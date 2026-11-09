// Spotify Canvas: sanatcinin sarkiya yukledigi 3-8 sn'lik DIKEY dongu videosu (cnvs.mp4).
// UYARI: RESMI DEGIL. Belgelenmemis uc noktalar kullanilir, Spotify hizmet sartlarini ihlal edebilir ve hesabin kisitlanmasina yol acabilir.
// Giris yapmis bir Spotify oturumunun `sp_dc` cerezi gerekir (SP_DC ortam degiskeni / .env); cerez yalnizca open.spotify.com'a gonderilir.
// Canvas gorselleri sanatcinin/yayincinin eseridir: klipler gibi telif iddiasi riski tasir. Mumkunse ayri (ikincil) bir hesabin cerezini kullanin.
// Bagimlilik yok: TOTP (RFC 6238) node:crypto ile, protobuf kucuk bir okuyucuyla cozulur.
import { createHmac } from 'node:crypto';

const SECRETS_URL = 'https://raw.githubusercontent.com/xyloflake/spot-secrets-go/refs/heads/main/secrets/secretDict.json';
const UA_WEB = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
const UA_APP = 'Spotify/9.0.34.593 iOS/18.4 (iPhone15,3)';

export class CanvasAuthError extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- TOTP ----------
function hotp(secret, counter) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', secret).update(msg).digest();
  const o = h[19] & 0xf;
  const code = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 1_000_000).padStart(6, '0');
}
const totp = (secret, timestampMs) => hotp(secret, Math.floor(timestampMs / 30_000));

let totpCache = null;
async function totpSecret() {
  if (totpCache && Date.now() - totpCache.at < 3600_000) return totpCache;
  const dict = await (await fetch(SECRETS_URL, { signal: AbortSignal.timeout(15_000) })).json();
  const version = String(Math.max(...Object.keys(dict).map(Number)));
  const data = dict[version];
  // Spotify web oynaticisindaki gizleme: her bayt (indeks % 33) + 9 ile XOR'lanir, ondalik yazilip birlestirilir
  const secret = Buffer.from(data.map((v, i) => v ^ ((i % 33) + 9)).join(''), 'utf8');
  totpCache = { at: Date.now(), secret, version };
  return totpCache;
}

// ---------- erisim anahtari ----------
let tokenCache = null;
async function accessToken() {
  const spDc = (process.env.SP_DC ?? '').trim();
  if (!spDc) throw new CanvasAuthError('SP_DC tanımlı değil (.env dosyasına SP_DC=<sp_dc çerezi> ekleyin).');
  if (tokenCache && tokenCache.exp - 60_000 > Date.now()) return tokenCache.token;

  const headers = { 'User-Agent': UA_WEB, Origin: 'https://open.spotify.com/', Referer: 'https://open.spotify.com/', Cookie: `sp_dc=${spDc}` };
  const { secret, version } = await totpSecret();
  let serverMs = Date.now();
  try {
    const st = await (await fetch('https://open.spotify.com/api/server-time', { headers, signal: AbortSignal.timeout(15_000) })).json();
    if (Number.isFinite(Number(st.serverTime))) serverMs = Number(st.serverTime) * 1000;
  } catch {
    /* yerel saat */
  }
  const qs = new URLSearchParams({
    reason: 'init',
    productType: 'mobile-web-player',
    totp: totp(secret, Date.now()),
    totpVer: version,
    totpServer: totp(secret, Math.floor(serverMs / 30)),
  });
  const res = await fetch(`https://open.spotify.com/api/token?${qs}`, { headers, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new CanvasAuthError(`Spotify erişim anahtarı alınamadı (HTTP ${res.status}); çerez geçersiz/süresi dolmuş olabilir ya da Spotify yöntemi değiştirmiş olabilir.`);
  const j = await res.json();
  if (!j.accessToken || j.isAnonymous) throw new CanvasAuthError('Spotify anonim oturum döndürdü: sp_dc çerezi geçersiz ya da süresi dolmuş.');
  tokenCache = { token: j.accessToken, exp: Number(j.accessTokenExpirationTimestampMs) || Date.now() + 3000_000 };
  return tokenCache.token;
}

// ---------- minimal protobuf ----------
function varint(buf, pos) {
  let result = 0;
  let mul = 1;
  for (;;) {
    const b = buf[pos++];
    result += (b & 0x7f) * mul;
    if (!(b & 0x80)) break;
    mul *= 128;
  }
  return [result, pos];
}
function fields(buf) {
  const out = [];
  let pos = 0;
  while (pos < buf.length) {
    const [tag, p1] = varint(buf, pos);
    const field = Math.floor(tag / 8);
    const wire = tag % 8;
    pos = p1;
    if (wire === 0) pos = varint(buf, pos)[1];
    else if (wire === 2) {
      const [len, p2] = varint(buf, pos);
      out.push({ field, buf: buf.subarray(p2, p2 + len) });
      pos = p2 + len;
    } else if (wire === 1) pos += 8;
    else if (wire === 5) pos += 4;
    else throw new Error(`Bilinmeyen protobuf tipi ${wire}`);
  }
  return out;
}
const str = (f) => f?.buf.toString('utf8');
// CanvasRequest { repeated Track tracks = 1 }, Track { string track_uri = 1 }
function encodeRequest(trackUri) {
  const uri = Buffer.from(trackUri, 'utf8');
  const track = Buffer.concat([Buffer.from([0x0a, uri.length]), uri]);
  return Buffer.concat([Buffer.from([0x0a, track.length]), track]);
}

// { id, url, artist } ya da null (bu sarkinin Canvas'i yok). Kimlik/sınır sorunlarında CanvasAuthError firlatir.
let lastCall = 0;
export async function getCanvas(trackId) {
  const token = await accessToken();
  const wait = lastCall + 1200 - Date.now(); // sorgular arasi bosluk (sinira takilmamak icin)
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  const res = await fetch('https://spclient.wg.spotify.com/canvaz-cache/v0/canvases', {
    method: 'POST',
    headers: { Accept: 'application/protobuf', 'Content-Type': 'application/x-www-form-urlencoded', 'Accept-Language': 'en', 'User-Agent': UA_APP, Authorization: `Bearer ${token}` },
    body: encodeRequest(`spotify:track:${trackId}`),
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 401 || res.status === 403) {
    tokenCache = null;
    throw new CanvasAuthError(`Canvas isteği reddedildi (HTTP ${res.status}).`);
  }
  if (res.status === 429) {
    await sleep(5000);
    throw new CanvasAuthError('Canvas istek sınırı (HTTP 429): daha yavaş deneyin.');
  }
  if (!res.ok) throw new Error(`Canvas isteği başarısız (HTTP ${res.status}).`);
  const canvases = fields(Buffer.from(await res.arrayBuffer())).filter((f) => f.field === 1);
  if (canvases.length === 0) return null;
  const c = fields(canvases[0].buf);
  const url = str(c.find((f) => f.field === 2));
  if (!url) return null;
  const artist = c.find((f) => f.field === 6);
  return { id: str(c.find((f) => f.field === 1)), url, artist: artist ? str(fields(artist.buf).find((f) => f.field === 2)) : null };
}

// Canvas videosunu indirir: { buffer, url } ya da null
export async function fetchCanvasVideo(trackId) {
  const c = await getCanvas(trackId);
  if (!c) return null;
  const res = await fetch(c.url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Canvas videosu indirilemedi (HTTP ${res.status}).`);
  return { ...c, buffer: Buffer.from(await res.arrayBuffer()) };
}

// yalnizca testler icin
export const _internals = { hotp, fields, encodeRequest };
