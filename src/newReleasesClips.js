// "Bu hafta çıkan yeni şarkılar" klipli liste: haftalık yayın kaydından (data/weeklyReleaseLog.json) son 7 günün (bugün-6 .. bugün) yayınları.
// Arka plan: Spotify Canvas (dikey döngü), yoksa iTunes resmi klip önizlemesi, ikisi de yoksa büyük kapak. Ses her zaman klipten ya da şarkı önizlemesinden.
// Sol sütunda sıra numarası yerine ÇIKIŞ GÜNÜ görünür (liste bir sıralama değil); en yeni şarkı en üstte ve en sonda (kahraman sahne).
import { readFile } from 'node:fs/promises';
import { getAccessToken } from './spotify.js';
import { fetchBackdrop } from './backdrop.js';
import { findSongAudio } from './artistSeries.js';
import { prepWeeklyClips, WEEKLY_CLIPS, weekRangeText } from './videoPrep.js';

const VERSION = /\b(remix|sped up|speed up|slowed|reverb|live|canlı|canli|instrumental|enstrümantal|acoustic|akustik|karaoke|edit|version|versiyon)\b/i;
const DAYS = ['PZR', 'PZT', 'SAL', 'ÇAR', 'PER', 'CUM', 'CMT'];
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const MIN_RELEASES = 5;

const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/[^a-z0-9]/g, '');
const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(d); // YYYY-MM-DD (Turkiye gunu)
const dayParts = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
};

export async function loadReleaseLog() {
  try {
    return JSON.parse(await readFile(new URL('../data/weeklyReleaseLog.json', import.meta.url), 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// Son `days` gunun yayinlari, surum/tekrar elenmis, en yeni once
export function recentReleases(log, { days = 6, today = ymd(new Date()) } = {}) {
  const since = ymd(new Date(Date.parse(`${today}T12:00:00Z`) - days * 86400e3));
  // Isbirligi sarkilar kayitta her sanatci icin ayri gecer: ayni gun + ayni sarki adi tek satir olur, sanatcilar birlestirilir
  const groups = new Map();
  const rows = log
    .filter((e) => e.releaseDate && e.releaseDate >= since && e.releaseDate <= today && !VERSION.test(e.songName))
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
  for (const e of rows) {
    const key = `${fold(e.songName)}|${e.releaseDate}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { ...e });
      continue;
    }
    if (!g.artistName.split(' & ').some((n) => fold(n) === fold(e.artistName))) g.artistName += ` & ${e.artistName}`;
    if (!/\/album\//.test(g.url ?? '') && /\/album\//.test(e.url ?? '')) g.url = e.url; // arama baglantisi yerine album baglantisi
  }
  return [...groups.values()];
}

async function trackIdOf(token, entry) {
  const albumId = (String(entry.url).match(/album\/([A-Za-z0-9]+)/) ?? [])[1];
  if (!albumId) return null;
  try {
    const r = await fetch(`https://api.spotify.com/v1/albums/${albumId}/tracks?limit=5&market=TR`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return null;
    const items = (await r.json()).items ?? [];
    const key = fold(entry.songName);
    return (items.find((t) => fold(t.name) === key) ?? items.find((t) => fold(t.name).includes(key.slice(0, 6))) ?? items[0])?.id ?? null;
  } catch {
    return null;
  }
}

// { prepared, picked, clipCount, canvasCount, text } hazirlar; yeterli yayin yoksa null
export async function prepareNewReleasesVideo(log, { today = ymd(new Date()), maxCandidates = 16 } = {}) {
  const candidates = recentReleases(log, { today }).slice(0, maxCandidates);
  if (candidates.length < MIN_RELEASES) return null;
  const N = Math.min(WEEKLY_CLIPS.N, candidates.length); // 5-10 satir; az sarkida sahne suresi uzar
  const layout = { ...WEEKLY_CLIPS, N, STEP: N >= 8 ? WEEKLY_CLIPS.STEP : 4.6 };

  let token = null;
  try {
    token = await getAccessToken();
  } catch {
    /* kimlik yoksa Canvas atlanir */
  }
  const found = [];
  for (const e of candidates) {
    const trackId = token ? await trackIdOf(token, e) : null;
    const b = await fetchBackdrop(e.artistName.split(/ & | ft\.? | feat\.? /i)[0], e.songName, trackId);
    console.log(`  ${b ? (b.kind === 'clip' ? 'klip  ' : 'Canvas') : 'kapak '}: ${e.artistName} - ${e.songName}`);
    found.push({ e, trackId, b });
  }
  // arka plani olanlar once, sonra en yeniler; secilenler yine en yeni -> eski siralanir
  const picked = [...found.filter((f) => f.b), ...found.filter((f) => !f.b)].slice(0, N).sort((a, b) => b.e.releaseDate.localeCompare(a.e.releaseDate));

  const entries = picked.map((f, i) => ({
    rank: i + 1,
    trackName: f.e.songName,
    artists: [{ name: f.e.artistName }],
    streams: 0,
    trackUrl: f.trackId ? `https://open.spotify.com/track/${f.trackId}` : f.e.url,
    releaseDate: f.e.releaseDate,
  }));
  const clips = {};
  const audioUrls = {};
  for (const [i, f] of picked.entries()) {
    const rank = i + 1;
    if (f.b) clips[rank] = f.b;
    if (!f.b || f.b.kind === 'canvas') {
      audioUrls[rank] = await findSongAudio(f.e.artistName.split(/ & | ft\.? | feat\.? /i)[0], f.e.songName);
      if (!audioUrls[rank]) throw new Error(`Ses bulunamadı: ${f.e.artistName} - ${f.e.songName}; sessiz sahneli video paylaşılmaz`);
    }
  }

  const endDmy = today.split('-').reverse().join('.');
  const prepared = await prepWeeklyClips({
    entries,
    clips,
    audioUrls,
    layout,
    header: { l1: 'BU HAFTA ÇIKAN', l2: 'YENİ ŞARKILAR', pill: weekRangeText(endDmy) },
    describe: (e) => {
      const p = dayParts(e.releaseDate);
      return { label: DAYS[p.wd], sub: e.artists[0].name, badge: `${p.d} ${MONTHS[p.m - 1]}` };
    },
  });
  return {
    prepared,
    picked: picked.map((f) => f.e),
    clipCount: picked.filter((f) => f.b?.kind === 'clip').length,
    canvasCount: picked.filter((f) => f.b?.kind === 'canvas').length,
    range: weekRangeText(endDmy),
  };
}

// X: 280 karakter; TikTok: hepsi tarihleriyle
export function newReleasesTexts(picked, range) {
  const line = (e) => `${e.artistName} – ${e.songName}`;
  const head = [`🆕 Bu hafta çıkan yeni şarkılar`, range, ''];
  let x = '';
  for (let n = Math.min(picked.length, 7); n >= 3; n--) {
    x = [...head, ...picked.slice(0, n).map(line), '', 'Hepsi videoda 👇'].join('\n');
    if (x.length <= 250) break;
  }
  const tiktok = [...head, ...picked.map(line), '', 'Her hafta yeni çıkanlar: takip et 🎧'].join('\n');
  return { x, tiktok };
}
