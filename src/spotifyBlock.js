import { readFile, writeFile } from 'node:fs/promises';

const FILE = 'data/spotifyBlock.json';

// Spotify kotasi dolunca (429, uzun retry-after) engelin bitecegi zamani saklar;
// engel surerken botun bosuna istek atip engeli uzatmasini onler.
export async function loadSpotifyBlock() {
  try {
    const { until } = JSON.parse(await readFile(FILE, 'utf8'));
    const t = Date.parse(until);
    return Number.isFinite(t) && Date.now() < t ? { until, remainingSeconds: Math.round((t - Date.now()) / 1000) } : null;
  } catch {
    return null;
  }
}

export async function saveSpotifyBlock(retryAfterSeconds) {
  const until = new Date(Date.now() + (retryAfterSeconds + 60) * 1000).toISOString();
  await writeFile(FILE, JSON.stringify({ until }, null, 2) + '\n');
  return until;
}
