// TikTok icin hareketli video uretici.
// Her kare Node'da (sharp) cizilir, sesin spektrumu analiz edilir, kareler ffmpeg'e akitilir.
// Sahneler: anniv (sayac), rise (siralama dususu), new (yeni sarki/olay), top5 (liste).
// Paletler: altin (yil donumu/yukselis), studio (yeni sarki/top 5).
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const run = promisify(execFile);
const W = 1080;
const H = 1920;
const FPS = 30;
// Linux (GitHub runner) icin DejaVu Sans yedegi; Windows'ta Arial Black kullanilir.
const FONT = "'Arial Black', 'DejaVu Sans', Arial, Helvetica, sans-serif";

// ------------------------------------------------------------ yardimcilar
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, x) => a + (b - a) * x;
const easeOutCubic = (x) => 1 - (1 - clamp(x)) ** 3;
const easeInCubic = (x) => clamp(x) ** 3;
const easeInOut = (x) => {
  x = clamp(x);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};
const easeOutBack = (x) => {
  x = clamp(x);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const bassOf = (b) => (b[0] + b[1] + b[2] + b[3]) / 4;

const PAL = {
  altin: { accent: '#F2C879', hi: '#FFFFFF', badge: '#F2C879', badgeText: '#1a1204', conf: ['#F2C879', '#FFFFFF', '#C9A45C', '#E8E8E8'], bars: '#F2C879', star: '#F2C879', glow: '#F2C879' },
  studio: { accent: '#FFD84D', hi: '#FFFFFF', badge: '#1DB954', badgeText: '#03140a', conf: ['#FFD84D', '#FFFFFF', '#1DB954', '#FF6B9A', '#6FD8FF'], bars: '#FFFFFF', star: '#FFFFFF', glow: '#FFFFFF' },
};
const OUTLINE = 'rgba(0,0,0,0.35)';
const SOFT = 'rgba(255,255,255,0.8)';

// ------------------------------------------------------------ gorsel parcalar
let textCache = new Map();

async function textImg({ lines, size, weight = 900, fill = '#fff', stroke = null, maxW = 980, shadow = true }) {
  const k = JSON.stringify([lines, size, weight, fill, stroke, maxW, shadow]);
  if (textCache.has(k)) return textCache.get(k);
  const p = (async () => {
    const L = Array.isArray(lines) ? lines : [lines];
    const lh = 1.1;
    const pad = Math.round(size * 0.35);
    const w = Math.min(4000, Math.round(Math.max(...L.map((l) => l.length), 1) * size * 0.95 + pad * 2));
    const h = Math.round(L.length * size * lh + pad * 2);
    const texts = (dy, attrs) =>
      L.map(
        (l, i) =>
          `<text x="${w / 2}" y="${pad + size * 0.85 + i * size * lh + dy}" text-anchor="middle" font-size="${size}" font-weight="${weight}" font-family="${FONT}" ${attrs}>${esc(l)}</text>`
      ).join('');
    const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${
      shadow ? texts(Math.round(size * 0.06), 'fill="#000" fill-opacity="0.5"') : ''
    }${stroke ? texts(0, `fill="none" stroke="${stroke}" stroke-width="${Math.round(size * 0.14)}" stroke-linejoin="round"`) : ''}${texts(0, `fill="${fill}"`)}</svg>`;
    let buf = await sharp(Buffer.from(svg)).png().toBuffer();
    try {
      buf = await sharp(buf).trim({ threshold: 2 }).png().toBuffer();
    } catch {
      /* kirpilamazsa oldugu gibi */
    }
    buf = await sharp(buf).extend({ top: 10, bottom: 10, left: 10, right: 10, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    let meta = await sharp(buf).metadata();
    if (meta.width > maxW) {
      buf = await sharp(buf).resize({ width: maxW }).png().toBuffer();
      meta = await sharp(buf).metadata();
    }
    return { buf, w: meta.width, h: meta.height };
  })();
  textCache.set(k, p);
  return p;
}

async function pillImg({ text, size = 40, fill = '#fff', bg = '#000', padX = 38, padY = 20, weight = 800 }) {
  const k = JSON.stringify(['pill', text, size, fill, bg, padX, padY, weight]);
  if (textCache.has(k)) return textCache.get(k);
  const p = (async () => {
    const t = await textImg({ lines: text, size, weight, fill, shadow: false, maxW: 900 });
    const w = t.w + padX * 2;
    const h = t.h + padY * 2 - 16;
    const rect = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${h / 2}" fill="${bg}"/></svg>`);
    const buf = await sharp(rect).composite([{ input: t.buf, left: padX, top: Math.round((h - t.h) / 2) }]).png().toBuffer();
    return { buf, w, h };
  })();
  textCache.set(k, p);
  return p;
}

