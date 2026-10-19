// Remotion sahneleri icin veri + ses hazirligi.
// Her fonksiyon { composition, dataKey, data, assets } dondurur; remotionRender.js bunu video/ klasorune yazip render eder.
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { getTrackThumbnail } from './dailyChart.js';
import {
  run,
  FPS,
  makeSfx,
  fetchBuf,
  findHookStart,
  hueOf,
  analyzeBands,
  mixMusicAndSfx,
} from './videoAudio.js';

const MONTHS = ['OCA', 'ŞUB', 'MAR', 'NİS', 'MAY', 'HAZ', 'TEM', 'AĞU', 'EYL', 'EKİ', 'KAS', 'ARA'];

async function withTmp(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'ttvid-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function squareJpeg(buf, size, quality = 90) {
  return sharp(buf).resize(size, size, { fit: 'cover' }).jpeg({ quality }).toBuffer();
}

async function readFileBuf(path) {
  const { readFile } = await import('node:fs/promises');
  return readFile(path);
}

// tek sarkilik muzik parcasi: [delay] sonra baslar, lo-fi/hi-fi gecisi opsiyonel
async function buildMusic({ prev, hookSS, segD, delayMs, dur, out, filterSweep }) {
  let graph;
  if (filterSweep) {
    const { from, to, lowpass, highpass } = filterSweep;
    const lo = `${highpass ? `highpass=f=${highpass},` : ''}lowpass=f=${lowpass}`;
    graph =
      `[0:a]atrim=start=${hookSS}:duration=${segD},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo,asplit=2[l][c];` +
      `[l]${lo},volume='1-clip((t-${from})/${to - from},0,1)':eval=frame[lo];` +
      `[c]volume='clip((t-${from})/${to - from},0,1)':eval=frame[hi];` +
      `[lo][hi]amix=inputs=2:normalize=0,afade=t=in:d=0.05,afade=t=out:st=${Math.max(0, segD - 1.1)}:d=1.1,adelay=${delayMs}|${delayMs},apad=whole_dur=${dur}[m]`;
  } else {
    graph =
      `[0:a]atrim=start=${hookSS}:duration=${segD},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st=${Math.max(0, segD - 1.3)}:d=1.3,` +
      `aformat=sample_rates=44100:channel_layouts=stereo,adelay=${delayMs}|${delayMs},apad=whole_dur=${dur}[m]`;
  }
  // Sure sinirini cikista (-t) uyguluyoruz: apad sonrasi atrim, yeni ffmpeg surumlerinde sesi erken kesiyor.
  await run('ffmpeg', ['-y', '-v', 'error', '-i', prev, '-filter_complex', graph, '-map', '[m]', '-t', String(dur), '-ar', '44100', '-ac', '2', out]);
}

// ---------------------------------------------------------------- Yeni cikis ("yukleniyor... DROP")
export async function prepNewRelease({ artist, title, cover, audioUrl, dateText, pill, loadingLabel, radarLabel, cta }) {
  const DUR = 16;
  const LOAD_END = 3.6;
  const DROP = 3.72;
  const OUTRO = 14.1;
  const cover800 = await squareJpeg(cover, 800, 92);
  const hue = await hueOf(sharp, cover800);

  return withTmp(async (dir) => {
    const prev = join(dir, 'prev.bin');
    await writeFile(prev, await fetchBuf(audioUrl));
    const hookSS = await findHookStart(prev, DUR - DROP - 1.2);

    const sfx = makeSfx(DUR, 7);
    sfx.riser(0, LOAD_END, 0.6);
    sfx.heartbeat(0.35, LOAD_END - 0.05);
    sfx.boom(DROP, 0.95, 70);
    sfx.slowdown(OUTRO, 1.1, 900, 0.35);
    sfx.whoosh(OUTRO, 1.0, 0.4, 6000, 300);
    await sfx.writeWav(join(dir, 'sfx.wav'));

    await buildMusic({
      prev,
      hookSS,
      segD: DUR - DROP - 1.2,
      delayMs: Math.round(DROP * 1000),
      dur: DUR,
      out: join(dir, 'music.wav'),
    });
    await mixMusicAndSfx(join(dir, 'music.wav'), join(dir, 'sfx.wav'), join(dir, 'mix.wav'));
    const bands = await analyzeBands(join(dir, 'music.wav'), DUR);

    return {
      composition: 'NewRelease',
      dataKey: 'new',
      data: {
        artist,
        title,
        dateText,
        hue,
        fps: FPS,
        durationSeconds: DUR,
        loadEnd: LOAD_END,
        drop: DROP,
        outro: OUTRO,
        hookStart: hookSS,
        bands,
        ...(pill ? { pill } : {}),
        ...(loadingLabel ? { loadingLabel } : {}),
        ...(radarLabel ? { radarLabel } : {}),
        ...(cta ? { cta } : {}),
      },
      assets: [
        { name: 'new-cover.jpg', buffer: cover800 },
        { name: 'new-soundtrack.wav', buffer: await readFileBuf(join(dir, 'mix.wav')) },
      ],
    };
  });
}

