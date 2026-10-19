// Gunde bir kez "Duello": gunluk listeden iki sarki, "hangisi daha cok dinlendi?" tahmin videosu.
// X: video tweet (cevap/kazanan metinde YOK, yalnizca videoda) + ilk yanitta iki Spotify linki.
// TikTok: ayni video (gunluk sinir icinde).
import { fetchDailyChart, getTrackThumbnail } from './dailyChart.js';
import { loadChartState, saveChartState } from './chartState.js';
import { publishThreadWithVideo } from './bufferPost.js';
import { makeDuelVideo, hostVideo, postVideoToTikTok } from './tiktokVideo.js';
import { tagText } from './artistHandles.js';
import { ctaFor } from './cta.js';

const STATE_FILE = 'duelState.json';
const KEEP_KEYS = 14; // son 14 duello cifti tekrar secilmez

const names = (e) => e.artists.map((a) => a.name).join(' & ');

async function main() {
  const { date, entries } = await fetchDailyChart();
  if (!date || entries.length === 0) {
    console.error('Chart verisi alinamadi, cikiliyor.');
    process.exitCode = 1;
    return;
  }

  const state = await loadChartState(STATE_FILE);
  if (state.lastPostedDate === date) {
    console.log(`${date} listesiyle duello zaten paylasilmis, atlaniyor.`);
    return;
  }

  const handle = await makeDuelVideo({ date, entries, excludeKeys: state.recentKeys ?? [] });
  if (!handle) {
    console.log('Duello videosu uretilemedi (video kapali / uygun cift yok), atlaniyor.');
    return;
  }
  const { a, b } = handle.pair;
  console.log(`Duello: A=${names(a)} - ${a.trackName} vs B=${names(b)} - ${b.trackName} (${handle.note})`);

  if (process.env.X_VIDEO !== '0') {
    const question = ctaFor('duel') ?? 'A mı B mi? Yorumla 👇';
    const plain = ['⚔️ DÜELLO: hangisi daha çok dinlendi?', '', `A: ${names(a)} - ${a.trackName}`, `B: ${names(b)} - ${b.trackName}`, '', question].join('\n');
    const xText = await tagText(plain, [a.artists[0], b.artists[0]], { max: 2 });
    const coverUrl = await getTrackThumbnail(a.trackUrl).catch(() => null);
    const items = [
      { text: xText, imageUrl: coverUrl ?? undefined, videoUrl: hostVideo(handle) },
      { text: `🎧 Dinle:\nA: ${a.trackUrl}\nB: ${b.trackUrl}` },
    ];
    const result = await publishThreadWithVideo(items);
    if (result.message) {
      console.error(`Buffer hatasi: ${result.message}`);
      process.exitCode = 1;
      return;
    }
    console.log(`X'e paylasildi (post id: ${result.post.id})`);
  }

  await postVideoToTikTok(handle);
  await saveChartState(
    { lastPostedDate: date, recentKeys: [handle.pair.key, ...(state.recentKeys ?? [])].slice(0, KEEP_KEYS) },
    STATE_FILE
  );
}

main();
