import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderFeatureCard, renderFeatureLayers, renderListCard, renderTitleCard } from './tiktokCard.js';
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
  chartArtists,
} from './tiktok.js';
import { withHashtags } from './hashtags.js';

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

async function publishVideo({ kind, cardJpeg, audioUrl, caption, source, artists = [] }) {
  const video = await makeVideo({ cardJpeg, audioUrl });
  return publishVideoBuffer({ kind, video, caption, note: `ses: ${source}`, artists });
}

const INTRO_SECONDS = 3.4;
const OUTRO_SECONDS = 5;
const SLIDE_SECONDS = 5.4;

// Gecis sureleri ve efektleri (ffmpeg xfade / acrossfade)
const TRANSITION_SECONDS = 0.6;
const TRANSITION_IN = 'fadeblack'; // baslik -> ilk slayt (yazilar ust uste binmesin)
const TRANSITION_SLIDE = 'slideleft'; // slayt -> slayt (temiz itme)
const TRANSITION_OUT = 'fadeblack'; // son slayt -> tam liste

// Slayt videosu: baslik karti + her sira icin kendi sesiyle bir slayt (+ istege bagli final listesi).
// slides: [{ cardJpeg, audioUrl|null }] (gosterim sirasiyla).
// Gorseller xfade ile, sesler acrossfade ile birbirine yumusakca gecer. Baslik ilk slaytin sarkisinin
// sesiyle baslar, final liste son slaytin sarkisinin sesiyle devam eder.
export async function makeSlideshowVideo({ introCard, slides, outroCard = null }) {
  const T = TRANSITION_SECONDS;
  const dir = await mkdtemp(join(tmpdir(), 'ttslides-'));
  try {
    const out = join(dir, 'out.mp4');
    const inputs = [];
    const filters = [];

    // --- Gorseller ---
    // Her oge bir "kaynak": statik kart veya katmanli slayt (kapak -> sira -> sarki adi -> sanatci).
    const sources = [
      { card: introCard, duration: INTRO_SECONDS },
      ...slides.map((s) => ({ card: s.cardJpeg, layers: s.layers, duration: SLIDE_SECONDS })),
      ...(outroCard ? [{ card: outroCard, duration: OUTRO_SECONDS }] : []),
    ];
    const durations = sources.map((src) => src.duration);
    const N = sources.length;

    let inputIndex = 0;
    const addLoopedImage = async (name, buffer, duration) => {
      const file = join(dir, name);
      await writeFile(file, buffer);
      inputs.push('-loop', '1', '-framerate', '30', '-t', String(duration), '-i', file);
      return inputIndex++;
    };

    // Katman belirme zamanlari (sn) ve kayma mesafesi (px)
    const REVEAL = { cover: 0.1, rank: 0.75, title: 1.35, subtitle: 1.95 };
    const FADE = 0.4;
    const ease = (start, dist) =>
      `if(lt(t,${start}),${dist},${dist}*pow(max(0,1-(t-${start})/${FADE}),2))`;

    for (let i = 0; i < N; i++) {
      const src = sources[i];

      if (!src.layers) {
        const idx = await addLoopedImage(`img${i}.jpg`, src.card, src.duration);
        filters.push(`[${idx}:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p,settb=AVTB[v${i}]`);
        continue;
      }

      const L = src.layers;
      const d = src.duration;
      const b = await addLoopedImage(`s${i}-base.jpg`, L.base, d);
      const c = await addLoopedImage(`s${i}-cover.png`, L.cover, d);
      const h = await addLoopedImage(`s${i}-rank.png`, L.headline, d);
      const t = await addLoopedImage(`s${i}-title.png`, L.title, d);
      const u = await addLoopedImage(`s${i}-sub.png`, L.subtitle, d);

      const fadeIn = (start) => `format=rgba,fade=t=in:st=${start}:d=${FADE}:alpha=1`;
      filters.push(
        `[${b}:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p[b${i}]`,
        `[${c}:v]${fadeIn(REVEAL.cover)}[c${i}]`,
        `[${h}:v]${fadeIn(REVEAL.rank)}[h${i}]`,
        `[${t}:v]${fadeIn(REVEAL.title)}[t${i}]`,
        `[${u}:v]${fadeIn(REVEAL.subtitle)}[u${i}]`,
        `[b${i}][c${i}]overlay=x=120:y='290+${ease(REVEAL.cover, 70)}':eval=frame[o1_${i}]`,
        `[o1_${i}][h${i}]overlay=x=0:y='${ease(REVEAL.rank, 40)}':eval=frame[o2_${i}]`,
        `[o2_${i}][t${i}]overlay=x=0:y='${ease(REVEAL.title, 40)}':eval=frame[o3_${i}]`,
        `[o3_${i}][u${i}]overlay=x=0:y='${ease(REVEAL.subtitle, 40)}':eval=frame,` +
          `format=yuv420p,setsar=1,fps=30,settb=AVTB[v${i}]`
      );
    }

    // Her gecisin baslangic ofseti ve orta noktasi (video zaman cizelgesi)
    const offset = [0]; // offset[i]: i. gorselin gecisle girmeye basladigi an (i >= 1)
    const mid = [0];
    let cumulative = durations[0];
    for (let i = 1; i < N; i++) {
      offset[i] = cumulative - i * T;
      mid[i] = offset[i] + T / 2;
      cumulative += durations[i];
    }
    const totalLength = cumulative - (N - 1) * T;

    let prev = 'v0';
    for (let i = 1; i < N; i++) {
      let effect = TRANSITION_SLIDE;
      if (i === 1) effect = TRANSITION_IN;
      if (outroCard && i === N - 1) effect = TRANSITION_OUT;
      const label = i === N - 1 ? 'vout' : `x${i}`;
      filters.push(
        `[${prev}][v${i}]xfade=transition=${effect}:duration=${T}:offset=${offset[i].toFixed(3)}[${label}]`
      );
      prev = label;
    }

    // --- Sesler ---
    // Slayt k = gorsel k+1. Ses parcasi sinirlari gorsel gecislerinin orta noktalarina denk gelir;
    // her parca iki yanda T/2 uzatilir ve acrossfade ile birlestirilir.
    const n = slides.length;
    const common = 'aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo';
    let nextInput = inputIndex;

    for (let k = 0; k < n; k++) {
      const start = k === 0 ? 0 : mid[k + 1];
      const end = k === n - 1 ? totalLength : mid[k + 2];
      const length = end - start + (k > 0 ? T / 2 : 0) + (k < n - 1 ? T / 2 : 0);

      const fadeIn = k === 0 ? ',afade=t=in:st=0:d=0.2' : '';
      const fadeOut = k === n - 1 ? `,afade=t=out:st=${(length - 0.8).toFixed(3)}:d=0.8` : '';

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
          `[${nextInput}:a]${common},atrim=start=0:duration=${length.toFixed(3)},asetpts=PTS-STARTPTS,` +
            `loudnorm=I=-16:TP=-1.5:LRA=11,${common}${fadeIn}${fadeOut}[a${k}]`
        );
        nextInput += 1;
      } else {
        filters.push(
          `anullsrc=r=44100:cl=stereo,atrim=duration=${length.toFixed(3)},asetpts=PTS-STARTPTS,${common}[a${k}]`
        );
      }
    }

    if (n === 1) {
      filters.push('[a0]anull[aout]');
    } else {
      let acc = 'a0';
      for (let k = 1; k < n; k++) {
        const label = k === n - 1 ? 'aout' : `ac${k}`;
        filters.push(`[${acc}][a${k}]acrossfade=d=${T}:c1=qsin:c2=qsin[${label}]`);
        acc = label;
      }
    }

    await execFileP('ffmpeg', [
      '-y',
      ...inputs,
      '-filter_complex', filters.join(';'),
      '-map', '[vout]',
      '-map', '[aout]',
      '-c:v', 'libx264',
      '-crf', '26',
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

// Top N slayt videosunu uretir (yayinlamaz).
// Akis: ortada buyuk baslik -> N..1 geri sayim slaytlari (her biri kendi sarkisiyla) -> tam liste.
// previewOnly=true ise video uretilmez, sadece kartlar doner. Hic sarkinin onizlemesi yoksa
// (ve previewOnly degilse) null doner.
export async function buildChartSlideshow({ header, date, entries, n = 5, previewOnly = false }) {
  const top = entries.slice(0, n);
  const [region, period] = header.split(' ');
  const fullHeader = `${header} TOP ${top.length}`;
  const periodWord = period === 'HAFTALIK' ? 'BU HAFTA' : 'BUGÜN';
  const lower = region.toLocaleLowerCase('tr');
  const regionName = lower.charAt(0).toLocaleUpperCase('tr') + lower.slice(1);

  const firstCover = await getTrackThumbnail(top[0].trackUrl);
  const introCard = await renderTitleCard({
    label: region,
    headline: `${periodWord} EN ÇOK\nDİNLENEN\n${top.length} ŞARKI`,
    subtitle: `Spotify ${regionName} · ${date}`,
    coverUrl: firstCover,
  });

  const rows = await buildChartRows(top);
  const outroCard = await renderListCard({ header: fullHeader, subheader: date, rows });

  const slides = [];
  let withAudio = 0;
  for (const e of top) {
    const cover = await getTrackThumbnail(e.trackUrl);
    if (!cover) continue;

    const names = e.artists.map((a) => a.name).join(' & ');
    const cardOptions = {
      label: header.replace(/ SPOTIFY$/, ''),
      headline: `${e.rank}. SIRA`,
      title: e.trackName,
      subtitle: `${names} · ${formatStreams(e.streams)} stream`,
      coverUrl: cover,
    };
    const cardJpeg = await renderFeatureCard(cardOptions);
    const layers = previewOnly ? null : await renderFeatureLayers(cardOptions);

    const preview = previewOnly ? null : await findPreview(e.artists[0].name, e.trackName);
    if (preview) withAudio += 1;
    slides.push({ rank: e.rank, cardJpeg, layers, audioUrl: preview?.url ?? null });
  }

  // Geri sayim: 5. siradan baslayip 1. sirada bitir (en iyi an sona kalir)
  slides.reverse();

  const cards = { intro: introCard, slides: slides.map((s) => ({ rank: s.rank, card: s.cardJpeg })), outro: outroCard };
  const caption = chartDescription(fullHeader, date, top);

  if (previewOnly) return { cards, caption };
  if (withAudio === 0 || slides.length === 0) return null;

  const video = await makeSlideshowVideo({ introCard, slides, outroCard });
  return { video, cards, withAudio, slideCount: slides.length, caption };
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
      artists: [artist],
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
          artists: chartArtists(entries.slice(0, 5)),
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
          artists: chartArtists(top),
        });
      }
    } catch (err) {
      console.error(`  TikTok video hatası (${kind}): ${err.message}`);
    }
  }

  return tiktokChartPost({ kind, header, date, entries, maxRows });
}