// ---------------------------------------------------------------- Yil donumu ("VHS geri sarma")
// Arka plan: ComfyUI ile (tek seferlik, yerelde) uretilmis nostalji odasi dongusu; repoda video/assets/anniv-bg.mp4. Yoksa null.
async function loadAnnivBackground() {
  const path = join(process.cwd(), 'video', 'assets', 'anniv-bg.mp4');
  if (!existsSync(path)) return null;
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]);
  return { buffer: await readFileBuf(path), seconds: Number(stdout.trim()) };
}

// era: dönem girisi varsa { introSeconds, knobAt, hp, lp }. Bu modda geri sarma sesi (motor, tiklar, cizirti) yok ve sarki, girisin devami olarak
// kesintisiz calar (radyo sesinden tam banda acilir).
export async function prepAnniversary({ artist, title, releaseDate, cover, audioUrl }, { era = null } = {}) {
  const DUR = 18;
  const REW_S = 1.8;
  const REW_E = 6.6;
  const OFF = 16.4;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(releaseDate ?? '');
  if (!m) throw new Error(`Gecersiz yayin tarihi: ${releaseDate}`);
  const releaseYear = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const yearNow = new Date().getUTCFullYear();
  const years = yearNow - releaseYear;
  if (years < 1) throw new Error('Yil donumu icin en az 1 yil gerekir');
  const cover800 = await squareJpeg(cover, 800, 92);
  const hue = await hueOf(sharp, cover800);
  const bg = await loadAnnivBackground();

  return withTmp(async (dir) => {
    const prev = join(dir, 'prev.bin');
    await writeFile(prev, await fetchBuf(audioUrl));
    const segD = OFF - REW_E;
    const eraMusic = era ? era.introSeconds - era.knobAt : 0; // girisde calan sarki suresi
    const hookSS = await findHookStart(prev, era ? eraMusic + OFF + 0.2 : segD + 0.2);

    const sfx = makeSfx(DUR, 11);
    if (era) {
      // geri sarma sesi yok: sarki devam eder; yalnizca "oynat" vurusu ve CRT kapanisi
      sfx.tick(REW_E, 0.8, 700);
      sfx.boom(REW_E, 0.5, 70);
    } else {
      sfx.hiss(0, REW_S + 0.2, 0.05);
      sfx.motor(REW_S, REW_E - 0.25, 650, 1250, 0.22);
      for (let d = 1; d <= years; d++) {
        const p = 1 - Math.pow(1 - d / years, 1 / 4);
        const t = REW_S + p * (REW_E - REW_S);
        sfx.tick(t, 0.35 + 0.5 * p, 2300 - 1200 * p);
      }
      sfx.slowdown(REW_E - 0.4, 0.4, 1100, 0.3);
      sfx.tick(REW_E, 0.95, 700);
      sfx.boom(REW_E, 0.8, 70);
      sfx.hiss(REW_E, REW_E + 4.2, 0.05);
    }
    sfx.slowdown(OFF, 0.8, 1500, 0.3);
    sfx.boom(OFF + 0.05, 0.5, 60);
    await sfx.writeWav(join(dir, 'sfx.wav'));

    if (era) {
      // Girisin tam devami: ayni sarki konumundan (hookSS + eraMusic) baslar; radyo filtresi (girisle ayni zincir, +4 dB) 1.6 sn'de tam banda acilir.
      const SWEEP = 1.6;
      const graph =
        `[0:a]atrim=start=${hookSS + eraMusic}:duration=${OFF},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo,asplit=2[l][c];` +
        `[l]highpass=f=${era.hp ?? 350},lowpass=f=${era.lp ?? 3200},acompressor=threshold=-18dB:ratio=3,volume=4dB,volume='1-clip(t/${SWEEP},0,1)':eval=frame[lo];` +
        `[c]volume='clip(t/${SWEEP},0,1)':eval=frame[hi];` +
        `[lo][hi]amix=inputs=2:normalize=0,afade=t=out:st=${OFF - 1.3}:d=1.3,apad=whole_dur=${DUR}[m]`;
      await run('ffmpeg', ['-y', '-v', 'error', '-i', prev, '-filter_complex', graph, '-map', '[m]', '-t', String(DUR), '-ar', '44100', '-ac', '2', join(dir, 'music.wav')]);
    } else {
      await buildMusic({
        prev,
        hookSS,
        segD,
        delayMs: Math.round(REW_E * 1000),
        dur: DUR,
        out: join(dir, 'music.wav'),
        filterSweep: { from: 0.5, to: 3.7, lowpass: 2800, highpass: 350 },
      });
    }
    await mixMusicAndSfx(join(dir, 'music.wav'), join(dir, 'sfx.wav'), join(dir, 'mix.wav'), 0.85);
    const bands = await analyzeBands(join(dir, 'music.wav'), DUR);

    return {
      composition: 'Anniversary',
      dataKey: 'anniv',
      meta: { hookSS },
      data: {
        artist,
        title,
        dateText: `${String(day).padStart(2, '0')}.${String(month + 1).padStart(2, '0')}.${releaseYear}`,
        day,
        monthAbbr: MONTHS[month],
        releaseYear,
        yearNow,
        years,
        hue,
        fps: FPS,
        durationSeconds: DUR,
        rewindStart: REW_S,
        rewindEnd: REW_E,
        off: OFF,
        bg: Boolean(bg),
        bgSeconds: bg?.seconds ?? 0,
        bands,
      },
      assets: [
        { name: 'anniv-cover.jpg', buffer: cover800 },
        { name: 'anniv-soundtrack.wav', buffer: await readFileBuf(join(dir, 'mix.wav')) },
        ...(bg ? [{ name: 'anniv-bg.mp4', buffer: bg.buffer }] : []),
      ],
    };
  });
}

