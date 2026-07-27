import { loadWeeklyLog, clearWeeklyLog } from './weeklyLog.js';
import { publishThread } from './bufferPost.js';

async function main() {
  const log = await loadWeeklyLog();

  if (log.length === 0) {
    console.log('Bu hafta yeni yayın yok, thread atlanıyor.');
    return;
  }

  console.log(`${log.length} yeni yayın bulundu, thread hazırlanıyor...`);

  const items = [
    {
      text: `🎵 Bu hafta çıkan yeni şarkılar 🎵\n\n${log.length} yeni yayın 👇`,
      imageUrl: log[0].imageUrl,
    },
    ...log.map((entry) => ({
      text: `${entry.artistName} - ${entry.songName}\n${entry.url}`,
      imageUrl: entry.imageUrl,
    })),
  ];

  const result = await publishThread(items);
  if (result.message) {
    console.error(`Buffer hatası: ${result.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Thread paylaşıldı (kök post id: ${result.post.id})`);
  await clearWeeklyLog();
}

main();
