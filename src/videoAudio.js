// Remotion sahneleri icin ses yardimcilari: efekt sentezi, nakarat bulma, spektrum analizi, renk tonu.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';

export const run = promisify(execFile);
export const SR = 44100;
export const FPS = 30;

export function rngMaker(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function fetchBuf(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`Indirilemedi (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---------------------------------------------------------------- efekt sentezi
export function makeSfx(durSeconds, seed = 5) {
  const rnd = rngMaker(seed);
  const buf = new Float32Array(Math.round(durSeconds * SR));
  const add = (i, v) => {
    if (i >= 0 && i < buf.length) buf[i] += v;
  };
  return {
    buf,
    tick(t, amp = 0.5, freq = 1800) {
      const s = Math.round(t * SR);
      const n = Math.round(0.012 * SR);
      for (let k = 0; k < n; k++) {
        const tt = k / SR;
        add(s + k, amp * (Math.sin(2 * Math.PI * freq * tt) * 0.6 + (rnd() * 2 - 1) * 0.5) * Math.exp(-tt / 0.0025));
      }
    },
    // yogun tak-tak yagmuru (mekanik tabela)
    clatter(t, seconds, density, gain) {
      const n = Math.round(seconds * density);
      for (let k = 0; k < n; k++) {
        const at = t + seconds * Math.pow(rnd(), 1.25);
        const amp = gain * (0.35 + 0.65 * rnd());
        const s = Math.round(at * SR);
        const len = Math.round(0.012 * SR);
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const tt = i / SR;
          const env = Math.exp(-tt / 0.0022);
          const nz = rnd() * 2 - 1;
          lp += 0.55 * (nz - lp);
          const thump = Math.sin(2 * Math.PI * 170 * tt) * Math.exp(-tt / 0.006) * 0.55;
          add(s + i, amp * (env * (nz - lp * 0.5) * 0.9 + thump));
        }
      }
    },
    whoosh(t, dur, amp = 0.5, from = 400, to = 6000) {
      const s = Math.round(t * SR);
      const n = Math.round(dur * SR);
      let lp = 0;
      for (let k = 0; k < n; k++) {
        const u = k / n;
        const fc = from * Math.pow(to / from, u);
        const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
        lp += a * (rnd() * 2 - 1 - lp);
        add(s + k, lp * Math.sin(Math.PI * Math.min(1, u)) ** 1.3 * amp * 1.8);
      }
    },
    ding(t, freq, amp = 0.5, decay = 0.5) {
      const s = Math.round(t * SR);
      const n = Math.round(Math.min(2.5, decay * 6) * SR);
      for (let k = 0; k < n; k++) {
        const tt = k / SR;
        const e = Math.exp(-tt / decay);
        const v = Math.sin(2 * Math.PI * freq * tt) + 0.4 * Math.sin(2 * Math.PI * freq * 2 * tt) + 0.2 * Math.sin(2 * Math.PI * freq * 3.01 * tt);
        add(s + k, amp * 0.5 * v * e * Math.min(1, tt / 0.004));
      }
    },
    boom(t, amp = 0.9, f0 = 78) {
      const s = Math.round(t * SR);
      const n = Math.round(1.3 * SR);
      let lp = 0;
      for (let k = 0; k < n; k++) {
        const tt = k / SR;
        const f = f0 - 30 * Math.min(1, tt / 0.6);
        lp += 0.25 * (rnd() * 2 - 1 - lp);
        add(s + k, amp * (Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt / 0.42) + (rnd() * 2 - 1 - lp * 0.3) * Math.exp(-tt / 0.2) * 0.5));
      }
    },
    motor(t0, t1, f0, f1, amp = 0.2) {
      const s = Math.round(t0 * SR);
      const n = Math.round((t1 - t0) * SR);
      let ph = 0;
      for (let k = 0; k < n; k++) {
        const u = k / n;
        const f = f0 + (f1 - f0) * u + 18 * Math.sin(2 * Math.PI * 7 * (k / SR));
        ph += (2 * Math.PI * f) / SR;
        const env = Math.min(1, k / (0.15 * SR)) * Math.min(1, (n - k) / (0.15 * SR));
        add(s + k, amp * env * (Math.sin(ph) * 0.6 + (Math.sin(ph * 2.01) > 0 ? 0.25 : -0.25) + (rnd() * 2 - 1) * 0.25));
      }
    },
    hiss(t0, t1, amp = 0.05) {
      const s = Math.round(t0 * SR);
      const n = Math.round((t1 - t0) * SR);
      let lp = 0;
      for (let k = 0; k < n; k++) {
        lp += 0.6 * (rnd() * 2 - 1 - lp);
        add(s + k, amp * lp * Math.min(1, k / (0.2 * SR)) * Math.min(1, (n - k) / (0.2 * SR)));
      }
    },
    slowdown(t, dur, f0 = 900, amp = 0.35) {
      const s = Math.round(t * SR);
      const n = Math.round(dur * SR);
      let ph = 0;
      for (let k = 0; k < n; k++) {
        const u = k / n;
        const f = f0 * Math.pow(1 - u, 2) + 40;
        ph += (2 * Math.PI * f) / SR;
        add(s + k, amp * Math.sin(ph) * (1 - u) ** 0.5);
      }
    },
    // yukselen gurultu + yukselen ton (riser)
    riser(t0, t1, amp = 0.6) {
      const s = Math.round(t0 * SR);
      const n = Math.round((t1 - t0) * SR);
      let lp = 0;
      let phase = 0;
      for (let k = 0; k < n; k++) {
        const u = k / n;
        const cutoff = 300 * Math.pow(30, u);
        const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
        lp += a * (rnd() * 2 - 1 - lp);
        phase += (2 * Math.PI * 110 * Math.pow(12, u)) / SR;
        add(s + k, lp * (0.05 + amp * u * u) * 1.4 + Math.sin(phase) * 0.18 * u);
      }
    },
    heartbeat(t0, t1, gap0 = 0.62, shrink = 0.82, minGap = 0.11) {
      let t = t0;
      let gap = gap0;
      while (t < t1) {
        const s = Math.round(t * SR);
        const len = Math.round(0.14 * SR);
        const u = (t - t0) / (t1 - t0);
        for (let k = 0; k < len; k++) {
          const tt = k / SR;
          add(s + k, Math.sin(2 * Math.PI * (125 - 80 * Math.min(1, tt / 0.1)) * tt) * Math.exp(-tt / 0.05) * (0.5 + 0.5 * u));
        }
        t += gap;
        gap = Math.max(minGap, gap * shrink);
      }
    },
    async writeWav(path, peak = 0.85) {
      let m = 0;
      for (const v of buf) m = Math.max(m, Math.abs(v));
      const k = m > 0 ? peak / m : 1;
      const wav = Buffer.alloc(44 + buf.length * 2);
      wav.write('RIFF', 0);
      wav.writeUInt32LE(36 + buf.length * 2, 4);
      wav.write('WAVEfmt ', 8);
      wav.writeUInt32LE(16, 16);
      wav.writeUInt16LE(1, 20);
      wav.writeUInt16LE(1, 22);
      wav.writeUInt32LE(SR, 24);
      wav.writeUInt32LE(SR * 2, 28);
      wav.writeUInt16LE(2, 32);
      wav.writeUInt16LE(16, 34);
      wav.write('data', 36);
      wav.writeUInt32LE(buf.length * 2, 40);
      for (let i = 0; i < buf.length; i++) wav.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(buf[i] * k * 32767))), 44 + i * 2);
      await writeFile(path, wav);
    },
  };
}

// ---------------------------------------------------------------- nakarat penceresi
export async function findHookStart(file, hookLen) {
  const { stdout } = await run('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '8000', '-f', 'f32le', '-'], {
    encoding: 'buffer',
    maxBuffer: 1 << 27,
  });
  const pf = new Float32Array(stdout.buffer.slice(stdout.byteOffset, stdout.byteOffset + Math.floor(stdout.byteLength / 4) * 4));
  const win = 2000;
  const rms = [];
  for (let i = 0; i + win <= pf.length; i += win) {
    let s = 0;
    for (let k = 0; k < win; k++) s += pf[i + k] * pf[i + k];
    rms.push(Math.sqrt(s / win));
  }
  const wl = Math.min(rms.length, Math.round(hookLen / 0.25));
  let best = 0;
  let bestMean = -1;
  for (let i = 0; i + wl <= rms.length; i++) {
    let m = 0;
    for (let k = 0; k < wl; k++) m += rms[i + k];
    if (m > bestMean) {
      bestMean = m;
      best = i;
    }
  }
  return best * 0.25;
}

// ---------------------------------------------------------------- renk tonu
export async function hueOf(sharp, buf) {
  const { data: px } = await sharp(buf).resize(8, 8).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let best = { score: -1, r: 29, g: 185, b: 84 };
  for (let i = 0; i < px.length; i += 3) {
    const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const score = (mx - mn) * (mx / 255 + 0.3);
    if (score > best.score) best = { score, r, g, b };
  }
  const mx = Math.max(best.r, best.g, best.b, 1);
  const mn = Math.min(best.r, best.g, best.b);
  const d = mx - mn;
  if (d < 28) return 150;
  let h;
  if (mx === best.r) h = ((best.g - best.b) / d) % 6;
  else if (mx === best.g) h = (best.b - best.r) / d + 2;
  else h = (best.r - best.g) / d + 4;
  h = Math.round(h * 60);
  return h < 0 ? h + 360 : h;
}

// ---------------------------------------------------------------- spektrum
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

export async function analyzeBands(wavPath, dur, nBands = 24) {
  const { stdout } = await run('ffmpeg', ['-v', 'error', '-i', wavPath, '-ac', '1', '-ar', '22050', '-f', 'f32le', '-'], {
    encoding: 'buffer',
    maxBuffer: 1 << 28,
  });
  const samples = new Float32Array(stdout.buffer.slice(stdout.byteOffset, stdout.byteOffset + Math.floor(stdout.byteLength / 4) * 4));
  const N = 1024;
  const frames = Math.round(dur * FPS) + 1;
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
      for (let q = lo; q < hi; q++) sum += Math.hypot(re[q], im[q]);
      row.push(sum / (hi - lo));
    }
    raw.push(row);
  }
  const norm = [];
  for (let b = 0; b < nBands; b++) {
    const col = raw.map((r) => r[b]).sort((a, c) => a - c);
    norm.push(Math.max(col[Math.floor(col.length * 0.95)], 1e-6));
  }
  let prev = new Array(nBands).fill(0);
  return raw.map((row) => {
    const cur = row.map((v, b) => Math.sqrt(Math.min(1.4, v / norm[b]) / 1.4));
    prev = cur.map((v, b) => Math.max(v, prev[b] * 0.8));
    return prev.map((v) => Math.round(v * 100) / 100);
  });
}

// muzik + efekt -> tek WAV (alimiter ile)
export async function mixMusicAndSfx(musicWav, sfxWav, outWav, sfxVolume = 0.8) {
  await run('ffmpeg', [
    '-y', '-v', 'error', '-i', musicWav, '-i', sfxWav,
    '-filter_complex',
    `[0:a]volume=1.0[a];[1:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=${sfxVolume}[b];[a][b]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[o]`,
    '-map', '[o]', '-ar', '44100', '-ac', '2', outWav,
  ]);
}