// ---------------------------------------------------------------- Kare kapak + oynatici (X icin)
export async function prepCoverPlayer({ artist, title, cover, audioUrl, seconds = 20 }) {
  const cover1080 = await squareJpeg(cover, 1080, 92);
  const hue = await hueOf(sharp, cover1080);

  return withTmp(async (dir) => {
    const prev = join(dir, 'prev.bin');
    await writeFile(prev, await fetchBuf(audioUrl));
    const hookSS = await findHookStart(prev, seconds);
    await run('ffmpeg', [
      '-y', '-v', 'error', '-i', prev,
      '-filter_complex',
      `[0:a]atrim=start=${hookSS}:duration=${seconds},asetpts=PTS-STARTPTS,afade=t=in:d=0.25,afade=t=out:st=${seconds - 1.3}:d=1.3,aformat=sample_rates=44100:channel_layouts=stereo[m]`,
      '-map', '[m]', '-ar', '44100', '-ac', '2', join(dir, 'music.wav'),
    ]);
    const bands = await analyzeBands(join(dir, 'music.wav'), seconds);

    return {
      composition: 'CoverPlayer',
      dataKey: 'player',
      data: { artist, title, hue, fps: FPS, durationSeconds: seconds, hookStart: hookSS, bands },
      assets: [
        { name: 'player-cover.jpg', buffer: cover1080 },
        { name: 'player-soundtrack.wav', buffer: await readFileBuf(join(dir, 'music.wav')) },
      ],
    };
  });
}

// ---------------------------------------------------------------- Siralamada yukselis ("siralama yarisi")
const easeInOut = (x) => {
  x = Math.min(1, Math.max(0, x));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};
