// Haftalik klipli liste (her Pazar): arkada ORIJINAL KLIPLER, solda 1-10 liste. X ve TikTok'a video olarak gider.
// Klipler Apple/iTunes resmi klip onizlemeleridir (src/clipSource.js). Kapatmak icin WEEKLY_CLIPS=0.
// Durum (data/weeklyClipsState.json) liste tarihine gore tutulur: ayni liste bir kez paylasilir; X basarili olup TikTok olmadiysa
// sonraki calistirma yalnizca TikTok'u dener.
import { postWindowOpen } from './postWindow.js';
import { fetchWeeklyChart } from './weeklyChart.js';
import { loadChartState, saveChartState } from './chartState.js';
import { fetchBackdrop } from './backdrop.js';
import { prepWeeklyClips, WEEKLY_CLIPS } from './videoPrep.js';
import { renderPrepared } from './remotionRender.js';
import { hostVideo, postVideoToTikTok } from './tiktokVideo.js';
import { findSongAudio } from './artistSeries.js';
import { tiktokEnabled } from './tiktok.js';
import { publishPost, waitForPost } from './bufferPost.js';
import { tagText } from './artistHandles.js';
import { weeklyClipsTexts } from './weeklyClipsText.js';

const STATE_FILE = 'weeklyClipsState.json';
const MIN_CLIPS = 3; // bundan az klip bulunursa video paylasilmaz (klipsiz bir liste videosu istenen sey degil)

async function main() {
  if (process.env.WEEKLY_CLIPS === '0') {
    console.log('Haftalık klipli liste kapalı (WEEKLY_CLIPS=0).');
    return;
  }
  if (!postWindowOpen('Haftalık klipli liste')) return;

  const { date, entries } = await fetchWeeklyChart();
  if (!date || entries.length < WEEKLY_CLIPS.N) {
    console.error('Chart verisi alinamadi, cikiliyor.');
    process.exitCode = 1;
    return;
  }

  const saved = await loadChartState(STATE_FILE);
  const st = saved.date === date ? saved : { date, x: false, tiktok: false };
  if (st.x && st.tiktok) {
    console.log(`Bu haftanin klipli listesi (${date}) zaten paylasilmis, atlaniyor.`);
    return;
  }

  // klipler: klibi olmayan siralarda kapak + sarkinin ses onizlemesi
  const clips = {};
  const audioUrls = {};
  for (const e of entries.slice(0, WEEKLY_CLIPS.N)) {
    const b = await fetchBackdrop(e.artists[0].name, e.trackName, e.trackId);
    if (b) {
      clips[e.rank] = b;
      console.log(`  ${b.kind === 'clip' ? 'klip' : 'Canvas'}: #${e.rank} ${e.artists[0].name} - ${e.trackName}`);
    } else {
      console.log(`  arka plan YOK: #${e.rank} ${e.artists[0].name} - ${e.trackName}`);
    }
    if (!b || b.kind === 'canvas') audioUrls[e.rank] = await findSongAudio(e.artists[0].name, e.trackName);
  }
  if (Object.keys(clips).length < MIN_CLIPS) {
    console.error(`Yalnizca ${Object.keys(clips).length} klip bulundu (en az ${MIN_CLIPS} gerekir), video paylasilmayacak.`);
    process.exitCode = 1;
    return;
  }

  const { x: xBase, tiktok: tiktokText } = weeklyClipsTexts(date, entries);
  let xText = await tagText(xBase, entries.slice(0, 5).flatMap((e) => e.artists), { max: 5 });
  if (xText.length > 280) xText = xBase;
  console.log(`\n${xText}\n`);

  const video = await renderPrepared(await prepWeeklyClips({ entries, date, clips, audioUrls }));
  const handle = {
    kind: 'weekly-tr',
    video,
    caption: tiktokText,
    artists: entries.slice(0, 3).map((e) => e.artists[0].name),
    note: 'haftalık klipli liste',
    aiGenerated: false, // gercek klipler + kodla cizilmis grafik: yapay zeka goruntusu yok
  };

  if (!st.x) {
    try {
      const r = await publishPost(xText, null, hostVideo(handle));
      if (r.message) throw new Error(r.message);
      const status = await waitForPost(r.post.id);
      if (status && (status.status === 'error' || status.status === 'failed' || status.error)) throw new Error(status.error?.message ?? status.status);
      console.log(`X'e gönderildi (post id: ${r.post.id}, durum: ${status?.status ?? 'belirsiz'})`);
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
