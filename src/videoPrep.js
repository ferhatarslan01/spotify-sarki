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
  rngMaker,
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
// audioUrl yoksa (ya da silent: true) SESSIZ mod: 8 sn kapak hareketi, "SPOTIFY'DA DINLE" etiketi; sahte oynatici ogesi yok.
export async function prepCoverPlayer({ artist, title, cover, audioUrl, seconds = 20, silent = false }) {
  const cover1080 = await squareJpeg(cover, 1080, 92);
  const hue = await hueOf(sharp, cover1080);

  if (silent || !audioUrl) {
    return {
      composition: 'CoverPlayer',
      dataKey: 'player',
      data: { artist, title, hue, fps: FPS, durationSeconds: 8, hookStart: 0, silent: true, label: "SPOTIFY'DA DİNLE", bands: [] },
      assets: [{ name: 'player-cover.jpg', buffer: cover1080 }],
    };
  }

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
  '80s': { years: [0, 1989], // 1980 öncesi çıkışlar da bu şablonu kullanır
    label: "80'LER", accent: '#ff5a36', files: 'era80', INTRO: 8.0, S1_END: 4.8, KNOB: 2.2, hp: 60, lp: 12000, click: 900, crackle: true },
  '90s': { years: [1990, 1999], label: "90'LAR", accent: '#ffb42a', files: 'era90', INTRO: 8.0, S1_END: 5.0, KNOB: 2.8, hp: 350, lp: 3200, click: 650 },
  '2010s': { years: [2010, 9999], // 2020 ve sonrası çıkışlar da bu şablonu kullanır
    label: "2010'LAR", accent: '#ff5fa2', files: 'era2010', INTRO: 8.0, S1_END: 4.4, KNOB: 3.5, hp: 120, lp: 10000, click: 1600 },
  '2000s': { years: [2000, 2009], label: "2000'LER", accent: '#4dd2ff', files: 'era2000', INTRO: 8.0, S1_END: 5.0, KNOB: 2.4, hp: 200, lp: 7000, click: 2200 },
};

