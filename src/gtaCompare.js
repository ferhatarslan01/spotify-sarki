// "GTA V -> GTA VI": 5 rapçinin eski ve yeni fotoğrafını yan yana koyan geri sayım videosu (5 -> 1). "GTA 5" / "GTA 6" yazı değil, simge (rozet) olarak gösterilir.
// Kompozisyon: video/src/GtaCompare.tsx. Önizleme: node --env-file=.env src/tiktokPreview.js preview --only gta
//
// Veri: kworb sanatçı sayfası (https://kworb.net/spotify/artist/<id>_songs.html). Sıralama ölçütü: rapçinin ANA sanatçı olduğu tüm şarkılarının
// günlük akış toplamı ("As lead / Daily"); aynı sayfadaki güncelleme tarihiyle birlikte gösterilir. "En çok dinlenen 5" iddiası kullanılmaz:
// yalnızca bu 5 rapçi kendi aralarında sıralanır (data/gtaRappers.json).
// Fotoğraflar sizden gelir (telif ve doğruluk sizde): gta-foto/<anahtar>-eski.jpg ve gta-foto/<anahtar>-yeni.jpg (jpg/png/webp).
//   İsteğe bağlı gta-foto/yillar.json: { "blok3": { "eski": 2019, "yeni": 2026, "eskiKirp": [x0,y0,x1,y1], "yeniKirp": [...], "eskiPoz": "50% 20%" } }
//   (kırpma kesirle verilir: 0-1 arası; yıl rozetlerde görünür; poz = kırpma odağı).
// Resmî logolar kullanılacaksa gta-foto/logo-gta5.png ve logo-gta6.png (saydam PNG) konur; yoksa çizilmiş rozet simgeler kullanılır.
// Fotoğraf eksikse o yerde kapak görseli ve "ÖRNEK FOTO" şeridi görünür; strict: true (paylaşım) eksik varsa hata verir.
// Hiçbir yüz yapay zekâyla üretilmez ya da değiştirilmez: fotoğraflar yalnızca kırpılıp konumlandırılır, filtre uygulanmaz.
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { getTrackThumbnail } from './dailyChart.js';
import { fmtStreamsTR } from './artistTopSongs.js';
import { findSongAudio } from './artistSeries.js';
import { run, FPS, makeSfx, fetchBuf, findHookStart, analyzeBands, mixMusicAndSfx } from './videoAudio.js';

const INTRO = 2.0;
const SLIDE = 4.6;
const OUTRO = 2.6;
const REVEAL = 1.5; // slayt içinde yeni fotoğrafın açıldığı an
const EXTS = ['jpg', 'jpeg', 'png', 'webp'];
const UA = { 'User-Agent': 'Mozilla/5.0' };
const VERSION = /\b(remix|sped up|speed up|slowed|reverb|live|canlı|canli|instrumental|enstrümantal|acoustic|akustik|edit|version|versiyon|mix|karaoke)\b/i;
const num = (s) => Number(String(s).replace(/\D/g, ''));
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export async function loadRappers() {
  return JSON.parse(await readFile(new URL('../data/gtaRappers.json', import.meta.url), 'utf-8'));
}

// kworb sanatçı sayfası: özet (Total / As lead, Streams ve Daily), güncelleme tarihi ve ana sanatçı olduğu en çok günlük dinlenen şarkı
export async function fetchRapperStats(r) {
  const res = await fetch(`https://kworb.net/spotify/artist/${r.id}_songs.html`, { headers: UA, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`kworb sayfası alınamadı (${r.name}): ${res.status}`);
  const html = await res.text();
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const sum = /Total As lead Solo As feature \(\*\) Streams ([\d,]+) ([\d,]+) ([\d,]+) ([\d,]+) Daily ([\d,]+) ([\d,]+)/.exec(text);
  if (!sum) throw new Error(`kworb özet satırı bulunamadı (${r.name})`);
  const upd = /Last updated: (\d{4})\/(\d{2})\/(\d{2})/.exec(text);

  const songs = [];
  for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    if (cells.length < 3) continue;
    const t = cells[0].match(/<a href="https:\/\/open\.spotify\.com\/track\/([^"]+)"[^>]*>([^<]+)<\/a>/);
    if (!t) continue;
    const feature = /^\s*\*/.test(cells[0].replace(/<a[\s\S]*$/, '')) || /^\s*\*/.test(cells[0].replace(/<[^>]+>/g, ''));
    songs.push({ trackId: t[1], trackName: decode(t[2]).trim(), streams: num(cells[1]), daily: num(cells[2]), feature });
  }
  const lead = songs.filter((s) => !s.feature && s.daily > 0 && !VERSION.test(s.trackName)).sort((a, b) => b.daily - a.daily);
  if (lead.length === 0) throw new Error(`Ana sanatçı şarkısı bulunamadı (${r.name})`);
  return {
    ...r,
    totalLead: num(sum[2]),
    dailyLead: num(sum[6]),
    updated: upd ? `${upd[3]}.${upd[2]}.${upd[1]}` : null,
    top: { ...lead[0], trackUrl: `https://open.spotify.com/track/${lead[0].trackId}` },
  };
}

