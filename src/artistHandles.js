// Sanatcilarin X (Twitter) hesaplari ve tweetlerde etiketleme (@kullanici).
// Kaynak: MusicBrainz (Spotify sanatci ID'siyle eslesir) + Wikidata; yalnizca iki kaynak ayni hesabi gosteriyorsa
// ya da hesap adi sanatci adiyla acikca eslesiyorsa kullanilir. X_TAGS=0 ile etiketleme kapatilir.
import { artists as trackedArtists } from './artists.js';

// Takip edilen sanatcilar: Spotify sanatci ID -> X kullanici adi (elle dogrulanmis liste).
const STATIC = {
  '51DevdOxIJin6DB1FXJpD1': 'Chavo1312', // UZI (kullanıcı onayı)
  '6sBSLIunx1Je0Y2T77wpkP': 'motive2m', // Motive (kullanıcı onayı)
  '0L3wrFI3QcbXAvFL7IaPQX': 'guneswon', // Güneş (kullanıcı onayı)
  '5PRW6j58xEEWL4DDVEITKT': 'dedublumanoffic', // Dedublüman (kullanıcı onayı)
  '6bGOmNBU1AOgttgOjh0ldf': 'ati242_', // Ati242
  '1CcZoULzFHa8Uhwo6OlQcp': 'semicenk', // Semicenk
  '0V2oXYR7DtrZAEFeILRW2r': 'lvbeIc5', // Lvbel C5
  '1F2v33FQTavJyaD7ZsyhdA': 'gulsen', // Gülşen
  '46zuW8tHxwahYn7VNMgYTa': 'yalinonline', // Yalın
  '08mjMUUjyTchMHCW7evc3R': 'handeyener', // Hande Yener
  '5AboYJAlMb9FGadTTDKRoN': 'EbruGundes', // Ebru Gündeş
  '6LnJKrtFnTEGdbWQ2riWCL': 'ezhel06', // Ezhel
  '2WjzL05RyqIk5n53sZc9nf': 'm6nifestgirls', // manifest
  '4StjyzjcmZ7a9QncHVf0pu': 'simgeesagin', // Simge
  '4W31XN2JH8mC54NkHdh04s': 'sertaberener', // Sertab Erener
  '2yMN0IP20GOaN6q0p0zL5k': 'tarkan', // Tarkan
  '0wCKNMsqYasJBFVagjay49': 'hadise', // Hadise
  '1dpqJqIuNqideTvmxBsSku': 'mabelmatiz', // Mabel Matiz
  '1AM52XHXnWAEqnQwpxTLWm': 'edisgorgulu', // Edis
  '1mpOD8ZwHnbsryIuXWq0R1': 'zeynepbastk', // Zeynep Bastık
  '5h2jTdwf4p0dM34aBykPzZ': 'iremderici', // İrem Derici
  '4XP7cGw4t8BqZ8Du5q3bHg': 'emircanigrek', // Emir Can İğrek
  '4ckLjJztj53Ifid7WHweBn': 'aleynatilki', // Aleyna Tilki
  '1ITjgqpqMDJlqZGAK3mlPQ': 'sefo362', // Sefo
  '15AZJFNrXtIN4Nk8BIOnS2': 'batuflex', // Batuflex
  '2y1VzMKAa5nmfXKtJL9jnj': 'murdaworld', // Murda
  '55WpZ8ig2SFNvQpDHPUrgY': 'melabedel', // Mela Bedel
  '27XMnTLvCO7t3qGlQyTMkF': 'pekkan1', // Ajda Pekkan
  '0mkH5jj3goQ51JtPKVodTo': 'mustinetnet', // Mustafa Sandal
  '2aZlYOswKNlrwqpuTsckKd': 'MadrigalBand', // Madrigal
  '6RTC1abMgBC7Krg6qJQHJh': 'OfficialDuman', // Duman
  '2RQ8NtUmg5y6tfbvCwX8jI': 'kenandogulu', // Kenan Doğulu
  '5gFPi3KWXEwA9bLEO47Ow0': 'silagencoglu', // Sıla
  '53oeVgECSa18dkHBQ9X6Eh': 'MuratBoz', // Murat Boz
  '1U449OOb70EZlElNjLMwCM': 'DemetAkalin', // Demet Akalın
  '1qZ684TB9E1BjH58btdtYd': 'Buraymusic', // Buray
  '1Fg19vpUJpAAPFjnKaVYVW': 'akareynmen', // Reynmen
  '28Qbi9jTj2eej21P2mImZI': 'CEZA_ED', // Ceza
  '1KXTegXtnCPKXjRaX1llcD': 'Sagopakajmerrap', // Sagopa Kajmer
  '3S6gaE89XewFAvZqsMuJDJ': 'normender', // Norm Ender
  '5LUxu287CsPM7jy3yS3l86': 'sarppalaur', // Şanışer
  '2boacFGRX1WIo7NFS8B0F2': 'gazapizm', // Gazapizm
  '3tJELJoPZ4VTKmL0vppqLj': 'Contra667', // Contra
  '1iJrQKRh5aJnp6cG5lpITr': 'khontkar', // Khontkar
  '40PllTYqoDKRna2jm9Gf8D': 'grogionline', // Grogi
  '74xBVPWYoSf5pvo5IkePRO': 'sebnemferah', // Şebnem Ferah
  '5ixQSDvAMa5O758xG8MWXT': 'mvoofficial', // mor ve ötesi
  '7rEIUw67hRTgievwuKQGSj': 'maNgaMusic', // maNga
  '23xJQJM7peht77DF6YNEoq': 'model_band', // Model
  '5IAxUWLiTMsvc1oWPrczNj': 'melekmosso', // Melek Mosso
  '7A6T0nTpXnPXDUGM1yEjEj': 'deryaulugg', // Derya Uluğ
  '17fJCykpa2EqIioh0zamN9': 'fettahcan', // Fettah Can
  '2AWUCT9xtcvkjpFq1ZgpPj': 'cemadrian', // Cem Adrian
};

