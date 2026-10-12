import { mkdir, writeFile, readdir, unlink } from 'node:fs/promises';
import { pushPaths, getRawUrl } from './gitPublish.js';
import { publishTikTokPhoto } from './bufferPost.js';
import { renderFeatureCard, renderListCard } from './tiktokCard.js';
import { getTrackThumbnail, formatStreams } from './dailyChart.js';

const DIR = 'public/tiktok';
const KEEP_DAYS = 3;
const TITLE_MAX = 90;

// BUFFER_TIKTOK_CHANNEL_ID tanimli degilse TikTok tarafi tamamen devre disi kalir.
export function tiktokEnabled() {
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

async function pruneOld() {
  const files = await readdir(DIR).catch(() => []);
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  for (const file of files) {
    const m = file.match(/^(\d{4})(\d{2})(\d{2})/);
    if (m && Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) < cutoff) {
      await unlink(`${DIR}/${file}`);
    }
  }
}

async function publishCard({ kind, cardBuffer, title, description }) {
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const name = `${stamp}-${kind}-${Math.random().toString(36).slice(2, 6)}.jpg`;
  const filePath = `${DIR}/${name}`;

  await mkdir(DIR, { recursive: true });
  await writeFile(filePath, cardBuffer);
  await pruneOld();
  pushPaths([DIR], `Add TikTok card ${kind} [skip ci]`);

  const imageUrl = getRawUrl(filePath);
  const result = await publishTikTokPhoto(process.env.BUFFER_TIKTOK_CHANNEL_ID, {
    text: description,
    imageUrls: [imageUrl],
    title: truncate(title, TITLE_MAX),
  });

  if (result.message) throw new Error(result.message);
  console.log(`  TikTok'a gönderildi (post id: ${result.post.id})`);
  return true;
}

// Tek sarki/olay karti. Hata verirse X akisini bozmamak icin asla throw etmez.
export async function tiktokFeaturePost({ kind, label, headline, title, subtitle, coverUrl, trackUrl, caption }) {
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
    });
  } catch (err) {
    console.error(`  TikTok hatası (${kind}): ${err.message}`);
    return false;
  }
}

// Chart karti: entries = fetchDailyChart/fetchGlobalChart/fetchWeeklyChart ciktisi
export async function tiktokChartPost({ kind, header, date, entries, maxRows = 8 }) {
  if (!tiktokEnabled()) return false;
  try {
    const top = entries.slice(0, maxRows);
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

    const fullHeader = `${header} TOP ${top.length}`;
    const cardBuffer = await renderListCard({ header: fullHeader, subheader: date, rows });
    const description = [
      `${fullHeader} (${date})`,
      '',
      ...top.map((e) => `${e.rank}. ${e.artists.map((a) => a.name).join(' & ')} - ${e.trackName}`),
    ].join('\n');

    return await publishCard({ kind, cardBuffer, title: `${fullHeader} (${date})`, description });
  } catch (err) {
    console.error(`  TikTok hatası (${kind}): ${err.message}`);
    return false;
  }
}

// Haftalik ozet gibi siralamasiz liste kartlari: rows = [{ coverUrl, line1, line2 }]
export async function tiktokListPost({ kind, header, subheader, rows, description }) {
  if (!tiktokEnabled()) return false;
  try {
    const cardBuffer = await renderListCard({ header, subheader, rows });
    return await publishCard({ kind, cardBuffer, title: header, description });
  } catch (err) {
    console.error(`  TikTok hatası (${kind}): ${err.message}`);
    return false;
  }
}