// Yayin yilina uygun dönem girisi varsa { id, cfg, s1, s2 }, yoksa null.
// Varsayilan ACIK. ERA_INTROS=0 kapatir; ERA_INTROS=90s,2000s gibi secili donemler de verilebilir.
// Yil araliklari disindakiler en yakin donemi kullanir: 1980 oncesi -> 80'ler, 2019 sonrasi -> 2010'lar.
export function eraClipsFor(releaseYear) {
  const flag = (process.env.ERA_INTROS ?? '').trim() || '1';
  if (flag === '0') return null;
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

// Yil donumu videosunda yapay zeka (ComfyUI) goruntusu var mi? (donem girisi ya da oda arka plani) -> TikTok "AI ile uretildi" etiketi
export function annivUsesAiFootage(releaseYear) {
  return Boolean(eraClipsFor(releaseYear)) || existsSync(join(process.cwd(), 'video', 'assets', 'anniv-bg.mp4'));
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
    if (cfg.crackle) {
      // plak cizirtisi: igne indikten sonra seyrek tikirtilar
      const rnd = rngMaker(81);
      for (let t = KNOB; t < INTRO; t += 0.04 + rnd() * 0.16) sfx.tick(t, 0.03 + rnd() * 0.1, 2500 + rnd() * 3500);
    }
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

// ---------------------------------------------------------------- "Yeni cikti" sablon ailesi
// Her sablon: Remotion bileseni + sure/acilis zamani + ses efekti tasarimi (+ ops. ComfyUI arka plan dongusu: video/assets/<bg>).
// Hepsi ortak veri dosyasini (nrvar) ve ayni ses kurgusunu (acilistan once yukselis/vuruslar, acilista sarki baslar) kullanir.
export const NR_TEMPLATES = {
  fragman: {
    composition: 'NRFragman',
    DUR: 15,
    REVEAL: 6.2,
    OUTRO: 13.0,
    bg: 'nr-fragman-bg.mp4',
    sfx(sfx, c) {
      sfx.riser(0.2, c.REVEAL - 0.12, 0.7);
      sfx.boom(1.0, 0.5, 62); // BU HAFTA
      sfx.boom(2.5, 0.7, 60); // YENI BIR SARKI
      sfx.boom(4.1, 0.95, 56); // SANATCI
      sfx.boom(c.REVEAL, 1.0, 72);
      sfx.whoosh(c.REVEAL, 0.9, 0.5, 400, 7000);
      sfx.whoosh(c.OUTRO, 1.2, 0.4, 5000, 250);
    },
  },
};

NR_TEMPLATES.bulten = {
  composition: 'NRBulten',
  DUR: 15,
  REVEAL: 2.6,
  OUTRO: 13.2,
  bg: 'nr-bulten-bg.mp4',
  sfx(sfx, c) {
    // haber jenerigi: acilis vurusu + uc notalik jingle, sonra acilista vurus
    sfx.boom(0.15, 0.8, 80);
    sfx.whoosh(0.1, 0.4, 0.5, 300, 5000);
    [523.25, 659.25, 783.99].forEach((f, i) => sfx.ding(0.3 + i * 0.16, f, 0.55, 0.45));
    sfx.riser(1.3, c.REVEAL - 0.1, 0.5);
    sfx.boom(c.REVEAL, 0.9, 70);
    sfx.whoosh(c.REVEAL + 0.3, 0.6, 0.35, 500, 4500);
    sfx.whoosh(c.OUTRO, 1.2, 0.35, 5000, 250);
  },
};

NR_TEMPLATES.kilit = {
  composition: 'NRKilit',
  DUR: 15,
  REVEAL: 3.4,
  OUTRO: 13.2,
  bg: null,
  sfx(sfx, c) {
    // telefon bildirimi: iki kisa titresim + bildirim tonu, dokunus tiki, acilista yumusak vurus
    sfx.motor(1.1, 1.22, 70, 70, 0.35);
    sfx.motor(1.3, 1.42, 70, 70, 0.35);
    sfx.ding(1.12, 1318.5, 0.5, 0.45);
    sfx.ding(1.3, 1760, 0.4, 0.5);
    sfx.tick(c.REVEAL - 0.5, 0.6, 900);
    sfx.whoosh(c.REVEAL - 0.1, 0.5, 0.3, 300, 3500);
    sfx.boom(c.REVEAL, 0.55, 90);
    sfx.whoosh(c.OUTRO, 1.2, 0.3, 5000, 250);
  },
};

NR_TEMPLATES.neon = {
  composition: 'NRNeon',
  DUR: 15,
  REVEAL: 5.2,
  OUTRO: 13.0,
  bg: 'nr-neon-bg.mp4',
  sfx(sfx, c) {
    // neon tupler: ariza cizirtilari + harflerin yanisi, sonra acilis vurusu
    sfx.hiss(0.9, 1.8, 0.07);
    [0.9, 1.0, 1.12, 1.25, 1.45].forEach((x) => sfx.tick(x, 0.5, 2600));
    sfx.boom(1.5, 0.5, 66);
    for (let i = 0; i < 7; i++) sfx.tick(2.4 + i * 0.07, 0.35, 3200);
    sfx.riser(3.4, c.REVEAL - 0.08, 0.6);
    sfx.boom(c.REVEAL, 1.0, 68);
    sfx.whoosh(c.REVEAL, 0.8, 0.45, 600, 7000);
    sfx.whoosh(c.OUTRO, 1.2, 0.35, 5000, 250);
  },
};

NR_TEMPLATES.kaset = {
  composition: 'NRKaset',
  DUR: 15,
  REVEAL: 3.2,
  OUTRO: 13.2,
  bg: 'nr-kaset-bg.mp4',
  sfx(sfx, c) {
    // kaset: masaya dusus, kalem hissi, PLAY tusu (tik-tak) + bant sesi (hiss + motor), sonra sarki
    sfx.boom(0.9, 0.5, 120);
    sfx.clatter(1.3, 1.0, 14, 0.12);
    sfx.tick(c.REVEAL - 0.35, 0.9, 700);
    sfx.tick(c.REVEAL - 0.3, 0.5, 1500);
    sfx.hiss(c.REVEAL - 0.3, c.REVEAL + 1.4, 0.08);
    sfx.motor(c.REVEAL - 0.3, c.REVEAL + 0.7, 60, 140, 0.18);
    sfx.whoosh(c.OUTRO, 1.2, 0.3, 5000, 250);
  },
};

// ---- izleyiciyi tutan sablonlar: merak boslugu + geri sayim + canlanan akis (ComfyUI gerektirmez)
NR_TEMPLATES.tahmin = {
  composition: 'NRTahmin',
  DUR: 15,
  REVEAL: 9.0,
  OUTRO: 13.2,
  musicAt: 0.4, // sarki bastan calar: izleyici dinleyerek tahmin eder
  bg: null,
  sfx(sfx, c) {
    // geri sayim tiklari (her saniye, giderek sertlesir), ipucu zilleri, son 2 sn yukselis, acilista vurus
    for (let s = 1; s < c.REVEAL - 0.4; s++) sfx.tick(s, 0.35 + 0.5 * (s / c.REVEAL), 1500 + s * 90);
    sfx.ding(3.5, 1174.7, 0.35, 0.35);
    sfx.ding(6.0, 1318.5, 0.4, 0.35);
    sfx.riser(c.REVEAL - 2.0, c.REVEAL - 0.05, 0.55);
    sfx.boom(c.REVEAL, 1.0, 70);
    sfx.whoosh(c.REVEAL, 0.8, 0.45, 500, 7000);
    sfx.whoosh(c.OUTRO, 1.2, 0.35, 5000, 250);
  },
};

NR_TEMPLATES.radyo = {
  composition: 'NRRadyo',
  DUR: 15,
  REVEAL: 5.4,
  OUTRO: 13.2,
  musicAt: 1.0, // zayif sinyal: bantli + cizirtili baslar, istasyon oturunca berraklasir
  sweep: { from: 3.2, to: 4.6, lowpass: 2400, highpass: 450 },
  bg: null,
  sfx(sfx, c) {
    // parazit + ayar dugmesi hareketleri; REVEAL'da sinyal yakalanir
    sfx.hiss(0.0, c.REVEAL + 0.6, 0.12);
    sfx.whoosh(0.6, 0.7, 0.3, 300, 2600);
    sfx.whoosh(1.7, 0.6, 0.3, 2600, 400);
    sfx.whoosh(2.7, 0.8, 0.3, 400, 3000);
    sfx.whoosh(3.8, 0.7, 0.3, 3000, 600);
    sfx.whoosh(4.6, 0.7, 0.25, 700, 1900);
    sfx.tick(c.REVEAL - 0.05, 0.7, 700);
    sfx.ding(c.REVEAL, 880, 0.4, 0.5);
    sfx.boom(c.REVEAL, 0.5, 80);
    sfx.whoosh(c.OUTRO, 1.2, 0.3, 5000, 250);
  },
};

NR_TEMPLATES.mesaj = {
  composition: 'NRMesaj',
  DUR: 16,
  REVEAL: 9.0,
  OUTRO: 14.0,
  bg: null,
  sfx(sfx, c) {
    // mesaj gelisi: yumusak "pop" (gelen) ve "swish" (giden); acilista vurus
    const incoming = [0.8, 2.0, 5.2, 6.6];
    incoming.forEach((t) => {
      sfx.ding(t, 1568, 0.35, 0.18);
      sfx.ding(t + 0.07, 2093, 0.25, 0.15);
    });
    sfx.whoosh(3.7, 0.3, 0.3, 900, 4200); // giden mesaj
    sfx.whoosh(c.REVEAL - 0.5, 0.35, 0.3, 900, 4200); // giden: "Hemen aciyorum"
    sfx.tick(c.REVEAL - 0.1, 0.5, 900);
    sfx.boom(c.REVEAL, 0.6, 85);
    sfx.whoosh(c.OUTRO, 1.2, 0.3, 5000, 250);
  },
};

// Varsa ComfyUI arka plan dongusu (video/assets/<dosya>)
async function loadNrBackground(file) {
  if (!file) return null;
  const path = join(process.cwd(), 'video', 'assets', file);
  if (!existsSync(path)) return null;
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]);
  return { buffer: await readFileBuf(path), seconds: Number(stdout.trim()) };
}

