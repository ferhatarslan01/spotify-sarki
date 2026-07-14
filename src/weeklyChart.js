const CHART_URL = 'https://kworb.net/spotify/country/tr_weekly.html';

export async function fetchWeeklyChart() {
  const res = await fetch(CHART_URL, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    throw new Error(`Chart sayfasi alinamadi: ${res.status}`);
  }
  const html = await res.text();

  const dateMatch = html.match(/Spotify Weekly Chart - Turkey - (\d{4})\/(\d{2})\/(\d{2})/);
  const date = dateMatch ? `${dateMatch[3]}.${dateMatch[2]}.${dateMatch[1]}` : null;

  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) throw new Error('Tablo bulunamadi');

  const rowMatches = tbodyMatch[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];

  const entries = [];
  for (const row of rowMatches) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    if (cells.length < 9) continue;

    const rank = Number(cells[0].replace(/\D/g, ''));
    const titleCell = cells[2];

    const artists = [...titleCell.matchAll(/<a href="\.\.\/artist\/([^"]+)\.html">([^<]+)<\/a>/g)].map(
      (m) => ({ id: m[1], name: m[2] })
    );
    const trackMatch = titleCell.match(/<a href="\.\.\/track\/([^"]+)\.html">([^<]+)<\/a>/);

    if (!trackMatch || artists.length === 0) continue;

    const streams = Number(cells[6].replace(/[^\d-]/g, ''));

    entries.push({
      rank,
      artists,
      trackId: trackMatch[1],
      trackName: trackMatch[2],
      streams,
      trackUrl: `https://open.spotify.com/track/${trackMatch[1]}`,
    });
  }

  return { date, entries };
}

function formatStreams(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const MAX_LENGTH = 280;

function render(date, entries, topN) {
  const lines = [`🇹🇷 Türkiye Haftalık Spotify Top ${topN} (${date})`, ''];

  for (const entry of entries.slice(0, topN)) {
    const artistNames = entry.artists.map((a) => a.name).join(' & ');
    lines.push(`${entry.rank}. ${artistNames} - ${entry.trackName} (${formatStreams(entry.streams)})`);
  }

  return lines.join('\n');
}

export function pickFittingTopNWeekly(date, entries, maxTopN = 10) {
  for (let n = Math.min(maxTopN, entries.length); n >= 1; n--) {
    if (render(date, entries, n).length <= MAX_LENGTH) return n;
  }
  return 1;
}

export function formatWeeklyChartPost(date, entries, maxTopN = 10) {
  return render(date, entries, pickFittingTopNWeekly(date, entries, maxTopN));
}