async function roundedImg(srcBuf, size, radius) {
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="#fff"/></svg>`);
  const buf = await sharp(srcBuf).resize(size, size).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return { buf, w: size, h: size };
}

async function glowImg(size, color, radius) {
  const pad = 70;
  const s = size + pad * 2;
  const svg = Buffer.from(`<svg width="${s}" height="${s}"><rect x="${pad}" y="${pad}" width="${size}" height="${size}" rx="${radius}" fill="${color}"/></svg>`);
  const buf = await sharp(svg).blur(34).png().toBuffer();
  return { buf, w: s, h: s };
}

async function shadowImg(size, radius) {
  const pad = 60;
  const s = size + pad * 2;
  const svg = Buffer.from(`<svg width="${s}" height="${s}"><rect x="${pad}" y="${pad + 18}" width="${size}" height="${size}" rx="${radius}" fill="#000" fill-opacity="0.65"/></svg>`);
  const buf = await sharp(svg).blur(28).png().toBuffer();
  return { buf, w: s, h: s };
}

async function makeCenter(cover, size, P) {
  return {
    cv: await roundedImg(cover, size, 64),
    gl: await glowImg(size, P.glow, 64),
    sh: await shadowImg(size, 64),
    size,
  };
}

function centerLayers(c, { t, t0, cx, cy, pop = null, bass = 0, tilt = 0 }) {
  const dt = t - t0;
  if (dt < 0) return [];
  const p = pop ?? easeOutBack(dt / 0.6);
  const float = 12 * Math.sin(dt * 1.8);
  const pulse = 1 + 0.05 * bass;
  return [
    layer(c.sh, { cx, cy: cy + float, scale: (c.size / c.sh.w) * p * 1.05 * pulse, opacity: clamp(dt / 0.2) }),
    layer(c.gl, { cx, cy: cy + float, scale: (c.size / c.gl.w) * p * 1.12 * pulse, opacity: (0.35 + 0.4 * bass) * clamp(dt / 0.2) }),
    layer(c.cv, { cx, cy: cy + float, scale: (c.size / c.cv.w) * p * pulse, rot: tilt * (1 - clamp(dt / 0.6)) + 1.2 * Math.sin(dt * 1.3), opacity: clamp(dt / 0.12) }),
  ];
}

// ------------------------------------------------------------ katman yerlestirme
function clipRaw(data, w, h, left, top) {
  if (left >= W || top >= H || left + w <= 0 || top + h <= 0) return null;
  if (left >= 0 && top >= 0 && left + w <= W && top + h <= H) return { input: data, raw: { width: w, height: h, channels: 4 }, left, top };
  const x0 = Math.max(0, -left);
  const y0 = Math.max(0, -top);
  const x1 = Math.min(w, W - left);
  const y1 = Math.min(h, H - top);
  const nw = x1 - x0;
  const nh = y1 - y0;
  const out = Buffer.allocUnsafe(nw * nh * 4);
  for (let y = 0; y < nh; y++) data.copy(out, y * nw * 4, ((y0 + y) * w + x0) * 4, ((y0 + y) * w + x1) * 4);
  return { input: out, raw: { width: nw, height: nh, channels: 4 }, left: left + x0, top: top + y0 };
}

async function layer(img, { cx, cy, scale = 1, rot = 0, opacity = 1 }) {
  if (!img || opacity <= 0.004 || scale <= 0.004) return null;
  const w = Math.max(2, Math.round(img.w * scale));
  const h = Math.max(2, Math.round(img.h * scale));
  let s = sharp(img.buf).resize(w, h, { fit: 'fill' });
  if (rot) s = s.rotate(rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
  s = s.ensureAlpha();
  if (opacity < 0.999) s = s.linear([1, 1, 1, opacity], [0, 0, 0, 0]);
  const { data, info } = await s.raw().toBuffer({ resolveWithObject: true });
  return clipRaw(data, info.width, info.height, Math.round(cx - info.width / 2), Math.round(cy - info.height / 2));
}

async function svgLayer(svg) {
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { input: data, raw: { width: info.width, height: info.height, channels: 4 }, left: 0, top: 0 };
}

function flashLayer(alpha) {
  if (alpha <= 0.01) return null;
  return { input: { create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: clamp(alpha) } } }, left: 0, top: 0 };
}

// ------------------------------------------------------------ efektler (SVG)
function starPath(x, y, s) {
  const k = s * 0.22;
  return `M${x},${y - s} L${x + k},${y - k} L${x + s},${y} L${x + k},${y + k} L${x},${y + s} L${x - k},${y + k} L${x - s},${y} L${x - k},${y - k} Z`;
}

function fxSvg({ t, stars = null, bars = null, chevrons = false, bursts = [], palette }) {
  let s = '';
  if (stars) {
    const r = rng(7);
    for (let i = 0; i < stars.count; i++) {
      const x = r() * W;
      const y = r() * H * 0.9;
      const size = 10 + r() * 22;
      const ph = r() * 6.28;
      const tw = 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(t * (2 + r() * 2.5) + ph));
      s += `<path d="${starPath(x, y, size)}" fill="${stars.color}" fill-opacity="${(tw * stars.alpha).toFixed(3)}"/>`;
    }
  }
  if (chevrons) {
    const r = rng(11);
    for (let i = 0; i < 14; i++) {
      const lane = (i % 5) * 230 + 100 + r() * 40;
      const speed = 520 + r() * 420;
      const size = 70 + r() * 80;
      const y = H + 200 - ((t * speed + i * 330) % (H + 500));
      const op = 0.25 + 0.5 * r();
      s += `<path d="M${lane - size},${y + size * 0.4} L${lane},${y - size * 0.4} L${lane + size},${y + size * 0.4} L${lane + size},${y + size * 0.8} L${lane},${y} L${lane - size},${y + size * 0.8} Z" fill="#1DB954" fill-opacity="${op.toFixed(2)}"/>`;
    }
  }
  if (bars) {
    const n = bars.bands.length;
    const bw = 22;
    const gap = 10;
    const total = n * bw + (n - 1) * gap;
    const x0 = (W - total) / 2;
    for (let i = 0; i < n; i++) {
      const v = clamp(bars.bands[i]);
      const hgt = 14 + v * (bars.height ?? 200);
      const x = x0 + i * (bw + gap);
      s += `<rect x="${x}" y="${bars.y - hgt / 2}" width="${bw}" height="${hgt}" rx="${bw / 2}" fill="${bars.color}" fill-opacity="${(0.55 + 0.45 * v).toFixed(2)}"/>`;
    }
  }
  for (const b of bursts) {
    const dt = t - b.t0;
    if (dt < 0 || dt > 3.2) continue;
    const r = rng(b.seed ?? 3);
    const k = 1.6;
    for (let i = 0; i < (b.n ?? 80); i++) {
      const ang = r() * Math.PI * 2;
      const sp = 350 + r() * 1100;
      const vx = Math.cos(ang) * sp;
      const vy = Math.sin(ang) * sp - 450;
      const drag = (1 - Math.exp(-k * dt)) / k;
      const x = (b.x ?? W / 2) + vx * drag;
      const y = (b.y ?? 900) + vy * drag + 0.5 * 1500 * dt * dt;
      const rot = r() * 360 + (r() - 0.5) * 900 * dt;
      const cw = 14 + r() * 16;
      const ch = 8 + r() * 10;
      const col = palette.conf[Math.floor(r() * palette.conf.length)];
      const op = 1 - clamp((dt - 2.0) / 1.0);
      if (op <= 0 || x < -50 || x > W + 50 || y > H + 50) continue;
      s += `<rect x="${(x - cw / 2).toFixed(1)}" y="${(y - ch / 2).toFixed(1)}" width="${cw.toFixed(1)}" height="${ch.toFixed(1)}" fill="${col}" fill-opacity="${op.toFixed(2)}" transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    }
  }
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}

