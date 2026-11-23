// "Türkiye'de günün en çok dinlenen 10 sanatçısı ve dinlenme sayıları" klipli liste videosu.
// Kaynak: kworb Türkiye günlük listesi (Top 200, src/dailyChart.js). Sanatçı toplamı = o sanatçının listedeki TÜM şarkılarının günlük dinlenmesi
// (düetlerde her iki sanatçıya da yazılır, Spotify'ın sanatçı sayımı gibi). Liste dışı (200 altı) şarkılar sayılmaz: metinde bu açıkça yazılır.
// Arka plan: Spotify Canvas (sanatçının en çok dinlenen, Canvas'ı olan şarkısı) -> resmî klip önizlemesi -> kapak. Ses şarkı önizlemesidir.
import { fetchDailyChart } from './dailyChart.js';
import { fetchBackdrop } from './backdrop.js';
import { findSongAudio } from './artistSeries.js';
import { prepWeeklyClips, WEEKLY_CLIPS } from './videoPrep.js';

export const TOP_N = 10;
const MAX_PROBE = 3; // Canvas/klip aranan en çok dinlenen şarkı sayısı (sanatçı başına)

const trNum = (n) => new Intl.NumberFormat('tr-TR').format(Math.round(n)); // 2.568.310
// Kısa biçim: 2,57 Mn / 845 B
const short = (n, digits = 2) => (n >= 1e6 ? `${(n / 1e6).toFixed(digits).replace('.', ',')} Mn` : `${Math.round(n / 1000)} B`);

// entries: kworb günlük satırları. Dönen: [{ id, name, streams, songs: [entry...] (dinlenmeye göre azalan) }] toplam dinlenmeye göre azalan
export function aggregateArtists(entries) {
  const byId = new Map();
  for (const e of entries) {
    for (const a of e.artists) {
      const g = byId.get(a.id) ?? { id: a.id, name: a.name, streams: 0, songs: [] };
      g.streams += e.streams;
      g.songs.push(e);
      byId.set(a.id, g);
    }
  }
  return [...byId.values()].map((g) => ({ ...g, songs: g.songs.sort((a, b) => b.streams - a.streams) })).sort((a, b) => b.streams - a.streams);
}

// X (280 karakter) ve TikTok metinleri
export function topArtistsTexts(groups, date) {
  const head = [`📊 Türkiye'de günün en çok dinlenen ${groups.length} sanatçısı`, ''];
  const foot = (extra) => ['', `📅 Spotify günlük liste · ${date}${extra}`];
  const lines = (digits) => groups.map((g, i) => `${i + 1}. ${g.name} · ${short(g.streams, digits)}`);
  let x = [...head, ...lines(2), ...foot('')].join('\n');
  if (x.length > 280) x = [...head, ...lines(1), ...foot('')].join('\n');
  if (x.length > 280) x = [...head.slice(0, 1), ...lines(1), `📅 ${date}`].join('\n');
  const tiktok = [
    ...head,
    ...groups.map((g, i) => `${i + 1}. ${g.name}: ${trNum(g.streams)} dinlenme (${g.songs.length} şarkı)`),
    '',
    `📅 Spotify Türkiye günlük Top 200 listesi, ${date}: sanatçının listedeki tüm şarkılarının o günkü dinlenme toplamı.`,
    'Her gün listeler: takip et 🎧',
  ].join('\n');
  return { x, tiktok };
}

// { prepared, groups, date, picked, canvasCount, clipCount } hazırlar
export async function prepareTopArtistsVideo({ n = TOP_N, seconds = 60 } = {}) {
  const { date, entries } = await fetchDailyChart();
  const groups = aggregateArtists(entries).slice(0, n);
  if (groups.length < 5) throw new Error(`Yeterli sanatçı yok (${groups.length})`);
  const N = groups.length;
  const HERO_LEN = 10;
  const STEP = Math.max(3, (seconds - WEEKLY_CLIPS.INTRO - WEEKLY_CLIPS.TAIL - HERO_LEN) / (N - 1));
  const layout = { ...WEEKLY_CLIPS, N, STEP, HERO_LEN };

  const backdropCache = new Map();
  const backdropOf = async (song) => {
    if (!backdropCache.has(song.trackId)) backdropCache.set(song.trackId, await fetchBackdrop(song.artists[0].name, song.trackName, song.trackId));
    return backdropCache.get(song.trackId);
  };
  const audioCache = new Map();
  const audioOf = async (song) => {
    if (!audioCache.has(song.trackId)) audioCache.set(song.trackId, await findSongAudio(song.artists[0].name, song.trackName));
    return audioCache.get(song.trackId);
  };

  const clips = {};
  const audioUrls = {};
  const picked = [];
  for (const [i, g] of groups.entries()) {
    const rank = i + 1;
    // 1) arka planı + sesi olan ilk şarkı, 2) yalnızca sesi olan (kapak arka plan), 3) sessiz ilk şarkı
    const cands = g.songs.slice(0, MAX_PROBE);
    let choice = null;
    for (const song of cands) {
      const b = await backdropOf(song);
      const audio = !b || b.kind === 'canvas' ? await audioOf(song) : null;
      if (b && (b.kind === 'clip' || audio)) {
        choice = { song, b, audio };
        break;
      }
    }
    if (!choice) {
      for (const song of cands) {
        const audio = await audioOf(song);
        if (audio) {
          choice = { song, b: null, audio };
          break;
        }
      }
    }
    if (!choice) choice = { song: g.songs[0], b: null, audio: null };
    if (choice.b) clips[rank] = choice.b;
    if (choice.audio && (!choice.b || choice.b.kind === 'canvas')) audioUrls[rank] = choice.audio;
    picked.push(choice);
    console.log(`  ${choice.b ? (choice.b.kind === 'clip' ? 'klip  ' : 'Canvas') : 'kapak '}: ${g.name} (${trNum(g.streams)}) -> ${choice.song.trackName}${choice.audio || choice.b?.kind === 'clip' ? '' : ' [SESSİZ]'}`);
  }

  const prepared = await prepWeeklyClips({
    entries: groups.map((g, i) => ({ rank: i + 1, trackName: g.name, artists: [{ name: g.name }], streams: 0, trackUrl: picked[i].song.trackUrl })),
    clips,
    audioUrls,
    layout,
    header: { l1: 'EN ÇOK DİNLENEN', l2: `${N} SANATÇI`, pill: `Türkiye günlük • ${date}` },
    describe: (e) => {
      const g = groups[e.rank - 1];
      return { sub: `${trNum(g.streams)} dinlenme`, badge: `${g.songs.length} ŞARKI` };
    },
  });
  return { prepared, groups, date, picked, canvasCount: picked.filter((p) => p.b?.kind === 'canvas').length, clipCount: picked.filter((p) => p.b?.kind === 'clip').length };
}
