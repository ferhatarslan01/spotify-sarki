import { postWindowOpen, isOpeningRun } from './postWindow.js';
import { artists } from './artists.js';
import { getAccessToken, getRecentReleases, QuotaError } from './spotify.js';
import { loadSpotifyBlock, saveSpotifyBlock } from './spotifyBlock.js';
import { loadState, saveState } from './state.js';
import { publishPostWithVideo } from './bufferPost.js';
import { tagText } from './artistHandles.js';
import { buildPostText } from './postText.js';
import { ctaFor } from './cta.js';
import { appendToWeeklyLog } from './weeklyLog.js';
import { loadAnniversaryState, saveAnniversaryState } from './anniversaryState.js';
import { makeEventVideos, hostVideo, tiktokPostPrepared } from './tiktokVideo.js';
import { loadCursor, saveCursor, pickBatch } from './checkCursor.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BATCH_COUNT = 2; // her calistirma listenin yarisini kontrol eder (imlec ile sirayla)

function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso ?? '';
}

function checkAnniversary(release, today) {
  const releaseDate = new Date(release.releaseDate);
  if (Number.isNaN(releaseDate.getTime())) return null;

  const yearsAgo = today.getUTCFullYear() - releaseDate.getUTCFullYear();
  if (yearsAgo < 1) return null;
  if (releaseDate.getUTCMonth() !== today.getUTCMonth()) return null;
  if (releaseDate.getUTCDate() !== today.getUTCDate()) return null;

  return yearsAgo;
}

