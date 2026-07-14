import { fetchWeeklyChart, formatWeeklyChartPost } from './weeklyChart.js';
import { getTrackThumbnail } from './dailyChart.js';
import { loadChartState, saveChartState } from './chartState.js';
import { publishPost } from './bufferPost.js';

const STATE_FILE = 'weeklyChartState.json';

async function main() {
  const { date, entries } = await fetchWeeklyChart();

  if (!date || entries.length === 0) {
    console.error('Chart verisi alinamadi, cikiliyor.');
    process.exitCode = 1;
    return;
  }

  const state = await loadChartState(STATE_FILE);

  if (state.lastPostedDate === date) {
    console.log(`Bu haftanin chart'i (${date}) zaten paylasilmis, atlaniyor.`);
    return;
  }

  const text = formatWeeklyChartPost(date, entries, 10);
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
  await saveChartState({ lastPostedDate: date }, STATE_FILE);
}

main();
