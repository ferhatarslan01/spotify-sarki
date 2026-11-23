// "Top 10'da kim kaç şarkıyla" videosu: tek seferlik / elle çalıştırılan akış. Zamanlayıcıya bağlı değildir.
//   Önizleme (hiçbir yere paylaşmaz):  node --env-file=.env src/postTop10Artists.js --preview [klasör=preview]
//     (--seconds 60: toplam süre)
//     -> <klasör>/top10-sanatci.mp4 ve .json (metinler, liste tarihi) yazar.
//   Paylaşım (onaylanmış önizlemeyi): node --env-file=.env src/postTop10Artists.js --post [--at 09:00] [--dir preview]
//     -> önizlemedeki videoyu yeniden üretmeden X ve TikTok'a Buffer'da bir sonraki hh:mm (Türkiye saati) için ZAMANLAR.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { prepareTop10Video, top10Texts } from './top10Artists.js';
import { renderPrepared } from './remotionRender.js';
import { hostVideo, postVideoToTikTok } from './tiktokVideo.js';
import { tiktokEnabled } from './tiktok.js';
import { publishPost, waitForPost, setPublishSchedule } from './bufferPost.js';
import { tagText, trackedByName } from './artistHandles.js';
import { nextSlotAt } from './slots.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const val = (name, def) => (args.includes(name) && args[args.indexOf(name) + 1] && !args[args.indexOf(name) + 1].startsWith('--') ? args[args.indexOf(name) + 1] : def);
const dir = val('--dir', val('--preview', 'preview'));
const mp4 = join(dir, 'top10-sanatci.mp4');
const meta = join(dir, 'top10-sanatci.json');
const marker = join(dir, 'top10-sanatci.posted.json');

async function preview() {
  const r = await prepareTop10Video({ seconds: Number(val('--seconds', 60)) });
  const { x, tiktok } = top10Texts(r.groups, r.date);
  let xText = await tagText(x, [trackedByName(r.groups[0].name)], { max: 1 });
  if (xText.length > 280) xText = x;
  console.log(`\n--- X metni (${xText.length} karakter) ---\n${xText}\n\n--- TikTok metni ---\n${tiktok}\n`);
  console.log(`${r.groups.length} satır: ${r.canvasCount} Canvas, ${r.clipCount} resmi klip.`);
  const video = await renderPrepared(r.prepared);
  await mkdir(dir, { recursive: true });
  await writeFile(mp4, video);
  await writeFile(meta, JSON.stringify({ date: r.date, xText, tiktokText: tiktok, artists: r.groups.slice(0, 3).map((g) => g.name), canvasCount: r.canvasCount }, null, 2));
  console.log(`Yazıldı: ${mp4} (${(video.length / 1024 / 1024).toFixed(1)} MB)`);
}

async function post() {
  if (!existsSync(mp4) || !existsSync(meta)) throw new Error(`Önce --preview çalıştırın (${mp4} yok).`);
  const done = existsSync(marker) ? JSON.parse(await readFile(marker, 'utf-8')) : { x: false, tiktok: false };
  const m = JSON.parse(await readFile(meta, 'utf-8'));
  const [hh, mm = '0'] = val('--at', '09:00').split(':');
  const due = nextSlotAt(Number(hh), Number(mm));
  setPublishSchedule(due.toISOString());
  const dueTrt = new Date(due.getTime() + 3 * 3600e3).toISOString().replace('T', ' ').slice(0, 16);
  console.log(`Paylaşım Buffer'da ${dueTrt} (TRT) için zamanlanacak.`);

  const handle = { kind: 'top10-artists', video: await readFile(mp4), caption: m.tiktokText, artists: m.artists, note: 'top10 sanatçı listesi (Canvas)', aiGenerated: false };

  if (!done.x) {
    const res = await publishPost(m.xText, null, hostVideo(handle));
    if (res.message) throw new Error(res.message);
    const status = await waitForPost(res.post.id);
    if (status && (status.status === 'error' || status.status === 'failed' || status.error)) throw new Error(status.error?.message ?? status.status);
    console.log(`X'e zamanlandı (post id: ${res.post.id}, durum: ${status?.status ?? 'belirsiz'})`);
    done.x = true;
    await writeFile(marker, JSON.stringify(done));
  } else console.log('X zaten gönderilmiş, atlanıyor.');

  if (!done.tiktok) {
    if (!tiktokEnabled()) console.log('TikTok kapalı/duraklatılmış, atlanıyor.');
    else if (await postVideoToTikTok(handle)) {
      done.tiktok = true;
      await writeFile(marker, JSON.stringify(done));
    } else console.log('TikTok gönderilemedi (sınır dolu ya da hata).');
  } else console.log('TikTok zaten gönderilmiş, atlanıyor.');
}

if (flag('--post')) await post();
else await preview();
