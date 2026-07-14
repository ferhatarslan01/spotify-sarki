import { artists } from './artists.js';
import { getAccessToken, getLatestRelease } from './spotify.js';
import { loadState, saveState } from './state.js';
import { publishPost } from './bufferPost.js';
import { buildPostText } from './postText.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const previousState = await loadState();
  const isFirstRun = previousState === null;
  const oldState = previousState ?? {};
  const newState = {};

  if (isFirstRun) {
    console.log('İlk çalıştırma: mevcut yayınlar kaydedilecek, tweet atılmayacak.\n');
  }

  const token = await getAccessToken();
  let hadErrors = false;

  for (const artist of artists) {
    let latest;
    try {
      latest = await getLatestRelease(token, artist.id);
    } catch (err) {
      console.error(`[HATA] ${artist.name}: ${err.message}`);
      hadErrors = true;
      continue;
    }

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
        }
      } catch (err) {
        console.error(`  Buffer hatası: ${err.message}`);
      }
    } else {
      console.log(`- ${artist.name}: değişiklik yok (son: ${latest.name}, ${latest.releaseDate})`);
    }

    await sleep(1500);
  }

  if (hadErrors) {
    console.log('\nBazı sanatçılarda hata oluştu, durum dosyası güncellenmedi (eksik veriyle karışıklık olmasın diye). Tekrar çalıştır.');
    process.exitCode = 1;
    return;
  }

  await saveState(newState);
  console.log('\nDurum dosyası güncellendi.');
}

main();
