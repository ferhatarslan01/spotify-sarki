// GTA VI şarkı listesini (gtabase.com: radyolar + albüm) okur; her şarkı için Spotify kimliğini bulur ve kworb sanatçı sayfasından
// toplam + günlük dinlenmeyi alır. Sonuç data/gtaSongs.json (src/gtaTop.js bu dosyadan video üretir).
// Kullanım: node --env-file=.env tools/gtaScan.mjs        (yaklaşık 5 dk; Spotify'a ~300 arama, kworb'a ~200 sayfa)
// Not: şarkı listesi hayran sitesinden (gtabase) gelir; resmî değildir. Eşleşmeyen şarkılar atlanır (eksikler dosyada "status" ile işaretlenir).
import { writeFile } from 'node:fs/promises';
import { getAccessToken } from '../src/spotify.js';

const SOURCE = 'https://www.gtabase.com/gta-6/soundtrack';
const OUT = new URL('../data/gtaSongs.json', import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/[^a-z0-9]/g, '');
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const res = await fetch(SOURCE, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30_000) });
if (!res.ok) throw new Error(`gtabase alınamadı: ${res.status}`);
const html = (await res.text()).replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, '');
const lines = decode(html.replace(/<[^>]+>/g, '\n'))
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);

// "N / Şarkı / Sanatçı (yıl) / Play" dörtlüleri; bölüm adı "# / Track" başlığının hemen öncesindeki satırdır
const entries = [];
let section = '';
for (let i = 0; i < lines.length - 3; i++) {
  if (/^\d{1,3}$/.test(lines[i]) && lines[i + 3] === 'Play' && /\(\d{4}\)\s*$/.test(lines[i + 2])) {
    entries.push({ title: lines[i + 1], artist: lines[i + 2].replace(/\s*\(\d{4}\)\s*$/, ''), year: Number((lines[i + 2].match(/\((\d{4})\)\s*$/) ?? [])[1]), section });
    i += 3;
  } else if (lines[i + 1] === '#' && lines[i + 2] === 'Track') section = lines[i];
}
console.log(`okunan şarkı: ${entries.length}`);
if (entries.length < 50) throw new Error('Şarkı listesi okunamadı (sayfa yapısı değişmiş olabilir).');

const token = await getAccessToken();
async function spotifySearch(q) {
  for (let k = 0; k < 3; k++) {
    const r = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=5&market=US`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
    if (r.ok) return (await r.json()).tracks.items;
    if (r.status === 429) await sleep(5000 * (k + 1));
    else return [];
  }
  return [];
}
const kwCache = new Map();
async function kworb(artistId) {
  if (kwCache.has(artistId)) return kwCache.get(artistId);
  const r = await fetch(`https://kworb.net/spotify/artist/${artistId}_songs.html`, { signal: AbortSignal.timeout(20_000) });
  let rows = [];
  if (r.ok) {
    rows = [...(await r.text()).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
      .map((m) => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => decode(c[1].replace(/<[^>]+>/g, '').trim())))
      .filter((c) => c.length >= 3 && /^[\d,]+$/.test(c[1] ?? ''))
      .map((c) => ({ name: c[0], total: Number(c[1].replace(/,/g, '')), daily: Number((c[2] ?? '0').replace(/,/g, '')) }));
  }
  kwCache.set(artistId, rows);
  await sleep(250);
  return rows;
}

const songs = [];
const seen = new Set();
for (const e of entries) {
  const first = e.artist.split(/ feat\.? | ft\.? | & |, | x | ft | feat /i)[0];
  const items = await spotifySearch(`track:${e.title} artist:${first}`);
  const t = items.find((x) => fold(x.name).startsWith(fold(e.title).slice(0, 8)) || fold(e.title).startsWith(fold(x.name).slice(0, 8)));
  if (!t) {
    songs.push({ ...e, status: 'spotify-yok' });
    continue;
  }
  if (seen.has(t.id)) continue; // aynı şarkı iki bölümde geçebilir
  seen.add(t.id);
  const rows = await kworb(t.artists[0].id);
  const row = rows.find((r) => fold(r.name) === fold(t.name)) ?? rows.find((r) => fold(r.name).startsWith(fold(t.name).slice(0, 10)));
  songs.push({
    ...e,
    spotifyId: t.id,
    name: t.name,
    artists: t.artists.map((a) => ({ id: a.id, name: a.name })),
    total: row?.total ?? null,
    daily: row?.daily ?? null,
    status: row ? 'ok' : 'kworb-yok',
  });
  await sleep(120);
}
await writeFile(OUT, JSON.stringify({ scannedAt: new Date().toISOString(), source: SOURCE, songs }, null, 2));
const ok = songs.filter((s) => s.status === 'ok').length;
console.log(`yazıldı: ${songs.length} kayıt, ${ok} şarkının dinlenmesi bulundu (data/gtaSongs.json)`);
