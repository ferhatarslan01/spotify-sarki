// "Spotify arka videosu" stili: tek sarkilik olay videosu = sarkinin Spotify Canvas'i (dikey dongu video) + onizleme sesi + kisa bilgi katmani.
// Canvas yoksa (ya da SP_DC tanimli degilse / kimlik hatasi) video URETILMEZ: eski sablonlara dusulmez (bkz. videoStyle.js).
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { getAccessToken } from './spotify.js';
import { fetchCanvasVideo, CanvasAuthError } from './spotifyCanvas.js';
import { run, FPS, fetchBuf, findHookStart, hueOf, analyzeBands } from './videoAudio.js';

const SECONDS = 15;
let canvasOff = false; // kimlik hatasinda bu calistirma boyunca Canvas denenmez

const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/[^a-z0-9]/g, '');

async function api(token, path) {
  const r = await fetch(`https://api.spotify.com/v1/${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
  return r.ok ? r.json() : null;
}

// Spotify sarki kimligi: dogrudan sarki baglantisi, yoksa album baglantisindan, yoksa arama ile. Bulunamazsa null.
export async function resolveTrackId({ trackUrl, albumUrl, artist, title }) {
  const direct = /track\/([A-Za-z0-9]+)/.exec(trackUrl ?? '');
  if (direct) return direct[1];
  let token = null;
  try {
    token = await getAccessToken();
  } catch {
    return null;
  }
  const key = fold(title);
  const albumId = (/album\/([A-Za-z0-9]+)/.exec(albumUrl ?? trackUrl ?? '') ?? [])[1];
  if (albumId) {
    const items = (await api(token, `albums/${albumId}/tracks?limit=20&market=TR`))?.items ?? [];
    const hit = items.find((t) => fold(t.name) === key) ?? items.find((t) => key && fold(t.name).includes(key.slice(0, 6)));
    if (hit) return hit.id;
  }
  const q = encodeURIComponent(`track:${title} artist:${String(artist).split(/ & | ft\.? | feat\.? /i)[0]}`);
  const found = (await api(token, `search?q=${q}&type=track&limit=5&market=TR`))?.tracks?.items ?? [];
  return (found.find((t) => fold(t.name) === key) ?? found.find((t) => key && fold(t.name).includes(key.slice(0, 6))))?.id ?? null;
}

// Sarkinin Canvas'i (Buffer) ya da null
export async function fetchSongCanvas(params) {
  if (canvasOff || !process.env.SP_DC) return null;
  const trackId = await resolveTrackId(params);
  if (!trackId) return null;
  try {
    const c = await fetchCanvasVideo(trackId);
    return c?.buffer ?? null;
  } catch (err) {
    if (err instanceof CanvasAuthError) {
      canvasOff = true;
      console.error(`  Canvas devre dışı: ${err.message}`);
    } else {
      console.error(`  Canvas hatası: ${String(err.message).split('\n')[0]}`);
    }
    return null;
  }
}

// prepared: renderPrepared() icin { composition, dataKey, data, assets }
export async function prepCanvasSong({ label, chip = '', title, artist, cover, canvas, audioUrl, seconds = SECONDS }) {
  const dir = await mkdtemp(join(tmpdir(), 'cs-'));
  try {
    // Canvas sureye kadar donguye alinir (1080x1920, 30 fps). Kaynak dusuk cozunurluklu (720-810 px) oldugundan Lanczos + hafif keskinlestirme;
    // ara kodlama neredeyse kayipsiz (CRF 14) ki ust uste sikistirma gorseli bozmasin.
    const src = join(dir, 'canvas.mp4');
    const loop = join(dir, 'cs-canvas.mp4');
    await writeFile(src, canvas);
    await run('ffmpeg', ['-y', '-v', 'error', '-stream_loop', '-1', '-i', src, '-t', String(seconds + 0.5), '-vf', `fps=${FPS},scale=1080:1920:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:1920,unsharp=5:5:0.5:5:5:0.0`, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'medium', loop]);

    // ses: onizlemenin nakarat penceresi, -15 LUFS
    const aud = join(dir, 'aud.bin');
    await writeFile(aud, await fetchBuf(audioUrl));
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', aud]);
    const total = Number(stdout.trim()) || 30;
    const l = seconds + 0.3;
    const ss = Math.min(await findHookStart(aud, Math.min(l + 0.5, 24)), Math.max(0, total - l - 0.1));
    const wav = join(dir, 'cs-audio.wav');
    await run('ffmpeg', ['-y', '-v', 'error', '-i', aud, '-af', `atrim=start=${ss}:duration=${l},asetpts=PTS-STARTPTS,loudnorm=I=-15:TP=-1.5:LRA=9,aformat=sample_rates=44100:channel_layouts=stereo,afade=t=in:d=0.12,afade=t=out:st=${(seconds - 0.9).toFixed(2)}:d=0.9`, '-t', String(seconds), '-ar', '44100', '-ac', '2', wav]);

    const coverJpg = await sharp(cover).resize(500, 500, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer();
    return {
      composition: 'CanvasSong',
      dataKey: 'cs',
      crf: 18,
      jpegQuality: 95,
      imageFormat: 'png', // Canvas arka plani JPEG karelerinden gecmesin
      data: { fps: FPS, durationSeconds: seconds, label, chip, title, artist, hue: await hueOf(sharp, coverJpg), bands: await analyzeBands(wav, seconds) },
      assets: [
        { name: 'cs-canvas.mp4', buffer: await readFile(loop) },
        { name: 'cs-audio.wav', buffer: await readFile(wav) },
        { name: 'cs-cover.jpg', buffer: coverJpg },
      ],
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
