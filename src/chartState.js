import { readFile, writeFile } from 'node:fs/promises';

const STATE_PATH = new URL('../data/chartState.json', import.meta.url);

export async function loadChartState() {
  try {
    const raw = await readFile(STATE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return { lastPostedDate: null };
    throw err;
  }
}

export async function saveChartState(state) {
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}
