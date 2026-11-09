// Tek seferlik sanatci serisi: her sanatcinin Spotify'da TOPLAM en cok dinlenen 7 sarkisi, arkada orijinal klipli liste videosu.
// Siralama ve kimlikler data/artistSeries.json'da. Klipler iTunes resmi klip onizlemeleridir (src/clipSource.js).
import { readFile } from 'node:fs/promises';
import { fetchArtistTopSongs, fmtStreamsTR } from './artistTopSongs.js';
import { fetchBackdrop } from './backdrop.js';
import { prepWeeklyClips, ARTIST_CLIPS } from './videoPrep.js';
import { findPreview } from './tiktokVideo.js';

// { start: 'YYYY-MM-DD' (Turkiye gunu), artists: [{ key, name, id }] }
export async function loadSeriesConfig() {
  const raw = await readFile(new URL('../data/artistSeries.json', import.meta.url), 'utf-8');
  return JSON.parse(raw);
}

export async function loadSeries() {
  return (await loadSeriesConfig()).artists;
}

const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase();
const baseTitle = (t) => fold(t).replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9]/g, '');

// Yedek ses onizlemesi: sanatci sarkida yalnizca KONUK olabilir (ana sanatci baska), bu yuzden Deezer'da katkida bulunanlara bakilir.
// Kisa/yaygin basliklarda (ornek "Dua") baslik birebir eslesmeli; sanatci katkida bulunanlar arasinda olmali.
async function previewByContributor(artistName, title) {
  const q = encodeURIComponent(`${artistName} ${title}`);
  const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=20`, { signal: AbortSignal.timeout(15_000) });
  const list = (await res.json()).data ?? [];
  const want = baseTitle(title);
  for (const t of list) {
    if (!t.preview) continue;
    const got = baseTitle(t.title_short ?? t.title);
    if (got !== want && !(want.length >= 6 && (got.includes(want) || want.includes(got)))) continue;
    if (fold(t.artist?.name).includes(fold(artistName))) return t.preview;
    const full = await (await fetch(`https://api.deezer.com/track/${t.id}`, { signal: AbortSignal.timeout(15_000) })).json();
    if ((full.contributors ?? []).some((c) => fold(c.name).includes(fold(artistName)))) return full.preview ?? t.preview;
  }
  return null;
}

export async function findSongAudio(artistName, title) {
  const normal = (await findPreview(artistName, title))?.url ?? null;
  if (normal) return normal;
  return (await previewByContributor(artistName, title).catch(() => null)) ?? null;
}

// { songs, clips, audioUrls } hazirlar ve render girdisini dondurur
export async function prepareArtistVideo(artist) {
  const songs = await fetchArtistTopSongs(artist.id, artist.name, { n: ARTIST_CLIPS.N });
  if (songs.length < ARTIST_CLIPS.N) throw new Error(`${artist.name}: yalnizca ${songs.length} sarki bulundu`);
  const clips = {};
  const audioUrls = {};
  for (const s of songs) {
    const b = await fetchBackdrop(artist.name, s.trackName, s.trackId);
    if (b) {
      clips[s.rank] = b;
      console.log(`  ${b.kind === 'clip' ? 'klip' : 'Canvas'}: #${s.rank} ${s.trackName}`);
    } else {
      console.log(`  arka plan YOK: #${s.rank} ${s.trackName}`);
    }
    // Canvas'in sesi yok; resmi klibi olmayan her sirada sarki onizlemesi gerekir
    if (!b || b.kind === 'canvas') {
      audioUrls[s.rank] = await findSongAudio(artist.name, s.trackName);
      if (!audioUrls[s.rank]) console.log(`    (SES BULUNAMADI: ${s.trackName})`);
    }
  }
  const silent = songs.filter((s) => clips[s.rank]?.kind !== 'clip' && !audioUrls[s.rank]).map((s) => `#${s.rank} ${s.trackName}`);
  if (silent.length) throw new Error(`${artist.name}: ses bulunamayan sahne var (${silent.join(', ')}); sessiz video paylasilmaz`);
  const prepared = await prepWeeklyClips({
    entries: songs,
    clips,
    audioUrls,
    layout: ARTIST_CLIPS,
    header: { l1: artist.name.toUpperCase(), l2: `EN ÇOK DİNLENEN ${ARTIST_CLIPS.N} ŞARKI`, pill: 'Spotify · tüm zamanlar' },
    describe: (e) => ({ sub: `${fmtStreamsTR(e.streams)} dinlenme`, badge: '' }),
  });
  return { prepared, songs, clipCount: Object.values(clips).filter((c) => c.kind === 'clip').length, canvasCount: Object.values(clips).filter((c) => c.kind === 'canvas').length };
}

// X: 280 karakter (yalnizca sarki adlari); TikTok: dinlenme sayilariyla.
export function artistSeriesTexts(artist, songs) {
  const head = [`🎵 ${artist.name}: en çok dinlenen ${songs.length} şarkı`, '(Spotify, tüm zamanlar)', ''];
  let x = '';
  for (let n = songs.length; n >= 3; n--) {
    x = [...head, ...songs.slice(0, n).map((s) => `${s.rank}. ${s.trackName}`), '', 'Hepsi videoda 👇'].join('\n');
    if (x.length <= 250) break;
  }
  const tiktok = [...head, ...songs.map((s) => `${s.rank}. ${s.trackName} (${fmtStreamsTR(s.streams)})`), '', `Sıradaki sanatçı için takipte kal 🎧`].join('\n');
  return { x, tiktok };
}