// easeInOut'un tersi
const invEaseInOut = (y) => (y < 0.5 ? Math.cbrt(y / 4) : 1 - Math.cbrt(2 * (1 - y)) / 2);

// entries: gunluk liste girdileri; featured: yukselen girdi (positionChange > 0)
export async function prepRankRise({ entries, featured, date, audioUrl }) {
  const change = featured.positionChange;
  if (!(typeof change === 'number' && change > 0)) throw new Error('Yukselis degeri yok');
  const to = featured.rank;
  const from = to + change;
  const DUR = 17;
  const START = 2.5;
  const CLIMB = Math.min(5.0, 2.0 + 0.3 * change);
  const arrival = START + CLIMB;
  const MUSIC_AT = 0.2;
  const MUSIC_END = 15.4;
  const names = (e) => e.artists.map((a) => a.name).join(' & ');
  const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : `${Math.round(n / 1e3)}K`);

  const topRank = Math.max(1, to - 6);
  const botRank = Math.min(entries.length, from + 6);
  const inWindow = entries.filter((e) => e.rank >= topRank && e.rank <= botRank);
  const assets = [];
  const rows = [];
  // kapaklar: kucuk paralel indirme
  const covers = new Map();
  const queue = [...inWindow];
  await Promise.all(
    Array.from({ length: 6 }).map(async () => {
      while (queue.length > 0) {
        const e = queue.shift();
        try {
          const url = await getTrackThumbnail(e.trackUrl);
          if (url) covers.set(e.rank, await sharp(await fetchBuf(url)).resize(240, 240, { fit: 'cover' }).jpeg({ quality: 86 }).toBuffer());
        } catch {
          /* kapak yoksa gri kutu */
        }
      }
    })
  );
  for (const e of inWindow) {
    const file = covers.has(e.rank) ? `rise-cover-${e.rank}.jpg` : null;
    if (file) assets.push({ name: file, buffer: covers.get(e.rank) });
    rows.push({
      rank: e.rank,
      title: e.trackName,
      artist: names(e),
      streams: fmt(e.streams),
      cover: file,
      featured: e.trackId === featured.trackId,
    });
  }
  const heroUrl = await getTrackThumbnail(featured.trackUrl);
  const heroBuf = await squareJpeg(await fetchBuf(heroUrl), 800, 92);
  assets.push({ name: 'rise-hero.jpg', buffer: heroBuf });
  const hue = await hueOf(sharp, heroBuf);

  return withTmp(async (dir) => {
    const prev = join(dir, 'prev.bin');
    await writeFile(prev, await fetchBuf(audioUrl));
    const segD = MUSIC_END - MUSIC_AT;
    const hookSS = await findHookStart(prev, segD);

    const sfx = makeSfx(DUR, 23);
    sfx.whoosh(0.0, START - 0.1, 0.45, 120, 2600);
    sfx.whoosh(START, CLIMB, 0.5, 500, 5200);
    const PENT = [0, 2, 4, 7, 9];
    for (let i = 0; i < change; i++) {
      // i. sira atlandiginda (pos = from - 1 - i) ding
      const y = (i + 1) / change;
      const t = START + invEaseInOut(y) * CLIMB;
      const semis = PENT[i % 5] + 12 * Math.min(2, Math.floor(i / 5));
      sfx.ding(t, 659.25 * Math.pow(2, semis / 12), 0.5, 0.35);
    }
    sfx.boom(arrival, 0.95, 82);
    [1046.5, 1318.51, 1567.98, 2093.0].forEach((f, i) => sfx.ding(arrival + 0.06 + i * 0.07, f, 0.5, 0.7));
    sfx.whoosh(15.1, 1.2, 0.5, 6000, 250);
    await sfx.writeWav(join(dir, 'sfx.wav'));

    await buildMusic({
      prev,
      hookSS,
      segD,
      delayMs: Math.round(MUSIC_AT * 1000),
      dur: DUR,
      out: join(dir, 'music.wav'),
      filterSweep: { from: START, to: arrival - MUSIC_AT, lowpass: 520 },
    });
    await mixMusicAndSfx(join(dir, 'music.wav'), join(dir, 'sfx.wav'), join(dir, 'mix.wav'));
    const bands = await analyzeBands(join(dir, 'music.wav'), DUR);
    assets.push({ name: 'rise-soundtrack.wav', buffer: await readFileBuf(join(dir, 'mix.wav')) });

    return {
      composition: 'RankRise',
      dataKey: 'rise',
      data: {
        date,
        artist: names(featured),
        title: featured.trackName,
        streams: fmt(featured.streams),
        from,
        to,
        change,
        hue,
        rows,
        start: START,
        climb: CLIMB,
        arrival,
        fps: FPS,
        durationSeconds: DUR,
        bands,
      },
      assets,
    };
  });
}

