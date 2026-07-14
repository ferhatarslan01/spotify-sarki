import sharp from 'sharp';
import { getTrackThumbnail } from './dailyChart.js';

const CELL_SIZE = 300;
const GAP = 6;
const COLS = 3;

async function fetchImageBuffer(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Gorsel alinamadi: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function rankBadgeSvg(rank) {
  return Buffer.from(`
    <svg width="56" height="56">
      <circle cx="28" cy="28" r="26" fill="black" fill-opacity="0.75" />
      <text x="28" y="38" font-size="28" font-family="Arial, sans-serif" font-weight="bold"
            fill="white" text-anchor="middle">${rank}</text>
    </svg>
  `);
}

// entries: [{ rank, trackUrl, ... }] - siraya gore, en fazla ~6-9 arasi kullanilmasi onerilir
export async function generateChartCollage(entries) {
  const n = entries.length;
  const cols = Math.min(COLS, n);
  const rows = Math.ceil(n / cols);

  const width = cols * CELL_SIZE + (cols - 1) * GAP;
  const height = rows * CELL_SIZE + (rows - 1) * GAP;

  const composites = [];

  for (let i = 0; i < n; i++) {
    const entry = entries[i];
    const thumbUrl = await getTrackThumbnail(entry.trackUrl);
    if (!thumbUrl) continue;

    const imgBuffer = await fetchImageBuffer(thumbUrl);
    const resized = await sharp(imgBuffer).resize(CELL_SIZE, CELL_SIZE).toBuffer();

    const col = i % cols;
    const row = Math.floor(i / cols);
    const left = col * (CELL_SIZE + GAP);
    const top = row * (CELL_SIZE + GAP);

    composites.push({ input: resized, left, top });
    composites.push({ input: rankBadgeSvg(entry.rank), left: left + 8, top: top + 8 });
  }

  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}
