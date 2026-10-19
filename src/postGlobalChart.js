import { mkdir, writeFile } from 'node:fs/promises';
import { fetchGlobalChart, formatGlobalChartPost, pickFittingTopNGlobal } from './globalChart.js';
import { loadChartState, saveChartState } from './chartState.js';
import { publishPost, publishThreadWithVideo } from './bufferPost.js';
import { generateChartCollage } from './collage.js';
import { pushFile, getRawUrl } from './gitPublish.js';
import { makeChartVideo, makeChartThread, buildChartThreadItems, tiktokChartPostPrepared } from './tiktokVideo.js';

const STATE_FILE = 'globalChartState.json';

async function main() {
  const { date, entries } = await fetchGlobalChart();

  if (!date || entries.length === 0) {
    console.error('Chart verisi alinamadi, cikiliyor.');
    process.exitCode = 1;
    return;
  }

  const state = await loadChartState(STATE_FILE);

  if (state.lastPostedDate === date) {
    console.log(`Bugunun global chart'i (${date}) zaten paylasilmis, atlaniyor.`);
    return;
  }

  const topN = pickFittingTopNGlobal(date, entries, 10);
  const text = formatGlobalChartPost(date, entries, 10);
  console.log(text);

  console.log('\nCollage olusturuluyor...');
  const collageBuffer = await generateChartCollage(entries.slice(0, topN));

  const safeDate = date.replace(/\./g, '-');
  const filePath = `public/charts/global-${safeDate}.png`;
  await mkdir('public/charts', { recursive: true });
  await writeFile(filePath, collageBuffer);

  console.log('Collage repoya push ediliyor...');
  pushFile(filePath, `Add global chart collage ${date} [skip ci]`);
  const imageUrl = getRawUrl(filePath);
  console.log('Gorsel URL:', imageUrl);

  console.log('\nPaylasiliyor...');

  // TikTok: dikey Top 5 videosu. X: 5 ayri kare "kapak + oynatici" videosu thread olarak (ilk tweet liste metnini tasir).
  const chartParams = { kind: 'daily-global', header: 'DÜNYA GÜNLÜK SPOTIFY', date, entries };
  // Dikey TikTok videosu sadece TIKTOK_GLOBAL=1 iken uretilir (gereksiz render olmasin).
  const handle = process.env.TIKTOK_GLOBAL === '1' ? await makeChartVideo(chartParams) : null;
  const thread = await makeChartThread(chartParams);
  const result = thread
    ? await publishThreadWithVideo(await buildChartThreadItems(thread, text), () => publishPost(text, imageUrl))
    : await publishPost(text, imageUrl);
  if (result.message) {
    console.error(`Buffer hatasi: ${result.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Paylasildi (post id: ${result.post.id})`);
  // Hesap yeni oldugu icin dunya listesi videosu varsayilan olarak kapali (TIKTOK_GLOBAL=1 ile acilir).
  if (process.env.TIKTOK_GLOBAL === '1') {
    await tiktokChartPostPrepared(handle, chartParams);
  }
  await saveChartState({ lastPostedDate: date }, STATE_FILE);
}

main();