// ---------------------------------------------------------------- Top liste ("kalkis tablosu")
// items: [{ rank, title, artist, streams, change, cover(Buffer), audioUrl|null }], 3..5 oge
// header: { hookTop, hookBottom, midTop, midBottom, heroTop, closeTop, closeBottom }
export async function prepTopBoard({ items, header, heroLabel, date, dateShort }) {
  const N = items.length;
  if (N < 3) throw new Error('En az 3 sarki gerekir');
  const ordered = [...items].sort((a, b) => b.rank - a.rank); // 5 -> 1 (ekranda acilis sirasi)
  const R0 = 2.0;
  const STEP = 3.2;
  const reveal = ordered.map((_, i) => R0 + STEP * i);
  const hero = reveal[N - 1];
  const pullBack = hero + 4.6;
  const closeAt = hero + 4.8;
  const outro = hero + 7.6;
  const DUR = Math.round((outro + 1.6) * 10) / 10;

  const assets = [];
  const rows = [];
  for (const [i, it] of ordered.entries()) {
    const file = `board-cover-${it.rank}.jpg`;
    assets.push({ name: file, buffer: await squareJpeg(it.cover, 400, 88) });
    rows.push({
      rank: it.rank,
      title: it.title,
      artist: it.artist,
      streams: it.streams,
      change: typeof it.change === 'number' ? it.change : null,
      cover: file,
      revealAt: reveal[i],
    });
  }

  return withTmp(async (dir) => {
    const segs = [];
    const lead = ordered[N - 1];
    if (lead.audioUrl) segs.push({ url: lead.audioUrl, ss: 10, d: 2.1, at: 0, vol: 0.85, fin: 0.05, fout: 0.35 });
    ordered.forEach((it, i) => {
      if (!it.audioUrl) return;
      const isLast = i === N - 1;
      segs.push({
        url: it.audioUrl,
        ss: isLast ? 6 : 8,
        d: isLast ? outro + 1.4 - reveal[i] : reveal[i + 1] - reveal[i] + 0.5,
        at: reveal[i],
        vol: 0.95,
        fin: 0.12,
        fout: isLast ? 1.4 : 0.45,
      });
    });
    if (segs.length === 0) throw new Error('Hicbir sarki icin ses onizlemesi yok');

    const args = ['-y', '-v', 'error'];
    const parts = [];
    for (const [i, s] of segs.entries()) {
      const p = join(dir, `seg${i}.bin`);
      await writeFile(p, await fetchBuf(s.url));
      args.push('-i', p);
      parts.push(
        `[${i}:a]atrim=start=${s.ss}:duration=${s.d},asetpts=PTS-STARTPTS,afade=t=in:d=${s.fin},afade=t=out:st=${Math.max(0, s.d - s.fout)}:d=${s.fout},volume=${s.vol},aformat=sample_rates=44100:channel_layouts=stereo,adelay=${Math.round(s.at * 1000)}|${Math.round(s.at * 1000)}[s${i}]`
      );
    }
    const mix = segs.length > 1 ? `${segs.map((_, i) => `[s${i}]`).join('')}amix=inputs=${segs.length}:normalize=0:duration=longest,` : '[s0]';
    await run('ffmpeg', [
      ...args,
      '-filter_complex',
      `${parts.join(';')};${mix}atrim=0:${DUR},apad=whole_dur=${DUR}[m]`,
      '-map', '[m]', '-ar', '44100', '-ac', '2', join(dir, 'music.wav'),
    ], { maxBuffer: 1 << 26 });

    const sfx = makeSfx(DUR, 42);
    sfx.clatter(0.0, 1.9, 150, 0.55);
    for (const r of reveal) sfx.clatter(r, 1.5, 70, 0.5);
    sfx.clatter(outro, 1.5, 120, 0.5);
    sfx.boom(hero + 0.15, 0.9, 90);
    sfx.boom(R0 - 0.02, 0.7, 90);
    await sfx.writeWav(join(dir, 'sfx.wav'));
    await mixMusicAndSfx(join(dir, 'music.wav'), join(dir, 'sfx.wav'), join(dir, 'mix.wav'));
    const bands = await analyzeBands(join(dir, 'music.wav'), DUR);
    assets.push({ name: 'board-soundtrack.wav', buffer: await readFileBuf(join(dir, 'mix.wav')) });

    return {
      composition: 'TopBoard',
      dataKey: 'board',
      data: {
        date,
        dateShort,
        fps: FPS,
        durationSeconds: DUR,
        reveal,
        outro,
        pullBack,
        closeAt,
        header,
        heroLabel,
        rows,
        bands,
      },
      assets,
    };
  });
}

