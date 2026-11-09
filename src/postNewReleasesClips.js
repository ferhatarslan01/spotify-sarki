// Her Cumartesi: "bu hafta çıkan yeni şarkılar" klipli liste videosu X ve TikTok'a gider.
// Arka plan: Spotify Canvas (SP_DC varsa) -> resmi klip önizlemesi -> kapak. Aynı gün bir kez; X ve TikTok ayrı takip edilir.
// Durum data/newReleasesClipsState.json. Kapatmak için NEW_RELEASES_CLIPS=0. Pazar özeti (weekly-digest) kaydı Pazar gecesi temizler;
// bu akış Cumartesi çalıştığı için o haftanın yayınlarını görür.
import { postWindowOpen } from './postWindow.js';
import { loadChartState, saveChartState } from './chartState.js';
import { loadReleaseLog, prepareNewReleasesVideo, newReleasesTexts } from './newReleasesClips.js';
import { renderPrepared } from './remotionRender.js';
import { hostVideo, postVideoToTikTok } from './tiktokVideo.js';
import { tiktokEnabled } from './tiktok.js';
import { publishPost, waitForPost } from './bufferPost.js';
import { tagText, trackedByName } from './artistHandles.js';

const STATE_FILE = 'newReleasesClipsState.json';
const todayTRT = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date()); // YYYY-MM-DD

async function main() {
  if (process.env.NEW_RELEASES_CLIPS === '0') {
    console.log('Yeni çıkanlar klipli listesi kapalı (NEW_RELEASES_CLIPS=0).');
    return;
  }
  if (!postWindowOpen('Yeni çıkanlar klipli liste')) return;

  const today = todayTRT();
  const saved = await loadChartState(STATE_FILE);
  const st = saved.date === today ? saved : { date: today, x: false, tiktok: false };
  if (st.x && st.tiktok) {
    console.log(`Bugünün (${today}) yeni çıkanlar videosu zaten paylaşılmış, atlanıyor.`);
    return;
  }

  const r = await prepareNewReleasesVideo(await loadReleaseLog(), { today });
  if (!r) {
    console.log('Bu hafta yeterli yeni yayın yok (en az 5 gerekir; sürüm/tekrarlar elenir), video paylaşılmayacak.');
    return;
  }
  console.log(`${r.picked.length} şarkı: ${r.clipCount} resmi klip, ${r.canvasCount} Canvas.`);

  const { x: xBase, tiktok: tiktokText } = newReleasesTexts(r.picked, r.range);
  let xText = await tagText(xBase, r.picked.slice(0, 3).map((e) => trackedByName(e.artistName)), { max: 3 });
  if (xText.length > 280) xText = xBase;
  console.log(`\n${xText}\n`);

  const video = await renderPrepared(r.prepared);
  const handle = { kind: 'weekly-digest', video, caption: tiktokText, artists: r.picked.slice(0, 3).map((e) => e.artistName), note: 'yeni çıkanlar klipli liste', aiGenerated: false };

  if (!st.x) {
    try {
      const res = await publishPost(xText, null, hostVideo(handle));
      if (res.message) throw new Error(res.message);
      const status = await waitForPost(res.post.id);
      if (status && (status.status === 'error' || status.status === 'failed' || status.error)) throw new Error(status.error?.message ?? status.status);
      console.log(`X'e gönderildi (post id: ${res.post.id}, durum: ${status?.status ?? 'belirsiz'})`);
      st.x = true;
      await saveChartState(st, STATE_FILE);
    } catch (err) {
      console.error(`X hatası: ${String(err.message).split('\n')[0]}`);
      process.exitCode = 1;
    }
  }

  if (!st.tiktok) {
    if (!tiktokEnabled()) {
      console.log('TikTok kapalı/duraklatılmış, atlanıyor.');
    } else if (await postVideoToTikTok(handle)) {
      st.tiktok = true;
      await saveChartState(st, STATE_FILE);
    } else {
      console.log('TikTok gönderilemedi (sınır dolu ya da hata); sonraki çalıştırmada tekrar denenecek.');
    }
  }
}

main();