function burstLayer(t, bursts, palette) {
  if (!bursts.some((b) => t - b.t0 >= 0 && t - b.t0 <= 3.2)) return null;
  return svgLayer(fxSvg({ t, bursts, palette }));
}

// ------------------------------------------------------------ ses
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = i + k + len / 2;
        const vr = re[b] * cr - im[b] * ci;
        const vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr;
        im[b] = im[a] - vi;
        re[a] += vr;
        im[a] += vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

async function analyze(wavPath, dur, nBands = 26) {
  const { stdout } = await run('ffmpeg', ['-v', 'error', '-i', wavPath, '-ac', '1', '-ar', '22050', '-f', 'f32le', '-'], {
    encoding: 'buffer',
    maxBuffer: 1 << 28,
  });
  const nSamp = Math.floor(stdout.byteLength / 4);
  const samples = new Float32Array(stdout.buffer.slice(stdout.byteOffset, stdout.byteOffset + nSamp * 4));
  const N = 1024;
  const frames = Math.ceil(dur * FPS) + 1;
  const edges = [];
  for (let i = 0; i <= nBands; i++) edges.push(Math.round(2 * Math.pow(380 / 2, i / nBands)));
  const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  const raw = [];
  for (let f = 0; f < frames; f++) {
    const center = Math.round((f / FPS) * 22050);
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const idx = center - N / 2 + i;
      re[i] = idx >= 0 && idx < samples.length ? samples[idx] * win[i] : 0;
    }
    fft(re, im);
    const row = [];
    for (let b = 0; b < nBands; b++) {
      let sum = 0;
      const lo = edges[b];
      const hi = Math.max(edges[b + 1], lo + 1);
      for (let k = lo; k < hi; k++) sum += Math.hypot(re[k], im[k]);
      row.push(sum / (hi - lo));
    }
    raw.push(row);
  }
  const norm = [];
  for (let b = 0; b < nBands; b++) {
    const col = raw.map((r) => r[b]).sort((a, c) => a - c);
    norm.push(Math.max(col[Math.floor(col.length * 0.95)], 1e-6));
  }
  const out = [];
  let prev = new Array(nBands).fill(0);
  for (let f = 0; f < frames; f++) {
    const row = raw[f].map((v, b) => Math.sqrt(clamp(v / norm[b], 0, 1.4) / 1.4));
    prev = row.map((v, b) => Math.max(v, prev[b] * 0.8));
    out.push(prev);
  }
  return out;
}

async function fetchBuf(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Ses indirilemedi: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// segments: [{ url, ss, d, at, vol, fin, fout }] -> stereo 44.1k WAV, tam `dur` saniye
async function buildAudio(segments, dur, outPath, dir) {
  const args = ['-y', '-v', 'error'];
  const parts = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const p = join(dir, `seg${i}.bin`);
    await writeFile(p, await fetchBuf(s.url));
    args.push('-i', p);
    const fout = s.fout ?? 0.4;
    parts.push(
      `[${i}:a]atrim=start=${s.ss ?? 0}:duration=${s.d},asetpts=PTS-STARTPTS,afade=t=in:d=${s.fin ?? 0.25},afade=t=out:st=${Math.max(0, s.d - fout)}:d=${fout},volume=${s.vol ?? 1},aformat=sample_rates=44100:channel_layouts=stereo,adelay=${Math.round((s.at ?? 0) * 1000)}|${Math.round((s.at ?? 0) * 1000)}[s${i}]`
    );
  }
  const mix = segments.length > 1 ? `${segments.map((_, i) => `[s${i}]`).join('')}amix=inputs=${segments.length}:normalize=0:duration=longest,` : '[s0]';
  args.push('-filter_complex', `${parts.join(';')};${mix}atrim=0:${dur},apad=whole_dur=${dur}[a]`, '-map', '[a]', '-ar', '44100', '-ac', '2', outPath);
  await run('ffmpeg', args, { maxBuffer: 1 << 26 });
}

// ------------------------------------------------------------ studyo arka plan
async function coverHue(buf) {
  const { data } = await sharp(buf).resize(8, 8).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let best = { score: -1, r: 29, g: 185, b: 84 };
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const score = (mx - mn) * (mx / 255 + 0.3);
    if (score > best.score) best = { score, r, g, b };
  }
  const mx = Math.max(best.r, best.g, best.b, 1);
  const mn = Math.min(best.r, best.g, best.b);
  const d = mx - mn;
  if (d < 28) return 150; // gri/koyu kapak: notr yesil-turkuaz
  let h;
  if (mx === best.r) h = ((best.g - best.b) / d) % 6;
  else if (mx === best.g) h = (best.b - best.r) / d + 2;
  else h = (best.r - best.g) / d + 4;
  h = Math.round(h * 60);
  return h < 0 ? h + 360 : h;
}

