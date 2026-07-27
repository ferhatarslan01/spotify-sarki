import { artists } from './artists.js';
import { getAccessToken, getRecentReleases } from './spotify.js';
import { loadState, saveState } from './state.js';
import { publishPost } from './bufferPost.js';
import { buildPostText } from './postText.js';
import { appendToWeeklyLog } from './weeklyLog.js';
import { loadAnniversaryState, saveAnniversaryState } from './anniversaryState.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

  const token = await getAccessToken();
  let hadErrors = false;

  for (const artist of artists) {
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

    const isNew = !isFirstRun && oldState[artist.id] !== latest.id;

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
          }
        } catch (err) {
          console.error(`  Buffer hatası: ${err.message}`);
        }
        await sleep(2000);
      }
    }

    await sleep(5000);
  }

  if (hadErrors) {
    console.log('\nBazı sanatçılarda hata oluştu, durum dosyası güncellenmedi (eksik veriyle karışıklık olmasın diye). Tekrar çalıştır.');
    process.exitCode = 1;
    return;
  }

  await saveState(newState);
  await saveAnniversaryState(anniversaryState);
  console.log('\nDurum dosyası güncellendi.');
}

main();
