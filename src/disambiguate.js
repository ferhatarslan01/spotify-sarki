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

const groups = {
  'Ati242': ['6bGOmNBU1AOgttgOjh0ldf', '14gJhkPZfPZvnz7X6xqvWu', '3Xb5lxqF4VTpQZshtlF4sp'],
  'Sezen Aksu': ['64d1rUxfizSAOE9UbMnUZd', '041KSW0uVCUNyeFar2Hvzy'],
  'Era7capone': ['4UW9Hdsrx9kX2HdJ90jRKM', '6vIsfXW3XWlXOV4oAeVTaj', '2HDhw5lLlOtSWMXktWq0VY'],
  'Lvbel C5': ['0V2oXYR7DtrZAEFeILRW2r', '6Vbawk0v32DilFWpmaVPSc', '6BQLcto4yoCAVt0jjI9cIM'],
  'Motive': ['6sBSLIunx1Je0Y2T77wpkP', '5LjOSVqRWRs1eL2OY297Jg'],
  'Melike Şahin': ['16GyR4WfCnIT2XST4ZLl2B', '5wGUFIwrtiUXyB3pV1hFvm'],
  'Mustafa Sandal': ['0mkH5jj3goQ51JtPKVodTo', '4fnqNXUDxi7AKlNJyzHzrm'],
  'Murda': ['2y1VzMKAa5nmfXKtJL9jnj', '09WqkYnqWKUQAYSlEvaf6s', '7q6wy08a2IA2NeNfpwBnaB'],
};

const token = await getAccessToken();

for (const [label, ids] of Object.entries(groups)) {
  console.log(`\n=== ${label} ===`);
  for (const id of ids) {
    const url = `https://api.spotify.com/v1/artists/${id}/albums?include_groups=single,album&market=TR&limit=3`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const items = data.items ?? [];
    console.log(`  id: ${id} | toplam: ${data.total ?? '?'} | son: ${items[0] ? `${items[0].release_date} - ${items[0].name}` : '(yayin yok)'}`);
  }
}