let bokehCache = null;
async function bokehLayers() {
  if (bokehCache) return bokehCache;
  const mk = async (seed, n, rMin, rMax, alpha, blur) => {
    const r = rng(seed);
    let c = '';
    for (let i = 0; i < n; i++) {
      const x = r() * W;
      const y = r() * H;
      const rad = rMin + r() * (rMax - rMin);
      const a = (alpha * (0.5 + r() * 0.8)).toFixed(3);
      for (const dy of [-H, 0, H]) c += `<circle cx="${x.toFixed(0)}" cy="${(y + dy).toFixed(0)}" r="${rad.toFixed(0)}" fill="#fff" fill-opacity="${a}"/>`;
    }
    const tile = await sharp(Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${c}</svg>`)).blur(blur).png().toBuffer();
    return sharp({ create: { width: W, height: H * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: tile, left: 0, top: 0 }, { input: tile, left: 0, top: H }])
      .ensureAlpha()
      .raw()
      .toBuffer();
  };
  const grainW = W + 120;
  const grainH = H + 120;
  const g = Buffer.alloc(grainW * grainH * 4);
  const rr = rng(99);
  for (let i = 0; i < grainW * grainH; i++) {
    const v = Math.floor(rr() * 255);
    g[i * 4] = v;
    g[i * 4 + 1] = v;
    g[i * 4 + 2] = v;
    g[i * 4 + 3] = 12;
  }
  const vigSvg = Buffer.from(`<svg width="${W}" height="${H}"><defs><radialGradient id="v" cx="50%" cy="45%" r="78%"><stop offset="52%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.7"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#v)"/></svg>`);
  bokehCache = {
    a: await mk(21, 12, 45, 100, 0.1, 7),
    b: await mk(33, 22, 14, 42, 0.15, 3),
    grain: { data: g, w: grainW, h: grainH },
    vig: await sharp(vigSvg).ensureAlpha().raw().toBuffer(),
  };
  return bokehCache;
}

async function studioBackground(cover) {
  const h = await coverHue(cover);
  const BW = 1400;
  const BH = 2300;
  const svg = Buffer.from(`<svg width="${BW}" height="${BH}" xmlns="http://www.w3.org/2000/svg"><defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${h},38%,5%)"/><stop offset="1" stop-color="hsl(${h},48%,12%)"/></linearGradient>
    <radialGradient id="a"><stop offset="0" stop-color="hsl(${h},78%,44%)" stop-opacity="0.8"/><stop offset="0.55" stop-color="hsl(${h},75%,30%)" stop-opacity="0.35"/><stop offset="1" stop-color="hsl(${h},70%,20%)" stop-opacity="0"/></radialGradient>
    <radialGradient id="b"><stop offset="0" stop-color="hsl(${(h + 28) % 360},70%,36%)" stop-opacity="0.55"/><stop offset="1" stop-color="hsl(${(h + 28) % 360},70%,25%)" stop-opacity="0"/></radialGradient></defs>
    <rect width="${BW}" height="${BH}" fill="url(#g)"/>
    <circle cx="700" cy="820" r="950" fill="url(#a)"/><circle cx="640" cy="1950" r="850" fill="url(#b)"/></svg>`);
  const baseRaw = await sharp(svg).ensureAlpha().raw().toBuffer();
  const bk = await bokehLayers();
  const rawOpt = (w, hh) => ({ raw: { width: w, height: hh, channels: 4 } });
  return {
    frame: async (t) => {
      const left = Math.round(160 + 120 * Math.sin(t * 0.35));
      const top = Math.round(190 + 150 * Math.cos(t * 0.27));
      const offA = Math.floor((t * 26) % H);
      const offB = Math.floor((t * 48) % H);
      const crop = (raw, off) => sharp(raw, rawOpt(W, H * 2)).extract({ left: 0, top: off, width: W, height: H }).raw().toBuffer();
      const [a, b] = await Promise.all([crop(bk.a, offA), crop(bk.b, offB)]);
      const gx = Math.floor(Math.random() * 120);
      const gy = Math.floor(Math.random() * 120);
      const gr = await sharp(bk.grain.data, rawOpt(bk.grain.w, bk.grain.h)).extract({ left: gx, top: gy, width: W, height: H }).raw().toBuffer();
      return sharp(baseRaw, rawOpt(BW, BH))
        .extract({ left, top, width: W, height: H })
        .composite([a, b, gr, bk.vig].map((x) => ({ input: x, ...rawOpt(W, H), left: 0, top: 0 })))
        .ensureAlpha()
        .raw()
        .toBuffer();
    },
  };
}

// ------------------------------------------------------------ animasyon yardimcilari
function slam(img, t, t0, cx, cy, { from = 2.4, dur = 0.3, shake = 10, exit = null } = {}) {
  const dt = t - t0;
  if (dt < 0) return null;
  const p = easeOutCubic(dt / dur);
  let sc = lerp(from, 1, p);
  let op = clamp(dt / 0.07);
  let dx = 0;
  let dy = 0;
  if (dt < 0.45) {
    const k = 1 - dt / 0.45;
    dx = shake * Math.sin(dt * 95) * k;
    dy = shake * 0.6 * Math.cos(dt * 80) * k;
  }
  if (exit != null) {
    const e = clamp((t - exit) / 0.3);
    sc *= 1 + 0.55 * easeInCubic(e);
    op *= 1 - e;
  }
  return layer(img, { cx: cx + dx, cy: cy + dy, scale: sc, opacity: op });
}

function popIn(img, t, t0, cx, cy, { dur = 0.45, rise = 0, scale = 1 } = {}) {
  const dt = t - t0;
  if (dt < 0) return null;
  const p = easeOutBack(dt / dur);
  return layer(img, { cx, cy: cy + rise * (1 - easeOutCubic(dt / dur)), scale: scale * Math.max(p, 0.001), opacity: clamp(dt / 0.12) });
}

function fadeIn(img, t, t0, cx, cy, { dur = 0.35, rise = 30, scale = 1, exit = null } = {}) {
  const dt = t - t0;
  if (dt < 0) return null;
  const p = easeOutCubic(dt / dur);
  let sc = scale;
  let op = p;
  if (exit != null) {
    const e = clamp((t - exit) / 0.3);
    sc *= 1 + 0.4 * easeInCubic(e);
    op *= 1 - e;
  }
  return layer(img, { cx, cy: cy + rise * (1 - p), scale: sc, opacity: op });
}

const BARS = (bands, P) => ({ bands, y: 1800, height: 140, color: P.bars });

function baseFx(P, t, { bars = null, extra = {} } = {}) {
  return { t, palette: P, stars: { count: 7, color: P.star, alpha: 0.5 }, bars, ...extra };
}

async function hookTexts(D, P, { l1, l2, s1 = 210, s2 = 250 }) {
  return {
    artist: await textImg({ lines: D.artist.toLocaleUpperCase('tr'), size: 190, fill: P.hi, stroke: OUTLINE }),
    title: await textImg({ lines: D.title, size: 112, fill: P.accent }),
    l1: await textImg({ lines: l1, size: s1, fill: P.hi, stroke: OUTLINE }),
    l2: await textImg({ lines: l2, size: s2, fill: P.accent }),
  };
}

// ------------------------------------------------------------ sahneler
// anniv: D = { artist, title, number, suffix, pill, small, l1, l2, label, dateText, cta }
async function sceneAnniv(D, assets, P) {
  const H0 = await hookTexts(D, P, { l1: D.l1, l2: D.l2 });
  const small = await textImg({ lines: D.small, size: 64, fill: '#fff', weight: 700 });
  const pillTop = await pillImg({ text: D.pill, size: 42, fill: P.badgeText, bg: P.badge });
  const qs = [];
  for (const q of [170, 120, 210, 100]) qs.push(await textImg({ lines: '?', size: q, fill: P.accent, shadow: false }));
  const total = Math.max(1, Math.round(D.number));
  const nums = [];
  for (let n = 0; n <= total; n++) nums.push(await textImg({ lines: `${n}${D.suffix ?? ''}`, size: 330, fill: P.accent, stroke: 'rgba(0,0,0,0.25)' }));
  const label = await textImg({ lines: D.label, size: 74, fill: '#fff' });
  const artistT = await textImg({ lines: D.artist, size: 62, fill: '#fff', weight: 700 });
  const titleT = await textImg({ lines: D.title, size: 84, fill: P.accent });
  const dateT = D.dateText ? await textImg({ lines: D.dateText, size: 44, fill: SOFT, weight: 700, shadow: false }) : null;
  const cta = await pillImg({ text: D.cta, size: 46, fill: P.badgeText, bg: P.accent, padX: 48, padY: 24 });
  const HOOK_END = 3.5;
  const NUM_T0 = 4.2;
  const NUM_T1 = 5.7;
  return {
    dur: 16,
    async frame(t, bands) {
      const bass = bassOf(bands);
      const L = [];
      const pre = t < HOOK_END + 0.3;
      L.push(svgLayer(fxSvg(baseFx(P, t, { bars: t > HOOK_END ? BARS(bands, P) : null }))));
      if (pre) {
        const ex = HOOK_END - 0.3;
        L.push(popIn(pillTop, t, 0.0, W / 2, 190, { dur: 0.4, rise: -40 }));
        L.push(slam(H0.artist, t, 0.1, W / 2, 470, { exit: ex }));
        L.push(slam(H0.title, t, 0.5, W / 2, 650, { exit: ex }));
        L.push(fadeIn(small, t, 0.95, W / 2, 775, { dur: 0.35, exit: ex }));
        L.push(slam(H0.l1, t, 1.3, W / 2, 1030, { exit: ex }));
        L.push(slam(H0.l2, t, 1.7, W / 2, 1310, { exit: ex, from: 3 }));
        qs.forEach((q, i) => {
          const dt = t - (1.9 + i * 0.12);
          if (dt > 0 && t < ex) {
            const x = [150, 930, 170, 900][i];
            const y = [280, 320, 1590, 1550][i] - 16 * Math.sin(t * 3 + i);
            L.push(layer(q, { cx: x, cy: y, scale: easeOutBack(dt / 0.4), rot: [-14, 12, 10, -10][i] + 6 * Math.sin(t * 4 + i), opacity: clamp(dt / 0.15) * 0.9 }));
          }
        });
      }
      if (t >= HOOK_END) {
        L.push(popIn(pillTop, t, HOOK_END, W / 2, 150, { dur: 0.4 }));
        L.push(...centerLayers(assets.center, { t, t0: HOOK_END + 0.05, cx: W / 2, cy: 560, bass, tilt: -8 }));
        const nt = easeOutCubic((t - NUM_T0) / (NUM_T1 - NUM_T0));
        const n = t < NUM_T0 ? 0 : Math.round(total * nt);
        if (t >= NUM_T0 - 0.2) {
          const done = t >= NUM_T1;
          const bump = done ? 1 + 0.18 * Math.exp(-9 * (t - NUM_T1)) * Math.cos(26 * (t - NUM_T1)) : 1 + 0.03 * Math.sin(t * 40);
          L.push(layer(nums[n], { cx: W / 2, cy: 1090, scale: bump * clamp((t - (NUM_T0 - 0.2)) / 0.2) }));
        }
        L.push(fadeIn(label, t, NUM_T1 - 0.2, W / 2, 1290, { dur: 0.4 }));
        L.push(fadeIn(artistT, t, NUM_T1 + 0.25, W / 2, 1385, { dur: 0.4 }));
        L.push(popIn(titleT, t, NUM_T1 + 0.45, W / 2, 1475, { dur: 0.5 }));
        if (dateT) L.push(fadeIn(dateT, t, NUM_T1 + 0.8, W / 2, 1570, { dur: 0.4 }));
        L.push(popIn(cta, t, 8.2, W / 2, 1660, { dur: 0.5, scale: 1 + 0.03 * Math.sin(t * 5) }));
      }
      L.push(burstLayer(t, [{ t0: NUM_T1, x: W / 2, y: 1000, n: 90, seed: 5 }, { t0: HOOK_END, x: W / 2, y: 560, n: 50, seed: 9 }], P));
      L.push(flashLayer(0.8 * Math.exp(-9 * Math.max(0, t - HOOK_END)) * (t >= HOOK_END ? 1 : 0)));
      L.push(flashLayer(0.45 * Math.exp(-10 * Math.max(0, t - NUM_T1)) * (t >= NUM_T1 ? 1 : 0)));
      return L;
    },
  };
}

// rise: D = { artist, title, from, to, pill, cta }
async function sceneRise(D, assets, P) {
  const H0 = await hookTexts(D, P, { l1: 'LİSTEYİ', l2: 'SALLADI!', s1: 220, s2: 240 });
  const pillTop = await pillImg({ text: D.pill, size: 40, fill: P.badgeText, bg: P.badge });
  const nums = new Map();
  for (let n = D.to; n <= D.from; n++) nums.set(n, await textImg({ lines: `#${n}`, size: 330, fill: '#fff', stroke: 'rgba(0,0,0,0.25)' }));
  const finalNum = await textImg({ lines: `#${D.to}`, size: 330, fill: P.accent, stroke: 'rgba(0,0,0,0.25)' });
  const jump = await textImg({ lines: `${D.from}. sıradan ${D.to}. sıraya`, size: 62, fill: '#fff', weight: 800 });
  const artistT = await textImg({ lines: D.artist, size: 60, fill: '#fff', weight: 700 });
  const titleT = await textImg({ lines: D.title, size: 84, fill: P.accent });
  const cta = await pillImg({ text: D.cta ?? 'Sence zirveye çıkar mı?', size: 46, fill: P.badgeText, bg: P.accent, padX: 48, padY: 24 });
  const upBadge = await pillImg({ text: `+${D.from - D.to}`, size: 70, fill: '#03140a', bg: '#1DB954', padX: 52, padY: 26 });
  const HOOK_END = 3.3;
  const T0 = 4.0;
  const T1 = 5.8;
  return {
    dur: 16,
    async frame(t, bands) {
      const bass = bassOf(bands);
      const L = [];
      const pre = t < HOOK_END + 0.3;
      L.push(svgLayer(fxSvg(baseFx(P, t, { bars: t > HOOK_END ? BARS(bands, P) : null, extra: { chevrons: pre && t < HOOK_END + 0.1 } }))));
      if (pre) {
        const ex = HOOK_END - 0.3;
        L.push(popIn(pillTop, t, 0.0, W / 2, 190, { dur: 0.4, rise: -40 }));
        L.push(slam(H0.artist, t, 0.1, W / 2, 470, { exit: ex }));
        L.push(slam(H0.title, t, 0.5, W / 2, 650, { exit: ex }));
        L.push(slam(H0.l1, t, 1.1, W / 2, 1010, { exit: ex }));
        L.push(slam(H0.l2, t, 1.5, W / 2, 1290, { exit: ex, from: 3 }));
      }
      if (t >= HOOK_END) {
        L.push(popIn(pillTop, t, HOOK_END, W / 2, 150, { dur: 0.4 }));
        L.push(...centerLayers(assets.center, { t, t0: HOOK_END + 0.05, cx: W / 2, cy: 560, bass, tilt: 8 }));
        if (t >= T0 - 0.2) {
          const p = easeInOut((t - T0) / (T1 - T0));
          const n = t < T0 ? D.from : Math.round(lerp(D.from, D.to, p));
          const done = t >= T1;
          const bump = done ? 1 + 0.2 * Math.exp(-9 * (t - T1)) * Math.cos(26 * (t - T1)) : 1;
          const img = done ? finalNum : nums.get(clamp(n, D.to, D.from));
          L.push(layer(img, { cx: W / 2, cy: 1090 + (done ? 0 : 6 * Math.sin(t * 50)), scale: bump * clamp((t - (T0 - 0.2)) / 0.2) }));
        }
        L.push(popIn(upBadge, t, T1 + 0.05, 830, 360, { dur: 0.5 }));
        L.push(fadeIn(jump, t, T1 + 0.2, W / 2, 1290, { dur: 0.4 }));
        L.push(fadeIn(artistT, t, T1 + 0.5, W / 2, 1385, { dur: 0.4 }));
        L.push(popIn(titleT, t, T1 + 0.7, W / 2, 1475, { dur: 0.5 }));
        L.push(popIn(cta, t, 8.4, W / 2, 1660, { dur: 0.5, scale: 1 + 0.03 * Math.sin(t * 5) }));
      }
      L.push(burstLayer(t, [{ t0: T1, x: W / 2, y: 1000, n: 90, seed: 4 }], P));
      L.push(flashLayer(0.8 * Math.exp(-9 * Math.max(0, t - HOOK_END)) * (t >= HOOK_END ? 1 : 0)));
      L.push(flashLayer(0.45 * Math.exp(-10 * Math.max(0, t - T1)) * (t >= T1 ? 1 : 0)));
      return L;
    },
  };
}

// new: D = { artist, title, dateText, pill, hook1, hook2, sub, badge, cta }
async function sceneNew(D, assets, P) {
  const artistHook = await textImg({ lines: D.artist.toLocaleUpperCase('tr'), size: 200, fill: P.hi, stroke: OUTLINE });
  const hook1 = await textImg({ lines: D.hook1, size: 104, fill: '#fff' });
  const hook2 = await textImg({ lines: D.hook2, size: 300, fill: P.accent });
  const pillTop = await pillImg({ text: D.pill, size: 40, fill: P.badgeText, bg: P.badge });
  const titlePill = await pillImg({ text: D.title, size: 60, fill: '#fff', bg: 'rgba(0,0,0,0.55)', padX: 54, padY: 28, weight: 800 });
  const artistT = await textImg({ lines: D.artist.toLocaleUpperCase('tr'), size: 118, fill: '#fff', stroke: 'rgba(0,0,0,0.25)' });
  const subT = await textImg({ lines: D.sub, size: 58, fill: '#fff', weight: 700 });
  const titleT = await textImg({ lines: D.title, size: 96, fill: P.accent });
  const dateT = D.dateText ? await textImg({ lines: D.dateText, size: 46, fill: SOFT, weight: 700, shadow: false }) : null;
  const badge = await pillImg({ text: D.badge, size: 62, fill: '#fff', bg: '#E8174B', padX: 46, padY: 22 });
  const cta = await pillImg({ text: D.cta, size: 44, fill: P.badgeText, bg: P.accent, padX: 48, padY: 24 });
  const HOOK_END = 3.4;
  return {
    dur: 16,
    async frame(t, bands) {
      const bass = bassOf(bands);
      const L = [];
      const pre = t < HOOK_END + 0.3;
      L.push(svgLayer(fxSvg(baseFx(P, t, { bars: t > HOOK_END ? BARS(bands, P) : null }))));
      if (pre) {
        const ex = HOOK_END - 0.3;
        L.push(popIn(pillTop, t, 0.0, W / 2, 190, { dur: 0.4, rise: -40 }));
        L.push(slam(artistHook, t, 0.1, W / 2, 620, { exit: ex, from: 3, shake: 14 }));
        L.push(slam(hook1, t, 0.6, W / 2, 840, { exit: ex }));
        L.push(slam(hook2, t, 1.05, W / 2, 1150, { exit: ex, from: 3.2, shake: 18 }));
        L.push(fadeIn(titlePill, t, 1.8, W / 2, 1450, { dur: 0.4, exit: ex }));
      }
      if (t >= HOOK_END) {
        L.push(popIn(pillTop, t, HOOK_END, W / 2, 150, { dur: 0.4 }));
        const dt = t - (HOOK_END + 0.05);
        L.push(...centerLayers(assets.center, { t, t0: HOOK_END + 0.05, cx: W / 2, cy: 600, pop: easeOutBack(dt / 0.7), bass, tilt: -20 }));
        L.push(popIn(badge, t, HOOK_END + 0.7, 250, 300, { dur: 0.45 }));
        L.push(slam(artistT, t, HOOK_END + 0.55, W / 2, 1215, { from: 1.8, shake: 12 }));
        L.push(fadeIn(subT, t, HOOK_END + 0.9, W / 2, 1335, { dur: 0.4 }));
        L.push(popIn(titleT, t, HOOK_END + 1.15, W / 2, 1435, { dur: 0.5 }));
        if (dateT) L.push(fadeIn(dateT, t, HOOK_END + 1.5, W / 2, 1532, { dur: 0.4 }));
        L.push(popIn(cta, t, 8.6, W / 2, 1660, { dur: 0.5, scale: 1 + 0.03 * Math.sin(t * 5) }));
      }
      L.push(burstLayer(t, [{ t0: HOOK_END + 0.1, x: W / 2, y: 700, n: 110, seed: 8 }], P));
      L.push(flashLayer(0.85 * Math.exp(-9 * Math.max(0, t - HOOK_END)) * (t >= HOOK_END ? 1 : 0)));
      return L;
    },
  };
}

// top5: D = { items:[{rank,title,artist,sub,cover}], intro:{l1,l2,big,small}, pill, outroHead, showRank, cta }
async function sceneTop5(D, P) {
  const items = D.items;
  const N = items.length;
  const INTRO = 2.6;
  const SL = 3.4;
  const OUTRO = 4.2;
  const slides = [];
  for (const it of items) {
    slides.push({
      center: await makeCenter(it.cover, 640, P),
      num: D.showRank ? await textImg({ lines: String(it.rank), size: 420, fill: P.accent, stroke: 'rgba(0,0,0,0.3)' }) : null,
      title: await textImg({ lines: it.title, size: 76, fill: '#fff', maxW: 960 }),
      artist: await textImg({ lines: it.artist, size: 52, fill: 'rgba(255,255,255,0.82)', weight: 700, maxW: 960 }),
      sub: it.sub ? await pillImg({ text: it.sub, size: 40, fill: P.badgeText, bg: P.badge, padX: 36, padY: 18 }) : null,
      bg: await studioBackground(it.cover),
    });
  }
  const l1 = await textImg({ lines: D.intro.l1, size: 120, fill: '#fff' });
  const l2 = await textImg({ lines: D.intro.l2, size: 150, fill: P.accent });
  const big = await textImg({ lines: D.intro.big, size: 460, fill: '#fff', stroke: 'rgba(0,0,0,0.3)' });
  const small = await textImg({ lines: D.intro.small, size: 112, fill: P.accent });
  const pillTop = await pillImg({ text: D.pill, size: 40, fill: P.badgeText, bg: P.badge });
  const newBadge = await pillImg({ text: 'YENİ', size: 70, fill: '#fff', bg: '#E8174B', padX: 46, padY: 22 });
  const dot = Buffer.from('<svg width="40" height="40"><circle cx="20" cy="20" r="12" fill="#fff"/></svg>');
  const outHead = await textImg({ lines: D.outroHead, size: 96, fill: P.accent });
  const rows = [];
  for (const it of [...items].reverse()) {
    const cov = await roundedImg(it.cover, 132, 22);
    const rank = await textImg({ lines: D.showRank ? String(it.rank) : '•', size: 90, fill: P.accent, shadow: false });
    const t1 = await textImg({ lines: it.title, size: 48, fill: '#fff', weight: 800, maxW: 640, shadow: false });
    const t2 = await textImg({ lines: it.artist, size: 36, fill: 'rgba(255,255,255,0.75)', weight: 700, maxW: 640, shadow: false });
    const rw = 960;
    const rh = 168;
    const base = Buffer.from(`<svg width="${rw}" height="${rh}"><rect width="${rw}" height="${rh}" rx="30" fill="#000" fill-opacity="0.5"/></svg>`);
    const buf = await sharp(base)
      .composite([
        { input: rank.buf, left: 24, top: Math.round((rh - rank.h) / 2) },
        { input: cov.buf, left: 128, top: 18 },
        { input: t1.buf, left: 284, top: 34 },
        { input: t2.buf, left: 284, top: 94 },
      ])
      .png()
      .toBuffer();
    rows.push({ buf, w: rw, h: rh });
  }
  const cta = await pillImg({ text: D.cta, size: 44, fill: P.badgeText, bg: P.accent, padX: 48, padY: 24 });
  const slideStart = (i) => INTRO + i * SL;
  const outroStart = INTRO + SL * N;
  return {
    dur: outroStart + OUTRO,
    INTRO,
    SL,
    N,
    bgFor(t) {
      const idx = t < INTRO ? -1 : Math.min(N - 1, Math.floor((t - INTRO) / SL));
      return idx;
    },
    slides,
    slideStart,
    async frame(t, bands) {
      const bass = bassOf(bands);
      const L = [];
      const idx = t < INTRO ? -1 : Math.min(N - 1, Math.floor((t - INTRO) / SL));
      const inOutro = t >= outroStart;
      L.push(svgLayer(fxSvg(baseFx(P, t, { bars: !inOutro && t > 0.5 ? { bands, y: 1800, height: 150, color: P.bars } : null }))));
      if (t < INTRO) {
        L.push(popIn(pillTop, t, 0.0, W / 2, 190, { dur: 0.4, rise: -40 }));
        L.push(slam(l1, t, 0.15, W / 2, 560, { exit: INTRO - 0.3 }));
        L.push(slam(l2, t, 0.45, W / 2, 740, { exit: INTRO - 0.3, from: 3 }));
        L.push(slam(big, t, 0.8, 330, 1170, { exit: INTRO - 0.3, from: 3.4, shake: 18 }));
        L.push(slam(small, t, 1.1, 770, 1230, { exit: INTRO - 0.3, from: 3 }));
      } else if (!inOutro) {
        const s = slides[idx];
        const st = slideStart(idx);
        const dt = t - st;
        L.push(layer(pillTop, { cx: W / 2, cy: 130, scale: 1 }));
        for (let i = 0; i < N; i++) {
          const active = i <= idx;
          L.push(layer({ buf: dot, w: 40, h: 40 }, { cx: W / 2 + (i - (N - 1) / 2) * 50, cy: 230, scale: active ? 0.9 + 0.2 * (i === idx ? Math.max(0, Math.exp(-6 * dt)) : 0) : 0.55, opacity: active ? 1 : 0.35 }));
        }
        L.push(...centerLayers(s.center, { t, t0: st, cx: W / 2, cy: 930, pop: 1, bass }));
        if (s.num) L.push(slam(s.num, t, st, 230, 440, { from: 3.2, shake: 20, dur: 0.28 }));
        else L.push(popIn(newBadge, t, st + 0.05, 230, 400, { dur: 0.4 }));
        L.push(fadeIn(s.title, t, st + 0.3, W / 2, 1400, { dur: 0.35 }));
        L.push(fadeIn(s.artist, t, st + 0.42, W / 2, 1480, { dur: 0.35 }));
        if (s.sub) L.push(popIn(s.sub, t, st + 0.6, W / 2, 1565, { dur: 0.4 }));
      } else {
        L.push(slam(outHead, t, outroStart, W / 2, 250, { from: 2, dur: 0.3 }));
        rows.forEach((r, i) => L.push(popIn(r, t, outroStart + 0.35 + i * 0.18, W / 2, 470 + i * 196, { dur: 0.45, rise: 60 })));
        L.push(popIn(cta, t, outroStart + 1.6, W / 2, 1530, { dur: 0.5, scale: 1 + 0.03 * Math.sin(t * 5) }));
      }
      L.push(burstLayer(t, [{ t0: slideStart(N - 1) + 0.1, x: W / 2, y: 930, n: 90, seed: 12 }], P));
      for (let i = 0; i < N; i++) L.push(flashLayer(0.55 * Math.exp(-11 * Math.max(0, t - slideStart(i))) * (t >= slideStart(i) ? 1 : 0)));
      L.push(flashLayer(0.6 * Math.exp(-9 * Math.max(0, t - outroStart)) * (t >= outroStart ? 1 : 0)));
      return L;
    },
  };
}

// ------------------------------------------------------------ disari acilan fonksiyon
// spec: { scene: 'anniv'|'rise'|'new'|'top5', palette: 'altin'|'studio', data }
// data.cover: Buffer (anniv/rise/new), data.audioUrl: string. top5 icin data.items[i].cover / audioUrl.
// Donus: MP4 Buffer. Ses bulunamazsa hata firlatir.
export async function renderVideo({ scene, palette = 'studio', data }) {
  textCache = new Map();
  const P = PAL[palette];
  if (!P) throw new Error(`Bilinmeyen palet: ${palette}`);
  const work = await mkdtemp(join(tmpdir(), 'ttscene-'));
  try {
    let sc;
    let bgMain = null;
    let audioSegs;
    if (scene === 'top5') {
      sc = await sceneTop5(data, P);
      audioSegs = [];
      const { INTRO, SL, N } = sc;
      const withAudio = data.items.map((it, i) => ({ it, i })).filter((x) => x.it.audioUrl);
      if (withAudio.length === 0) throw new Error('Hicbir sarki icin ses onizlemesi yok');
      const first = withAudio[0].it;
      audioSegs.push({ url: first.audioUrl, ss: 5, d: INTRO + 0.6, at: 0, vol: 0.9, fin: 0.2, fout: 0.5 });
      for (const { it, i } of withAudio) audioSegs.push({ url: it.audioUrl, ss: 8, d: SL + 0.5, at: INTRO + i * SL - 0.05, vol: 1, fin: 0.12, fout: 0.45 });
      const lastAudio = withAudio[withAudio.length - 1].it;
      audioSegs.push({ url: lastAudio.audioUrl, ss: 8 + SL + 0.4, d: 4.4, at: INTRO + SL * N, vol: 0.9, fin: 0.1, fout: 1.6 });
    } else {
      if (!data.audioUrl) throw new Error('Ses onizlemesi yok');
      const assets = { center: await makeCenter(data.cover, 700, P) };
      bgMain = await studioBackground(data.cover);
      const builders = { anniv: sceneAnniv, rise: sceneRise, new: sceneNew };
      if (!builders[scene]) throw new Error(`Bilinmeyen sahne: ${scene}`);
      sc = await builders[scene](data, assets, P);
      audioSegs = [{ url: data.audioUrl, ss: 0, d: sc.dur, at: 0, fin: 0.3, fout: 1.5 }];
    }

    const dur = sc.dur;
    const wav = join(work, 'audio.wav');
    await buildAudio(audioSegs, dur, wav, work);
    const bandsAll = await analyze(wav, dur);
    const bandAt = (t) => bandsAll[Math.min(bandsAll.length - 1, Math.max(0, Math.round(t * FPS)))];

    const renderFrame = async (t) => {
      const bands = bandAt(t);
      const L = await sc.frame(t, bands);
      let bg;
      if (scene === 'top5') {
        const idx = sc.bgFor(t);
        const cur = sc.slides[Math.max(0, idx)];
        bg = await cur.bg.frame(t, bassOf(bands));
        if (idx > 0 && t - sc.slideStart(idx) < 0.35) {
          const prev = await sc.slides[idx - 1].bg.frame(t, bassOf(bands));
          const a = easeOutCubic((t - sc.slideStart(idx)) / 0.35);
          const opt = { raw: { width: W, height: H, channels: 4 } };
          const fade = await sharp(bg, opt).ensureAlpha().linear([1, 1, 1, a], [0, 0, 0, 0]).raw().toBuffer();
          bg = await sharp(prev, opt).composite([{ input: fade, ...opt, left: 0, top: 0 }]).raw().toBuffer();
        }
      } else {
        bg = await bgMain.frame(t, bassOf(bands));
      }
      const items = (await Promise.all(L)).filter(Boolean);
      return sharp(bg, { raw: { width: W, height: H, channels: 4 } }).composite(items).removeAlpha().raw().toBuffer();
    };

    const out = join(work, 'out.mp4');
    const ff = spawn('ffmpeg', [
      '-y', '-v', 'error',
      '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-framerate', String(FPS), '-i', 'pipe:0',
      '-i', wav,
      '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart',
      out,
    ]);
    let ffErr = '';
    ff.stderr.on('data', (d) => (ffErr += d));
    const done = new Promise((res, rej) => {
      ff.on('error', rej);
      ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}: ${ffErr.slice(-300)}`))));
    });
    ff.stdin.on('error', () => {});
    const frames = Math.round(dur * FPS);
    for (let f = 0; f < frames; f++) {
      const buf = await renderFrame(f / FPS);
      if (!ff.stdin.write(buf)) await Promise.race([new Promise((r) => ff.stdin.once('drain', r)), done]);
    }
    ff.stdin.end();
    await done;
    return await readFile(out);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
