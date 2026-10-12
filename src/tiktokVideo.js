import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderFeatureCard, renderListCard } from './tiktokCard.js';
import { hostMedia } from './mediaHost.js';
import { publishTikTokVideo } from './bufferPost.js';
import { getTrackThumbnail, formatStreams } from './dailyChart.js';
import {
  tiktokEnabled,
  stripUrls,
  mediaName,
  tiktokFeaturePost,
  tiktokChartPost,
  buildChartRows,
  chartDescription,
} from './tiktok.js';

const execFileP = promisify(execFile);

const CLIP_SECONDS = 20;

// TIKTOK_VIDEO=0 ise sesli video kapatilir, sadece foto kartlar gider.
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

// Dikey kart + ses -> 1080x1920 MP4 (bytes)
export async function makeVideo({ cardJpeg, audioUrl, seconds = CLIP_SECONDS }) {
  const dir = await mkdtemp(join(tmpdir(), 'ttvideo-'));
  try {
    const img = join(dir, 'card.jpg');
    const aud = join(dir, 'audio.mp3');
    const out = join(dir, 'out.mp4');

    await writeFile(img, cardJpeg);
    const res = await fetch(audioUrl, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Ses indirilemedi: ${res.status}`);
    await writeFile(aud, Buffer.from(await res.arrayBuffer()));

    await execFileP('ffmpeg', [
      '-y',
      '-loop', '1',
      '-framerate', '30',
      '-i', img,
      '-i', aud,
      '-t', String(seconds),
      '-vf', 'scale=1080:1920,format=yuv420p',
      '-c:v', 'libx264',
      '-tune', 'stillimage',
      '-crf', '28',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-af', `afade=t=in:st=0:d=0.4,afade=t=out:st=${seconds - 2.5}:d=2.5`,
      '-movflags', '+faststart',
      '-shortest',
      out,
    ]);

    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function publishVideoBuffer({ kind, video, caption, note }) {
  const videoUrl = hostMedia(video, mediaName(kind, 'mp4'));

  const result = await publishTikTokVideo(process.env.BUFFER_TIKTOK_CHANNEL_ID, {
    text: stripUrls(caption),
    videoUrl,
  });
  if (result.message) throw new Error(result.message);

  console.log(
    `  TikTok videosu gönderildi (post id: ${result.post.id}, ${note}, ${(video.length / 1024).toFixed(0)} KB)`
  );
  return true;
}

async function publishVideo({ kind, cardJpeg, audioUrl, caption, source }) {
  const video = await makeVideo({ cardJpeg, audioUrl });
  return publishVideoBuffer({ kind, video, caption, note: `ses: ${source}` });
}

const INTRO_SECONDS = 3.5;
const SLIDE_SECONDS = 5;

// Slayt videosu: giris karti (liste) + her sira icin kendi sesiyle bir slayt.
// slides: [{ cardJpeg, audioUrl|null }]. Giris, 1. siradaki sarkinin sesiyle baslar ve
// 1. slayta kesintisiz devam eder; sonraki slaytlar kendi sarkilarini calar.
export async function makeSlideshowVideo({ introCard, slides }) {
  const dir = await mkdtemp(join(tmpdir(), 'ttslides-'));
  try {
    const out = join(dir, 'out.mp4');
    const inputs = [];
    const filters = [];

    // Gorseller: giris + slaytlar
    const images = [introCard, ...slides.map((s) => s.cardJpeg)];
    const durations = [INTRO_SECONDS, ...slides.map(() => SLIDE_SECONDS)];
    for (let i = 0; i < images.length; i++) {
      const file = join(dir, `img${i}.jpg`);
      await writeFile(file, images[i]);
      inputs.push('-loop', '1', '-framerate', '30', '-t', String(durations[i]), '-i', file);
      filters.push(`[${i}:v]scale=1080:1920,setsar=1,format=yuv420p[v${i}]`);
    }
    filters.push(
      `${images.map((_, i) => `[v${i}]`).join('')}concat=n=${images.length}:v=1:a=0[vout]`
    );

    // Sesler: her slayt icin bir parca (1. siradaki giris suresini de kapsar)
    let nextInput = images.length;
    for (let k = 0; k < slides.length; k++) {
      const duration = SLIDE_SECONDS + (k === 0 ? INTRO_SECONDS : 0);
      const common = 'aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo';
      const fades = `afade=t=in:st=0:d=0.15,afade=t=out:st=${duration - 0.35}:d=0.35`;

      let audioFile = null;
      if (slides[k].audioUrl) {
        try {
          const res = await fetch(slides[k].audioUrl, { signal: AbortSignal.timeout(20_000) });
          if (res.ok) {
            audioFile = join(dir, `aud${k}.mp3`);
            await writeFile(audioFile, Buffer.from(await res.arrayBuffer()));
          }
        } catch {
          audioFile = null;
        }
      }

      if (audioFile) {
        inputs.push('-i', audioFile);
        filters.push(
          `[${nextInput}:a]${common},atrim=start=0:duration=${duration},asetpts=PTS-STARTPTS,` +
            `loudnorm=I=-16:TP=-1.5:LRA=11,${common},${fades}[a${k}]`
        );
        nextInput += 1;
      } else {
        filters.push(
          `anullsrc=r=44100:cl=stereo,atrim=duration=${duration},asetpts=PTS-STARTPTS,${common}[a${k}]`
        );
      }
    }
    filters.push(
      `${slides.map((_, k) => `[a${k}]`).join('')}concat=n=${slides.length}:v=0:a=1[aout]`
    );

    await execFileP('ffmpeg', [
      '-y',
      ...inputs,
      '-filter_complex', filters.join(';'),
      '-map', '[vout]',
      '-map', '[aout]',
      '-c:v', 'libx264',
      '-crf', '28',
      '-pix_fmt', 'yuv420p',
      '-r', '30',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      out,
    ]);

    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Top N slayt videosunu uretir (yayinlamaz). En az bir sarkinin onizlemesi yoksa null doner.
export async function buildChartSlideshow({ header, date, entries, n = 5 }) {
  const top = entries.slice(0, n);
  const label = header.replace(/ SPOTIFY$/, '');
  const fullHeader = `${header} TOP ${top.length}`;

  const rows = await buildChartRows(top);
  const introCard = await renderListCard({ header: fullHeader, subheader: date, rows });

  const slides = [];
  let withAudio = 0;
  for (const e of top) {
    const cover = await getTrackThumbnail(e.trackUrl);
    if (!cover) continue;

    const names = e.artists.map((a) => a.name).join(' & ');
    const cardJpeg = await renderFeatureCard({
      label,
      headline: `${e.rank}. SIRA`,
      title: e.trackName,
      subtitle: `${names} · ${formatStreams(e.streams)} stream`,
      coverUrl: cover,
    });

    const preview = await findPreview(e.artists[0].name, e.trackName);
    if (preview) withAudio += 1;
    slides.push({ cardJpeg, audioUrl: preview?.url ?? null });
  }

  if (withAudio === 0 || slides.length === 0) return null;

  const video = await makeSlideshowVideo({ introCard, slides });
  return { video, withAudio, slideCount: slides.length, caption: chartDescription(fullHeader, date, top) };
}

// Tek sarki/olay icin sesli video. Onizleme yoksa veya hata olursa false doner, asla throw etmez.
export async function tiktokVideoPost({ kind, artist, title, label, headline, subtitle, coverUrl, trackUrl, caption }) {
  if (!tiktokEnabled() || !videoEnabled()) return false;
  try {
    const preview = await findPreview(artist, title);
    if (!preview) {
      console.log(`  Ses önizlemesi bulunamadı (${artist} - ${title}).`);
      return false;
    }

    const cover = coverUrl ?? (await getTrackThumbnail(trackUrl));
    if (!cover) throw new Error('Kapak gorseli bulunamadi');

    const cardJpeg = await renderFeatureCard({ label, headline, title, subtitle, coverUrl: cover });
    return await publishVideo({
      kind,
      cardJpeg,
      audioUrl: preview.url,
      caption: caption ?? `${artist} - ${title}`,
      source: preview.source,
    });
  } catch (err) {
    console.error(`  TikTok video hatası (${kind}): ${err.message}`);
    return false;
  }
}

// Once sesli video, olmazsa foto kart. Yeni sarki/yil donumu/trend olaylari bunu kullanir.
// params: tiktokFeaturePost parametreleri + artist (onizleme aramasi icin ana sanatci)
export async function tiktokSmartPost(params) {
  if (!tiktokEnabled()) return false;
  if (params.artist && (await tiktokVideoPost({ ...params, title: params.title }))) return true;
  return tiktokFeaturePost(params);
}

// Chart icin: listenin en ustundeki (onizlemesi bulunan) sarkinin sesiyle video, olmazsa foto kart.
export async function tiktokChartSmartPost({ kind, header, date, entries, maxRows = 8 }) {
  if (!tiktokEnabled()) return false;

  if (videoEnabled()) {
    // 1) Tercih: Top 5 slayt videosu (giris listesi + her sira kendi sarkisiyla)
    try {
      const show = await buildChartSlideshow({ header, date, entries, n: 5 });
      if (show) {
        return await publishVideoBuffer({
          kind,
          video: show.video,
          caption: show.caption,
          note: `slayt: ${show.slideCount}, sesli: ${show.withAudio}`,
        });
      }
    } catch (err) {
      console.error(`  TikTok slayt hatası (${kind}): ${err.message}`);
    }

    // 2) Yedek: liste karti + en ustteki sarkinin sesi
    try {
      const top = entries.slice(0, maxRows);

      let preview = null;
      for (const e of top.slice(0, 3)) {
        preview = await findPreview(e.artists[0].name, e.trackName);
        if (preview) break;
      }

      if (preview) {
        const fullHeader = `${header} TOP ${top.length}`;
        const rows = await buildChartRows(top);
        const cardJpeg = await renderListCard({ header: fullHeader, subheader: date, rows });
        return await publishVideo({
          kind,
          cardJpeg,
          audioUrl: preview.url,
          caption: chartDescription(fullHeader, date, top),
          source: preview.source,
        });
      }
    } catch (err) {
      console.error(`  TikTok video hatası (${kind}): ${err.message}`);
    }
  }

  return tiktokChartPost({ kind, header, date, entries, maxRows });
}
