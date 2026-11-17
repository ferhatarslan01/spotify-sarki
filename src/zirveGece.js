// "Zirveye Bir Gece Kala" (24 sn, 9:16): günlük listenin 1 numarası ile en yakın rakibi, "sabah taç kimde kalır?" sorusu.
// Senaryo: Desktop/yenisarkilarim-video/SENARYO_ZIRVEYE_BIR_GECE_KALA.md. Kompozisyon: video/src/Zirve.tsx.
//
// Veri kuralı: videodaki her sayı kworb günlük listesinden gelir (günlük dinlenme, "Streams+" = bir önceki günlük listeye göre değişim).
// İddialar veriye bağlıdır; veri desteklemiyorsa söylenmez:
//   - "en hızlı yükselen"  yalnızca rakibin günlük dinlenmesi arttıysa ve Top 10'daki en büyük artışsa
//   - "yarın zirve el değişebilir"  yalnızca son günde kapanan fark, şimdiki farka eşit ya da büyükse
//   - "fark kapandı"  yalnızca bir önceki listeye göre fark gerçekten azaldıysa (ve azalan miktarla birlikte)
// Final sorusu cevapsız: kazanan açıklanmaz, son kare ilk kareye bağlanır.
//
// Türkçe seslendirme: Microsoft Edge çevrimiçi nöral TTS, ses fr-FR-RemyMultilingualNeural (çok dilli; python `edge-tts` paketi). Yalnızca anlatım metni gönderilir.
// Kendi sesinizi ya da başka sağlayıcıyı (ElevenLabs/Azure) kullanmak için ZIRVE_VO_DIR içine l1.wav ... l7.wav koyun (bkz. synthLines).
import { mkdtemp, rm, writeFile, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { getTrackThumbnail } from './dailyChart.js';
import { run, SR, FPS, makeSfx, rngMaker, fetchBuf, analyzeBands, mixMusicAndSfx } from './videoAudio.js';

const DUR = 24;
const VOICE = process.env.ZIRVE_VOICE || 'fr-FR-RemyMultilingualNeural'; // secilen ses (alternatifler: tr-TR-AhmetNeural, tr-TR-EmelNeural, en-US-BrianMultilingualNeural ...)
const RATE = process.env.ZIRVE_RATE || '+4%'; // konusma hizi (ornek -6%)
const PITCH = process.env.ZIRVE_PITCH || '+0Hz'; // ton (ornek -12Hz daha derin)
// Ses isleme: varsayilan | 'haber' (spiker: sunus bandi vurgusu + sikistirma) | 'flas' (daha dar bant, daha sert, "flas haber")
const VO_FX = {
  default: 'highpass=f=80,acompressor=threshold=-22dB:ratio=3:attack=6:release=90,loudnorm=I=-16:TP=-1.5:LRA=7',
  haber: 'highpass=f=90,equalizer=f=180:t=q:w=1:g=2,equalizer=f=3200:t=q:w=1.2:g=3.5,equalizer=f=7500:t=q:w=1:g=1.5,acompressor=threshold=-24dB:ratio=4:attack=5:release=60:makeup=5,loudnorm=I=-16:TP=-1.5:LRA=6',
  flas: 'highpass=f=140,lowpass=f=9000,equalizer=f=2800:t=q:w=1:g=5,acompressor=threshold=-26dB:ratio=6:attack=3:release=50:makeup=6,loudnorm=I=-16:TP=-1.5:LRA=5',
}[process.env.ZIRVE_VO_FX || 'default'] ?? 'highpass=f=80';
const PY = process.platform === 'win32' ? 'python' : 'python3';
const names = (e) => e.artists.map((a) => a.name).join(' & ');

// ---------------------------------------------------------------- veri: çift seçimi ve iddia kuralları
// A = günlük listede 1 numara. B = 2-5. sıradan; son günde kapanan fark şimdiki farka yetiyorsa o (gerçek tehdit), yoksa 2 numara.
export function pickZirvePair(entries) {
  const top = entries.slice(0, 10).filter((e) => Number.isFinite(e.streams) && e.streams > 0);
  if (top.length < 3) return null;
  const a = top[0];
  const facts = (b) => {
    const gapNow = a.streams - b.streams;
    const known = Number.isFinite(a.streamsChange) && Number.isFinite(b.streamsChange);
    const closed = known ? b.streamsChange - a.streamsChange : null; // son günde azalan fark (pozitif = fark küçüldü)
    return { gapNow, closed, gapPrev: known ? gapNow + closed : null, shareB: b.streams / a.streams };
  };
  const rivals = top.slice(1, 5).filter((e) => e.artists[0].id !== a.artists[0].id);
  if (rivals.length === 0) return null;
  const threats = rivals.filter((r) => { const f = facts(r); return f.closed != null && f.closed >= f.gapNow; }).sort((x, y) => facts(x).gapNow - facts(y).gapNow);
  const b = threats[0] ?? rivals[0];
  const f = facts(b);
  const rises = top.slice(1).map((e) => e.streamsChange).filter(Number.isFinite);
  const fastest = Number.isFinite(b.streamsChange) && b.streamsChange > 0 && b.streamsChange === Math.max(...rises);
  const tomorrow = f.closed != null && f.closed > 0 && f.closed >= f.gapNow;
  return { a, b, ...f, fastest, tomorrow };
}

// ---------------------------------------------------------------- metin yardımcıları
const ones = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const tens = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
export function trNum(n) {
  if (n === 0) return 'sıfır';
  const part = (x) => {
    const h = Math.floor(x / 100);
    const t = Math.floor((x % 100) / 10);
    const o = x % 10;
    return [h ? (h > 1 ? `${ones[h]} yüz` : 'yüz') : '', tens[t], ones[o]].filter(Boolean).join(' ');
  };
  const th = Math.floor(n / 1000);
  const rest = n % 1000;
  return [th ? (th === 1 ? 'bin' : `${part(th)} bin`) : '', rest ? part(rest) : ''].filter(Boolean).join(' ');
}
// iki anlamlı basamağa yuvarla: 62.879 -> 63.000, 4.365 -> 4.400
const approx = (n) => {
  const m = 10 ** Math.max(0, String(Math.round(n)).length - 2);
  return Math.round(n / m) * m;
};
const upperTR = (s) => s.toLocaleUpperCase('tr-TR');
const dots = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
// TTS için ad: tamamı büyük harfse ("TRALALA") harf harf okunmasın
const spoken = (s) => (s === s.toLocaleUpperCase('tr-TR') && /[A-ZÇĞİÖŞÜ]{3,}/.test(s) ? s.charAt(0) + s.slice(1).toLocaleLowerCase('tr-TR') : s);

function buildCopy(p, aTitle, bTitle) {
  const A = spoken(aTitle);
  const B = spoken(bTitle);
  const hook = p.tomorrow ? ['YARIN 1 NUMARA', 'DEĞİŞEBİLİR'] : ['1 NUMARA TAHTINI', 'KORUYABİLİR Mİ?'];
  let s4;
  let l4;
  if (p.closed != null && p.closed > 0) {
    s4 = p.fastest ? ['SON GÜNDE', 'EN HIZLI YÜKSELEN'] : ['SON GÜNDE', 'FARK AZALDI'];
    l4 = p.fastest ? `Fakat ${B}, son günün en hızlı yükselen şarkısı.` : `Fakat ${B}, farkı bir günde yaklaşık ${trNum(approx(p.closed))} dinlenme azalttı.`;
  } else {
    s4 = ['EN YAKIN', 'RAKİP'];
    l4 = `Fakat ${B}, hemen arkasında.`;
  }
  const lead = p.gapNow / p.a.streams <= 0.05 ? 'yalnızca ' : '';
  const l5a = `Aradaki fark ${lead}yaklaşık ${trNum(approx(p.gapNow))} dinlenme.`;
  const s5 = p.tomorrow ? ['YARIN TAÇ', 'EL DEĞİŞTİRİR Mİ?'] : [`PEKİ ${upperTR(aTitle)}`, 'TAHTINI KORUYABİLECEK Mİ?'];
  const l5b = p.tomorrow ? 'Bu hız sürerse, yarın zirve el değiştirebilir.' : `Peki ${A}, tahtını koruyabilecek mi?`;
  const lines = [
    { id: 'l1', text: 'Tahtlar yavaş kurulur…', start: 0.4 },
    { id: 'l2', text: 'ama bazen bir gecede yıkılır.', start: 2.45 },
    { id: 'l3', text: `${A}, günlük listede Türkiye'nin bir numarası.`, start: 6.2 },
    { id: 'l4', text: l4, start: 10.15 },
    { id: 'l5', text: l5a, start: 14.2 },
    { id: 'l6', text: l5b, start: 17.58 },
    { id: 'l7', text: 'Sabah olduğunda taç kimde kalacak? A mı, B mi?', start: 19.85 },
  ];
  return { hook, s4, s5, fastest: p.fastest, tomorrow: p.tomorrow, lines };
}

// ---------------------------------------------------------------- seslendirme
async function ffdur(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return Number(stdout.trim());
}

async function synthLine(dir, line, rate) {
  const wav = join(dir, `${line.id}.wav`);
  const custom = process.env.ZIRVE_VO_DIR ? join(process.env.ZIRVE_VO_DIR, `${line.id}.wav`) : null;
  const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse';
  if (custom && (await access(custom).then(() => true, () => false))) {
    await run('ffmpeg', ['-y', '-v', 'error', '-i', custom, '-af', `${trim},aformat=sample_rates=44100:channel_layouts=mono`, wav]);
    return wav;
  }
  const mp3 = join(dir, `${line.id}.mp3`);
  await run(PY, ['-m', 'edge_tts', '--voice', VOICE, `--rate=${rate}`, `--pitch=${PITCH}`, '--text', line.text, '--write-media', mp3], { timeout: 90_000 });
  await run('ffmpeg', ['-y', '-v', 'error', '-i', mp3, '-af', `${trim},aformat=sample_rates=44100:channel_layouts=mono`, wav]);
  return wav;
}

// Her satırı ayrı üretir, sahne süresine sığacak kadar hızlandırır (en çok x1.22), art arda yerleştirir.
async function layoutVoice(dir, lines) {
  const placed = [];
  let prevEnd = 0;
  for (const [i, line] of lines.entries()) {
    const wav = await synthLine(dir, line, RATE);
    const nat = await ffdur(wav);
    const limit = (lines[i + 1]?.start ?? 23.35) - 0.1;
    const tempo = Math.min(1.22, Math.max(1, nat / Math.max(0.5, limit - line.start)));
    const start = Math.max(line.start, prevEnd + 0.08);
    const end = start + nat / tempo;
    if (end > limit + 0.45) console.warn(`  uyarı: "${line.text}" sahne süresini ${(end - limit).toFixed(2)} sn aşıyor (tempo x${tempo.toFixed(2)})`);
    placed.push({ ...line, wav, start, end, tempo });
    prevEnd = end;
  }
  const args = ['-y', '-v', 'error'];
  const parts = [];
  placed.forEach((p, i) => {
    args.push('-i', p.wav);
    const ms = Math.round(p.start * 1000);
    parts.push(`[${i}:a]atempo=${p.tempo.toFixed(3)},aformat=sample_rates=44100:channel_layouts=stereo,adelay=${ms}|${ms}[v${i}]`);
  });
  const out = join(dir, 'vo.wav');
  await run('ffmpeg', [...args, '-filter_complex', `${parts.join(';')};${placed.map((_, i) => `[v${i}]`).join('')}amix=inputs=${placed.length}:normalize=0:duration=longest,atrim=0:${DUR},apad=whole_dur=${DUR},${VO_FX}[o]`, '-map', '[o]', '-ar', '44100', '-ac', '2', out], { maxBuffer: 1 << 26 });
  return { wav: out, placed };
}

// altyazı: en çok 4 kelimelik parçalar, süre karakter sayısına orantılı
function captionsFor(placed) {
  const caps = [];
  for (const p of placed) {
    const words = p.text.replace(/…/g, '').split(/\s+/).filter(Boolean);
    // en çok 4 kelime ve 26 karakter (62 px yazı 960 px'e sığsın)
    const chunks = [];
    let cur = [];
    for (const w of words) {
      const next = [...cur, w];
      if (cur.length && (next.length > 4 || next.join(' ').length > 26)) {
        chunks.push(cur);
        cur = [w];
      } else cur = next;
    }
    if (cur.length) chunks.push(cur);
    const total = chunks.reduce((s, c) => s + c.join(' ').length, 0);
    let t = p.start;
    for (const c of chunks) {
      const text = c.join(' ');
      const len = ((p.end - p.start) * text.length) / total;
      caps.push({ t0: Math.round(t * 100) / 100, t1: Math.round((t + len) * 100) / 100, text: upperTR(text).replace(/[.,]$/, '') });
      t += len;
    }
  }
  return caps;
}

// ---------------------------------------------------------------- özgün ses tasarımı (telifli müzik yok)
const mute = (buf, t0, t1, fade = 0.012) => {
  const a = Math.round(t0 * SR);
  const b = Math.round(t1 * SR);
  const f = Math.round(fade * SR);
  for (let i = Math.max(0, a - f); i < Math.min(buf.length, b + f); i++) {
    const g = i < a ? 1 - (i - (a - f)) / f : i >= b ? (i - b) / f : 0;
    buf[i] *= Math.max(0, Math.min(1, g));
  }
};

async function designSound(dir, { frz0, frz1 }) {
  // --- yatak: alçak drone + gerilim, sahne zarfına göre
  const bed = makeSfx(DUR, 7);
  const rnd = rngMaker(77);
  const B = bed.buf;
  const env = (t) => {
    if (t < 0.3) return 0;
    if (t < 2.0) return 0.35 * ((t - 0.3) / 1.7);
    if (t < 6.0) return 0.45;
    if (t < 10.0) return 0.55;
    if (t < 15.0) return 0.55 + 0.35 * ((t - 10.0) / 5.0);
    if (t < 17.05) return 0.9 + 0.1 * ((t - 15.0) / 2.05);
    if (t < 17.55) return 0;
    if (t < 19.0) return 0.5;
    if (t < 23.0) return 0.6;
    return 0.6 - 0.4 * (t - 23.0);
  };
  let p1 = 0;
  let p2 = 0;
  let p3 = 0;
  let lp = 0;
  for (let i = 0; i < B.length; i++) {
    const t = i / SR;
    const e = env(t);
    p1 += (2 * Math.PI * 55) / SR;
    p2 += (2 * Math.PI * 55.6) / SR;
    p3 += (2 * Math.PI * (440 * Math.pow(2, clampT(t, 10, 17) / 7))) / SR;
    lp += 0.04 * (rnd() * 2 - 1 - lp);
    const pulse = t >= 10 && t < 17.05 ? 0.78 + 0.22 * Math.sin(2 * Math.PI * (1.6 + (t - 10) * 0.18) * t) : 1;
    const shimmer = t >= 10 ? Math.min(1, (t - 10) / 6) * 0.05 * Math.sin(p3) : 0;
    B[i] = e * (0.5 * Math.sin(p1) + 0.34 * Math.sin(p2) + 0.16 * Math.sin(p1 * 2 + 0.8 * Math.sin(t * 0.7)) * pulse + shimmer) + lp * 0.05 * (e > 0 ? 1 : 0);
  }
  mute(B, frz0, frz1);

  // --- efektler
  const s = makeSfx(DUR, 41);
  s.boom(0.0, 0.5, 46); // döngü iniş vuruşu (son sahnenin ters metal sesine bağlanır)
  s.hiss(0.12, 0.32, 0.5); // kısa CRT paraziti
  s.tick(0.12, 0.35, 5200);
  s.boom(1.0, 1.0, 62); // bas darbesi: tacta çatlak
  s.tick(1.0, 0.9, 3800);
  s.tick(1.03, 0.7, 5200);
  s.ding(1.02, 1568, 0.12, 0.25);
  s.whoosh(1.95, 0.45, 0.35, 250, 5000); // ekran ikiye ayrılır
  s.whoosh(2.25, 0.9, 0.45, 150, 3000); // B karanlıktan yaklaşır
  s.motor(5.78, 6.14, 900, 3600, 0.22); // kaset sarma + yatay kesme
  s.hiss(5.78, 6.14, 0.25);
  s.clatter(5.78, 0.36, 90, 0.25);
  s.tick(5.97, 0.6, 700);
  [1318.5, 1760, 2093].forEach((f, i) => s.ding(6.1 + i * 0.09, f, 0.22, 0.6)); // altın ışık
  for (const t of [6.9, 7.9, 8.9]) s.tick(t, 0.22, 1500); // sabit sayaç
  s.heartbeat(10.0, 14.9, 0.62, 0.93, 0.28); // yükselen nabız
  const N = 44;
  for (let k = 0; k < N; k++) s.tick(10.55 + (13.0 - 10.55) * (1 - (1 - k / N) ** (1 / 3)), 0.2, 1700 + k * 9); // sayaç tıkları (ease-out ile ritim)
  s.boom(13.0, 1.0, 52); // kilitlenme: kısa sub-bass
  s.tick(13.0, 0.9, 900);
  s.ding(13.02, 523.25, 0.3, 0.8);
  s.riser(15.0, frz0, 0.55);
  s.slowdown(frz0 - 0.15, 0.3, 700, 0.3); // görüntü donar
  s.boom(frz1, 0.8, 58); // donmadan çıkış
  s.tick(19.0, 0.6, 1100);
  s.ding(19.02, 1046.5, 0.35, 0.6);
  s.ding(19.07, 1318.5, 0.35, 0.6);
  for (const t of [19.5, 20.5, 21.5, 22.5]) s.whoosh(t - 0.25, 0.5, 0.16, 800, 3200); // ışık çizgisi gidip gelir
  s.whoosh(23.0, 0.9, 0.55, 200, 7000); // taç kameraya gelir
  s.riser(23.0, 23.95, 0.45);
  s.tick(23.5, 0.8, 2600); // bir karelik flaş
  // ters çevrilmiş metal: 23.0-24.0, son örnekte vuruş (başa bağlanır)
  const metal = new Float32Array(SR);
  for (let k = 0; k < metal.length; k++) {
    const tt = k / SR;
    let v = (rnd() * 2 - 1) * Math.exp(-tt / 0.03) * 0.8;
    for (const [f, a] of [[523, 1], [1443, 0.6], [2824, 0.4], [4670, 0.25]]) v += a * Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt / 0.42);
    metal[k] = v * 0.6;
  }
  const off = Math.round(23.0 * SR);
  for (let k = 0; k < metal.length; k++) if (off + k < s.buf.length) s.buf[off + k] += metal[metal.length - 1 - k] * (0.25 + 0.75 * (k / metal.length));
  mute(s.buf, frz0, frz1);

  await bed.writeWav(join(dir, 'bed.wav'), 0.85);
  await s.writeWav(join(dir, 'sfx.wav'), 0.85);
}
const clampT = (t, a, b) => Math.min(b, Math.max(a, t)) - a;

