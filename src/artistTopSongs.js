// Bir sanatcinin Spotify'da TOPLAM (tum zamanlar) en cok dinlenen sarkilari: kworb "Spotify Top Songs" sayfasi (sanatcinin tum sarkilari).
// Remix / sped up / live gibi sürümler elenir, ayni sarkinin tekrarlari birlestirilir. Rakamlar gercek toplam dinlenmedir.
const UA = { 'User-Agent': 'Mozilla/5.0' };
const VERSION = /\b(remix|sped up|speed up|slowed|reverb|live|canlı|canli|instrumental|enstrümantal|acoustic|akustik|edit|version|versiyon|mix|karaoke)\b/i;

const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase();
const baseTitle = (t) => fold(t).replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9]/g, '');

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

// { rank, trackId, trackName, streams, trackUrl, artists: [{ name }] } dizisi (rank 1 = en cok dinlenen)
export async function fetchArtistTopSongs(artistId, artistName, { n = 7 } = {}) {
  const res = await fetch(`https://kworb.net/spotify/artist/${artistId}_songs.html`, { headers: UA, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Sanatci sayfasi alinamadi (${artistName}): ${res.status}`);
  const html = await res.text();

  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  const songs = [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    if (cells.length < 3) continue;
    const t = cells[0].match(/<a href="https:\/\/open\.spotify\.com\/track\/([^"]+)"[^>]*>([^<]+)<\/a>/);
    const streams = Number(cells[1].replace(/\D/g, ''));
    if (!t || !Number.isFinite(streams) || streams <= 0) continue;
    songs.push({ trackId: t[1], trackName: decode(t[2]).trim(), streams });
  }
  if (songs.length === 0) throw new Error(`Sarki listesi bulunamadi (${artistName})`);

  songs.sort((a, b) => b.streams - a.streams);
  const seen = new Set();
  const top = [];
  for (const s of songs) {
    if (VERSION.test(s.trackName)) continue;
    const key = baseTitle(s.trackName);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    top.push({ rank: top.length + 1, ...s, trackUrl: `https://open.spotify.com/track/${s.trackId}`, artists: [{ name: artistName }] });
    if (top.length >= n) break;
  }
  return top;
}

// 157295895 -> "157,3 milyon", 1234567890 -> "1,23 milyar"
export function fmtStreamsTR(n) {
  const f = (v, d) => v.toFixed(d).replace('.', ',').replace(/,0+$/, '').replace(/(,\d)0$/, '$1');
  if (n >= 1e9) return `${f(n / 1e9, 2)} milyar`;
  if (n >= 1e6) return `${f(n / 1e6, n >= 1e8 ? 1 : 2)} milyon`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} bin`;
  return String(n);
}
