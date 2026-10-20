// Paylasim penceresi: TUM saatler Turkiye saatiyle (Europe/Istanbul, UTC+3, yaz/kis saati yok) hesaplanir.
// Calistigi makinenin / kullanicinin yerel saati (ornek: ABD) hicbir yerde kullanilmaz.
//
// Ayar (ortam degiskeni POST_WINDOW):
//   (bos)         varsayilan pencere (asagida)
//   "10:00-23:00" ozel pencere (TRT)
//   "off"         pencere kontrolu kapali (elle calistirmada kullanilir)
// Pencere disinda calisan paylasim betikleri HICBIR SEY paylasmadan, durum dosyalarina dokunmadan cikar;
// bekleyen olaylar sonraki (pencere ici) calistirmada yakalanir.
const DEFAULT_WINDOW = '09:00-23:30';
const OPENING_HOURS = 3; // pencere acildiktan sonraki bu kadar saat "acilis calistirmasi" sayilir

function parseWindow(spec) {
  const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(String(spec).trim());
  if (!m) return null;
  const start = Number(m[1]) * 60 + Number(m[2]);
  const end = Number(m[3]) * 60 + Number(m[4]);
  if (start > 24 * 60 || end > 24 * 60) return null;
  return { start, end };
}

// null = pencere kontrolu kapali
export function getPostWindow() {
  const raw = (process.env.POST_WINDOW ?? '').trim();
  if (raw.toLowerCase() === 'off') return null;
  return (raw && parseWindow(raw)) || parseWindow(DEFAULT_WINDOW);
}

// Turkiye saatiyle gunun dakikasi (0-1439)
export function trtMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

const hhmm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// Gece yarisini asan pencereler de desteklenir (ornek 22:00-02:00).
export function inPostWindow(date = new Date()) {
  const w = getPostWindow();
  if (!w) return true;
  const now = trtMinutes(date);
  return w.start <= w.end ? now >= w.start && now < w.end : now >= w.start || now < w.end;
}

// Pencerenin ilk saatleri: gece biriken olaylari yakalamak icin tum sanatcilar bu calistirmada kontrol edilir.
export function isOpeningRun(date = new Date()) {
  const w = getPostWindow();
  if (!w) return false;
  const now = trtMinutes(date);
  const since = (now - w.start + 24 * 60) % (24 * 60);
  return inPostWindow(date) && since < OPENING_HOURS * 60;
}

// Betiklerin basinda: true ise paylasima devam, false ise log yazip cikilmali.
export function postWindowOpen(label = 'Paylasim', date = new Date()) {
  const w = getPostWindow();
  const now = hhmm(trtMinutes(date));
  if (!w) {
    console.log(`${label}: paylasim penceresi kapali (POST_WINDOW=off), TRT ${now}.`);
    return true;
  }
  if (inPostWindow(date)) return true;
  console.log(`${label}: TRT ${now}, paylasim penceresi (${hhmm(w.start)}-${hhmm(w.end)} TRT) disinda; bu tur atlaniyor, bekleyenler sonraki turda paylasilir.`);
  return false;
}