// ---------------------------------------------------------------- kapak görüntüsü ve gürültü dokusu
async function coverJpeg(entry) {
  const url = await getTrackThumbnail(entry.trackUrl);
  if (!url) throw new Error(`Kapak bulunamadı: ${entry.trackName}`);
  return sharp(await fetchBuf(url)).resize(640, 640, { fit: 'cover' }).jpeg({ quality: 95 }).toBuffer();
}

async function noisePng() {
  const w = 256;
  const raw = Buffer.alloc(w * w * 4, 255);
  const r = rngMaker(5);
  for (let i = 0; i < w * w; i++) raw[i * 4 + 3] = Math.round(Math.pow(r(), 1.6) * 255);
  return sharp(raw, { raw: { width: w, height: w, channels: 4 } }).png().toBuffer();
}

// ---------------------------------------------------------------- ana fonksiyon
// entries: fetchDailyChart() çıktısı, date: 'dd.mm.yyyy'. Çift uygun değilse null.
export async function prepZirve({ entries, date }) {
  const p = pickZirvePair(entries);
  if (!p) return null;
  const { a, b } = p;
  const copy = buildCopy(p, a.trackName, b.trackName);
  const dir = await mkdtemp(join(tmpdir(), 'zirve-'));
  try {
    const { wav: vo, placed } = await layoutVoice(dir, copy.lines);
    await designSound(dir, { frz0: 17.05, frz1: 17.55 });
    await mixMusicAndSfx(join(dir, 'bed.wav'), join(dir, 'sfx.wav'), join(dir, 'music.wav'), 0.95, 0.4);
    const bands = await analyzeBands(join(dir, 'music.wav'), DUR);
    // yatak konuşmanın altında kısılır (sidechain), sonra tek dosya, hedef -15 LUFS
    await run('ffmpeg', [
      '-y', '-v', 'error', '-i', vo, '-i', join(dir, 'music.wav'),
      '-filter_complex',
      `[0:a]asplit=2[v][k];[1:a]volume=0.8[m];[m][k]sidechaincompress=threshold=0.03:ratio=5:attack=12:release=260[md];[v][md]amix=inputs=2:normalize=0:duration=longest,loudnorm=I=-15:TP=-1.5:LRA=9,atrim=0:${DUR}[o]`,
      '-map', '[o]', '-ar', '44100', '-ac', '2', join(dir, 'mix.wav'),
    ], { maxBuffer: 1 << 26 });

    const data = {
      fps: FPS,
      durationSeconds: DUR,
      chartDate: date,
      a: { artist: names(a), title: a.trackName, rank: a.rank, streams: a.streams },
      b: { artist: names(b), title: b.trackName, rank: b.rank, streams: b.streams },
      gapNow: p.gapNow,
      gapPrev: p.gapPrev,
      closed: p.closed,
      shareB: Math.round(p.shareB * 10000) / 10000,
      copy: { hook: copy.hook, s4: copy.s4, s5: copy.s5, fastest: copy.fastest, tomorrow: copy.tomorrow },
      captions: captionsFor(placed),
      bands,
    };
    const assets = [
      { name: 'zirve-cover-a.jpg', buffer: await coverJpeg(a) },
      { name: 'zirve-cover-b.jpg', buffer: await coverJpeg(b) },
      { name: 'zirve-noise.png', buffer: await noisePng() },
      { name: 'zirve-audio.wav', buffer: await readFile(join(dir, 'mix.wav')) },
    ];
    return {
      prepared: { composition: 'Zirve', dataKey: 'zirve', data, assets, crf: 27 }, // grenli VHS dokusu yuksek bit hizi ister; crf 27 ile paylasima uygun boyut
      pair: p,
      voice: placed.map((x) => ({ text: x.text, start: Math.round(x.start * 100) / 100, end: Math.round(x.end * 100) / 100, tempo: Math.round(x.tempo * 100) / 100 })),
      pack: zirvePack(p, date),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- platform paketi (yayınlanmaz; metin dosyası)
export function zirvePack(p, date) {
  const { a, b } = p;
  const closing = p.closed != null && p.closed > 0;
  const title = p.tomorrow ? 'Yarın Türkiye’nin 1 numarası değişebilir.' : 'Zirveye bir gece kala: taç kimde kalacak?';
  const x = [
    `Tahtın sahibi belli.${closing ? ' Ama aradaki fark son günlük listede küçüldü.' : ' Ama rakip hemen arkasında.'}`,
    `A: ${names(a)} – ${a.trackName}`,
    `B: ${names(b)} – ${b.trackName}`,
    'Yarın sabah taç kimde: A mı, B mi?',
  ].join('\n');
  return [
    `# Zirveye Bir Gece Kala (veri: kworb Türkiye günlük listesi, ${date})`,
    '',
    `A (1 numara): ${names(a)} – ${a.trackName}, günlük ${dots(a.streams)}`,
    `B (${b.rank} numara): ${names(b)} – ${b.trackName}, günlük ${dots(b.streams)}`,
    `Fark: ${dots(p.gapNow)} dinlenme` + (p.closed != null ? `; bir önceki günlük listede ${dots(p.gapPrev)} idi (${p.closed >= 0 ? '−' : '+'}${dots(Math.abs(p.closed))})` : '; önceki gün verisi yok'),
    `İddia kontrolü: en hızlı yükselen = ${p.fastest ? 'EVET' : 'HAYIR (kullanılmadı)'}; yarın değişebilir = ${p.tomorrow ? 'EVET' : 'HAYIR (kullanılmadı)'}`,
    '',
    `Video başlığı: ${title}`,
    '',
    `X gönderisi (${x.length} karakter):`,
    x,
    '',
    `TikTok / Reels açıklaması: ${p.tomorrow ? 'Bir gecede her şey değişebilir. A mı, B mi? 👑' : 'Taç sabah kimde kalır? A mı, B mi? 👑'}`,
    'Sabit yorum: Sonuç videosu yarın. Tahminini değiştirmek yok: A mı B mi?',
    `Kapak metni: ${p.tomorrow ? 'ZİRVE EL DEĞİŞTİRİR Mİ?' : 'TAÇ KİMDE KALACAK?'}`,
    'Etiketler: #TürkçeMüzik #SpotifyTürkiye #MüzikListeleri #YeniMüzik',
    '',
    'Not: Sayılar yayın anında yeniden çekilmelidir (node src/tiktokPreview.js preview --only zirve).',
  ].join('\n');
}
