// Takip listesini genisletmek icin aday bulur: kworb Turkiye gunluk + haftalik listelerindeki, henuz takip edilmeyen sanatcilar.
// Turk sanatci filtresi (Spotify sanatci turleri artik API'den gelmiyor): Deezer'daki en populer sarkilarinin adlarinda
// Turkceye ozgu harflerin (ğ ş ı İ) orani + kworb liste adaylarinin sarki adlari. Sonucu GOZDEN GECIRIN: data/extraArtists.json.
// Kullanim: node tools/discoverArtists.mjs   (Spotify'a dokunmaz; Deezer ve kworb anahtarsizdir)
import { writeFile, readFile } from 'node:fs/promises';
import { artists as tracked } from '../src/artists.js';
import { fetchDailyChart } from '../src/dailyChart.js';
import { fetchWeeklyChart } from '../src/weeklyChart.js';
import { searchArtist, normName } from '../src/deezer.js';

const MAX_CANDIDATES = Number(process.env.MAX_CANDIDATES || 200);
const MIN_FRACTION = Number(process.env.MIN_TR_FRACTION || 0.25);
const TR_CHARS = /[ğşıİ]/;
// Elle duzeltmeler: otomatik harf orani kimi Turk sanatciyi eler (MANUAL_INCLUDE), vefat etmis sanatcilarin katalog yeniden
// yayinlari "yeni cikti" gurultusu yaratir (EXCLUDE). Yalnizca Deezer'da dogrulanan sanatcilar eklenir (Spotify kotasina yuk bindirmemek icin).
const MANUAL_INCLUDE = new Set(['Kalben', 'Burak Bulut', 'KARM6', 'Pınar Soykan', 'Pilli Bebek', 'Emre Fel', 'MERO', 'Selcan', 'Alroca']);
const EXCLUDE = new Set(['Müslüm Gürses', 'Ahmet Kaya', 'Ferdi Özbeğen', 'Kibariye', 'Tame Impala']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = async (url) => (await fetch(url, { signal: AbortSignal.timeout(15000) })).json();

const known = new Set(tracked.map((a) => a.id));
let previous = [];
try {
  previous = JSON.parse(await readFile(new URL('../data/extraArtists.json', import.meta.url), 'utf8'));
} catch {
  /* ilk calistirma */
}
const have = new Set([...known, ...previous.map((a) => a.id)]);

const [daily, weekly] = await Promise.all([fetchDailyChart(), fetchWeeklyChart()]);
const score = new Map(); // id -> { name, best, count, titles }
for (const [chart, w] of [[daily.entries, 1], [weekly.entries, 1.5]]) {
  for (const e of chart) {
    for (const a of e.artists) {
      if (have.has(a.id)) continue;
      const s = score.get(a.id) ?? { id: a.id, name: a.name, best: 999, count: 0, titles: [] };
      s.best = Math.min(s.best, e.rank);
      s.count += w;
      s.titles.push(e.trackName);
      score.set(a.id, s);
    }
  }
}
const candidates = [...score.values()].sort((x, y) => y.count - x.count || x.best - y.best).slice(0, MAX_CANDIDATES);
console.log(`Aday sanatci: ${score.size} (ilk ${candidates.length} taranacak). Takipteki: ${known.size}, ekstra (onceden): ${previous.length}\n`);

const found = [...previous];
const rows = [];
for (const c of candidates) {
  // Deezer'da bu sarkilarla eslesen sanatci (kimlik dogrulamasi: kworb listesindeki sarki adlari)
  let deezerId = null;
  for (const title of c.titles.slice(0, 3)) {
    const r = await getJson(`https://api.deezer.com/search?q=${encodeURIComponent(`${c.name} ${title}`)}&limit=8`).catch(() => ({ data: [] }));
    await sleep(260);
    const hit = (r.data ?? []).find((t) => normName(t.artist?.name) === normName(c.name));
    if (hit) {
      deezerId = hit.artist.id;
      break;
    }
  }
  let frac = 0;
  let n = 0;
  if (deezerId) {
    const top = await getJson(`https://api.deezer.com/artist/${deezerId}/top?limit=50`).catch(() => ({ data: [] }));
    await sleep(260);
    const titles = [...(top.data ?? []).map((t) => t.title_short), ...c.titles];
    n = titles.length;
    frac = n ? titles.filter((t) => TR_CHARS.test(t)).length / n : 0;
  } else {
    n = c.titles.length;
    frac = n ? c.titles.filter((t) => TR_CHARS.test(t)).length / n : 0;
  }
  const isTR = (frac >= MIN_FRACTION || MANUAL_INCLUDE.has(c.name)) && !EXCLUDE.has(c.name) && Boolean(deezerId);
  rows.push({ ...c, deezerId, frac, n, isTR });
  console.log(`${isTR ? '+' : '-'} ${c.name.padEnd(26)} en iyi #${String(c.best).padEnd(4)} TR-harf orani ${(frac * 100).toFixed(0).padStart(3)}% (${n} baslik) ${deezerId ? '' : '[Deezer yok]'}`);
  if (isTR) found.push({ name: c.name, id: c.id });
}
await writeFile(new URL('../data/extraArtists.json', import.meta.url), `${JSON.stringify(found, null, 2)}\n`, 'utf8');
console.log(`\nEklenen: ${found.length - previous.length} yeni, ${found.length} toplam. (Gozden gecirip yanlislari data/extraArtists.json'dan silin.)`);
