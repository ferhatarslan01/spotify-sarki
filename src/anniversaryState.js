import { readFile, writeFile } from 'node:fs/promises';

const STATE_PATH = new URL('../data/anniversaryState.json', import.meta.url);

export async function loadAnniversaryState() {
  try {
    const raw = await readFile(STATE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return { announced: [] };
    throw err;
  }
}

export async function saveAnniversaryState(state) {
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}
