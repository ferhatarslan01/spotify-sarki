// "GTA 6 şarkılarında şu an en çok dinlenenler" (ya da toplam dinlenmeye göre) klipli liste videosu.
// Kaynak: data/gtaSongs.json (tools/gtaScan.mjs üretir): GTA VI şarkı listesi (gtabase, resmî değil) + Spotify kimlikleri + kworb dinlenmeleri.
// Arka plan: Spotify Canvas -> resmî klip önizlemesi -> kapak. Ses şarkı önizlemesidir.
import { readFile } from 'node:fs/promises';
import { fetchBackdrop } from './backdrop.js';
import { findSongAudio } from './artistSeries.js';
import { prepWeeklyClips, WEEKLY_CLIPS } from './videoPrep.js';

const DATA = new URL('../data/gtaSongs.json', import.meta.url);
const MAX_AGE_H = Number(process.env.GTA_DATA_MAX_AGE_H ?? 36); // veri bundan eskiyse uyarı verilir

const trNum = (n) => new Intl.NumberFormat('tr-TR').format(Math.round(n));
// 5,0 Mn / 842 B / 1,15 Mr
const short = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2).replace('.', ',')} Mr` : n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',')} Mn` : `${Math.round(n / 1000)} B`);

// "(feat. ...)", "[From GTAVI: ...]", "- From ...", "(Remastered)" gibi ekleri at
export const cleanTitle = (s) =>
  String(s)
    .replace(/\s*[([]\s*(feat\.?|ft\.?|from|with|remaster)[^)\]]*[)\]]/gi, '')
    .replace(/\s*-\s*(from|remaster|single|radio)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
const artistNames = (s) => s.artists.map((a) => a.name).filter((n) => !/grand theft auto/i.test(n));

export async function loadGtaSongs() {
  const j = JSON.parse(await readFile(DATA, 'utf-8'));
  const ageH = (Date.now() - new Date(j.scannedAt).getTime()) / 3600e3;
  if (ageH > MAX_AGE_H) console.error(`  UYARI: GTA verisi ${ageH.toFixed(0)} saat önce taranmış; güncellemek için: node --env-file=.env tools/gtaScan.mjs`);
  return j;
}

// by: 'daily' | 'total'
export function rankGta(songs, by = 'daily', n = 10) {
  return songs
    .filter((s) => s.status === 'ok' && s[by] > 0)
    .sort((a, b) => b[by] - a[by])
    .slice(0, n);
}

export function gtaTexts(ranked, by) {
  const daily = by === 'daily';
  const head = [daily ? '🎮 GTA 6 şarkılarında şu an en çok dinlenenler' : '🎮 GTA 6 şarkılarının en çok dinlenenleri', daily ? '(Spotify, günlük dinlenme)' : '(Spotify, toplam dinlenme)', ''];
  const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
  const lines = (count, len) => ranked.slice(0, count).map((s, i) => `${i + 1}. ${cut(cleanTitle(s.name), len)} · ${short(s[by])}`);
  let x = '';
  for (const [count, len] of [[10, 22], [9, 22], [8, 22], [7, 22], [6, 22]]) {
    x = [...head, ...lines(count, len), '', 'Hepsi videoda 👇'].join('\n');
    if (x.length <= 280) break;
  }
  const tiktok = [
    ...head,
    ...ranked.map((s, i) => `${i + 1}. ${cleanTitle(s.name)} – ${artistNames(s).slice(0, 2).join(', ')}: ${trNum(s[by])} ${daily ? 'günlük' : 'toplam'} dinlenme${daily ? ` (toplam ${short(s.total)})` : ''}`),
    '',
    'Şarkı listesi GTA 6 hayran veritabanından (resmî değildir). Dinlenmeler Spotify, kworb verisi.',
    'Her gün listeler: takip et 🎧  #GTA6 #GTAVI',
  ].join('\n');
  return { x, tiktok };
}

// { prepared, groups, date, picked, canvasCount, clipCount, ranked }
export async function prepareGtaVideo({ by = 'daily', n = 10, seconds = 60 } = {}) {
  const data = await loadGtaSongs();
  const ranked = rankGta(data.songs, by, n);
  if (ranked.length < 5) throw new Error(`Yeterli şarkı yok (${ranked.length})`);
  const N = ranked.length;
  const HERO_LEN = 10;
  const STEP = Math.max(3, (seconds - WEEKLY_CLIPS.INTRO - WEEKLY_CLIPS.TAIL - HERO_LEN) / (N - 1));
  const layout = { ...WEEKLY_CLIPS, N, STEP, HERO_LEN };

  const clips = {};
  const audioUrls = {};
  const picked = [];
  for (const [i, s] of ranked.entries()) {
    const rank = i + 1;
    const a1 = artistNames(s)[0] ?? s.artists[0].name;
    const title = cleanTitle(s.name);
    const b = await fetchBackdrop(a1, title, s.spotifyId);
    let audio = null;
    if (!b || b.kind === 'canvas') audio = await findSongAudio(a1, title);
    if (b) clips[rank] = b;
    if (audio) audioUrls[rank] = audio;
    picked.push({ b, audio });
    console.log(`  ${b ? (b.kind === 'clip' ? 'klip  ' : 'Canvas') : 'kapak '}: ${a1} - ${title} (${trNum(s[by])})${audio || b?.kind === 'clip' ? '' : ' [SESSİZ]'}`);
  }

  const daily = by === 'daily';
  const prepared = await prepWeeklyClips({
    entries: ranked.map((s, i) => ({ rank: i + 1, trackName: cleanTitle(s.name), artists: [{ name: artistNames(s)[0] ?? '' }], streams: 0, trackUrl: `https://open.spotify.com/track/${s.spotifyId}` })),
    clips,
    audioUrls,
    layout,
    header: { l1: 'GTA 6 ŞARKILARI', l2: daily ? 'ŞU AN EN ÇOK DİNLENEN' : 'EN ÇOK DİNLENEN', pill: daily ? 'Spotify • günlük dinlenme' : 'Spotify • toplam dinlenme' },
    describe: (e) => {
      const s = ranked[e.rank - 1];
      const a = artistNames(s)[0] ?? '';
      return { sub: `${a.length > 16 ? `${a.slice(0, 15)}…` : a} • ${daily ? 'toplam' : 'bugün'} ${short(daily ? s.total : s.daily)}`, badge: short(s[by]) };
    },
  });
  return {
    prepared,
    ranked,
    groups: ranked.map((s) => ({ name: artistNames(s)[0] ?? s.artists[0].name })),
    date: new Date(data.scannedAt).toISOString().slice(0, 10).split('-').reverse().join('.'),
    picked,
    canvasCount: picked.filter((p) => p.b?.kind === 'canvas').length,
    clipCount: picked.filter((p) => p.b?.kind === 'clip').length,
  };
}
