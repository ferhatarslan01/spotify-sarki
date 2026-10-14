import { hostMedia } from './mediaHost.js';
import { publishTikTokVideo } from './bufferPost.js';
import { getTrackThumbnail, formatStreams } from './dailyChart.js';
import {
  tiktokEnabled,
  stripUrls,
  mediaName,
  tiktokFeaturePost,
  tiktokChartPost,
  tiktokListPost,
  chartDescription,
  chartArtists,
} from './tiktok.js';
import { withHashtags } from './hashtags.js';
import { renderVideo } from './videoEngine.js';

// TIKTOK_VIDEO=0 ise hareketli video kapatilir, sadece foto kartlar gider.
function videoEnabled() {
  return process.env.TIKTOK_VIDEO !== '0';
}

function norm(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function mainArtist(artist) {
  return artist.split(/ & | ft\.? | feat\.? /i)[0];
}

function matches(artist, title, foundArtist, foundTitle) {
  return norm(foundTitle).includes(norm(title)) && norm(foundArtist).includes(norm(mainArtist(artist)));
}

async function fromDeezer(artist, title) {
  const q = `artist:"${mainArtist(artist)}" track:"${title}"`;
  const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=10`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const hit = (data.data ?? []).find(
    (t) => t.preview && matches(artist, title, t.artist?.name ?? '', t.title ?? '')
  );
  return hit ? { url: hit.preview, source: 'deezer' } : null;
}

async function fromItunes(artist, title) {
  const term = `${mainArtist(artist)} ${title}`;
  const res = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=10&country=TR`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const hit = (data.results ?? []).find(
    (t) => t.previewUrl && matches(artist, title, t.artistName ?? '', t.trackName ?? '')
  );
  return hit ? { url: hit.previewUrl, source: 'itunes' } : null;
}

// Sarkinin 30 sn'lik halka acik onizlemesini bulur; hem sanatci hem sarki adi eslesmeli.
export async function findPreview(artist, title) {
  return (await fromDeezer(artist, title).catch(() => null)) ?? (await fromItunes(artist, title).catch(() => null));
}

async function fetchBuffer(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Gorsel indirilemedi: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function publishVideoBuffer({ kind, video, caption, note, artists = [] }) {
  const videoUrl = hostMedia(video, mediaName(kind, 'mp4'));

  const result = await publishTikTokVideo(process.env.BUFFER_TIKTOK_CHANNEL_ID, {
    text: withHashtags(stripUrls(caption), { kind, artists }),
    videoUrl,
  });
  if (result.message) throw new Error(result.message);

  console.log(
    `  TikTok videosu gönderildi (post id: ${result.post.id}, ${note}, ${(video.length / 1024).toFixed(0)} KB)`
  );
  return true;
}

// Tek sarki/olay icin hareketli sahne videosu. Hata verirse false doner, asla throw etmez.
// params: { kind, scene, palette, artist, title, coverUrl|trackUrl, caption, sceneData }
export async function tiktokSceneVideoPost({ kind, scene, palette, artist, title, coverUrl, trackUrl, caption, sceneData }) {
  if (!tiktokEnabled() || !videoEnabled()) return false;
  try {
    const preview = await findPreview(artist, title);
    if (!preview) {
      console.log(`  Ses önizlemesi bulunamadı (${artist} - ${title}).`);
      return false;
    }

    const coverSrc = coverUrl ?? (await getTrackThumbnail(trackUrl));
    if (!coverSrc) throw new Error('Kapak gorseli bulunamadi');
    const cover = await fetchBuffer(coverSrc);

    const video = await renderVideo({
      scene,
      palette,
      data: { artist, title, cover, audioUrl: preview.url, ...sceneData },
    });
    return await publishVideoBuffer({
      kind,
      video,
      caption: caption ?? `${artist} - ${title}`,
      note: `sahne: ${scene}, ses: ${preview.source}`,
      artists: [artist],
    });
  } catch (err) {
    console.error(`  TikTok video hatası (${kind}): ${err.message}`);
    return false;
  }
}

// Yeni sarki/yil donumu/trend olaylari bunu kullanir.
// Sahne bilgisi (scene) varsa hareketli video, yoksa (veya TIKTOK_VIDEO=0 ise) foto kart.
export async function tiktokSmartPost(params) {
  if (!tiktokEnabled()) return false;
  if (videoEnabled() && params.scene) return tiktokSceneVideoPost(params);
  return tiktokFeaturePost(params);
}

function headerParts(header) {
  const [region, period] = header.split(' ');
  const weekly = period === 'HAFTALIK';
  return { region, period, periodWord: weekly ? 'BU HAFTA' : 'BUGÜN', weekly };
}

// Chart icin: en ust 5 sarkiyla "geri sayim" videosu (5 -> 1), her sira kendi sesiyle.
export async function tiktokChartSmartPost({ kind, header, date, entries, maxRows = 8 }) {
  if (!tiktokEnabled()) return false;
  if (!videoEnabled()) return tiktokChartPost({ kind, header, date, entries, maxRows });

  try {
    const top = entries.slice(0, 5);
    const { region, period, periodWord, weekly } = headerParts(header);
    const items = [];
    for (const e of [...top].reverse()) {
      const coverUrl = await getTrackThumbnail(e.trackUrl).catch(() => null);
      if (!coverUrl) continue;
      const artist = e.artists.map((a) => a.name).join(' & ');
      const preview = await findPreview(e.artists[0].name, e.trackName);
      items.push({
        rank: e.rank,
        title: e.trackName,
        artist,
        sub: `${formatStreams(e.streams)} stream`,
        cover: await fetchBuffer(coverUrl),
        audioUrl: preview?.url ?? null,
      });
    }
    if (items.length < 3) throw new Error('Yeterli sarki gorseli bulunamadi');

    const video = await renderVideo({
      scene: 'top5',
      palette: 'studio',
      data: {
        items,
        intro: {
          l1: region === 'DÜNYA' ? `DÜNYADA ${periodWord}` : `${periodWord} EN ÇOK`,
          l2: 'DİNLENEN',
          big: String(items.length),
          small: 'ŞARKI',
        },
        pill: `${region} ${period} LİSTE`,
        outroHead: weekly ? "HAFTANIN TOP 5'İ" : "BUGÜNÜN TOP 5'İ",
        showRank: true,
        cta: 'Sence sıralama doğru mu? Yaz!',
      },
    });
    const fullHeader = `${header} TOP ${top.length}`;
    return await publishVideoBuffer({
      kind,
      video,
      caption: chartDescription(fullHeader, date, top),
      note: `top5, ${items.filter((i) => i.audioUrl).length} sesli`,
      artists: chartArtists(top),
    });
  } catch (err) {
    console.error(`  TikTok video hatası (${kind}): ${err.message}`);
    return false;
  }
}

function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso ?? '';
}

// Haftalik ozet: en son 5 yeni cikis, her biri kendi sesiyle.
// log: [{ artistName, songName, releaseDate, imageUrl }]; rows/description/artists foto kart yedegi icin.
export async function tiktokDigestPost({ log, header, subheader, rows, description, artists = [] }) {
  if (!tiktokEnabled()) return false;
  if (!videoEnabled()) return tiktokListPost({ kind: 'weekly-digest', header, subheader, rows, description, artists });

  try {
    const picked = log.filter((e) => e.imageUrl).slice(-5);
    const items = [];
    for (const [i, e] of picked.entries()) {
      const preview = await findPreview(e.artistName, e.songName);
      items.push({
        rank: i + 1,
        title: e.songName,
        artist: e.artistName,
        sub: formatDate(e.releaseDate),
        cover: await fetchBuffer(e.imageUrl),
        audioUrl: preview?.url ?? null,
      });
    }
    if (items.length < 2 || items.every((i) => !i.audioUrl)) throw new Error('Yeterli sesli sarki yok');

    const video = await renderVideo({
      scene: 'top5',
      palette: 'studio',
      data: {
        items,
        intro: { l1: 'BU HAFTA ÇIKAN', l2: 'YENİ ŞARKILAR', big: String(items.length), small: 'ŞARKI' },
        pill: 'HAFTANIN YENİLERİ',
        outroHead: 'BU HAFTANIN YENİLERİ',
        showRank: false,
        cta: 'En çok hangisini beğendin?',
      },
    });
    return await publishVideoBuffer({
      kind: 'weekly-digest',
      video,
      caption: description,
      note: `özet, ${items.length} şarkı`,
      artists,
    });
  } catch (err) {
    console.error(`  TikTok video hatası (weekly-digest): ${err.message}`);
    return false;
  }
}
