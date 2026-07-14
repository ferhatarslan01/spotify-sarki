import 'dotenv/config';

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;

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
  const data = await res.json();
  return data.access_token;
}

const names = [
  'BLOK3', 'Ati242', 'Semicenk', 'Era7capone', 'Lvbel C5', 'UZI', 'Sezen Aksu',
  'Poizi', 'Motive', 'AKDO', 'Gülşen', 'Yalın', 'Dedublüman', 'Hande Yener',
  'SNOW', 'Ebru Gündeş', 'Ezhel', 'manifest', 'Simge', 'Sertab Erener', 'Tarkan',
  'Hadise', 'Mabel Matiz', 'Edis', 'Zeynep Bastık', 'İrem Derici', 'Melike Şahin',
  'Emir Can İğrek', 'Aleyna Tilki', 'Sefo', 'Güneş', 'Batuflex', 'Reckol', 'Murda',
  'Mela Bedel', 'Ajda Pekkan', 'Mustafa Sandal', 'Madrigal', 'Duman', 'Kenan Doğulu',
];

const token = await getAccessToken();

// 1) her isim icin arama yap, aday id'leri topla
const searchResults = [];
for (const name of names) {
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=5&market=TR`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  searchResults.push({ name, candidates: data.artists.items });
}

for (const { name, candidates } of searchResults) {
  console.log(`\n=== ${name} ===`);
  for (const a of candidates) {
    console.log(`  ${a.name} | id: ${a.id} | ${a.external_urls.spotify}`);
  }
}
