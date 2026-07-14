import { readFile, writeFile } from 'node:fs/promises';

function statePath(fileName) {
  return new URL(`../data/${fileName}`, import.meta.url);
}

export async function loadChartState(fileName = 'chartState.json') {
  try {
    const raw = await readFile(statePath(fileName), 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return { lastPostedDate: null };
    throw err;
  }
}

export async function saveChartState(state, fileName = 'chartState.json') {
  await writeFile(statePath(fileName), JSON.stringify(state, null, 2), 'utf-8');
}
