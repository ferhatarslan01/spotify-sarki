export function parseDailyChartHtml(html, regionLabel) {
  const dateRegex = new RegExp(`Spotify Daily Chart - ${regionLabel} - (\\d{4})/(\\d{2})/(\\d{2})`);
  const dateMatch = html.match(dateRegex);
  const date = dateMatch ? `${dateMatch[3]}.${dateMatch[2]}.${dateMatch[1]}` : null;

  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) throw new Error('Tablo bulunamadi');

  const rowMatches = tbodyMatch[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];

  const entries = [];
  for (const row of rowMatches) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    if (cells.length < 11) continue;

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

export function formatStreams(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const MAX_LENGTH = 280;

export function renderChartPost(header, entries, topN) {
  const lines = [header.replace('{topN}', topN), ''];

  for (const entry of entries.slice(0, topN)) {
    const artistNames = entry.artists.map((a) => a.name).join(' & ');
    lines.push(`${entry.rank}. ${artistNames} - ${entry.trackName} (${formatStreams(entry.streams)})`);
  }

  return lines.join('\n');
}

export function pickFittingTopN(header, entries, maxTopN = 10) {
  for (let n = Math.min(maxTopN, entries.length); n >= 1; n--) {
    if (renderChartPost(header, entries, n).length <= MAX_LENGTH) return n;
  }
  return 1;
}

export function formatChartPostGeneric(header, entries, maxTopN = 10) {
  return renderChartPost(header, entries, pickFittingTopN(header, entries, maxTopN));
}
