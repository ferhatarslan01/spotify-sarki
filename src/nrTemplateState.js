// "Yeni cikti" sablon donusu: hangi sablonlarin son kullanildigini ve hangi sarkiya hangisinin verildigini tutar (data/nrTemplateState.json).
// Sarki daha once atandiysa ayni sablon verilir; yoksa en uzun suredir kullanilmayan sablon secilir (bir oncekiyle ayni olmaz).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chooseLeastRecentTemplate, newReleasePool, newReleaseVariantFor } from './videoPrep.js';

const STATE_PATH = process.env.NR_STATE_FILE || fileURLToPath(new URL('../data/nrTemplateState.json', import.meta.url));
const MAX_HISTORY = 60;
const MAX_ASSIGNED = 300;

async function load() {
  try {
    const raw = JSON.parse(await readFile(STATE_PATH, 'utf-8'));
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
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf-8');
}

// Bu sarki icin sablon adi. NR_VARIANTS=0 ya da kimlik yoksa 'drop'; durum okunamazsa kimlige dayali sabit secime duser.
export async function nextNewReleaseVariant(seed) {
  if (process.env.NR_VARIANTS === '0' || !seed) return 'drop';
  const pool = newReleasePool();
  if (pool.length === 0) return 'drop';
  try {
    const state = await load();
    const prior = state.assigned[seed];
    if (prior && pool.includes(prior)) return prior;
    return chooseLeastRecentTemplate(seed, pool, state.history) ?? 'drop';
  } catch (err) {
    console.error(`  Şablon durumu okunamadı (${err.message}), kimliğe göre seçiliyor.`);
    return newReleaseVariantFor(seed);
  }
}

// Gercekte kullanilan sablonu kaydeder (hazirlik hata verip DROP'a dusulduyse 'drop' kaydedilir).
export async function rememberNewReleaseVariant(seed, used) {
  if (process.env.NR_VARIANTS === '0' || !seed || !used) return;
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
}