const UA = 'YeniSarkilarimBot/1.0 (https://github.com/ferhatarslan01/spotify-sarki)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const memo = new Map(); // id -> handle | null (surec boyunca)

export function xTagsEnabled() {
  return process.env.X_TAGS !== '0';
}

function norm(s) {
  return String(s)
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '');
}

function similar(name, handle) {
  const n = norm(name);
  const h = norm(handle);
  return n.length >= 3 && (h.includes(n) || (h.length >= 4 && n.includes(h)));
}

let lastMb = 0;
async function mbGet(url) {
  const wait = Math.max(0, lastMb + 1100 - Date.now());
  if (wait) await sleep(wait);
  lastMb = Date.now();
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
  return res.ok ? res.json() : null;
}

function handleFromUrl(u) {
  const m = /^https?:\/\/(?:www\.|mobile\.)?(?:twitter|x)\.com\/(?:#!\/)?@?([A-Za-z0-9_]{1,15})(?:[/?].*)?$/i.exec(u ?? '');
  return m && !['intent', 'share', 'home', 'i', 'search', 'hashtag'].includes(m[1].toLowerCase()) ? m[1] : null;
}

// Takip listesi disindaki sanatcilar icin (ornegin liste girdileri): MusicBrainz + Wikidata capraz kontrol.
async function lookupHandle(id, name) {
  const u = await mbGet(`https://musicbrainz.org/ws/2/url?resource=${encodeURIComponent(`https://open.spotify.com/artist/${id}`)}&inc=artist-rels&fmt=json`);
  const mbid = u?.relations?.find((r) => r['target-type'] === 'artist')?.artist?.id;
  if (!mbid) return null;
  const artist = await mbGet(`https://musicbrainz.org/ws/2/artist/${mbid}?inc=url-rels&fmt=json`);
  const handles = [];
  let wikidata = null;
  for (const r of artist?.relations ?? []) {
    const h = handleFromUrl(r.url?.resource);
    if (h) handles.push(h);
    if (r.type === 'wikidata') wikidata = r.url?.resource?.split('/').pop() ?? null;
  }
  if (handles.length === 0) return null;

  let wd = [];
  if (wikidata) {
    try {
      const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${wikidata}.json`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) });
      const j = res.ok ? await res.json() : null;
      wd = (j?.entities?.[wikidata]?.claims?.P2002 ?? []).map((c) => c.mainsnak?.datavalue?.value).filter(Boolean);
    } catch {
      /* Wikidata yoksa isim eslesmesine bakilir */
    }
  }
  const lc = (s) => s.toLowerCase();
  return handles.find((h) => wd.some((w) => lc(w) === lc(h))) ?? handles.find((h) => similar(name, h)) ?? null;
}

// { id, name } -> X kullanici adi (yoksa null). Hata/bulunamazsa null; asla throw etmez.
export async function handleFor({ id, name }) {
  if (!xTagsEnabled() || !id) return null;
  if (STATIC[id]) return STATIC[id];
  if (memo.has(id)) return memo.get(id);
  let handle = null;
  try {
    handle = await lookupHandle(id, name);
  } catch {
    handle = null;
  }
  memo.set(id, handle);
  return handle;
}

// Takip edilen sanatciyi ada gore bulur (haftalik ozet gunlugunde ID yok).
export function trackedByName(name) {
  return trackedArtists.find((a) => a.name === name) ?? { id: null, name };
}

// Metindeki sanatci adlarinin ilk gecisinden sonra " (@kullanici)" ekler (en fazla `max` kisi).
// 280 karakteri asarsa etiketsiz metni dondurur.
export async function tagText(text, artists, { max = 2 } = {}) {
  if (!xTagsEnabled()) return text;
  let out = text;
  let n = 0;
  for (const a of artists) {
    if (n >= max) break;
    const handle = await handleFor(a);
    if (!handle) continue;
    const i = out.indexOf(a.name);
    if (i < 0) continue;
    const end = i + a.name.length;
    if (out.slice(end).startsWith(' (@')) continue;
    out = `${out.slice(0, end)} (@${handle})${out.slice(end)}`;
    n += 1;
  }
  return out.length <= 280 ? out : text;
}
