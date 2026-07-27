import { readFile, writeFile } from 'node:fs/promises';

const STATE_PATH = new URL('../data/trendsState.json', import.meta.url);

const EMPTY_STATE = {
  date: null,
  jumpsAnnounced: [],
  topTenSeen: [],
  milestonesSeen: {},
  crossoverSeen: [],
};

export async function loadTrendsState() {
  try {
    const raw = await readFile(STATE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function saveTrendsState(state) {
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

export function emptyTrendsState() {
  return structuredClone(EMPTY_STATE);
}

export const MILESTONES = [1_000_000, 5_000_000, 10_000_000, 50_000_000, 100_000_000, 500_000_000, 1_000_000_000];

export function highestMilestone(total) {
  let best = 0;
  for (const m of MILESTONES) {
    if (total >= m) best = m;
  }
  return best;
}
