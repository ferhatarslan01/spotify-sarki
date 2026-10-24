// src/artists.js'deki sanatcilari Deezer sanatci kimliklerine esler -> data/deezerArtists.json
// Kullanim: node tools/mapDeezerArtists.mjs   (Deezer ve kworb anahtarsizdir; Spotify API'ye dokunmaz)
// Dogrulama: kworb'daki sanatcinin en cok dinlenen sarkilari Deezer'da "<sanatci> <sarki>" diye aranir; adi tutan sonucun
// sanatci kimligi "oy" alir, en cok oy alan secilir. Oy yoksa adaya ait albumlerle kworb sarkilari karsilastirilir;
// o da tutmazsa sanatci Deezer'da "deezerId: null" olur ve botta Spotify yoluyla takip edilir (yanlis sanatciyi eslememek icin).
import { writeFile } from 'node:fs/promises';
import { artists } from '../src/artists.js';
import { searchArtist, normName } from '../src/deezer.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = async (url) => (await fetch(url, { signal: AbortSignal.timeout(15000) })).json();
const ALT = { 'Ebru Gündeş': ['Ebru Gundes', 'Ebru Gündes'], 'Kenan Doğulu': ['Kenan Dogulu'] };
// Elle dogrulanmis kararlar (otomatik eslemeyi ezer). null = Deezer'da guvenilir hesap yok, Spotify yoluyla takip edilir.
const OVERRIDES = { Grogi: 4532336 /* 2014 albumu "90's Ghetto Kids" var */, SNOW: null /* Deezer'daki 'SNoW' farkli sanatcilarin sarkilarini karistiriyor */ };

async function kworbSongs(spotifyId) {
  const res = await fetch(`https://kworb.net/spotify/artist/${spotifyId}_songs.html`, { signal: AbortSignal.timeout(15000) });
  const html = await res.text();
  const titles = [...html.matchAll(/<a href="https:\/\/open\.spotify\.com\/track\/[^"]+"[^>]*>([^<]+)<\/a>/g)].map((m) => m[1]);
  const display = (html.match(/<title>(.*?) - Spotify Top Songs<\/title>/) ?? [])[1] ?? '';
  return { titles, display };
}

const map = {};
const fallback = [];
for (const a of artists) {
  const { titles, display } = await kworbSongs(a.id).catch(() => ({ titles: [], display: '' }));
  const names = [...new Set([a.name, display, ...(ALT[a.name] ?? [])].filter(Boolean))];
  const votes = new Map();
  for (const title of titles.slice(0, 6)) {
    const r = await getJson(`https://api.deezer.com/search?q=${encodeURIComponent(`${a.name} ${title}`)}&limit=8`).catch(() => ({ data: [] }));
    await sleep(260);
    const hit = (r.data ?? []).find((t) => names.some((x) => normName(t.artist?.name) === normName(x)));
    if (hit) votes.set(hit.artist.id, (votes.get(hit.artist.id) ?? 0) + 1);
  }
  let deezerId = null;
  let how = '';
  if (a.name in OVERRIDES) {
    deezerId = OVERRIDES[a.name];
    how = deezerId ? 'elle dogrulandi' : '';
  } else if (votes.size) {
    deezerId = [...votes.entries()].sort((x, y) => y[1] - x[1])[0][0];
    how = `dogrulandi (${votes.get(deezerId)}/${Math.min(6, titles.length)} sarki)`;
  } else {
    // oy yok: ad adaylarinin albumleriyle kworb basliklarini karsilastir
    const want = new Set(titles.map((t) => normName(t)));
    for (const nm of names) {
      const { matches } = await searchArtist(nm);
      for (const m of matches) {
        const al = await getJson(`https://api.deezer.com/artist/${m.id}/albums?limit=100`).catch(() => ({ data: [] }));
        const tr = await getJson(`https://api.deezer.com/artist/${m.id}/top?limit=30`).catch(() => ({ data: [] }));
        await sleep(260);
        const have = [...(al.data ?? []).map((x) => x.title), ...(tr.data ?? []).map((x) => x.title_short)].map((t) => normName(t));
        if (have.some((t) => want.has(t))) {
          deezerId = m.id;
          how = 'dogrulandi (album/sarki kesisimi)';
          break;
        }
      }
      if (deezerId) break;
    }
  }
  if (!deezerId) {
    fallback.push(a.name);
    map[a.id] = { name: a.name, deezerId: null, how: 'Deezer yok/dogrulanamadi: Spotify yoluyla takip edilir' };
    console.log(`${a.name.padEnd(18)} -> (yok)      SPOTIFY'DA KALIR`);
    continue;
  }
  const info = await getJson(`https://api.deezer.com/artist/${deezerId}`).catch(() => ({}));
  map[a.id] = { name: a.name, deezerId, deezerName: info.name ?? '', fans: info.nb_fan ?? 0, albums: info.nb_album ?? 0, how };
  console.log(`${a.name.padEnd(18)} -> ${String(deezerId).padEnd(10)} ${String(info.name ?? '').padEnd(16)} ${how}`);
  await sleep(250);
}
await writeFile(new URL('../data/deezerArtists.json', import.meta.url), `${JSON.stringify(map, null, 2)}\n`, 'utf8');
console.log(`\nDeezer'a eslesen: ${Object.values(map).filter((v) => v.deezerId).length}/${artists.length} | Spotify'da kalanlar: ${fallback.join(', ') || '-'}`);
