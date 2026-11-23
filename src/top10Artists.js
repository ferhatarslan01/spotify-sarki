// "Spotify Türkiye Top 10'da kim kaç şarkıyla?" klipli liste videosu.
// Kaynak: kworb Türkiye günlük listesi (src/dailyChart.js). Satırlar SANATÇI: şarkı sayısı çoktan aza, eşitlikte en iyi sıra önce.
// Aynı şarkılara sahip sanatçılar (ör. iki kişilik düet) tek satırda birleşir. Arka plan: Spotify Canvas -> resmi klip önizlemesi -> kapak.
// Ses her zaman şarkının önizlemesinden ya da klipten gelir. Satırın şarkısı: sanatçının en üst sıradaki, arka planı + sesi olan şarkısı.
import { fetchDailyChart } from './dailyChart.js';
import { fetchBackdrop } from './backdrop.js';
import { findSongAudio } from './artistSeries.js';
import { prepWeeklyClips, WEEKLY_CLIPS } from './videoPrep.js';

export const MIN_ROWS = 5;
const MAX_ROWS = 10;

const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

// entries: kworb günlük liste satırları (sıra artan). Dönen: [{ name, songs: [entry...] }] sıralı.
export function groupTop10(entries, topN = 10) {
  const byArtist = new Map();
  for (const e of entries.filter((x) => x.rank <= topN)) {
    for (const a of e.artists) {
      const g = byArtist.get(a.id) ?? { names: [a.name], songs: [] };
      g.songs.push(e);
      byArtist.set(a.id, g);
    }
  }
  // Aynı şarkı kümesine sahip sanatçıları birleştir (düetler)
  const merged = new Map();
  for (const g of byArtist.values()) {
    const key = g.songs.map((s) => s.trackId).join(',');
    const m = merged.get(key);
    if (m) m.names.push(...g.names);
    else merged.set(key, { names: [...g.names], songs: g.songs });
  }
  return [...merged.values()]
    .map((g) => ({ name: g.names.join(' & '), songs: g.songs }))
    .sort((a, b) => b.songs.length - a.songs.length || a.songs[0].rank - b.songs[0].rank);
}

// X (280 karakter) ve TikTok metinleri
export function top10Texts(groups, date) {
  const byCount = new Map();
  for (const g of groups) byCount.set(g.songs.length, [...(byCount.get(g.songs.length) ?? []), g]);
  const counts = [...byCount.keys()].sort((a, b) => b - a);
  const head = [`📊 Spotify Türkiye Top 10'da kim kaç şarkıyla?`, ''];
  const foot = ['', `📅 Liste: ${date} · Hepsi videoda 👇`];
  const xLines = (withRanks) =>
    counts.map((c) => {
      const gs = byCount.get(c);
      const names = gs.map((g) => (withRanks && c > 1 ? `${g.name} (${g.songs.map((s) => `#${s.rank}`).join(', ')})` : g.name)).join(', ');
      return `${c > 1 ? '🔥' : '•'} ${c} şarkı: ${names}`;
    });
  let x = [...head, ...xLines(true), ...foot].join('\n');
  if (x.length > 280) x = [...head, ...xLines(false), ...foot].join('\n');
  if (x.length > 280) x = [...head, ...counts.slice(0, 1).flatMap((c) => xLines(false).slice(0, 1)), ...foot].join('\n');
  const tiktok = [
    ...head,
    ...groups.map((g) => `${g.songs.length > 1 ? '🔥 ' : ''}${g.name} (${g.songs.length}): ${g.songs.map((s) => s.trackName).join(', ')}`),
    ...foot.slice(0, 1),
    `📅 Spotify Türkiye günlük listesi: ${date}`,
    'Her gün listeler: takip et 🎧',
  ].join('\n');
  return { x, tiktok };
}

// { prepared, groups, date, picked, canvasCount } hazırlar
// seconds: toplam süre (varsayılan 60 sn). Giriş/kapanış sabit; kahraman sahne 10 sn, kalan süre satırlara eşit bölünür.
export async function prepareTop10Video({ topN = 10, seconds = 60 } = {}) {
  const { date, entries } = await fetchDailyChart();
  const groups = groupTop10(entries, topN).slice(0, MAX_ROWS);
  if (groups.length < MIN_ROWS) throw new Error(`Top ${topN}'da yeterli sanatçı yok (${groups.length})`);
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
    let choice = null; // { song, b, audio }
    // 1) arka planı + sesi olan ilk şarkı, 2) yalnızca sesi olan (kapak arka plan), 3) sessiz ilk şarkı
    const probed = [];
    for (const song of g.songs) {
      const b = await backdropOf(song);
      const audio = !b || b.kind === 'canvas' ? await audioOf(song) : null;
      const ok = Boolean(b && (b.kind === 'clip' || audio));
      probed.push({ song, b, audio, ok });
      if (ok) break;
    }
    choice = probed.find((p) => p.ok);
    if (!choice) {
      for (const song of g.songs) {
        const audio = await audioOf(song);
        if (audio) {
          choice = { song, b: null, audio, ok: false };
          break;
        }
      }
    }
    if (!choice) choice = { song: g.songs[0], b: null, audio: null, ok: false };
    if (choice.b) clips[rank] = choice.b;
    if (choice.audio && (!choice.b || choice.b.kind === 'canvas')) audioUrls[rank] = choice.audio;
    picked.push(choice);
    console.log(`  ${choice.b ? (choice.b.kind === 'clip' ? 'klip  ' : 'Canvas') : 'kapak '}: ${g.name} (${g.songs.length} şarkı) -> #${choice.song.rank} ${choice.song.trackName}${choice.audio || choice.b?.kind === 'clip' ? '' : ' [SESSİZ]'}`);
  }

  const prepared = await prepWeeklyClips({
    entries: groups.map((g, i) => ({
      rank: i + 1,
      trackName: g.name,
      artists: [{ name: g.name }],
      streams: 0,
      trackUrl: picked[i].song.trackUrl,
    })),
    clips,
    audioUrls,
    layout,
    header: { l1: "TOP 10'DA", l2: 'KİM KAÇ ŞARKIYLA?', pill: `Spotify Türkiye · ${date}` },
    describe: (e) => {
      const g = groups[e.rank - 1];
      const sub = g.songs.length > 1 ? g.songs.map((s) => `#${s.rank}`).join(' · ') : `#${g.songs[0].rank} · ${cut(g.songs[0].trackName, 20)}`;
      return { sub, badge: `${g.songs.length} ŞARKI` };
    },
  });
  return { prepared, groups, date, picked, canvasCount: picked.filter((p) => p.b?.kind === 'canvas').length, clipCount: picked.filter((p) => p.b?.kind === 'clip').length };
}