// Secilebilir yeni cikti sablonlari ('drop' = ilk, yukleniyor->DROP sablonu). NR_ONLY=fragman,drop,... ile kisitlanabilir.
export function newReleasePool(names = ['drop', ...Object.keys(NR_TEMPLATES)]) {
  const only = (process.env.NR_ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return only.length ? names.filter((n) => only.includes(n)) : names;
}

function seedHash(seed) {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

// Durumsuz secim (yedek): sarki kimligine gore sabit ama rastgele; ayni sarki hep ayni sablonu alir.
export function pickNewReleaseTemplate(seed, names) {
  const pool = newReleasePool(names);
  return pool.length ? pool[seedHash(seed) % pool.length] : null;
}

// Sirali dongu: en uzun suredir kullanilmayan sablon secilir (hic kullanilmayanlar once), bir onceki sablon tekrarlanmaz.
// Esitlikte sarki kimligi karar verir. history: eskiden yeniye kullanilan sablon adlari.
export function chooseLeastRecentTemplate(seed, pool, history) {
  if (pool.length === 0) return null;
  const last = history.at(-1);
  const cands = pool.length > 1 ? pool.filter((n) => n !== last) : pool;
  const age = (n) => history.lastIndexOf(n); // -1: hic kullanilmadi
  const oldest = Math.min(...cands.map(age));
  const ties = cands.filter((n) => age(n) === oldest);
  return ties[seedHash(seed) % ties.length];
}

// Gercek yeni cikti icin sablon adi (durumsuz yedek). NR_VARIANTS=0 -> hep 'drop'.
export function newReleaseVariantFor(seed) {
  if (process.env.NR_VARIANTS === '0' || !seed) return 'drop';
  return pickNewReleaseTemplate(seed) ?? 'drop';
}

// ComfyUI (yapay zeka) arka plani kullanan sablonlar TikTok/X'te "AI ile uretildi" etiketi alir.
export function nrVariantUsesAi(name) {
  return Boolean(NR_TEMPLATES[name]?.bg);
}

export async function prepNewReleaseVariant(template, { artist, title, cover, audioUrl, dateText }) {
  const cfg = NR_TEMPLATES[template];
  if (!cfg) throw new Error(`Bilinmeyen yeni cikti sablonu: ${template}`);
  const { DUR, REVEAL, OUTRO } = cfg;
  // sarki varsayilan olarak acilista baslar; musicAt ile erkene alinabilir (tahmin/radyo), sweep ile bantli sesten berraklasir
  const musicAt = cfg.musicAt ?? REVEAL;
  const cover800 = await squareJpeg(cover, 800, 92);
  const hue = await hueOf(sharp, cover800);
  const bg = await loadNrBackground(cfg.bg);

  return withTmp(async (dir) => {
    const prev = join(dir, 'prev.bin');
    await writeFile(prev, await fetchBuf(audioUrl));
    const segD = DUR - musicAt - 1.2;
    const hookSS = await findHookStart(prev, segD);

    const sfx = makeSfx(DUR, 17);
    cfg.sfx(sfx, cfg);
    await sfx.writeWav(join(dir, 'sfx.wav'));
    await buildMusic({
      prev,
      hookSS,
      segD,
      delayMs: Math.round(musicAt * 1000),
      dur: DUR,
      out: join(dir, 'music.wav'),
      filterSweep: cfg.sweep,
    });
    await mixMusicAndSfx(join(dir, 'music.wav'), join(dir, 'sfx.wav'), join(dir, 'mix.wav'));
    const bands = await analyzeBands(join(dir, 'music.wav'), DUR);

    return {
      composition: cfg.composition,
      dataKey: 'nrvar',
      data: {
        artist,
        title,
        dateText,
        hue,
        fps: FPS,
        durationSeconds: DUR,
        reveal: REVEAL,
        outro: OUTRO,
        hookStart: hookSS,
        bands,
        bg: Boolean(bg),
        bgSeconds: bg?.seconds ?? 0,
      },
      assets: [
        { name: 'nrvar-cover.jpg', buffer: cover800 },
        { name: 'nrvar-soundtrack.wav', buffer: await readFileBuf(join(dir, 'mix.wav')) },
        ...(bg ? [{ name: 'nrvar-bg.mp4', buffer: bg.buffer }] : []),
      ],
    };
  });
}

// ---------------------------------------------------------------- "Yukselen sarki" sablon ailesi (RankRise'a ek profesyonel gorunumler)
// Hepsi ayni gercek veriyi kullanir: dun/bugun sirasi, gunluk + toplam stream, listedeki komsu sarkilar. Uydurma veri yok.
const invSmoothstep = (y) => 0.5 - Math.sin(Math.asin(1 - 2 * Math.min(1, Math.max(0, y))) / 3);

// sira atlandikca tik: odometre ile ayni yumusak egri (smoothstep)
function tickRanks(sfx, c, amp, freq) {
  const n = Math.min(c.change, 28);
  for (let i = 1; i <= n; i++) sfx.tick(c.START + invSmoothstep(i / n) * (c.ARRIVAL - c.START), amp, freq + i * 25);
}

export const RISE_TEMPLATES = {
  // Piyasa raporu: finans terminali (ticker, sira grafigi, istatistik paneli, kayan komsu listesi)
  terminal: {
    composition: 'RiseTerminal',
    DUR: 16,
    START: 2.0,
    ARRIVAL: 5.6,
    OUTRO: 14.0,
    sfx(sfx, c) {
      for (let i = 0; i < 6; i++) sfx.tick(0.5 + i * 0.09, 0.3, 2400); // sembol yaziliyor
      sfx.riser(c.START, c.ARRIVAL, 0.4);
      tickRanks(sfx, c, 0.28, 2600);
      sfx.boom(c.ARRIVAL, 0.8, 78);
      [880, 1318.5, 1760].forEach((f, i) => sfx.ding(c.ARRIVAL + 0.05 + i * 0.08, f, 0.4, 0.6));
      for (let i = 0; i < 8; i++) sfx.tick(c.ARRIVAL + 0.5 + i * 0.16, 0.22, 3000); // istatistik sayaclari
      sfx.whoosh(c.OUTRO, 1.1, 0.35, 5000, 250);
    },
  },
  // Canli yayin: TV/spor grafigi (DUN -> BUGUN, donen sira gostergesi, +N slam, alt bant)
  yayin: {
    composition: 'RiseYayin',
    DUR: 16,
    START: 2.6,
    ARRIVAL: 5.6,
    OUTRO: 14.0,
    sfx(sfx, c) {
      sfx.whoosh(0.2, 0.7, 0.55, 300, 6000);
      sfx.boom(0.5, 0.85, 72); // SIRA ATLADI vurusu
      sfx.whoosh(c.START - 0.4, 0.5, 0.35, 500, 3000);
      tickRanks(sfx, c, 0.4, 1500);
      sfx.whoosh(c.START, c.ARRIVAL - c.START, 0.4, 400, 4800);
      sfx.boom(c.ARRIVAL, 1.0, 66);
      [784, 1046.5, 1318.5, 1568].forEach((f, i) => sfx.ding(c.ARRIVAL + 0.04 + i * 0.07, f, 0.45, 0.7));
      sfx.whoosh(c.ARRIVAL + 1.1, 0.5, 0.35, 700, 5200); // alt bant girisi
      sfx.whoosh(c.OUTRO, 1.1, 0.35, 5000, 250);
    },
  },
  // Roket (gorev kontrol): sira = irtifa; geri sayim, kalkis, yuk teslimi
  roket: {
    composition: 'RiseRoket',
    DUR: 17,
    START: 2.6,
    ARRIVAL: 6.0,
    OUTRO: 14.2,
    sfx(sfx, c) {
      [0.2, 0.9, 1.6].forEach((t) => sfx.tick(t, 0.5, 900)); // geri sayim
      sfx.tick(c.START, 0.7, 1500);
      sfx.motor(1.9, c.ARRIVAL + 0.2, 38, 110, 0.3); // motor
      sfx.hiss(1.9, c.ARRIVAL + 0.6, 0.11); // ates
      sfx.boom(c.START, 1.0, 58);
      sfx.whoosh(c.START, c.ARRIVAL - c.START, 0.35, 300, 4200);
      tickRanks(sfx, c, 0.2, 2200);
      sfx.slowdown(c.ARRIVAL + 0.1, 0.6, 400, 0.2); // motor kesildi
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => sfx.ding(c.ARRIVAL + 0.1 + i * 0.12, f, 0.42, 0.7)); // misyon basarili
      sfx.tick(c.ARRIVAL + 1.0, 0.4, 2800);
      sfx.whoosh(c.OUTRO, 1.1, 0.35, 5000, 250);
    },
  },
  // Transfer haberi: SON DAKIKA -> sozlesme + imza -> RESMEN damgasi -> forma (numara = yeni sira)
  transfer: {
    composition: 'RiseTransfer',
    DUR: 17,
    START: 3.2,
    ARRIVAL: 5.8,
    OUTRO: 14.2,
    sfx(sfx, c) {
      sfx.boom(0.2, 0.8, 78);
      sfx.whoosh(0.1, 0.5, 0.5, 300, 5500);
      [523.25, 659.25, 783.99].forEach((f, i) => sfx.ding(0.35 + i * 0.15, f, 0.5, 0.45)); // haber jenerigi
      for (let i = 0; i < 32; i++) sfx.tick(1.55 + i * 0.04, 0.16, 2600 + (i % 5) * 80); // haber yaziliyor
      sfx.whoosh(2.6, 0.6, 0.4, 400, 3500); // sozlesme kagidi
      sfx.hiss(c.ARRIVAL - 1.15, c.ARRIVAL - 0.15, 0.06); // kalem
      tickRanks(sfx, c, 0.2, 2400);
      sfx.boom(c.ARRIVAL, 1.0, 66); // damga
      sfx.tick(c.ARRIVAL, 0.9, 500);
      sfx.whoosh(c.ARRIVAL + 0.05, 0.9, 0.5, 600, 7000); // konfeti / tribun
      [880, 1108.7, 1318.5, 1760].forEach((f, i) => sfx.ding(c.ARRIVAL + 0.1 + i * 0.08, f, 0.4, 0.6));
      sfx.whoosh(6.9, 0.6, 0.35, 500, 4000); // forma
      sfx.ding(7.7, 1046.5, 0.4, 0.6);
      sfx.whoosh(c.OUTRO, 1.1, 0.35, 5000, 250);
    },
  },
  // Hiz radari: sinir 10 sira/gun, radar okumasi, flas, ceza makbuzu
  radar: {
    composition: 'RiseRadar',
    DUR: 17,
    START: 2.4,
    ARRIVAL: 5.2,
    OUTRO: 14.0,
    marks: { print: 6.8, step: 0.36, stamp: 11.5 },
    sfx(sfx, c) {
      sfx.hiss(0.0, 1.2, 0.04); // gece ortami
      sfx.whoosh(1.1, c.ARRIVAL - 1.1, 0.45, 200, 3800); // arac yaklasiyor
      let tt = c.START;
      let gap = 0.34;
      while (tt < c.ARRIVAL) {
        sfx.tick(tt, 0.32, 2300 + (tt - c.START) * 400); // radar bipleri hizlanir
        gap = Math.max(0.07, gap * 0.88);
        tt += gap;
      }
      sfx.tick(c.ARRIVAL, 0.9, 600); // deklansor
      sfx.tick(c.ARRIVAL + 0.05, 0.7, 1300);
      sfx.whoosh(c.ARRIVAL - 0.15, 0.5, 0.5, 7000, 300); // flas sarji
      sfx.boom(c.ARRIVAL, 0.8, 90);
      [0, 1, 2].forEach((i) => sfx.ding(c.ARRIVAL + 0.25 + i * 0.18, 1568, 0.32, 0.15)); // alarm
      sfx.whoosh(c.marks.print - 0.6, 0.5, 0.35, 500, 3000); // makbuz
      sfx.clatter(c.marks.print, 12 * c.marks.step, 22, 0.12); // yazici
      sfx.boom(c.marks.stamp, 0.7, 100);
      sfx.tick(c.marks.stamp, 0.8, 500);
      sfx.whoosh(c.OUTRO, 1.1, 0.35, 5000, 250);
    },
  },
  // Dergi karti: duz renk bloklari + dev tipografi, kart gecisleri
  kart: {
    composition: 'RiseKart',
    DUR: 17,
    START: 3.5,
    ARRIVAL: 5.3,
    OUTRO: 12.8,
    marks: { c2: 3.0, c3: 7.0 },
    sfx(sfx, c) {
      [0.2, 0.6, 1.0].forEach((t, i) => sfx.whoosh(t, 0.35, 0.3, 700 + i * 200, 3600));
      sfx.whoosh(c.marks.c2 - 0.3, 0.55, 0.5, 300, 5500);
      tickRanks(sfx, c, 0.3, 2000);
      sfx.boom(c.ARRIVAL, 0.9, 74);
      sfx.whoosh(c.marks.c3 - 0.3, 0.55, 0.5, 300, 5500);
      [7.4, 7.7, 8.0].forEach((t, i) => sfx.ding(t, 987.8 * (1 + i * 0.25), 0.3, 0.3));
      sfx.whoosh(c.OUTRO - 0.3, 0.55, 0.5, 300, 5500);
      sfx.whoosh(c.OUTRO + 3, 0.9, 0.3, 4000, 300);
    },
  },
};

// Yukselen sarki sablonlari ('rise' = mevcut siralama merdiveni). RISE_ONLY=terminal,yayin,... ile kisitlanabilir.
export function risePool(names = ['rise', ...Object.keys(RISE_TEMPLATES)]) {
  const only = (process.env.RISE_ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return only.length ? names.filter((n) => only.includes(n)) : names;
}

// Durumsuz yedek secim: sarki kimligine gore sabit.
export function riseVariantFor(seed) {
  if (process.env.RISE_VARIANTS === '0' || !seed) return 'rise';
  const pool = risePool();
  if (pool.length === 0) return 'rise';
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

export async function prepRiseVariant(template, { entries, featured, date, audioUrl }) {
  const cfg = RISE_TEMPLATES[template];
  if (!cfg) throw new Error(`Bilinmeyen yukselis sablonu: ${template}`);
  const change = featured.positionChange;
  if (!(typeof change === 'number' && change > 0)) throw new Error('Yukselis degeri yok');
  const to = featured.rank;
  const from = to + change;
  const { DUR, START, ARRIVAL, OUTRO } = cfg;
  const MUSIC_AT = 0.3;
  const names = (e) => e.artists.map((a) => a.name).join(' & ');

  const heroUrl = await getTrackThumbnail(featured.trackUrl);
  const heroBuf = await squareJpeg(await fetchBuf(heroUrl), 800, 92);
  const hue = await hueOf(sharp, heroBuf);
  // listedeki komsular (gercek siralama): kayan bant icin
  const neighbors = entries
    .filter((e) => e.rank >= Math.max(1, to - 4) && e.rank <= to + 6)
    .map((e) => ({
      rank: e.rank,
      title: e.trackName,
      artist: names(e),
      change: typeof e.positionChange === 'number' ? e.positionChange : e.positionChange === 'NEW' ? 'NEW' : null,
      featured: e.trackId === featured.trackId,
    }));

  return withTmp(async (dir) => {
    const prev = join(dir, 'prev.bin');
    await writeFile(prev, await fetchBuf(audioUrl));
    const segD = DUR - MUSIC_AT - 0.6;
    const hookSS = await findHookStart(prev, segD);

    const sfx = makeSfx(DUR, 29);
    cfg.sfx(sfx, { ...cfg, change });
    await sfx.writeWav(join(dir, 'sfx.wav'));
    await buildMusic({
      prev,
      hookSS,
      segD,
      delayMs: Math.round(MUSIC_AT * 1000),
      dur: DUR,
      out: join(dir, 'music.wav'),
      filterSweep: { from: START, to: Math.max(START + 0.5, ARRIVAL - MUSIC_AT), lowpass: 700 },
    });
    await mixMusicAndSfx(join(dir, 'music.wav'), join(dir, 'sfx.wav'), join(dir, 'mix.wav'));
    const bands = await analyzeBands(join(dir, 'music.wav'), DUR);

    return {
      composition: cfg.composition,
      dataKey: 'risev',
      data: {
        date,
        artist: names(featured),
        title: featured.trackName,
        from,
        to,
        change,
        daily: Number.isFinite(featured.streams) ? featured.streams : 0,
        total: Number.isFinite(featured.totalStreams) ? featured.totalStreams : 0,
        hue,
        neighbors,
        start: START,
        arrival: ARRIVAL,
        outro: OUTRO,
        marks: cfg.marks ?? {},
        fps: FPS,
        durationSeconds: DUR,
        hookStart: hookSS,
        bands,
      },
      assets: [
        { name: 'risev-cover.jpg', buffer: heroBuf },
        { name: 'risev-soundtrack.wav', buffer: await readFileBuf(join(dir, 'mix.wav')) },
      ],
    };
  });
}

// ---------------------------------------------------------------- Haftalik liste sablon ailesi (TopBoard'a ek)
// Haftalik veriden (kworb): sira degisimi (weekChange), listede kac hafta (weeks), en yuksek sira (peak/peakTimes), haftalik stream (+ fark) ve toplam.
// Tum rakamlar gercek; kartlar veriden turetilir (en cok yukselen, yeni giris, kidemli...).
const wkFmt = (n) => (n >= 1e7 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)));
const wkNames = (e) => e.artists.map((a) => a.name).join(' & ');

export const WEEKLY_TEMPLATES = {
  // Hit listesi geri sayimi: 10 -> 1, ustte o anki sarki karti, altta liste asagidan yukari dolar
  countdown: {
    composition: 'WeeklyCountdown',
    N: 10,
    INTRO: 2.4,
    STEP: 1.15,
    HERO_LEN: 5.6,
    TAIL: 2.4,
  },
  // Haftanin raporu: story kartlari (zirve, en cok yukselen, yeni giris, kidemli, Top 5)
  rapor: {
    composition: 'WeeklyRapor',
    INTRO: 1.8,
    CARD: 3.0,
    TOP5: 4.2,
    TAIL: 2.4,
  },
};

export function weeklyPool(names = ['board', ...Object.keys(WEEKLY_TEMPLATES)]) {
  const only = (process.env.WEEKLY_ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return only.length ? names.filter((n) => only.includes(n)) : names;
}

export function weeklyVariantFor(seed) {
  if (process.env.WEEKLY_VARIANTS === '0' || !seed) return 'board';
  const pool = weeklyPool();
  if (pool.length === 0) return 'board';
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

// Rapor kartlari: veriden turetilir; olmayan kart atlanir. En fazla 4 bilgi karti + Top 5 ozeti.
export function weeklyCards(entries) {
  const top = entries[0];
  const second = entries[1];
  const cards = [];
  const used = new Set();
  const take = (e) => used.add(e.trackId);

  // 1) zirve
  const ratio = second && second.streams > 0 ? top.streams / second.streams : null;
  const zPills = [];
  if (ratio && ratio >= 1.2) zPills.push(`2. SIRADAKİNİN ${ratio.toFixed(1).replace('.', ',')} KATI`);
  if (top.weekChange === 'NEW') zPills.push('ZİRVEYE DOĞRUDAN GİRİŞ');
  else if (top.peak === 1 && top.peakTimes > 1) zPills.push(`${top.peakTimes} HAFTADIR ZİRVEDE`);
  else if (top.weeks) zPills.push(`${top.weeks}. HAFTA LİSTEDE`);
  cards.push({ type: 'zirve', label: 'HAFTANIN ZİRVESİ', entry: top, big: { value: top.streams / 1e6, decimals: 2, prefix: '', suffix: 'M' }, caption: 'HAFTALIK DİNLENME', pills: zPills.slice(0, 2) });
  take(top);

  const cands = [];
  // 2) en cok yukselen (ilk 100 icinde, yeni giris degil)
  const riser = entries
    .filter((e) => e.rank <= 100 && typeof e.weekChange === 'number' && e.weekChange > 0 && !used.has(e.trackId))
    .sort((a, b) => b.weekChange - a.weekChange || a.rank - b.rank)[0];
  if (riser) cands.push({ type: 'yukselen', label: 'EN ÇOK YÜKSELEN', entry: riser, big: { value: riser.weekChange, decimals: 0, prefix: '+', suffix: '' }, caption: 'SIRA YÜKSELDİ', pills: [`#${riser.rank + riser.weekChange} → #${riser.rank}`, `${wkFmt(riser.streams)} DİNLENME`] });
  // 3) en yuksek yeni giris (zirvedeki haric)
  const news = entries.filter((e) => e.weekChange === 'NEW');
  const newBest = news.filter((e) => !used.has(e.trackId)).sort((a, b) => a.rank - b.rank)[0];
  if (newBest) cands.push({ type: 'yeni', label: 'EN YÜKSEK YENİ GİRİŞ', entry: newBest, big: { value: newBest.rank, decimals: 0, prefix: '#', suffix: '' }, caption: 'LİSTEYE YENİ GİRDİ', pills: [`BU HAFTA ${news.length} YENİ ŞARKI`, `${wkFmt(newBest.streams)} DİNLENME`] });
  // 4) kidemli (ilk 20, en cok hafta)
  const vet = entries
    .slice(0, 20)
    .filter((e) => e.weeks && e.weeks >= 8 && !used.has(e.trackId))
    .sort((a, b) => b.weeks - a.weeks || a.rank - b.rank)[0];
  if (vet) cands.push({ type: 'kidemli', label: 'LİSTENİN KIDEMLİSİ', entry: vet, big: { value: vet.weeks, decimals: 0, prefix: '', suffix: '' }, caption: 'HAFTADIR LİSTEDE', pills: [vet.peak === 1 ? `${vet.peakTimes} HAFTA ZİRVEDE` : `EN YÜKSEK #${vet.peak}`, `ŞU AN #${vet.rank}`] });
  // 5) haftalik dinlenmesi en cok artan (yedek kart)
  const gainer = entries
    .slice(0, 50)
    .filter((e) => typeof e.streamsChange === 'number' && e.streamsChange > 0 && !used.has(e.trackId))
    .sort((a, b) => b.streamsChange - a.streamsChange)[0];
  if (gainer) cands.push({ type: 'artan', label: 'EN ÇOK İVMELENEN', entry: gainer, big: { value: gainer.streamsChange / 1e6, decimals: 2, prefix: '+', suffix: 'M' }, caption: 'GEÇEN HAFTAYA GÖRE DİNLENME', pills: [`ŞU AN #${gainer.rank}`, `${wkFmt(gainer.streams)} DİNLENME`] });

  // ayni sarki birden cok kartta tekrarlanmasin
  for (const c of cands) {
    if (cards.length >= 4) break;
    if (used.has(c.entry.trackId)) continue;
    cards.push(c);
    take(c.entry);
  }
  return cards;
}

export async function prepWeeklyVariant(template, { entries, date, audioUrl }) {
  const cfg = WEEKLY_TEMPLATES[template];
  if (!cfg) throw new Error(`Bilinmeyen haftalik sablon: ${template}`);
  if (entries.length < 6) throw new Error('Haftalik liste cok kisa');

  const coverOf = async (e, size, quality = 88) => squareJpeg(await fetchBuf(await getTrackThumbnail(e.trackUrl)), size, quality);
  const assets = [];
  let data;
  let DUR;
  let sfxPlan;
  let sweep = null;
  const MUSIC_AT = 0.3;

  if (template === 'countdown') {
    const { N, INTRO, STEP, HERO_LEN, TAIL } = cfg;
    const top = entries.slice(0, N);
    const items = [];
    for (const e of [...top].reverse()) {
      const file = `wk-c${e.rank}.jpg`;
      const buf = await coverOf(e, 600);
      assets.push({ name: file, buffer: buf });
      items.push({
        rank: e.rank,
        title: e.trackName,
        artist: wkNames(e),
        streams: wkFmt(e.streams),
        change: e.weekChange,
        weeks: e.weeks,
        peak: e.peak,
        peakTimes: e.peakTimes,
        cover: file,
        hue: await hueOf(sharp, buf),
      });
    }
    const HERO = INTRO + (items.length - 1) * STEP;
    const OUTRO = HERO + HERO_LEN;
    DUR = Math.round((OUTRO + TAIL) * 10) / 10;
    data = { kind: 'countdown', items, cards: [], cardStarts: [], start: INTRO, step: STEP, hero: HERO, outro: OUTRO, intro: INTRO, cardLen: 0, top5Len: 0 };
    sweep = { from: Math.max(0, INTRO - MUSIC_AT), to: HERO - MUSIC_AT, lowpass: 600 };
    sfxPlan = (sfx) => {
      sfx.boom(0.2, 0.8, 76);
      sfx.whoosh(0.1, 0.6, 0.5, 300, 5500);
      [523.25, 659.25, 783.99].forEach((f, i) => sfx.ding(0.4 + i * 0.14, f, 0.4, 0.45));
      for (let i = 0; i < items.length - 1; i++) {
        const t = INTRO + i * STEP;
        sfx.whoosh(t - 0.05, 0.35, 0.34, 300, 4200);
        sfx.tick(t + 0.1, 0.4, 1800 + i * 90);
        sfx.ding(t + 0.12, 440 * Math.pow(2, (i * 2) / 12), 0.22, 0.25);
      }
      sfx.riser(HERO - 1.3, HERO, 0.6);
      sfx.boom(HERO, 1.0, 66);
      [784, 1046.5, 1318.5, 1568].forEach((f, i) => sfx.ding(HERO + 0.05 + i * 0.08, f, 0.45, 0.8));
      sfx.whoosh(OUTRO, 1.1, 0.35, 5000, 250);
    };
  } else {
    const { INTRO, CARD, TOP5, TAIL } = cfg;
    const cards = weeklyCards(entries);
    const out = [];
    for (const [i, c] of cards.entries()) {
      const file = `wk-r${i}.jpg`;
      const buf = await coverOf(c.entry, 720, 90);
      assets.push({ name: file, buffer: buf });
      out.push({
        type: c.type,
        label: c.label,
        title: c.entry.trackName,
        artist: wkNames(c.entry),
        rank: c.entry.rank,
        cover: file,
        hue: await hueOf(sharp, buf),
        big: c.big,
        caption: c.caption,
        pills: c.pills,
        rows: [],
      });
    }
    // Top 5 ozeti
    const rows = [];
    for (const e of entries.slice(0, 5)) {
      const file = `wk-t${e.rank}.jpg`;
      assets.push({ name: file, buffer: await coverOf(e, 220, 84) });
      rows.push({ rank: e.rank, title: e.trackName, artist: wkNames(e), change: e.weekChange, weeks: e.weeks, cover: file });
    }
    out.push({ type: 'top5', label: "HAFTANIN TOP 5'İ", title: '', artist: '', rank: 1, cover: rows[0].cover, hue: out[0].hue, big: { value: 0, decimals: 0, prefix: '', suffix: '' }, caption: '', pills: [], rows });
    const cardStarts = out.map((c, i) => INTRO + i * CARD);
    const top5Start = cardStarts[out.length - 1];
    const OUTRO = top5Start + TOP5;
    DUR = Math.round((OUTRO + TAIL) * 10) / 10;
    data = { kind: 'rapor', items: [], cards: out, cardStarts, start: INTRO, step: CARD, hero: top5Start, outro: OUTRO, intro: INTRO, cardLen: CARD, top5Len: TOP5 };
    sfxPlan = (sfx) => {
      sfx.boom(0.2, 0.8, 76);
      sfx.whoosh(0.05, 0.6, 0.5, 300, 5500);
      for (const [i, st] of cardStarts.entries()) {
        sfx.whoosh(st - 0.18, 0.4, 0.4, 300, 4500);
        if (i < cardStarts.length - 1) {
          sfx.ding(st + 0.2, 659.25 * Math.pow(2, (i * 3) / 12), 0.4, 0.5);
          for (let k = 0; k < 9; k++) sfx.tick(st + 0.45 + k * 0.09, 0.22, 2200 + k * 70); // sayac
          sfx.boom(st + 1.35, 0.5, 90);
        } else {
          for (let k = 0; k < 5; k++) sfx.ding(st + 0.35 + k * 0.45, 523.25 * Math.pow(2, (k * 2) / 12), 0.3, 0.3);
        }
      }
      sfx.whoosh(OUTRO, 1.1, 0.35, 5000, 250);
    };
  }

  const bg = {};
  return withTmp(async (dir) => {
    const music = join(dir, 'music.wav');
    if (audioUrl) {
      const prev = join(dir, 'prev.bin');
      await writeFile(prev, await fetchBuf(audioUrl));
      const segD = DUR - MUSIC_AT - 0.6;
      const hookSS = await findHookStart(prev, segD);
      bg.hookSS = hookSS;
      await buildMusic({ prev, hookSS, segD, delayMs: Math.round(MUSIC_AT * 1000), dur: DUR, out: music, filterSweep: sweep ?? undefined });
    } else {
      bg.hookSS = 0;
      await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', String(DUR), music]);
    }
    const sfx = makeSfx(DUR, 31);
    sfxPlan(sfx);
    await sfx.writeWav(join(dir, 'sfx.wav'));
    await mixMusicAndSfx(music, join(dir, 'sfx.wav'), join(dir, 'mix.wav'), 0.8, 0.78); // uzun sure surekli muzik: biraz kisik
    const bands = await analyzeBands(music, DUR);

    return {
      composition: cfg.composition,
      dataKey: 'wk',
      data: { date, hue: data.items?.length ? data.items[data.items.length - 1].hue : data.cards[0].hue, fps: FPS, durationSeconds: DUR, hookStart: bg.hookSS, bands, ...data },
      assets: [...assets, { name: 'wk-soundtrack.wav', buffer: await readFileBuf(join(dir, 'mix.wav')) }],
    };
  });
}
