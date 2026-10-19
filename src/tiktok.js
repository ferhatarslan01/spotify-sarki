import { existsSync } from 'node:fs';
import { publishTikTokPhoto, countRecentPosts } from './bufferPost.js';
import { ctaFor } from './cta.js';
import { hostMedia } from './mediaHost.js';
import { renderFeatureCard, renderListCard } from './tiktokCard.js';
import { getTrackThumbnail, formatStreams } from './dailyChart.js';
import { withHashtags } from './hashtags.js';

const TITLE_MAX = 90;

// BUFFER_TIKTOK_CHANNEL_ID tanimli degilse TikTok tarafi tamamen devre disi kalir.
// data/TIKTOK_PAUSED dosyasi varsa otomatik TikTok gonderisi duraklatilir (dosyayi silince devam eder).
export function tiktokEnabled() {
  if (existsSync('data/TIKTOK_PAUSED')) return false;
  return Boolean(process.env.BUFFER_TIKTOK_CHANNEL_ID);
}

// Yeni hesapta gunde 1-3 video onerildigi icin son 24 saatteki TikTok gonderisi sayisi sinirlanir.
// TIKTOK_DAILY_MAX (varsayilan 3); 0 = sinirsiz. Trend olaylari bir slot geride kalir (yeni sarki/liste icin yer kalsin).
// Sayim Buffer'dan okunur (workflow'lar arasi ortak dosya yok); okunamazsa sinir uygulanmaz.
const DAILY_MAX = Number(process.env.TIKTOK_DAILY_MAX ?? 3);
let baseline = null; // bu calistirmanin basinda Buffer'daki sayi
let sentThisRun = 0;

export async function tiktokSlotAvailable(kind = '') {
  if (!tiktokEnabled()) return false;
  if (!(DAILY_MAX > 0)) return true;
  const remote = await countRecentPosts(process.env.BUFFER_TIKTOK_CHANNEL_ID);
  if (remote === null) return true;
  if (baseline === null) baseline = remote;
  const used = Math.max(remote, baseline + sentThisRun);
  const limit = String(kind).startsWith('trend-') ? Math.max(1, DAILY_MAX - 1) : DAILY_MAX;
  if (used >= limit) {
    console.log(`  TikTok günlük sınırı dolu (son 24 saatte ${used}/${limit}), ${kind} TikTok'a gönderilmeyecek.`);
    return false;
  }
  return true;
}

export function noteTikTokSent() {
  sentThisRun += 1;
}

function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

// TikTok aciklamasinda link tiklanmaz, X metinlerindeki URL satirlarini atiyoruz.
export function stripUrls(text) {
  return text
    .split('\n')
    .filter((line) => !/^https?:\/\//.test(line.trim()))
    .join('\n')
    .trim();
}

export function mediaName(kind, ext) {
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  return `${stamp}-${kind}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
}

async function publishCard({ kind, cardBuffer, title, description, artists = [] }) {
  if (!(await tiktokSlotAvailable(kind))) return false;
  const imageUrl = hostMedia(cardBuffer, mediaName(kind, 'jpg'));
  const result = await publishTikTokPhoto(process.env.BUFFER_TIKTOK_CHANNEL_ID, {
    text: withHashtags(description, { kind, artists }),
    imageUrls: [imageUrl],
    title: truncate(title, TITLE_MAX),
  });

  if (result.message) throw new Error(result.message);
  noteTikTokSent();
  console.log(`  TikTok'a gönderildi (post id: ${result.post.id})`);
  return true;
}

// Tek sarki/olay karti. Hata verirse X akisini bozmamak icin asla throw etmez.
export async function tiktokFeaturePost({
  kind,
  artist,
  label,
  headline,
  title,
  subtitle,
  coverUrl,
  trackUrl,
  caption,
}) {
  if (!tiktokEnabled()) return false;
  try {
    const cover = coverUrl ?? (await getTrackThumbnail(trackUrl));
    if (!cover) throw new Error('Kapak gorseli bulunamadi');
    const cardBuffer = await renderFeatureCard({ label, headline, title, subtitle, coverUrl: cover });
    const description = stripUrls(caption ?? `${subtitle} - ${title}`);
    return await publishCard({
      kind,
      cardBuffer,
      title: description.split('\n')[0] || `${subtitle} - ${title}`,
      description,
      artists: [artist ?? subtitle],
    });
  } catch (err) {
    console.error(`  TikTok hatası (${kind}): ${err.message}`);
    return false;
  }
}

// Chart kartinin satirlari (kapak + sanatci/sarki + stream)
export async function buildChartRows(top) {
  const rows = [];
  for (const e of top) {
    rows.push({
      rank: e.rank,
      coverUrl: await getTrackThumbnail(e.trackUrl),
      line1: e.artists.map((a) => a.name).join(' & '),
      line2: e.trackName,
      line3: `${formatStreams(e.streams)} stream`,
    });
  }
  return rows;
}

// Hashtag icin: listenin en ustundeki sanatcilar (benzersiz, ilk 3)
export function chartArtists(top) {
  const names = [];
  for (const e of top) {
    const name = e.artists[0]?.name;
    if (name && !names.includes(name)) names.push(name);
    if (names.length >= 3) break;
  }
  return names;
}

export function chartDescription(fullHeader, date, top, kind) {
  const question = kind ? ctaFor(kind) : null;
  return [
    `${fullHeader} (${date})`,
    '',
    ...top.map((e) => `${e.rank}. ${e.artists.map((a) => a.name).join(' & ')} - ${e.trackName}`),
    ...(question ? ['', question] : []),
  ].join('\n');
}

// Chart karti: entries = fetchDailyChart/fetchGlobalChart/fetchWeeklyChart ciktisi
export async function tiktokChartPost({ kind, header, date, entries, maxRows = 8 }) {
  if (!tiktokEnabled()) return false;
  try {
    const top = entries.slice(0, maxRows);
    const rows = await buildChartRows(top);
    const fullHeader = `${header} TOP ${top.length}`;
    const cardBuffer = await renderListCard({ header: fullHeader, subheader: date, rows });

    return await publishCard({
      kind,
      cardBuffer,
      title: `${fullHeader} (${date})`,
      description: chartDescription(fullHeader, date, top, kind),
      artists: chartArtists(top),
    });
  } catch (err) {
    console.error(`  TikTok hatası (${kind}): ${err.message}`);
    return false;
  }
}

// Haftalik ozet gibi siralamasiz liste kartlari: rows = [{ coverUrl, line1, line2 }]
export async function tiktokListPost({ kind, header, subheader, rows, description, artists = [] }) {
  if (!tiktokEnabled()) return false;
  try {
    const cardBuffer = await renderListCard({ header, subheader, rows });
    return await publishCard({ kind, cardBuffer, title: header, description, artists });
  } catch (err) {
    console.error(`  TikTok hatası (${kind}): ${err.message}`);
    return false;
  }
}
