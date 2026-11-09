// Tek seferlik sanatci serisi: her calistirmada siradaki sanatcinin "en cok dinlenen 7 sarkisi" klipli liste videosu X ve TikTok'a gider.
// Siralama data/artistSeries.json, durum data/artistSeriesState.json. Gunde en fazla bir sanatci (Turkiye gunu); seri bitince bir sey yapmaz.
// Klibi olan sarkilarda iTunes resmi klip onizlemesi, olmayanlarda buyuk kapak + sarki onizlemesi. Kapatmak icin ARTIST_SERIES=0.
import { postWindowOpen } from './postWindow.js';
import { loadChartState, saveChartState } from './chartState.js';
import { loadSeriesConfig, prepareArtistVideo, artistSeriesTexts } from './artistSeries.js';
import { renderPrepared } from './remotionRender.js';
import { hostVideo, postVideoToTikTok } from './tiktokVideo.js';
import { tiktokEnabled } from './tiktok.js';
import { publishPost, waitForPost } from './bufferPost.js';
import { tagText } from './artistHandles.js';

const STATE_FILE = 'artistSeriesState.json';
const todayTRT = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date()); // YYYY-MM-DD

async function main() {
  if (process.env.ARTIST_SERIES === '0') {
    console.log('Sanatçı serisi kapalı (ARTIST_SERIES=0).');
    return;
  }
  if (!postWindowOpen('Sanatçı serisi')) return;

  const { start, artists: series } = await loadSeriesConfig();
  const state = await loadChartState(STATE_FILE);
  const items = state.items ?? {};
  const today = todayTRT();
  if (start && today < start) {
    console.log(`Sanatçı serisi ${start} tarihinde başlayacak (bugün ${today}).`);
    return;
  }

  const artist = series.find((a) => !(items[a.key]?.x && items[a.key]?.tiktok));
  if (!artist) {
    console.log('Sanatçı serisi tamamlandı, yapılacak bir şey yok.');
    return;
  }
  const st = items[artist.key] ?? { x: false, tiktok: false, date: null };
  const fresh = !st.x && !st.tiktok;
  const doneToday = Object.values(items).some((v) => v.x && v.tiktok && v.date === today);
  if (fresh && doneToday) {
    console.log(`Bugün (${today}) zaten bir sanatçı paylaşıldı; sıradaki ${artist.name} yarın.`);
    return;
  }

  console.log(`Sıradaki sanatçı: ${artist.name}`);
  const { prepared, songs, clipCount } = await prepareArtistVideo(artist);
  console.log(`${songs.length} şarkı, ${clipCount} resmi klip.`);
  const { x: xBase, tiktok: tiktokText } = artistSeriesTexts(artist, songs);
  let xText = await tagText(xBase, [{ id: artist.id, name: artist.name }], { max: 1 });
  if (xText.length > 280) xText = xBase;
  console.log(`\n${xText}\n`);

  const video = await renderPrepared(prepared);
  const handle = { kind: 'artist-top', video, caption: tiktokText, artists: [artist.name], note: `${artist.name} en çok dinlenen 7`, aiGenerated: false };
  const save = async () => {
    items[artist.key] = { ...st, date: st.date ?? today };
    await saveChartState({ ...state, items }, STATE_FILE);
  };

  if (!st.x) {
    try {
      const r = await publishPost(xText, null, hostVideo(handle));
      if (r.message) throw new Error(r.message);
      const status = await waitForPost(r.post.id);
      if (status && (status.status === 'error' || status.status === 'failed' || status.error)) throw new Error(status.error?.message ?? status.status);
      console.log(`X'e gönderildi (post id: ${r.post.id}, durum: ${status?.status ?? 'belirsiz'})`);
      st.x = true;
      await save();
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
      await save();
    } else {
      console.log('TikTok gönderilemedi (sınır dolu ya da hata); sonraki çalıştırmada tekrar denenecek.');
    }
  }
}

main();
