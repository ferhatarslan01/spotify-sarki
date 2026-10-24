// Deezer API (anahtarsiz, ~50 istek / 5 sn): yeni yayin tespiti icin Spotify kotasina bagimli olmadan sanatci yayinlarini listeler.
// Spotify yalnizca paylasimdaki albumun linkini bulmak icin (UPC ile) kullanilir.
const BASE = 'https://api.deezer.com';
const TIMEOUT_MS = 15_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function dz(path, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status >= 500) throw new Error(`Deezer ${res.status}`);
      const json = await res.json();
      if (json?.error) {
        // kota (code 4) ya da gecici hata: kisa bekleyip tekrar dene
        if (json.error.code === 4 || /quota/i.test(json.error.message ?? '')) {
          await sleep(5000 * (i + 1));
          lastErr = new Error(`Deezer kota: ${json.error.message}`);
          continue;
        }
        throw new Error(`Deezer hata: ${json.error.message ?? JSON.stringify(json.error)}`);
      }
      return json;
    } catch (err) {
      lastErr = err;
      await sleep(1500 * (i + 1));
    }
  }
  throw lastErr ?? new Error('Deezer istegi basarisiz');
}

export const normName = (s) =>
  String(s ?? '')
    .normalize('NFC')
    .toLocaleLowerCase('tr')
    .replace(/[^a-z0-9ğüşıöçâîû]/g, '');

// Ayni adli sanatcilar arasindan en cok hayrani olani secer (tam ad eslesmesi gerekir).
export async function searchArtist(name) {
  const json = await dz(`/search/artist?q=${encodeURIComponent(name)}&limit=10`);
  const matches = (json.data ?? []).filter((a) => normName(a.name) === normName(name));
  matches.sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0));
  return { best: matches[0] ?? null, matches };
}

// TRT'ye gore bugunun tarihi (YYYY-MM-DD). TODAY_OVERRIDE ile test icin degistirilebilir.
export function todayTRT(now = new Date()) {
  if (process.env.TODAY_OVERRIDE) return process.env.TODAY_OVERRIDE;
  return new Date(now.getTime() + 3 * 3600e3).toISOString().slice(0, 10);
}

// Sanatcinin tum yayinlari (sayfalama; Deezer siralamasi kronolojik degil), yeniden eskiye siralanir. Gelecek tarihliler atlanir.
export async function getArtistAlbums(deezerArtistId, { maxPages = 6 } = {}) {
  const all = [];
  let index = 0;
  for (let page = 0; page < maxPages; page++) {
    const json = await dz(`/artist/${deezerArtistId}/albums?limit=100&index=${index}`);
    all.push(...(json.data ?? []));
    if (!json.next || (json.data ?? []).length === 0) break;
    index += 100;
    await sleep(250);
  }
  const today = todayTRT();
  const seen = new Set();
  const items = [];
  for (const a of all) {
    if (!a.release_date || a.release_date > today) continue; // henuz yayinlanmamis
    if (a.record_type === 'compile') continue;
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    items.push({
      id: `dz:${a.id}`,
      dzId: a.id,
      name: a.title,
      releaseDate: a.release_date,
      albumType: a.record_type === 'album' ? 'album' : 'single',
      url: null, // Spotify linki paylasimdan hemen once cozulur (attachSpotifyLink)
      dzUrl: a.link,
      imageUrl: a.cover_xl || a.cover_big || a.cover_medium || null,
      fans: a.fans ?? 0,
    });
  }
  items.sort((x, y) => y.releaseDate.localeCompare(x.releaseDate) || y.dzId - x.dzId);
  return items;
}

export async function getAlbumUpc(deezerAlbumId) {
  const json = await dz(`/album/${deezerAlbumId}`);
  return json.upc || null;
}

// Bir sarkinin ilk albumunun yayin tarihi (liste girisi olaylarinda "gercekten yeni mi" kontrolu).
export async function findTrackReleaseDate(artistName, title) {
  // (Deezer'in artist:"" track:"" gelismis sozdizimi bos donuyor; duz arama + sanatci adi eslesmesi kullanilir)
  const json = await dz(`/search?q=${encodeURIComponent(`${artistName} ${title}`)}&limit=8`);
  const hit = (json.data ?? []).find((t) => normName(t.artist?.name) === normName(artistName));
  if (!hit?.album?.id) return null;
  const album = await dz(`/album/${hit.album.id}`);
  return album.release_date ? { releaseDate: album.release_date, albumId: album.id } : null;
}
