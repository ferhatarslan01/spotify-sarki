// Yeni cikti kontrolunde sanatci gruplarini duvar saatine bagli degil, kalici bir "sira imleci" ile secer.
// Eski mantik (pencere % 2) GitHub zamanlayicisi kayinca ayni yariyi art arda kontrol edip diger yariyi hic taramayabiliyordu.
// Imlec her calistirmada, gercekten kontrol edilen sanatci sayisi kadar ilerler; ardisik iki calistirma tum listeyi kapsar.
import { readFile, writeFile } from 'node:fs/promises';

const CURSOR_PATH = new URL('../data/checkCursor.json', import.meta.url);

export async function loadCursor() {
  try {
    const raw = JSON.parse(await readFile(CURSOR_PATH, 'utf-8'));
    return Number.isInteger(raw.cursor) && raw.cursor >= 0 ? raw.cursor : 0;
  } catch (err) {
    if (err.code === 'ENOENT') return 0;
    throw err;
  }
}

export async function saveCursor(cursor) {
  await writeFile(CURSOR_PATH, `${JSON.stringify({ cursor }, null, 2)}\n`, 'utf-8');
}

// list'in imlecten baslayan, ceil(n / batchCount) elemanlik dilimi (liste sonunda basa sarar).
export function pickBatch(list, cursor, batchCount = 2) {
  const n = list.length;
  if (n === 0) return [];
  const k = Math.ceil(n / batchCount);
  const start = ((cursor % n) + n) % n;
  return Array.from({ length: k }, (_, i) => list[(start + i) % n]);
}