async function findPhoto(dir, key, kind) {
  for (const ext of EXTS) {
    const p = join(dir, `${key}-${kind}.${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

// EXIF yönüne göre döndür, isteğe bağlı kırpma (kesir), uzun kenarı en çok 1400 px
async function photoJpeg(buf, crop = null) {
  let img = sharp(buf).rotate();
  if (crop) {
    const { width, height } = await sharp(await img.toBuffer()).metadata();
    const [x0, y0, x1, y1] = crop;
    const left = Math.max(0, Math.round(x0 * width));
    const top = Math.max(0, Math.round(y0 * height));
    img = sharp(await img.toBuffer()).extract({ left, top, width: Math.min(width - left, Math.round((x1 - x0) * width)), height: Math.min(height - top, Math.round((y1 - y0) * height)) });
  }
  return img.resize(1400, 1400, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
}

async function coverJpeg(trackUrl) {
  const url = await getTrackThumbnail(trackUrl);
  if (!url) throw new Error('Kapak bulunamadı');
  return sharp(await fetchBuf(url)).resize(640, 640, { fit: 'cover' }).jpeg({ quality: 92 }).toBuffer();
}

// ---------------------------------------------------------------- ses: şarkı kesitleri + efektler
async function buildAudio(dir, items, DUR) {
  const args = ['-y', '-v', 'error'];
  const parts = [];
  for (const [i, it] of items.entries()) {
    const url = await findSongAudio(it.name, it.topSong);
    if (!url) throw new Error(`Ses bulunamadı: ${it.name} - ${it.topSong}; sessiz sahneli video paylaşılmaz`);
    const f = join(dir, `a${i}.bin`);
    await writeFile(f, await fetchBuf(url));
    const last = i === items.length - 1;
    const l = last ? SLIDE + OUTRO + 0.2 : SLIDE + 0.3; // son şarkı kapanışta da çalar (ölü hava olmasın)
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]);
    const total = Number(stdout.trim()) || 30;
    // nakarat penceresi önizlemenin sonuna taşmasın (yoksa parça erken biter)
    const ss = Math.min(await findHookStart(f, Math.min(l + 0.5, 24)), Math.max(0, total - l - 0.1));
    const fade = last ? 1.4 : 0.4;
    const ms = Math.round(it.at * 1000);
    args.push('-i', f);
    parts.push(`[${i}:a]atrim=start=${ss}:duration=${l},asetpts=PTS-STARTPTS,loudnorm=I=-15:TP=-1.5:LRA=9,aformat=sample_rates=44100:channel_layouts=stereo,afade=t=in:d=0.06,afade=t=out:st=${(l - fade).toFixed(2)}:d=${fade},adelay=${ms}|${ms}[s${i}]`);
  }
  const music = join(dir, 'music.wav');
  // not: apad sonrası atrim kullanılmaz (ffmpeg 8'de baştaki kısmı kesiyor); süre -t ile sınırlanır
  await run('ffmpeg', [...args, '-filter_complex', `${parts.join(';')};${items.map((_, i) => `[s${i}]`).join('')}amix=inputs=${items.length}:normalize=0:duration=longest,apad=whole_dur=${DUR}[m]`, '-map', '[m]', '-t', String(DUR), '-ar', '44100', '-ac', '2', music], { maxBuffer: 1 << 26 });

  const s = makeSfx(DUR, 63);
  // yükleme ekranı: hızlanan tıklar ve final
  for (let k = 0; k < 14; k++) s.tick(0.25 + k * 0.12 - k * k * 0.004, 0.22, 900 + k * 140);
  s.whoosh(0.0, 0.5, 0.3, 200, 3500);
  [659.25, 880, 1318.5].forEach((f, i) => s.ding(1.85 + i * 0.05, f, 0.3, 0.5));
  for (const [i, it] of items.entries()) {
    const hero = i === items.length - 1;
    s.whoosh(it.at - 0.12, 0.4, 0.4, 300, 4500); // geçiş
    s.tick(it.at + 0.05, 0.45, 1500); // isim
    s.whoosh(it.at + 0.12, 0.45, 0.3, 250, 3800); // eski panel girer
    s.riser(it.at + REVEAL - 0.5, it.at + REVEAL, hero ? 0.6 : 0.45); // yeni yükleniyor
    s.boom(it.at + REVEAL, hero ? 1.0 : 0.75, hero ? 62 : 74); // yeni açılır
    [784, 1046.5, 1318.5, 1568].forEach((f, k) => s.ding(it.at + REVEAL + 0.04 + k * 0.07, f, hero ? 0.4 : 0.28, 0.6));
  }
  s.whoosh(INTRO + SLIDE * items.length, 0.5, 0.35, 250, 4800);
  await s.writeWav(join(dir, 'sfx.wav'));
  await mixMusicAndSfx(music, join(dir, 'sfx.wav'), join(dir, 'mix.wav'), 0.7, 0.95);
  return { music, mix: join(dir, 'mix.wav') };
}

// ---------------------------------------------------------------- ana fonksiyon
export async function prepGta({ photoDir = 'gta-foto', strict = false } = {}) {
  const rappers = await loadRappers();
  const stats = [];
  for (const r of rappers) stats.push(await fetchRapperStats(r));
  const ranked = stats.sort((a, b) => b.dailyLead - a.dailyLead);

  let years = {};
  if (existsSync(join(photoDir, 'yillar.json'))) years = JSON.parse(await readFile(join(photoDir, 'yillar.json'), 'utf-8'));

  const order = [...ranked].reverse(); // 5 -> 1
  const dir = await mkdtemp(join(tmpdir(), 'gta-'));
  try {
    const assets = [];
    const items = [];
    const missing = [];
    for (const [i, r] of order.entries()) {
      const rank = ranked.length - i;
      const at = INTRO + i * SLIDE;
      const oldP = await findPhoto(photoDir, r.key, 'eski');
      const newP = await findPhoto(photoDir, r.key, 'yeni');
      const cover = await coverJpeg(r.top.trackUrl);
      if (!oldP) missing.push(`${r.key}-eski`);
      if (!newP) missing.push(`${r.key}-yeni`);
      const y = years[r.key] ?? {};
      assets.push({ name: `gta-old-${r.key}.jpg`, buffer: oldP ? await photoJpeg(await readFile(oldP), y.eskiKirp ?? null) : cover });
      assets.push({ name: `gta-new-${r.key}.jpg`, buffer: newP ? await photoJpeg(await readFile(newP), y.yeniKirp ?? null) : cover });
      items.push({
        rank,
        key: r.key,
        name: r.name,
        streams: r.dailyLead,
        streamsText: `${fmtStreamsTR(r.dailyLead)} günlük akış`.toLocaleUpperCase('tr-TR'),
        totalText: `${fmtStreamsTR(r.totalLead)} toplam`.toLocaleUpperCase('tr-TR'),
        songs: 0,
        topSong: r.top.trackName,
        oldFile: `gta-old-${r.key}.jpg`,
        newFile: `gta-new-${r.key}.jpg`,
        oldYear: y.eski ?? null,
        newYear: y.yeni ?? null,
        oldPos: y.eskiPoz ?? '50% 28%',
        newPos: y.yeniPoz ?? '50% 28%',
        oldPlaceholder: !oldP,
        newPlaceholder: !newP,
        at,
      });
    }
    if (strict && missing.length) throw new Error(`Fotoğraf eksik: ${missing.join(', ')}`);

    // resmî logolar varsa (kullanıcı koyarsa) rozet yerine onlar kullanılır
    const logoPath = (k) => {
      const p = join(photoDir, `logo-gta${k}.png`);
      return existsSync(p) ? p : null;
    };
    const l5 = logoPath(5); // rozet: V + FIVE amblemi
    const l5full = existsSync(join(photoDir, 'logo-gta5-tam.png')) ? join(photoDir, 'logo-gta5-tam.png') : null; // giris: "grand theft auto V" yazili logo
    const l6 = logoPath(6);
    if (l5) assets.push({ name: 'gta-logo-5.png', buffer: await readFile(l5) });
    if (l5full) assets.push({ name: 'gta-logo-5full.png', buffer: await readFile(l5full) });
    if (l6) assets.push({ name: 'gta-logo-6.png', buffer: await readFile(l6) });

    const DUR = Math.round((INTRO + SLIDE * items.length + OUTRO) * 10) / 10;
    const { music, mix } = await buildAudio(dir, items, DUR);
    const bands = await analyzeBands(music, DUR);
    const updated = ranked.map((r) => r.updated).filter(Boolean).sort().pop() ?? '';
    assets.push({ name: 'gta-soundtrack.wav', buffer: await readFile(mix) });
    return {
      prepared: { composition: 'GtaCompare', dataKey: 'gta', data: { fps: FPS, durationSeconds: DUR, intro: INTRO, slide: SLIDE, reveal: REVEAL, outro: INTRO + SLIDE * items.length, updated, logo5: Boolean(l5), logo5full: Boolean(l5full), logo6: Boolean(l6), items, bands }, assets, crf: 25 },
      items,
      missing,
      updated,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
