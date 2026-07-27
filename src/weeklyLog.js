import { readFile, writeFile } from 'node:fs/promises';

const LOG_PATH = new URL('../data/weeklyReleaseLog.json', import.meta.url);

export async function loadWeeklyLog() {
  try {
    const raw = await readFile(LOG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function appendToWeeklyLog(entry) {
  const log = await loadWeeklyLog();
  log.push(entry);
  await writeFile(LOG_PATH, JSON.stringify(log, null, 2), 'utf-8');
}

export async function clearWeeklyLog() {
  await writeFile(LOG_PATH, JSON.stringify([], null, 2), 'utf-8');
}
