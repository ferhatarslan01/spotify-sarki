// Pilot: kapak -> hareket klibi (Kaggle ucretsiz GPU). Kaggle API anahtari ~/.kaggle/kaggle.json icinde olmali.
// Kullanim: node --env-file=.env pilot/kaggleRun.mjs [--accelerator NvidiaTeslaT4]
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fetchDailyChart, getTrackThumbnail } from '../src/dailyChart.js';

const run = promisify(execFile);
const KAGGLE = process.env.KAGGLE_BIN ?? join(homedir(), 'AppData/Roaming/Python/Python310/Scripts/kaggle.exe');
const DIR = 'pilot/cover-motion';
const OUT = 'pilot/out';
const accel = process.argv.includes('--accelerator') ? process.argv[process.argv.indexOf('--accelerator') + 1] : 'NvidiaTeslaT4';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// kullanici adi (anahtar yazdirilmaz)
const creds = JSON.parse(await readFile(join(homedir(), '.kaggle', 'kaggle.json'), 'utf8'));
const user = creds.username;
const slug = 'cover-motion-pilot';

// 1) test kapaklari: listeden 3 + Duman + Poizi
const covers = [];
const { entries } = await fetchDailyChart();
for (const e of [entries[0], entries[3], entries[7]]) {
  const url = await getTrackThumbnail(e.trackUrl).catch(() => null);
  if (url) covers.push({ name: e.trackName.replace(/[^\w]+/g, '_').slice(0, 24), url });
}
const itunes = await (await fetch('https://itunes.apple.com/search?term=Duman+Her+%C5%9Eeyi+Yak&country=TR&entity=song&limit=5')).json();
const duman = itunes.results.find((x) => x.artistName === 'Duman');
if (duman) covers.push({ name: 'Duman_HerSeyiYak', url: duman.artworkUrl100.replace('100x100bb', '600x600bb') });
console.log('kapaklar:', covers.map((c) => c.name).join(', '));

// 2) kernel dosyalari
const py = (await readFile(`${DIR}/run.py`, 'utf8')).replace('__COVERS_JSON__', () => JSON.stringify(covers));
await mkdir('pilot/.build', { recursive: true });
await writeFile('pilot/.build/run.py', py);
await writeFile(
  'pilot/.build/kernel-metadata.json',
  JSON.stringify(
    {
      id: `${user}/${slug}`,
      title: 'Cover Motion Pilot',
      code_file: 'run.py',
      language: 'python',
      kernel_type: 'script',
      is_private: true,
      enable_gpu: true,
      enable_internet: true,
      dataset_sources: [],
      competition_sources: [],
      kernel_sources: [],
    },
    null,
    2
  )
);

// 3) gonder ve bekle
const kg = (args) => run(KAGGLE, args, { maxBuffer: 1 << 26 });
console.log("Kaggle'a gonderiliyor...");
try {
  console.log((await kg(['kernels', 'push', '-p', 'pilot/.build', '--accelerator', accel])).stdout);
} catch (e) {
  console.error(e.stdout, e.stderr || e.message);
  process.exit(1);
}

const t0 = Date.now();
for (let i = 0; i < 240; i++) {
  await sleep(30_000);
  const { stdout } = await kg(['kernels', 'status', `${user}/${slug}`]).catch((e) => ({ stdout: e.stdout ?? '' }));
  const status = stdout.trim();
  console.log(`[${Math.round((Date.now() - t0) / 60000)} dk]`, status);
  if (/complete|error|cancel/i.test(status)) break;
}

await mkdir(OUT, { recursive: true });
await kg(['kernels', 'output', `${user}/${slug}`, '-p', OUT]).catch((e) => console.error(e.stderr || e.message));
console.log('cikti klasoru:', OUT);
