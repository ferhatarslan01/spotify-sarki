import { mkdir, writeFile } from 'node:fs/promises';
import { fetchDailyChart, formatChartPost, pickFittingTopN } from './dailyChart.js';
import { loadChartState, saveChartState } from './chartState.js';
import { publishPost, publishThreadWithVideo } from './bufferPost.js';
import { generateChartCollage } from './collage.js';
import { pushFile, getRawUrl } from './gitPublish.js';
import { makeChartVideo, makeChartThread, buildChartThreadItems, tiktokChartPostPrepared } from './tiktokVideo.js';

async function main() {
  const { date, entries } = await fetchDailyChart();

  if (!date || entries.length === 0) {
    console.error('Chart verisi alinamadi, cikiliyor.');
    process.exitCode = 1;
    return;
  }

  const state = await loadChartState();

  if (state.lastPostedDate === date) {
    console.log(`Bugunun chart'i (${date}) zaten paylasilmis, atlaniyor.`);
    return;
  }

  const topN = pickFittingTopN(date, entries, 10);
  const text = formatChartPost(date, entries, 10);
  console.log(text);

  console.log('\nCollage olusturuluyor...');
  const collageBuffer = await generateChartCollage(entries.slice(0, topN));

  const safeDate = date.replace(/\./g, '-');
  const filePath = `public/charts/daily-${safeDate}.png`;
  await mkdir('public/charts', { recursive: true });
  await writeFile(filePath, collageBuffer);

  console.log('Collage repoya push ediliyor...');
  pushFile(filePath, `Add daily chart collage ${date} [skip ci]`);
  const imageUrl = getRawUrl(filePath);
  console.log('Gorsel URL:', imageUrl);

  console.log('\nPaylasiliyor...');

  // TikTok: dikey Top 5 videosu. X: 5 ayri kare "kapak + oynatici" videosu thread olarak (ilk tweet liste metnini tasir).
  const chartParams = { kind: 'daily-tr', header: 'TÜRKİYE GÜNLÜK SPOTIFY', date, entries };
  const handle = await makeChartVideo(chartParams);
  const thread = await makeChartThread(chartParams);
  const result = thread
    ? await publishThreadWithVideo(buildChartThreadItems(thread, text), () => publishPost(text, imageUrl))
    : await publishPost(text, imageUrl);
  if (result.message) {
    console.error(`Buffer hatasi: ${result.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Paylasildi (post id: ${result.post.id})`);
  await tiktokChartPostPrepared(handle, chartParams);
  await saveChartState({ lastPostedDate: date });
}

main();
