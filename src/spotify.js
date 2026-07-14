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

async function fetchWithRetry(url, options, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (res.status !== 429) return res;

    const retryAfter = Number(res.headers.get('retry-after')) || 2;
    await sleep(Math.min(retryAfter + 1, 10) * 1000);
  }
  return fetch(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

// En son yayini bulmak icin son 10 yayini cekip tarihe gore sirala
// (Spotify'in varsayilan siralamasi kronolojik degil).
export async function getLatestRelease(token, artistId) {
  const url = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&market=TR&limit=10`;
  const res = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!res.ok) {
    throw new Error(`Yayinlar alinamadi (${artistId}): ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const items = data.items ?? [];
  if (items.length === 0) return null;

  items.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
  const latest = items[0];

  return {
    id: latest.id,
    name: latest.name,
    releaseDate: latest.release_date,
    albumType: latest.album_type,
    url: latest.external_urls.spotify,
    imageUrl: latest.images?.[0]?.url,
  };
}
