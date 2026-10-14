import { existsSync } from 'node:fs';
import { publishTikTokPhoto } from './bufferPost.js';
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
  const imageUrl = hostMedia(cardBuffer, mediaName(kind, 'jpg'));
  const result = await publishTikTokPhoto(process.env.BUFFER_TIKTOK_CHANNEL_ID, {
    text: withHashtags(description, { kind, artists }),
    imageUrls: [imageUrl],
    title: truncate(title, TITLE_MAX),
  });

  if (result.message) throw new Error(result.message);
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

export function chartDescription(fullHeader, date, top) {
  return [
    `${fullHeader} (${date})`,
    '',
    ...top.map((e) => `${e.rank}. ${e.artists.map((a) => a.name).join(' & ')} - ${e.trackName}`),
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
      description: chartDescription(fullHeader, date, top),
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
