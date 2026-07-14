import { parseDailyChartHtml, formatChartPostGeneric, pickFittingTopN } from './chartParser.js';

const CHART_URL = 'https://kworb.net/spotify/country/global_daily.html';
const HEADER = '🌍 Dünya Günlük Spotify Top {topN}';

export async function fetchGlobalChart() {
  const res = await fetch(CHART_URL, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    throw new Error(`Chart sayfasi alinamadi: ${res.status}`);
  }
  const html = await res.text();
  const { date, entries } = parseDailyChartHtml(html, 'Global');
  return { date, entries };
}

function headerWithDate(date) {
  return `${HEADER} (${date})`;
}

export function pickFittingTopNGlobal(date, entries, maxTopN = 10) {
  return pickFittingTopN(headerWithDate(date), entries, maxTopN);
}

export function formatGlobalChartPost(date, entries, maxTopN = 10) {
  return formatChartPostGeneric(headerWithDate(date), entries, maxTopN);
}
