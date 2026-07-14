import { fetchDailyChart, formatChartPost, getTrackThumbnail } from './dailyChart.js';
import { loadChartState, saveChartState } from './chartState.js';
import { publishPost } from './bufferPost.js';

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

  const text = formatChartPost(date, entries, 10);
  console.log(text);

  const imageUrl = await getTrackThumbnail(entries[0].trackUrl).catch(() => null);

  console.log('\nPaylasiliyor...');

  const result = await publishPost(text, imageUrl);
  if (result.message) {
    console.error(`Buffer hatasi: ${result.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Paylasildi (post id: ${result.post.id})`);
  await saveChartState({ lastPostedDate: date });
}

main();
