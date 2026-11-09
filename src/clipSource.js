// Sarkinin ORIJINAL klibini bulur: iTunes (Apple) musicVideo onizlemesi (~30 sn, 1080p, sesli).
// YouTube'dan indirme yapilmaz (hizmet sartlari/koruma onlemleri); Apple'in tanitim amacli sundugu resmi onizleme kullanilir.
// Dikkat: gercek klip goruntusu X/TikTok'ta telif iddiasina (sessize alma, kaldirma) yol acabilir; kullanim sahibinin kararidir.
import { fetchBuf } from './videoAudio.js';

// Turkce karakterler ASCII'ye katlanir (Cakal = Çakal, Yuregime = Yüreğime): iTunes ile Spotify yazimlari farkli olabilir.
const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/[^a-z0-9]/g, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchVideos(term, country) {
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=${country}&entity=musicVideo&limit=25`, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) return (await res.json()).results ?? [];
    } catch {
      /* tekrar dene */
    }
    await sleep(800);
  }
  return [];
}

// { url, artist, title, fullMs } ya da null. Sanatci ve sarki adi eslesmezse baska bir videoya dusmez.
export async function findMusicVideo(artist, title, { country = 'TR' } = {}) {
  const a = norm(artist);
  const t = norm(title);
  for (const term of [`${artist} ${title}`, title]) {
    const hit = (await searchVideos(term, country)).find((x) => x.previewUrl && norm(x.artistName).includes(a) && (norm(x.trackName).includes(t) || t.includes(norm(x.trackName))));
    if (hit) return { url: hit.previewUrl, artist: hit.artistName, title: hit.trackName, fullMs: hit.trackTimeMillis ?? null };
    await sleep(250);
  }
  return null;
}

// { buffer, artist, title } ya da null (klip yok / indirilemedi)
export async function fetchMusicVideo(artist, title, opts) {
  const found = await findMusicVideo(artist, title, opts);
  if (!found) return null;
  try {
    return { ...found, buffer: await fetchBuf(found.url) };
  } catch (err) {
    console.error(`  Klip indirilemedi (${artist} - ${title}): ${err.message.split('\n')[0]}`);
    return null;
  }
}
