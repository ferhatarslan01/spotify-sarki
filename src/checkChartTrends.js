import { postWindowOpen } from './postWindow.js';
import { fetchDailyChart, getTrackThumbnail, formatStreams } from './dailyChart.js';
import { fetchGlobalChart } from './globalChart.js';
import { loadTrendsState, saveTrendsState, emptyTrendsState, highestMilestone } from './trendsState.js';
import { publishPostWithVideo } from './bufferPost.js';
import { tagText } from './artistHandles.js';
import { ctaFor } from './cta.js';
import { makeEventVideos, hostVideo, tiktokPostPrepared } from './tiktokVideo.js';
import { artists as trackedArtists } from './artists.js';
import { findTrackReleaseDate } from './deezer.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const JUMP_THRESHOLD = 10;
const MAX_POSTS_PER_RUN = 5;
const MAX_TIKTOK_PER_RUN = 1;
const RELEVANT_RANK_LIMIT = 100;
const NEWENTRY_RANK_LIMIT = 100; // listeye yeni giren sarki bu siranin icindeyse "yeni cikti" olarak duyurulur
const NEWENTRY_MAX_AGE_DAYS = 21; // Deezer'a gore yayin tarihi en fazla bu kadar eskiyse (eski sarkilarin listeye donusu haric)
const TRACKED_IDS = new Set(trackedArtists.map((a) => a.id)); // takip edilen sanatcilarin yeni yayinlari release-check ile zaten duyurulur

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
  // Paylaşım penceresi (TRT): pencere dışındaysa hiçbir şey paylaşılmaz, durum dosyalarına dokunulmaz.
  if (!postWindowOpen('Trend kontrolü')) return;

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
  state.newEntrySeen ??= [];

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
          variantSeed: entry.trackId, // sarkiya gore yukselis sablonu (sirali donus)
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

    // 5) Listeye yeni giren, gercekten yeni cikmis sarki (takip listesinde olmayan sanatcilar dahil)
    if (
      entry.positionChange === 'NEW' &&
      entry.rank <= NEWENTRY_RANK_LIMIT &&
      !state.newEntrySeen.includes(entry.trackId) &&
      !entry.artists.some((a) => TRACKED_IDS.has(a.id))
    ) {
      if (!isFirstRun) {
        const rel = await findTrackReleaseDate(entry.artists[0].name, entry.trackName).catch(() => null);
        const ageDays = rel ? Math.round((Date.now() - new Date(`${rel.releaseDate}T12:00:00Z`).getTime()) / 86_400_000) : null;
        if (rel && ageDays !== null && ageDays >= -1 && ageDays <= NEWENTRY_MAX_AGE_DAYS) {
          const [yy, mm, dd] = rel.releaseDate.split('-');
          const releaseText = `${dd}.${mm}.${yy}`;
          events.push({
            priority: 60 + (100 - entry.rank) / 100,
            trackUrl: entry.trackUrl,
            artists: entry.artists,
            text: eventText('trend-newentry', `🆕 ${label}`, `Yeni çıktı ve Türkiye günlük listesine ${entry.rank}. sıradan girdi! 🔥`, entry.trackUrl),
            card: {
              kind: 'trend-newentry',
              label: 'LİSTEYE YENİ GİRİŞ',
              headline: `${entry.rank}. SIRA`,
              title: entry.trackName,
              subtitle: artistNames(entry),
              template: 'NewRelease',
              variantSeed: entry.trackId, // sarkiya gore yeni cikti sablonu (sirali donus)
              templateData: {
                dateText: releaseText,
                pill: `YENİ ÇIKTI · LİSTEDE #${entry.rank}`,
                loadingLabel: 'YENİ ŞARKI YÜKLENİYOR',
                radarLabel: 'LİSTEYE YENİ GİRİŞ',
              },
              scene: 'new',
              palette: 'studio',
              sceneData: {
                dateText: releaseText,
                pill: 'LİSTEYE YENİ GİRİŞ',
                hook1: 'YENİ ÇIKTI',
                hook2: 'LİSTEDE!!!',
                sub: `${entry.rank}. sıradan girdi!`,
                badge: `#${entry.rank}`,
                cta: 'Dinledin mi?',
              },
            },
            onCommit: () => {
              state.newEntrySeen.push(entry.trackId);
              state.newEntrySeen = state.newEntrySeen.slice(-400);
            },
          });
        } else {
          console.log(`Liste girişi atlandı (yeni çıkmamış ya da tarih bulunamadı): ${label} (${rel?.releaseDate ?? '?'})`);
          state.newEntrySeen.push(entry.trackId);
        }
      } else {
        state.newEntrySeen.push(entry.trackId);
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
  for (const event of toPost) {
    console.log(`- ${event.text.split('\n')[0]}`);
    // X'e HER olay icin video (kare oynatici) uretilir; TikTok videosu calistirma basina en fazla MAX_TIKTOK_PER_RUN olay icin.
    const params = {
      ...event.card,
      artist: event.card.subtitle,
      trackUrl: event.trackUrl,
      caption: event.text,
      wantTikTok: tiktokSent < MAX_TIKTOK_PER_RUN,
    };
    const handles = await makeEventVideos(params);
    if (!handles.x) console.log('  Uyarı: bu olay için video üretilemedi, X\'e görselli tweet gidecek.');
    const ok = await postEvent(await tagText(event.text, event.artists), event.trackUrl, handles.x);
    if (ok) {
      event.onCommit();
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
