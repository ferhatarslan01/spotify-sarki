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
import { prepareTopArtistsVideo, topArtistsTexts } from './topArtists.js';
import { prepareGtaVideo, gtaTexts } from './gtaTop.js';
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
// --type songs   : "Top 10'da kim kaç şarkıyla" (varsayılan)
// --type streams : "günün en çok dinlenen 10 sanatçısı ve dinlenme sayıları"
// --type gta-daily | gta-total : "GTA 6 şarkılarında en çok dinlenenler" (günlük / toplam dinlenmeye göre)
const type = val('--type', 'songs');
const base = type === 'streams' ? 'top-sanatci-dinlenme' : type.startsWith('gta') ? `gta6-${type.slice(4)}` : 'top10-sanatci';
const mp4 = join(dir, `${base}.mp4`);
const meta = join(dir, `${base}.json`);
const marker = join(dir, `${base}.posted.json`);

async function preview() {
  const seconds = Number(val('--seconds', 60));
  const isGta = type.startsWith('gta');
  const by = type === 'gta-total' ? 'total' : 'daily';
  const r = isGta ? await prepareGtaVideo({ by, seconds }) : type === 'streams' ? await prepareTopArtistsVideo({ seconds }) : await prepareTop10Video({ seconds });
  const { x, tiktok } = isGta ? gtaTexts(r.ranked, by) : type === 'streams' ? topArtistsTexts(r.groups, r.date) : top10Texts(r.groups, r.date);
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
  const due = new Date(nextSlotAt(Number(hh), Number(mm)).getTime() + Number(val('--days', 0)) * 86400e3); // --days 1: bir sonraki hh:mm'den bir gün sonrası
  setPublishSchedule(due.toISOString());
  const dueTrt = new Date(due.getTime() + 3 * 3600e3).toISOString().replace('T', ' ').slice(0, 16);
  console.log(`Paylaşım Buffer'da ${dueTrt} (TRT) için zamanlanacak.`);

  const gta = type.startsWith('gta');
  const handle = {
    kind: gta ? 'gta-top' : type === 'streams' ? 'top-artists-streams' : 'top10-artists',
    video: await readFile(mp4),
    caption: m.tiktokText,
    artists: m.artists,
    note: gta ? 'GTA 6 en çok dinlenen şarkılar (Canvas)' : type === 'streams' ? 'en çok dinlenen 10 sanatçı (Canvas)' : 'top10 sanatçı listesi (Canvas)',
    aiGenerated: false,
  };

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
