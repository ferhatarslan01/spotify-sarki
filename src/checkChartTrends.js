import { fetchDailyChart, getTrackThumbnail, formatStreams } from './dailyChart.js';
import { fetchGlobalChart } from './globalChart.js';
import { loadTrendsState, saveTrendsState, emptyTrendsState, highestMilestone } from './trendsState.js';
import { publishPost } from './bufferPost.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const JUMP_THRESHOLD = 10;
const MAX_POSTS_PER_RUN = 5;
const RELEVANT_RANK_LIMIT = 100;

function trackLabel(entry) {
  const artistNames = entry.artists.map((a) => a.name).join(' & ');
  return `${artistNames} - ${entry.trackName}`;
}

async function postEvent(text, trackUrl) {
  const imageUrl = await getTrackThumbnail(trackUrl).catch(() => null);
  const result = await publishPost(text, imageUrl);
  if (result.message) {
    console.error(`  Buffer hatası: ${result.message}`);
    return false;
  }
  console.log(`  Paylaşıldı (post id: ${result.post.id})`);
  return true;
}

async function main() {
  const { date, entries } = await fetchDailyChart();
  if (!date || entries.length === 0) {
    console.error('Chart verisi alinamadi, cikiliyor.');
    process.exitCode = 1;
    return;
  }

  let globalEntries = [];
  try {
    const global = await fetchGlobalChart();
    globalEntries = global.entries;
  } catch (err) {
    console.error(`Global chart alinamadi, crossover kontrolu atlanacak: ${err.message}`);
  }
  const globalTrackIds = new Set(globalEntries.map((e) => e.trackId));

  let state = await loadTrendsState();
  const isFirstRun = state === null;
  if (isFirstRun) state = emptyTrendsState();

  if (state.date !== date) {
    state.jumpsAnnounced = [];
    state.date = date;
  }

  const events = [];

  for (const entry of entries) {
    const label = trackLabel(entry);

    // 1) Buyuk siçrama
    if (
      !isFirstRun &&
      entry.rank <= RELEVANT_RANK_LIMIT &&
      typeof entry.positionChange === 'number' &&
      entry.positionChange >= JUMP_THRESHOLD &&
      !state.jumpsAnnounced.includes(entry.trackId)
    ) {
      events.push({
        priority: entry.positionChange,
        trackUrl: entry.trackUrl,
        text: `🚀 ${label}\n\n${entry.positionChange} sıra birden yükseldi! Şu an Türkiye ${entry.rank}. sırada 🔥\n${entry.trackUrl}`,
        onCommit: () => state.jumpsAnnounced.push(entry.trackId),
      });
    }

    // 2) Ilk kez Top 10
    if (entry.rank <= 10 && !state.topTenSeen.includes(entry.trackId)) {
      if (!isFirstRun) {
        events.push({
          priority: 11 - entry.rank + 100,
          trackUrl: entry.trackUrl,
          text: `🎉 ${label}\n\nİlk kez Türkiye Top 10'a girdi! (${entry.rank}. sıra)\n${entry.trackUrl}`,
          onCommit: () => state.topTenSeen.push(entry.trackId),
        });
      } else {
        state.topTenSeen.push(entry.trackId);
      }
    }

    // 3) Stream rekoru
    if (Number.isFinite(entry.totalStreams)) {
      const milestone = highestMilestone(entry.totalStreams);
      const previous = state.milestonesSeen[entry.trackId] ?? 0;
      if (milestone > previous) {
        if (!isFirstRun) {
          events.push({
            priority: milestone / 1_000_000,
            trackUrl: entry.trackUrl,
            text: `🎊 ${label}\n\n${formatStreams(milestone)} stream'i geçti! 🎧\n${entry.trackUrl}`,
            onCommit: () => {
              state.milestonesSeen[entry.trackId] = milestone;
            },
          });
        } else {
          state.milestonesSeen[entry.trackId] = milestone;
        }
      }
    }

    // 4) TR -> Dunya gecisi
    if (globalTrackIds.has(entry.trackId) && !state.crossoverSeen.includes(entry.trackId)) {
      if (!isFirstRun) {
        events.push({
          priority: 200,
          trackUrl: entry.trackUrl,
          text: `🌍 ${label}\n\nBizden bir şarkı şu anda Dünya Günlük Top 200'de de yer alıyor! 🇹🇷➡️🌍\n${entry.trackUrl}`,
          onCommit: () => state.crossoverSeen.push(entry.trackId),
        });
      } else {
        state.crossoverSeen.push(entry.trackId);
      }
    }
  }

  if (isFirstRun) {
    console.log('İlk çalıştırma: mevcut durum kaydedildi, hiçbir şey paylaşılmadı.');
    await saveTrendsState(state);
    return;
  }

  if (events.length === 0) {
    console.log('Bu çalıştırmada dikkat çekici bir gelişme yok.');
    await saveTrendsState(state);
    return;
  }

  events.sort((a, b) => b.priority - a.priority);
  const toPost = events.slice(0, MAX_POSTS_PER_RUN);
  console.log(`${events.length} olay bulundu, ${toPost.length} tanesi paylaşılacak.`);

  for (const event of toPost) {
    console.log(`- ${event.text.split('\n')[0]}`);
    const ok = await postEvent(event.text, event.trackUrl);
    if (ok) event.onCommit();
    await sleep(2000);
  }

  await saveTrendsState(state);
  console.log('Durum güncellendi.');
}

main();
