import 'dotenv/config';

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.error('SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET .env dosyasinda eksik.');
  process.exit(1);
}

async function getAccessToken() {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:
        'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error(`Token alinamadi: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function getLatestReleases(token, artistId, limit = 5) {
  const url = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=single,album&market=TR&limit=${limit}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Albumler alinamadi: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.items;
}

// Test icin ornek sanatci: Sagopa Kajmer
const TEST_ARTIST_ID = '1KXTegXtnCPKXjRaX1llcD';

const token = await getAccessToken();
console.log('Token alindi.');

const releases = await getLatestReleases(token, TEST_ARTIST_ID);
console.log(`${releases.length} yayin bulundu:\n`);
for (const r of releases) {
  console.log(`- [${r.release_date}] ${r.name} (${r.album_type}) - id: ${r.id}`);
}
