import 'dotenv/config';

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;

const REQUEST_TIMEOUT_MS = 10_000;

export async function getAccessToken() {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:
        'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Spotify token alinamadi: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class QuotaError extends Error {
  constructor(message, retryAfter) {
    super(message);
    this.name = 'QuotaError';
    this.retryAfter = retryAfter;
  }
}

// 429'da Retry-After kisaysa (<= 10 sn) bir kez bekleyip tekrar dener; uzunsa (kota doldu) beklemeden QuotaError atar.
async function fetchWithRetry(url, options) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (res.status !== 429) return res;

  const retryAfter = Number(res.headers.get('retry-after')) || 0;
  if (retryAfter > 0 && retryAfter <= 10) {
    await sleep((retryAfter + 1) * 1000);
    const again = await fetch(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (again.status !== 429) return again;
  }
  throw new QuotaError(`Spotify kotasi doldu (429, retry-after: ${retryAfter || '?'} sn)`, retryAfter);
}

// Son 10 yayini cekip tarihe gore sirali dondurur
// (Spotify'in varsayilan siralamasi kronolojik degil).
export async function getRecentReleases(token, artistId) {
  const url = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&market=TR&limit=10`;
  const res = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!res.ok) {
    throw new Error(`Yayinlar alinamadi (${artistId}): ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const items = data.items ?? [];
  items.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    releaseDate: item.release_date,
    albumType: item.album_type,
    url: item.external_urls.spotify,
    imageUrl: item.images?.[0]?.url,
  }));
}

export async function getLatestRelease(token, artistId) {
  const releases = await getRecentReleases(token, artistId);
  return releases[0] ?? null;
}
