import { loadWeeklyLog, clearWeeklyLog } from './weeklyLog.js';
import { publishThread, publishThreadWithVideo } from './bufferPost.js';
import { makeDigestVideo, hostVideo, tiktokDigestPostPrepared } from './tiktokVideo.js';
import { tagText, trackedByName } from './artistHandles.js';
import { ctaFor } from './cta.js';

async function main() {
  const log = await loadWeeklyLog();

  if (log.length === 0) {
    console.log('Bu hafta yeni yayın yok, thread atlanıyor.');
    return;
  }

  console.log(`${log.length} yeni yayın bulundu, thread hazırlanıyor...`);

  const question = ctaFor('weekly-digest');
  const items = [
    {
      text: [`🎵 Bu hafta çıkan yeni şarkılar 🎵`, '', `${log.length} yeni yayın 👇`, ...(question ? ['', question] : [])].join('\n'),
      imageUrl: log[0].imageUrl,
    },
    ...(await Promise.all(
      log.map(async (entry) => ({
        text: await tagText(`${entry.artistName} - ${entry.songName}\n${entry.url}`, [trackedByName(entry.artistName)]),
        imageUrl: entry.imageUrl,
      }))
    )),
  ];

  const digestArgs = {
    log,
    header: 'BU HAFTA ÇIKAN ŞARKILAR',
    subheader: `${log.length} yeni yayın`,
    rows: log
      .slice(0, 8)
      .map((entry) => ({ coverUrl: entry.imageUrl, line1: entry.artistName, line2: entry.songName }))
      .filter((r) => r.coverUrl),
    artists: log.slice(0, 3).map((e) => e.artistName),
    description: [
      `Bu hafta çıkan şarkılar (${log.length} yeni yayın)`,
      '',
      ...log.map((e) => `${e.artistName} - ${e.songName}`),
      ...(question ? ['', question] : []),
    ].join('\n'),
  };

  // Video (X ve TikTok ortak): thread'in ilk tweeti video olur, uretilemezse gorsel kalir.
  const handle = await makeDigestVideo(digestArgs);
  const videoItems = handle ? [{ ...items[0], imageUrl: undefined, videoUrl: hostVideo(handle) }, ...items.slice(1)] : items;

  const result = await publishThreadWithVideo(videoItems, () => publishThread(items));
  if (result.message) {
    console.error(`Buffer hatası: ${result.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Thread paylaşıldı (kök post id: ${result.post.id})`);

  await tiktokDigestPostPrepared(handle, digestArgs);

  await clearWeeklyLog();
}

main();
