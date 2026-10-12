import { artists } from './artists.js';
import { getAccessToken, getRecentReleases } from './spotify.js';
import { loadState, saveState } from './state.js';
import { publishPost } from './bufferPost.js';
import { buildPostText } from './postText.js';
import { appendToWeeklyLog } from './weeklyLog.js';
import { loadAnniversaryState, saveAnniversaryState } from './anniversaryState.js';
import { tiktokSmartPost } from './tiktokVideo.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BATCH_COUNT = 2;
const BATCH_WINDOW_MS = 3 * 60 * 60 * 1000; // workflow her 3 saatte bir calisir

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
  const slot = Math.floor(Date.now() / BATCH_WINDOW_MS) % BATCH_COUNT;
  const batch =
    process.env.CHECK_ALL === '1' ? artists : artists.filter((_, i) => i % BATCH_COUNT === slot);
  console.log(
    `Bu çalıştırmada ${batch.length}/${artists.length} sanatçı kontrol ediliyor (grup ${slot + 1}/${BATCH_COUNT}).\n`
  );

  const token = await getAccessToken();
  let hadErrors = false;

  for (const artist of batch) {
    let releases;
    try {
      releases = await getRecentReleases(token, artist.id);
    } catch (err) {
      console.error(`[HATA] ${artist.name}: ${err.message}`);
      hadErrors = true;
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
        const result = await publishPost(text, latest.imageUrl);
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
          await tiktokSmartPost({
            kind: 'release',
            artist: artist.name,
            label: latest.albumType === 'album' ? 'YENİ ALBÜM' : 'YENİ ŞARKI',
            headline: artist.name,
            title: latest.name,
            subtitle: formatDate(latest.releaseDate),
            coverUrl: latest.imageUrl,
            caption: text,
          });
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

        const annText = `📅 ${artist.name} - ${release.name}\n\nÜzerinden tam ${yearsAgo} yıl geçti! 🎂\n${release.url}`;
        console.log(`[YIL DÖNÜMÜ] ${artist.name}: ${release.name} (${yearsAgo} yıl) -> paylaşılıyor...`);
        try {
          const result = await publishPost(annText, release.imageUrl);
          if (result.message) {
            console.error(`  Buffer hatası: ${result.message}`);
          } else {
            console.log(`  Paylaşıldı (post id: ${result.post.id})`);
            anniversaryState.announced.push(key);
            await tiktokSmartPost({
              kind: 'anniversary',
              artist: artist.name,
              label: 'YIL DÖNÜMÜ',
              headline: `${yearsAgo}. YIL`,
              title: release.name,
              subtitle: artist.name,
              coverUrl: release.imageUrl,
              caption: annText,
            });
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
    console.log(`\nDurum dosyası güncellendi (${succeeded} sanatçı).`);
  }

  if (hadErrors) {
    console.log('\nBazı sanatçılarda hata oluştu; hatalı olanlar sonraki turda tekrar denenecek.');
    // Hic ilerleme yoksa (hepsi basarisiz) calistirmayi basarisiz say ki bildirim gelsin.
    if (succeeded === 0) process.exitCode = 1;
  }
}

main();