async function main() {
  // Paylaşım penceresi (TRT): pencere dışındaysa hiçbir şey paylaşılmaz, durum dosyalarına dokunulmaz.
  if (!postWindowOpen('Yeni şarkı kontrolü')) return;

  const block = await loadSpotifyBlock();
  if (block) {
    console.log(`Spotify kotası dolu; engel ${block.until} tarihine kadar sürüyor (~${Math.round(block.remainingSeconds / 3600)} saat), bu tur atlanıyor.`);
    return;
  }

  const previousState = await loadState();
  const isFirstRun = previousState === null;
  const oldState = previousState ?? {};
  const newState = {};

  if (isFirstRun) {
    console.log('İlk çalıştırma: mevcut yayınlar kaydedilecek, tweet atılmayacak.\n');
  }

  const anniversaryState = await loadAnniversaryState();
  const today = new Date();
  const currentYear = today.getUTCFullYear();

  // Spotify kotasini (QUOTA_EXCEEDED) zorlamamak icin sanatcilar iki gruba bolunur,
  // her calistirma siradaki grubu kontrol eder (her sanatci yine ~6 saatte bir kontrol edilir).
  // CHECK_ALL=1 ile hepsi tek seferde kontrol edilir.
  // Paylaşım penceresi açıldığında (TRT) gece atlanan turları telafi etmek için ilk turda da hepsi kontrol edilir.
  // Sira imleci: GitHub zamanlayicisi kaysa bile ardisik iki calistirma tum listeyi kapsar (eski saat tabanli grup mantigi ayni yariyi tekrar edebiliyordu).
  const openingRun = isOpeningRun();
  const checkAll = process.env.CHECK_ALL === '1' || openingRun;
  const cursor = await loadCursor();
  const batch = checkAll ? artists : pickBatch(artists, cursor, BATCH_COUNT);
  let processed = 0; // bu turda gercekten kontrol edilen sanatci sayisi (imleci bu kadar ilerletiriz)
  console.log(
    `Bu çalıştırmada ${batch.length}/${artists.length} sanatçı kontrol ediliyor (${openingRun ? 'pencere açılış turu: hepsi' : checkAll ? 'hepsi' : `sıradaki grup, imleç ${cursor}/${artists.length}`}).\n`
  );

  const token = await getAccessToken();
  let hadErrors = false;
  let quotaStopped = false;

  for (const artist of batch) {
    processed += 1;
    let releases;
    try {
      releases = await getRecentReleases(token, artist.id);
    } catch (err) {
      console.error(`[HATA] ${artist.name}: ${err.message}`);
      hadErrors = true;
      if (err instanceof QuotaError) {
        // Kota doldu: kalan sanatcilari bosuna denemeyip turu burada birakiyoruz (ilerleme asagida kaydedilir).
        console.error('Spotify kotası doldu, tur erken bitiriliyor; kalan sanatçılar sonraki turda kontrol edilecek.');
        quotaStopped = true;
        processed -= 1; // bu sanatci kontrol edilemedi
        if (err.retryAfter >= 60) {
          const until = await saveSpotifyBlock(err.retryAfter);
          console.error(`Spotify engeli ${until} tarihine kadar kaydedildi.`);
        }
        break;
      }
      continue;
    }

    const latest = releases[0] ?? null;

    if (!latest) {
      console.log(`- ${artist.name}: yayın bulunamadı`);
      continue;
    }

    newState[artist.id] = latest.id;

    // Durumda kaydi olmayan sanatci (ilk tarama veya listeye yeni eklenen) sessizce kaydedilir.
    const known = oldState[artist.id] !== undefined;
    const isNew = !isFirstRun && known && oldState[artist.id] !== latest.id;

    if (isNew) {
      const text = buildPostText(artist.name, latest);

      console.log(`[YENİ] ${artist.name}: ${latest.name} (${latest.releaseDate}) -> paylaşılıyor...`);
      try {
        const tiktokParams = {
            kind: 'release',
            artist: artist.name,
            label: latest.albumType === 'album' ? 'YENİ ALBÜM' : 'YENİ ŞARKI',
            headline: artist.name,
            title: latest.name,
            subtitle: formatDate(latest.releaseDate),
            coverUrl: latest.imageUrl,
            caption: text,
            template: 'NewRelease',
            variantSeed: latest.id, // sarkiya gore yeni cikti sablonu (ayni sarki hep ayni sablon)
            templateData: {
              dateText: formatDate(latest.releaseDate),
            },
            scene: 'new',
            palette: 'studio',
            sceneData: {
              dateText: formatDate(latest.releaseDate),
              pill: 'ÇIKTI, ŞİMDİ DİNLE',
              hook1: latest.albumType === 'album' ? 'YENİ ALBÜMÜ' : 'YENİ ŞARKISI',
              hook2: 'GELDİ!!!',
              sub: latest.albumType === 'album' ? 'yeni albümü çıktı!' : 'yeni şarkısı çıktı!',
              badge: 'YENİ',
              cta: 'Dinledin mi?',
            },
          };
        const handle = await makeEventVideos(tiktokParams);
        const result = await publishPostWithVideo(await tagText(text, [artist]), latest.imageUrl, handle.x ? hostVideo(handle.x) : null);
        if (result.message) {
          console.error(`  Buffer hatası: ${result.message}`);
        } else {
          console.log(`  Paylaşıldı (post id: ${result.post.id})`);
          await appendToWeeklyLog({
            artistName: artist.name,
            songName: latest.name,
            releaseDate: latest.releaseDate,
            url: latest.url,
            imageUrl: latest.imageUrl,
          });
          await tiktokPostPrepared(handle.tiktok, tiktokParams);
        }
      } catch (err) {
        console.error(`  Buffer hatası: ${err.message}`);
      }
    } else {
      console.log(`- ${artist.name}: değişiklik yok (son: ${latest.name}, ${latest.releaseDate})`);
    }

    if (!isFirstRun) {
      for (const release of releases) {
        const yearsAgo = checkAnniversary(release, today);
        if (yearsAgo === null) continue;

        const key = `${release.id}-${currentYear}`;
        if (anniversaryState.announced.includes(key)) continue;

        const annQuestion = ctaFor('anniversary');
        const annText = [
          `📅 ${artist.name} - ${release.name}`,
          '',
          `Üzerinden tam ${yearsAgo} yıl geçti! 🎂`,
          ...(annQuestion ? ['', annQuestion] : []),
          release.url,
        ].join('\n');
        console.log(`[YIL DÖNÜMÜ] ${artist.name}: ${release.name} (${yearsAgo} yıl) -> paylaşılıyor...`);
        try {
          const tiktokParams = {
              kind: 'anniversary',
              artist: artist.name,
              label: 'YIL DÖNÜMÜ',
              headline: `${yearsAgo}. YIL`,
              title: release.name,
              subtitle: artist.name,
              coverUrl: release.imageUrl,
              caption: annText,
              template: 'Anniversary',
              templateData: { releaseDate: release.releaseDate },
              scene: 'anniv',
              palette: 'altin',
              sceneData: {
                number: yearsAgo,
                suffix: '',
                pill: 'YIL DÖNÜMÜ',
                small: 'şarkısı çıkalı',
                l1: 'KAÇ YIL',
                l2: 'OLDU?',
                label: 'YIL ÖNCE ÇIKTI',
                dateText: formatDate(release.releaseDate),
                cta: 'Sen hâlâ dinliyor musun?',
              },
            };
          const handle = await makeEventVideos(tiktokParams);
          const result = await publishPostWithVideo(await tagText(annText, [artist]), release.imageUrl, handle.x ? hostVideo(handle.x) : null, {
            aiGenerated: Boolean(handle.x?.aiGenerated) && process.env.X_AI_LABEL !== '0', // yapay zeka (ComfyUI) goruntusu varsa X etiketi
          });
          if (result.message) {
            console.error(`  Buffer hatası: ${result.message}`);
          } else {
            console.log(`  Paylaşıldı (post id: ${result.post.id})`);
            anniversaryState.announced.push(key);
            await tiktokPostPrepared(handle.tiktok, tiktokParams);
          }
        } catch (err) {
          console.error(`  Buffer hatası: ${err.message}`);
        }
        await sleep(2000);
      }
    }

    await sleep(5000);
  }

  // Kontrol edilemeyen sanatcilarin eski kaydi korunur; basarili olanlar kaydedilir.
  // Boylece kota hatasi olsa bile ilerleme kaybolmaz, sadece hatalilar sonraki turda tekrar denenir.
  const succeeded = Object.keys(newState).length;
  if (succeeded > 0) {
    await saveState({ ...oldState, ...newState });
    await saveAnniversaryState(anniversaryState);
    if (!checkAll) await saveCursor((cursor + processed) % artists.length);
    console.log(`\nDurum dosyası güncellendi (${succeeded} sanatçı).`);
  }

  if (hadErrors) {
    console.log('\nBazı sanatçılarda hata oluştu; hatalı olanlar sonraki turda tekrar denenecek.');
    // Hic ilerleme yoksa (hepsi basarisiz) calistirmayi basarisiz say ki bildirim gelsin.
    if (succeeded === 0 && !quotaStopped) process.exitCode = 1;
  }
}

main();