// ---------------------------------------------------------------- Duello ("hangisi daha cok dinlendi?")
// a, b: { artist, title, cover(Buffer), audioUrl, rank, streams }
const DUEL = { DUR: 17, tA: 1.6, tB: 5.6, tCount: 9.6, tReveal: 12.6, tWin: 14.4 };

async function meanVolumeDb(file, ss, d) {
  const { stderr } = await run('ffmpeg', ['-v', 'info', '-ss', String(ss), '-t', String(d), '-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
  const m = /mean_volume:\s*(-?[\d.]+) dB/.exec(stderr);
  return m ? Number(m[1]) : -20;
}

// Onizlemenin [hookSS, hookSS+segD) kismi; ortalama ses -17 dB'e esitlenir (iki sarki ayni siddette olsun)
async function duelSegment({ prev, hookSS, segD, delayMs, out, fadeOut = 0.4, dur }) {
  const gain = Math.max(-12, Math.min(12, -17 - (await meanVolumeDb(prev, hookSS, segD))));
  const graph =
    `[0:a]atrim=start=${hookSS}:duration=${segD},asetpts=PTS-STARTPTS,volume=${gain.toFixed(1)}dB,` +
    `afade=t=in:d=0.03,afade=t=out:st=${Math.max(0, segD - fadeOut)}:d=${fadeOut},` +
    `aformat=sample_rates=44100:channel_layouts=stereo,adelay=${delayMs}|${delayMs},apad=whole_dur=${dur}[m]`;
  await run('ffmpeg', ['-y', '-v', 'error', '-i', prev, '-filter_complex', graph, '-map', '[m]', '-t', String(dur), '-ar', '44100', '-ac', '2', out]);
}

export async function prepDuel({ a, b, dateShort }) {
  const { DUR, tA, tB, tCount, tReveal, tWin } = DUEL;
  const winner = a.streams >= b.streams ? 'a' : 'b';
  const coverA = await squareJpeg(a.cover, 600, 90);
  const coverB = await squareJpeg(b.cover, 600, 90);
  const hueA = await hueOf(sharp, coverA);
  const hueB = await hueOf(sharp, coverB);

  return withTmp(async (dir) => {
    const prevA = join(dir, 'a.bin');
    const prevB = join(dir, 'b.bin');
    await writeFile(prevA, await fetchBuf(a.audioUrl));
    await writeFile(prevB, await fetchBuf(b.audioUrl));
    const segA = tB - tA;
    const segB = tCount - tB;
    const ssA = await findHookStart(prevA, segA);
    const ssB = await findHookStart(prevB, segB);

    await duelSegment({ prev: prevA, hookSS: ssA, segD: segA, delayMs: Math.round(tA * 1000), out: join(dir, 'ma.wav'), dur: DUR });
    await duelSegment({ prev: prevB, hookSS: ssB, segD: segB, delayMs: Math.round(tB * 1000), out: join(dir, 'mb.wav'), dur: DUR });
    // kazananin nakarati sonuc aninda tekrar calar
    const w = winner === 'a' ? { prev: prevA, ss: ssA } : { prev: prevB, ss: ssB };
    await duelSegment({
      prev: w.prev,
      hookSS: w.ss,
      segD: DUR - tWin,
      delayMs: Math.round(tWin * 1000),
      out: join(dir, 'mw.wav'),
      fadeOut: 1.2,
      dur: DUR,
    });
    await run('ffmpeg', [
      '-y', '-v', 'error', '-i', join(dir, 'ma.wav'), '-i', join(dir, 'mb.wav'), '-i', join(dir, 'mw.wav'),
      '-filter_complex', '[0:a][1:a][2:a]amix=inputs=3:normalize=0[m]', '-map', '[m]', '-ar', '44100', '-ac', '2', join(dir, 'music.wav'),
    ]);

    const sfx = makeSfx(DUR, 41);
    sfx.whoosh(0.05, 0.65, 0.45, 150, 2400);
    sfx.whoosh(0.38, 0.65, 0.45, 150, 2400);
    sfx.tick(tA - 0.02, 0.5, 1400);
    sfx.tick(tB - 0.02, 0.5, 1400);
    // gerisayim: 3-2-1 tik + yukselen ton
    for (let i = 0; i < 3; i++) sfx.tick(tCount + i, 0.8, 900 + i * 220);
    sfx.riser(tCount + 0.2, tReveal, 0.55);
    sfx.clatter(tReveal, tWin - tReveal, 70, 0.32);
    sfx.boom(tWin, 0.9, 80);
    [1046.5, 1318.51, 1567.98, 2093.0].forEach((f, i) => sfx.ding(tWin + 0.05 + i * 0.07, f, 0.5, 0.7));
    sfx.whoosh(DUR - 1.3, 1.2, 0.4, 5000, 250);
    await sfx.writeWav(join(dir, 'sfx.wav'));
    await mixMusicAndSfx(join(dir, 'music.wav'), join(dir, 'sfx.wav'), join(dir, 'mix.wav'), 0.7);
    const bands = await analyzeBands(join(dir, 'music.wav'), DUR);

    return {
      composition: 'Duel',
      dataKey: 'duel',
      data: {
        fps: FPS,
        durationSeconds: DUR,
        tA,
        tB,
        tCount,
        tReveal,
        tWin,
        hueA,
        hueB,
        dateShort,
        a: { artist: a.artist, title: a.title, rank: a.rank, streams: a.streams },
        b: { artist: b.artist, title: b.title, rank: b.rank, streams: b.streams },
        winner,
        diff: Math.abs(a.streams - b.streams),
        bands,
      },
      assets: [
        { name: 'duel-cover-a.jpg', buffer: coverA },
        { name: 'duel-cover-b.jpg', buffer: coverB },
        { name: 'duel-soundtrack.wav', buffer: await readFileBuf(join(dir, 'mix.wav')) },
      ],
    };
  });
}

// ---------------------------------------------------------------- Donem girisli yil donumu
// Cikis yilina gore 8 sn'lik giris (ComfyUI ile uretilmis 2 sahne: video/assets/era<dönem>-s1.mp4, -s2.mp4) + ses yukselisi; ardindan "KAC YIL OLDU?".
// Ses profili: hp/lp = giristeki cihazin (radyo / PC hoparlor) frekans araligi; ana videoda tam banda acilir.
const ERAS = {
  '90s': { years: [1990, 1999], label: "90'LAR", accent: '#ffb42a', files: 'era90', INTRO: 8.0, S1_END: 5.0, KNOB: 2.8, hp: 350, lp: 3200, click: 650 },
  '2000s': { years: [2000, 2009], label: "2000'LER", accent: '#4dd2ff', files: 'era2000', INTRO: 8.0, S1_END: 5.0, KNOB: 2.4, hp: 200, lp: 7000, click: 2200 },
};

// Yayin yilina uygun dönem girisi varsa { id, cfg, s1, s2 }, yoksa null.
// Onaylanana kadar kapali: ERA_INTROS=1 ile acilir (canli akisa kendiliginden girmesin); ERA_INTROS=90s,2000s ile secilebilir.
export function eraClipsFor(releaseYear) {
  const flag = process.env.ERA_INTROS;
  if (!flag) return null;
  for (const [id, cfg] of Object.entries(ERAS)) {
    if (releaseYear < cfg.years[0] || releaseYear > cfg.years[1]) continue;
    if (flag !== '1' && !flag.split(',').includes(id)) continue;
    const dir = join(process.cwd(), 'video', 'assets');
    const s1 = join(dir, `${cfg.files}-s1.mp4`);
    const s2 = join(dir, `${cfg.files}-s2.mp4`);
    if (existsSync(s1) && existsSync(s2)) return { id, cfg, s1, s2 };
  }
  return null;
}

export async function prepAnniversaryEra(args) {
  const clips = eraClipsFor(Number(String(args.releaseDate).slice(0, 4)));
  if (!clips) throw new Error('Donem giris klipleri bulunamadi');
  const { cfg } = clips;
  const { INTRO, S1_END, KNOB } = cfg;
  const base = await prepAnniversary(args, { era: { introSeconds: INTRO, knobAt: KNOB, hp: cfg.hp, lp: cfg.lp } });

  return withTmp(async (dir) => {
    const prev = join(dir, 'prev.bin');
    await writeFile(prev, await fetchBuf(args.audioUrl));
    // Ana video ayni pencereyi kullanir: giriste duyulan kisimdan sonra sarki kesintisiz devam eder (geri sarma sesi yok)
    const { hookSS } = base.meta;

    const musicLen = INTRO - KNOB;
    const graph =
      `[0:a]atrim=start=${hookSS}:duration=${musicLen + 0.1},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo,` +
      `highpass=f=${cfg.hp},lowpass=f=${cfg.lp},acompressor=threshold=-18dB:ratio=3,` +
      `volume='0.06+0.94*pow(clip(t/${musicLen},0,1),1.7)':eval=frame,volume=4dB,afade=t=in:d=0.04,` +
      `adelay=${Math.round(KNOB * 1000)}|${Math.round(KNOB * 1000)},apad=whole_dur=${INTRO}[m]`;
    await run('ffmpeg', ['-y', '-v', 'error', '-i', prev, '-filter_complex', graph, '-map', '[m]', '-t', String(INTRO), '-ar', '44100', '-ac', '2', join(dir, 'music.wav')]);

    const sfx = makeSfx(INTRO, 57);
    sfx.hiss(0, INTRO, 0.012); // oda cizirtisi
    sfx.tick(KNOB - 0.05, 0.8, cfg.click); // dugme / fare tiki
    if (clips.id === '90s') sfx.whoosh(KNOB, 0.6, 0.12, 300, 3200); // radyo frekans taramasi
    sfx.whoosh(S1_END - 0.5, 0.5, 0.25, 200, 2400); // sahne gecisi
    sfx.riser(INTRO - 1.0, INTRO, 0.35); // ana videoya yukselis
    sfx.boom(INTRO - 0.05, 0.6, 70);
    await sfx.writeWav(join(dir, 'sfx.wav'));
    await mixMusicAndSfx(join(dir, 'music.wav'), join(dir, 'sfx.wav'), join(dir, 'mix.wav'), 0.9);
    const bands = await analyzeBands(join(dir, 'music.wav'), INTRO);

    return {
      composition: 'EraIntro',
      dataKey: 'eraintro',
      data: { introSeconds: INTRO, scene1End: S1_END, knobAt: KNOB, fps: FPS, label: cfg.label, accent: cfg.accent, bands },
      extras: [{ dataKey: base.dataKey, data: base.data }],
      assets: [
        ...base.assets,
        { name: 'eraintro-s1.mp4', buffer: await readFileBuf(clips.s1) },
        { name: 'eraintro-s2.mp4', buffer: await readFileBuf(clips.s2) },
        { name: 'eraintro-intro.wav', buffer: await readFileBuf(join(dir, 'mix.wav')) },
      ],
    };
  });
}

// Yayin yilina gore dönem girisli ya da duz yil donumu videosunu hazirlar.
export async function prepAnniversaryAuto(args) {
  return eraClipsFor(Number(String(args.releaseDate).slice(0, 4))) ? prepAnniversaryEra(args) : prepAnniversary(args);
}
