// Remotion sahnelerini render eder: video/ projesini (gerekirse) kurar, veriyi ve varliklari yazar,
// `remotion render` calistirip MP4 Buffer dondurur. Renderlar sirayla calisir.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const execFileP = promisify(execFile);
const WIN = process.platform === 'win32';
const VIDEO_DIR = resolve(process.cwd(), 'video');

// Bundle derlenirken dort sahnenin de veri dosyasi bulunmali; eksik olanlara iskelet yazilir.
const STUBS = {
  board: {
    date: '',
    dateShort: '',
    fps: 30,
    durationSeconds: 10,
    reveal: [2, 5.2, 8.4],
    outro: 15,
    pullBack: 12,
    closeAt: 12.2,
    header: { hookTop: '', hookBottom: '', midTop: '', midBottom: '', heroTop: '', closeTop: '', closeBottom: '' },
    heroLabel: '',
    rows: [3, 2, 1].map((rank, i) => ({ rank, title: '', artist: '', streams: '', change: null, cover: `board-cover-${rank}.jpg`, revealAt: 2 + i * 3.2 })),
    bands: [],
  },
  new: { artist: '', title: '', dateText: '', hue: 30, fps: 30, durationSeconds: 16, loadEnd: 3.6, drop: 3.72, outro: 14.1, hookStart: 0, bands: [] },
  rise: {
    date: '',
    artist: '',
    title: '',
    streams: '',
    from: 8,
    to: 5,
    change: 3,
    hue: 30,
    rows: [5, 6, 7, 8].map((rank) => ({ rank, title: '', artist: '', streams: '', cover: null, featured: rank === 8 })),
    start: 2.5,
    climb: 3,
    arrival: 5.5,
    fps: 30,
    durationSeconds: 17,
    bands: [],
  },
  risev: { date: '', artist: '', title: '', from: 8, to: 5, change: 3, daily: 0, total: 0, hue: 30, neighbors: [], start: 2, arrival: 5.6, outro: 14, marks: {}, fps: 30, durationSeconds: 16, hookStart: 0, bands: [] },
  player: { artist: '', title: '', hue: 30, fps: 30, durationSeconds: 20, hookStart: 0, silent: false, label: '', bands: [] },
  nrvar: { artist: '', title: '', dateText: '', hue: 30, fps: 30, durationSeconds: 15, reveal: 6.2, outro: 13, hookStart: 0, bands: [], bg: false, bgSeconds: 0 },
  eraintro: { introSeconds: 8, scene1End: 5, knobAt: 3, fps: 30, label: '', accent: '#ffb42a', bands: [] },
  duel: {
    fps: 30,
    durationSeconds: 17,
    tA: 1.6,
    tB: 5.6,
    tCount: 9.6,
    tReveal: 12.6,
    tWin: 14.4,
    hueA: 30,
    hueB: 210,
    dateShort: '',
    a: { artist: '', title: '', rank: 1, streams: 0 },
    b: { artist: '', title: '', rank: 2, streams: 0 },
    winner: 'a',
    diff: 0,
    bands: [],
  },
  anniv: { artist: '', title: '', dateText: '', day: 1, monthAbbr: 'OCA', releaseYear: 2000, yearNow: 2026, years: 26, hue: 30, fps: 30, durationSeconds: 18, rewindStart: 1.8, rewindEnd: 6.6, off: 16.4, bg: false, bgSeconds: 0, bands: [] },
};

const CHROME_LIBS = [
  'libnss3', 'libdbus-1-3', 'libatk1.0-0', 'libgbm-dev', 'libxrandr2', 'libxkbcommon-dev', 'libxfixes3',
  'libxcomposite1', 'libxdamage1', 'libatk-bridge2.0-0', 'libpango-1.0-0', 'libcairo2', 'libcups2',
];

let depsReady = null;
let queue = Promise.resolve();

function binPath() {
  return join(VIDEO_DIR, 'node_modules', '.bin', WIN ? 'remotion.cmd' : 'remotion');
}

async function sh(cmd, args, opts = {}) {
  return execFileP(cmd, args, { maxBuffer: 1 << 26, shell: WIN, ...opts });
}

async function ensureDeps() {
  if (depsReady) return depsReady;
  depsReady = (async () => {
    if (!existsSync(binPath())) {
      console.log('  Remotion bağımlılıkları kuruluyor (ilk çalıştırma)...');
      await sh(WIN ? 'npm.cmd' : 'npm', ['ci', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: VIDEO_DIR, timeout: 10 * 60_000 });
    }
    if (process.platform === 'linux' && process.env.GITHUB_ACTIONS) {
      try {
        await sh('sudo', ['apt-get', 'update', '-qq'], { timeout: 5 * 60_000 });
        try {
          await sh('sudo', ['apt-get', 'install', '-y', '-qq', ...CHROME_LIBS, 'libasound2t64'], { timeout: 5 * 60_000 });
        } catch {
          await sh('sudo', ['apt-get', 'install', '-y', '-qq', ...CHROME_LIBS, 'libasound2'], { timeout: 5 * 60_000 });
        }
      } catch (err) {
        console.error(`  Chrome kütüphaneleri kurulamadı (devam ediliyor): ${err.message.split('\n')[0]}`);
      }
    }
  })().catch((err) => {
    depsReady = null;
    throw err;
  });
  return depsReady;
}

async function ensureStubs() {
  for (const [key, stub] of Object.entries(STUBS)) {
    const p = join(VIDEO_DIR, 'src', `data-${key}.json`);
    if (!existsSync(p)) await writeFile(p, JSON.stringify(stub));
  }
}

async function renderOne({ composition, dataKey, data, assets, extras = [] }) {
  await ensureDeps();
  await ensureStubs();

  const pub = join(VIDEO_DIR, 'public');
  await mkdir(pub, { recursive: true });
  await writeFile(join(VIDEO_DIR, 'src', `data-${dataKey}.json`), JSON.stringify(data));
  // birden cok veri dosyasi gerektiren kompozisyonlar (ornek: Era90s icinde Anniversary)
  for (const x of extras) await writeFile(join(VIDEO_DIR, 'src', `data-${x.dataKey}.json`), JSON.stringify(x.data));
  for (const a of assets) await writeFile(join(pub, a.name), a.buffer);

  const out = join(tmpdir(), `remotion-${composition}-${Date.now()}.mp4`);
  try {
    const t0 = Date.now();
    await sh(binPath(), ['render', 'src/index.ts', composition, out, '--codec=h264', '--crf=23', '--audio-codec=aac', '--log=warn'], {
      cwd: VIDEO_DIR,
      timeout: 15 * 60_000,
    });
    console.log(`  Remotion render tamam: ${composition} (${Math.round((Date.now() - t0) / 1000)} sn)`);
    return await readFile(out);
  } finally {
    await rm(out, { force: true });
    for (const a of assets) await rm(join(pub, a.name), { force: true });
  }
}

// prepared: videoPrep.js fonksiyonlarinin dondurdugu { composition, dataKey, data, assets, extras? }
export function renderPrepared(prepared) {
  const run = queue.then(() => renderOne(prepared));
  queue = run.catch(() => {});
  return run;
}
