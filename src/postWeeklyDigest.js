import { loadWeeklyLog, clearWeeklyLog } from './weeklyLog.js';
import { publishThread } from './bufferPost.js';
import { tiktokListPost } from './tiktok.js';

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

  const rows = log.slice(0, 8).map((entry) => ({
    coverUrl: entry.imageUrl,
    line1: entry.artistName,
    line2: entry.songName,
  }));
  await tiktokListPost({
    kind: 'weekly-digest',
    header: 'BU HAFTA ÇIKAN ŞARKILAR',
    subheader: `${log.length} yeni yayın`,
    rows: rows.filter((r) => r.coverUrl),
    artists: log.slice(0, 3).map((e) => e.artistName),
    description: [
      `Bu hafta çıkan şarkılar (${log.length} yeni yayın)`,
      '',
      ...log.map((e) => `${e.artistName} - ${e.songName}`),
    ].join('\n'),
  });

  await clearWeeklyLog();
}

main();
