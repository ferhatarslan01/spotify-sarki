import { fetchDailyChart, getTrackThumbnail, formatStreams } from './dailyChart.js';
import { fetchGlobalChart } from './globalChart.js';
import { loadTrendsState, saveTrendsState, emptyTrendsState, highestMilestone } from './trendsState.js';
import { publishPostWithVideo } from './bufferPost.js';
import { tagText } from './artistHandles.js';
import { ctaFor } from './cta.js';
import { makeEventVideos, hostVideo, tiktokPostPrepared } from './tiktokVideo.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const JUMP_THRESHOLD = 10;
const MAX_POSTS_PER_RUN = 5;
const MAX_TIKTOK_PER_RUN = 1;
const RELEVANT_RANK_LIMIT = 100;

function artistNames(entry) {
  return entry.artists.map((a) => a.name).join(' & ');
}

function trackLabel(entry) {
  return `${artistNames(entry)} - ${entry.trackName}`;
}

// Olay metni: baslik, aciklama, (varsa) tek harfli soru, son satir Spotify linki (X'te ilk yanita tasinir).
function eventText(kind, head, body, url) {
  const question = ctaFor(kind);
  return [head, '', body, ...(question ? ['', question] : []), url].join('\n');
}

async function postEvent(text, trackUrl, handle) {
  const imageUrl = await getTrackThumbnail(trackUrl).catch(() => null);
  const result = await publishPostWithVideo(text, imageUrl, handle ? hostVideo(handle) : null);
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
        artists: entry.artists,
        text: eventText(
          'trend-jump',
          `🚀 ${label}`,
          `${entry.positionChange} sıra birden yükseldi! Şu an Türkiye ${entry.rank}. sırada 🔥`,
          entry.trackUrl
        ),
        card: {
          kind: 'trend-jump',
          label: 'SIRA ATLADI',
          headline: `+${entry.positionChange} SIRA`,
          title: entry.trackName,
          subtitle: artistNames(entry),
          template: 'RankRise',
          templateData: { entries, featured: entry, date },
          scene: 'rise',
          palette: 'altin',
          sceneData: {
            from: entry.rank + entry.positionChange,
            to: entry.rank,
            pill: 'TÜRKİYE GÜNLÜK LİSTE',
            cta: 'Sence zirveye çıkar mı?',
          },
        },
        onCommit: () => state.jumpsAnnounced.push(entry.trackId),
      });
    }

    // 2) Ilk kez Top 10
    if (entry.rank <= 10 && !state.topTenSeen.includes(entry.trackId)) {
      if (!isFirstRun) {
        events.push({
          priority: 11 - entry.rank + 100,
          trackUrl: entry.trackUrl,
        artists: entry.artists,
          text: eventText('trend-top10', `🎉 ${label}`, `İlk kez Türkiye Top 10'a girdi! (${entry.rank}. sıra)`, entry.trackUrl),
          card: {
            kind: 'trend-top10',
            label: 'İLK KEZ TOP 10',
            headline: `${entry.rank}. SIRA`,
            title: entry.trackName,
            subtitle: artistNames(entry),
            template: 'NewRelease',
            templateData: {
              dateText: 'Türkiye günlük listesi',
              pill: `İLK KEZ TOP 10 · #${entry.rank}`,
              loadingLabel: 'TOP 10 YÜKLENİYOR',
              radarLabel: 'TÜRKİYE · TOP 10 RADARI',
            },
            scene: 'new',
            palette: 'studio',
            sceneData: {
              dateText: `Türkiye günlük listesi · ${entry.rank}. sıra`,
              pill: 'İLK KEZ TOP 10',
              hook1: "TÜRKİYE TOP 10'A",
              hook2: 'GİRDİ!!!',
              sub: `${entry.rank}. sıraya yerleşti!`,
              badge: `#${entry.rank}`,
              cta: 'Sence kaçıncı olur?',
            },
          },
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
        artists: entry.artists,
            text: eventText('trend-milestone', `🎊 ${label}`, `${formatStreams(milestone)} stream'i geçti! 🎧`, entry.trackUrl),
            card: {
              kind: 'trend-milestone',
              label: 'STREAM REKORU',
              headline: `${formatStreams(milestone)} STREAM`,
              title: entry.trackName,
              subtitle: artistNames(entry),
              template: 'NewRelease',
              templateData: {
                dateText: 'Türkiye günlük listesi',
                pill: `STREAM REKORU · ${formatStreams(milestone)}`,
                loadingLabel: 'REKOR YÜKLENİYOR',
                radarLabel: 'STREAM REKORLARI RADARI',
              },
              scene: 'anniv',
              palette: 'altin',
              sceneData: {
                number: milestone >= 1_000_000 ? Math.round(milestone / 1_000_000) : Math.round(milestone / 1_000),
                suffix: milestone >= 1_000_000 ? 'M' : 'K',
                pill: 'STREAM REKORU',
                small: 'şarkısı',
                l1: 'REKOR',
                l2: 'KIRDI!',
                label: "STREAM'İ GEÇTİ",
                dateText: 'Türkiye günlük listesi',
                cta: 'Sen kaç kere dinledin?',
              },
            },
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
        artists: entry.artists,
          text: eventText(
            'trend-global',
            `🌍 ${label}`,
            "Bizden bir şarkı şu anda Dünya Günlük Top 200'de de yer alıyor! 🇹🇷➡️🌍",
            entry.trackUrl
          ),
          card: {
            kind: 'trend-global',
            label: 'DÜNYA LİSTESİNDE',
            headline: 'TÜRKİYE → DÜNYA',
            title: entry.trackName,
            subtitle: artistNames(entry),
            template: 'NewRelease',
            templateData: {
              dateText: 'Dünya günlük listesi',
              pill: 'DÜNYA LİSTESİNDE',
              loadingLabel: 'DÜNYA LİSTESİ YÜKLENİYOR',
              radarLabel: 'TÜRKİYE > DÜNYA',
            },
            scene: 'new',
            palette: 'studio',
            sceneData: {
              dateText: 'Dünya günlük listesi',
              pill: 'DÜNYA LİSTESİNDE',
              hook1: 'DÜNYA LİSTESİNE',
              hook2: 'GİRDİ!!!',
              sub: 'dünyada da dinleniyor!',
              badge: 'DÜNYA',
              cta: 'Gurur duydun mu?',
            },
          },
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

  let tiktokSent = 0;
  let videosMade = 0;
  for (const event of toPost) {
    console.log(`- ${event.text.split('\n')[0]}`);
    // Video (X + TikTok ortak) calistirma basina en fazla MAX_TIKTOK_PER_RUN olay icin uretilir.
    const params = {
      ...event.card,
      artist: event.card.subtitle,
      trackUrl: event.trackUrl,
      caption: event.text,
    };
    const handles = videosMade < MAX_TIKTOK_PER_RUN ? await makeEventVideos(params) : { tiktok: null, x: null };
    const ok = await postEvent(await tagText(event.text, event.artists), event.trackUrl, handles.x);
    if (ok) {
      event.onCommit();
      if (handles.x || handles.tiktok) videosMade += 1;
      if (tiktokSent < MAX_TIKTOK_PER_RUN) {
        const sent = await tiktokPostPrepared(handles.tiktok, params);
        if (sent) tiktokSent += 1;
      }
    }
    await sleep(2000);
  }

  await saveTrendsState(state);
  console.log('Durum güncellendi.');
}

main();
