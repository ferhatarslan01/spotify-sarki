// Sablon donusu: hangi sablonlarin son kullanildigini ve hangi sarkiya hangisinin verildigini tutar.
//  - "Yeni cikti" ailesi: data/nrTemplateState.json   (NR_STATE_FILE, NR_VARIANTS=0 kapatir, NR_ONLY havuzu kisitlar)
//  - "Yukselen sarki" ailesi: data/riseTemplateState.json (RISE_STATE_FILE, RISE_VARIANTS=0 kapatir, RISE_ONLY havuzu kisitlar)
//  - "Haftalik liste" ailesi: data/weeklyTemplateState.json (WEEKLY_STATE_FILE, WEEKLY_VARIANTS=0 kapatir, WEEKLY_ONLY havuzu kisitlar)
//  - "Gunluk Top 5" ailesi: data/dailyTemplateState.json (DAILY_STATE_FILE, DAILY_VARIANTS=0 kapatir, DAILY_ONLY havuzu kisitlar)
// Sarki daha once atandiysa ayni sablon verilir; yoksa en uzun suredir kullanilmayan sablon secilir (bir oncekiyle ayni olmaz).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chooseLeastRecentTemplate, newReleasePool, newReleaseVariantFor, risePool, riseVariantFor, weeklyPool, weeklyVariantFor, dailyPool, dailyVariantFor } from './videoPrep.js';

const MAX_HISTORY = 60;
const MAX_ASSIGNED = 300;

function makeRotation({ file, off, pool, fallback, defaultName }) {
  async function load() {
    try {
      const raw = JSON.parse(await readFile(file(), 'utf-8'));
      return { history: Array.isArray(raw.history) ? raw.history : [], assigned: raw.assigned && typeof raw.assigned === 'object' ? raw.assigned : {} };
    } catch (err) {
      if (err.code === 'ENOENT') return { history: [], assigned: {} };
      throw err;
    }
  }

  async function save(state) {
    const keys = Object.keys(state.assigned);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ASSIGNED))) delete state.assigned[k];
    state.history = state.history.slice(-MAX_HISTORY);
    await writeFile(file(), `${JSON.stringify(state, null, 2)}\n`, 'utf-8');
  }

  return {
    // Bu sarki icin sablon adi. Kapaliysa ya da kimlik yoksa varsayilan; durum okunamazsa kimlige dayali sabit secime duser.
    async next(seed) {
      if (off() || !seed) return defaultName;
      const names = pool();
      if (names.length === 0) return defaultName;
      try {
        const state = await load();
        const prior = state.assigned[seed];
        if (prior && names.includes(prior)) return prior;
        return chooseLeastRecentTemplate(seed, names, state.history) ?? defaultName;
      } catch (err) {
        console.error(`  Şablon durumu okunamadı (${err.message}), kimliğe göre seçiliyor.`);
        return fallback(seed);
      }
    },
    // Gercekte kullanilan sablonu kaydeder (hazirlik hata verip varsayilana dusulduyse o kaydedilir).
    async remember(seed, used) {
      if (off() || !seed || !used) return;
      try {
        const state = await load();
        if (state.assigned[seed] === used) return; // ayni sarki yeniden denendi: sayaci ilerletme
        state.history.push(used);
        delete state.assigned[seed];
        state.assigned[seed] = used;
        await save(state);
      } catch (err) {
        console.error(`  Şablon durumu kaydedilemedi: ${err.message}`);
      }
    },
  };
}

const nr = makeRotation({
  file: () => process.env.NR_STATE_FILE || fileURLToPath(new URL('../data/nrTemplateState.json', import.meta.url)),
  off: () => process.env.NR_VARIANTS === '0',
  pool: newReleasePool,
  fallback: newReleaseVariantFor,
  defaultName: 'drop',
});

const rise = makeRotation({
  file: () => process.env.RISE_STATE_FILE || fileURLToPath(new URL('../data/riseTemplateState.json', import.meta.url)),
  off: () => process.env.RISE_VARIANTS === '0',
  pool: risePool,
  fallback: riseVariantFor,
  defaultName: 'rise',
});

const weekly = makeRotation({
  file: () => process.env.WEEKLY_STATE_FILE || fileURLToPath(new URL('../data/weeklyTemplateState.json', import.meta.url)),
  off: () => process.env.WEEKLY_VARIANTS === '0',
  pool: weeklyPool,
  fallback: weeklyVariantFor,
  defaultName: 'board',
});

const daily = makeRotation({
  file: () => process.env.DAILY_STATE_FILE || fileURLToPath(new URL('../data/dailyTemplateState.json', import.meta.url)),
  off: () => process.env.DAILY_VARIANTS === '0',
  pool: dailyPool,
  fallback: dailyVariantFor,
  defaultName: 'board',
});

export const nextNewReleaseVariant = nr.next;
export const rememberNewReleaseVariant = nr.remember;
export const nextRiseVariant = rise.next;
export const rememberRiseVariant = rise.remember;
export const nextWeeklyVariant = weekly.next;
export const rememberWeeklyVariant = weekly.remember;
export const nextDailyVariant = daily.next;
export const rememberDailyVariant = daily.remember;
