import { hostMedia } from './mediaHost.js';
import { publishTikTokVideo } from './bufferPost.js';
import { getTrackThumbnail, formatStreams } from './dailyChart.js';
import {
  tiktokEnabled,
  stripUrls,
  mediaName,
  tiktokFeaturePost,
  tiktokChartPost,
  tiktokListPost,
  chartDescription,
  chartArtists,
  tiktokSlotAvailable,
  noteTikTokSent,
} from './tiktok.js';
import { ctaFor } from './cta.js';
import { withHashtags } from './hashtags.js';
import { renderVideo } from './videoEngine.js';
import { prepNewRelease, prepAnniversary, prepRankRise, prepTopBoard, prepCoverPlayer, prepDuel, prepAnniversaryAuto, annivUsesAiFootage, eraClipsFor, prepNewReleaseVariant, newReleaseVariantFor, nrVariantUsesAi } from './videoPrep.js';
import { pickDuelPair } from './duelPick.js';
import { renderPrepared } from './remotionRender.js';
import { tagText } from './artistHandles.js';

// TIKTOK_VIDEO=0 ise hareketli video kapatilir, sadece foto kartlar gider.
function videoEnabled() {
  return process.env.TIKTOK_VIDEO !== '0';
}

function norm(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function mainArtist(artist) {
  return artist.split(/ & | ft\.? | feat\.? /i)[0];
}

function matches(artist, title, foundArtist, foundTitle) {
  return norm(foundTitle).includes(norm(title)) && norm(foundArtist).includes(norm(mainArtist(artist)));
}

async function fromDeezer(artist, title) {
  const q = `artist:"${mainArtist(artist)}" track:"${title}"`;
  const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=10`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const hit = (data.data ?? []).find(
    (t) => t.preview && matches(artist, title, t.artist?.name ?? '', t.title ?? '')
  );
  return hit ? { url: hit.preview, source: 'deezer' } : null;
}

async function fromItunes(artist, title) {
  const term = `${mainArtist(artist)} ${title}`;
  const res = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=10&country=TR`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const hit = (data.results ?? []).find(
    (t) => t.previewUrl && matches(artist, title, t.artistName ?? '', t.trackName ?? '')
  );
  return hit ? { url: hit.previewUrl, source: 'itunes' } : null;
}

// Deezer'in kati (artist:"" track:"") sorgusu yeni cikan sarkilari bulamayabiliyor; duz metin aramasi bulur.
async function fromDeezerPlain(artist, title) {
  const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(`${mainArtist(artist)} ${title}`)}&limit=15`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const hit = (data.data ?? []).find((t) => t.preview && matches(artist, title, t.artist?.name ?? '', t.title ?? ''));
  return hit ? { url: hit.preview, source: 'deezer' } : null;
}

// Albumler: ad bir parca degil albumun adidir (ornek: "BİPOLAR"). iTunes'ta albumun parcalari collectionName ile listelenir;
// ilk parcanin onizlemesi kullanilir.
async function fromItunesAlbum(artist, title) {
  const res = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(`${mainArtist(artist)} ${title}`)}&entity=song&limit=25&country=TR`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const hit = (data.results ?? []).find(
    (t) => t.previewUrl && norm(t.collectionName ?? '').includes(norm(title)) && norm(t.artistName ?? '').includes(norm(mainArtist(artist)))
  );
  return hit ? { url: hit.previewUrl, source: 'itunes-album' } : null;
}

async function fromDeezerAlbum(artist, title) {
  const res = await fetch(`https://api.deezer.com/search/album?q=${encodeURIComponent(`${mainArtist(artist)} ${title}`)}&limit=10`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const album = ((await res.json()).data ?? []).find(
    (a) => norm(a.title ?? '').includes(norm(title)) && norm(a.artist?.name ?? '').includes(norm(mainArtist(artist)))
  );
  if (!album) return null;
  const tr = await fetch(`https://api.deezer.com/album/${album.id}/tracks?limit=10`, { signal: AbortSignal.timeout(10_000) });
  if (!tr.ok) return null;
  const hit = ((await tr.json()).data ?? []).find((t) => t.preview);
  return hit ? { url: hit.preview, source: 'deezer-album' } : null;
}

// Parantez ici ekler ve " - Live / Remastered" gibi son ekler eslesmeyi bozmasin.
function baseTitle(t) {
  const s = String(t).replace(/\s*[(\[].*?[)\]]\s*/g, ' ').replace(/\s+-\s+.*$/, '').trim();
  return s.length >= 2 ? s : String(t);
}

// Sarkinin (albumse ilk parcasinin) 30 sn'lik halka acik onizlemesini bulur; hem sanatci hem ad eslesmeli.
// Sira: Deezer parca -> iTunes parca -> Deezer duz arama -> (temiz adla tekrar) -> albumler. X'te foto yerine video cikabilsin diye cok kaynakli.
export async function findPreview(artist, title) {
  const attempts = [
    () => fromDeezer(artist, title),
    () => fromItunes(artist, title),
    () => fromDeezerPlain(artist, title),
    ...(baseTitle(title) !== String(title)
      ? [() => fromItunes(artist, baseTitle(title)), () => fromDeezerPlain(artist, baseTitle(title))]
      : []),
    () => fromItunesAlbum(artist, title),
    () => fromDeezerAlbum(artist, title),
  ];
  for (const attempt of attempts) {
    const found = await attempt().catch(() => null);
    if (found) return found;
  }
  return null;
}

// TIKTOK_REMOTION=0 ise Remotion sahneleri kapatilir, dahili (Node) video motoru kullanilir.
function remotionEnabled() {
  return process.env.TIKTOK_REMOTION !== '0';
}

async function renderTemplate(template, input) {
  let prepared;
  if (template === 'NewRelease') {
    // yeni cikti: sarkiya gore sablon ailesi (fragman, bulten, kilit ekrani...); hata olursa klasik DROP sablonuna doner
    if (input.variant && input.variant !== 'drop') {
      try {
        prepared = await prepNewReleaseVariant(input.variant, input);
      } catch (err) {
        console.error(`  Yeni çıktı şablonu hazırlanamadı (${input.variant}), DROP şablonuna dönülüyor: ${String(err.message).split('\n')[0]}`);
      }
    }
    prepared ??= await prepNewRelease(input);
  } else if (template === 'Anniversary') prepared = await prepAnniversaryAuto(input); // 90lar vb. icin donem girisi otomatik
  else if (template === 'RankRise') prepared = await prepRankRise(input);
  else throw new Error(`Bilinmeyen sablon: ${template}`);
  return renderPrepared(prepared);
}

async function fetchBuffer(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Gorsel indirilemedi: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---------------------------------------------------------------- video uretimi (X ve TikTok ortak)
// X_VIDEO=0 ise X'e video gonderilmez (sadece gorselli tweet).
function xVideoEnabled() {
  return process.env.X_VIDEO !== '0';
}

// Hareketli video aciksa ve X ya da TikTok kullanacaksa uretilir.
function wantVideo() {
  return videoEnabled() && (xVideoEnabled() || tiktokEnabled());
}

// Videonun herkese acik URL'si; ilk cagride barindirilir, sonra tekrar kullanilir.
export function hostVideo(handle) {
  if (!handle.url) handle.url = hostMedia(handle.video, mediaName(handle.kind, 'mp4'));
  return handle.url;
}

// TikTok'a gonder. Hata verirse false doner.
export async function postVideoToTikTok(handle) {
  if (!handle || !tiktokEnabled()) return false;
  if (!(await tiktokSlotAvailable(handle.kind))) return false;
  try {
    const result = await publishTikTokVideo(process.env.BUFFER_TIKTOK_CHANNEL_ID, {
      text: withHashtags(stripUrls(handle.caption), { kind: handle.kind, artists: handle.artists }),
      videoUrl: hostVideo(handle),
      // yapay zeka (ComfyUI) goruntusu iceren videolarda TikTok etiketi; TIKTOK_AI_LABEL=0 ile kapatilir
      aiGenerated: Boolean(handle.aiGenerated) && process.env.TIKTOK_AI_LABEL !== '0',
    });
    if (result.message) throw new Error(result.message);
    noteTikTokSent();
    console.log(
      `  TikTok videosu gönderildi (post id: ${result.post.id}, ${handle.note}, ${(handle.video.length / 1024).toFixed(0)} KB)`
    );
    return true;
  } catch (err) {
    console.error(`  TikTok video hatası (${handle.kind}): ${err.message}`);
    return false;
  }
}

// Tek sarki/olay icin hareketli sahne videosu uretir (paylasmaz). Yoksa/hata olursa null doner.
// params: { kind, scene, palette, template, templateData, artist, title, coverUrl|trackUrl, caption, sceneData }
export async function makeEventVideo({
  kind,
  scene,
  palette,
  template,
  templateData,
  artist,
  title,
  coverUrl,
  trackUrl,
  caption,
  sceneData,
  variantSeed,
}) {
  if (!wantVideo() || !(scene || template)) return null;
  try {
    const preview = await findPreview(artist, title);
    if (!preview) {
      console.log(`  Ses önizlemesi bulunamadı (${artist} - ${title}).`);
      return null;
    }

    const coverSrc = coverUrl ?? (await getTrackThumbnail(trackUrl));
    if (!coverSrc) throw new Error('Kapak gorseli bulunamadi');
    const cover = await fetchBuffer(coverSrc);

    let video = null;
    let engine = '';
    let aiGenerated = false; // ComfyUI (yapay zeka) goruntusu kullanildi mi -> TikTok "AI ile uretildi" etiketi
    if (template && remotionEnabled()) {
      try {
        const variant = template === 'NewRelease' ? newReleaseVariantFor(variantSeed) : null;
        video = await renderTemplate(template, { artist, title, cover, audioUrl: preview.url, ...templateData, variant });
        engine = `remotion:${template}${variant && variant !== 'drop' ? `/${variant}` : ''}`;
        if (template === 'NewRelease') aiGenerated = Boolean(variant) && nrVariantUsesAi(variant);
        if (template === 'Anniversary') aiGenerated = annivUsesAiFootage(Number(String(templateData?.releaseDate).slice(0, 4)));
      } catch (err) {
        console.error(`  Remotion hatası (${kind}), dahili motora geçiliyor: ${err.message.split('\n')[0]}`);
      }
    }
    if (!video && scene) {
      video = await renderVideo({
        scene,
        palette,
        data: { artist, title, cover, audioUrl: preview.url, ...sceneData },
      });
      engine = `sahne:${scene}`;
    }
    if (!video) return null;
    return {
      kind,
      video,
      caption: caption ?? `${artist} - ${title}`,
      artists: [artist],
      note: `${engine}, ses: ${preview.source}`,
      aiGenerated,
    };
  } catch (err) {
    console.error(`  Video üretilemedi (${kind}): ${err.message}`);
    return null;
  }
}

// X icin kare (1080x1080) "kapak + oynatici" videosu.
async function renderSquare({ artist, title, cover, audioUrl }) {
  const prepared = await prepCoverPlayer({ artist, title, cover, audioUrl, seconds: 20 });
  return renderPrepared(prepared);
}

// Bir olay icin iki video: tiktok (dikey sahne) ve x (kare kapak+oynatici). Biri uretilemezse digeri yedek olur.
// Hicbiri uretilemezse { tiktok: null, x: null }.
export async function makeEventVideos(params) {
  const none = { tiktok: null, x: null };
  // params.wantTikTok === false: bu olay icin TikTok videosu uretilmez (calistirma basina TikTok siniri); X videosu yine uretilir.
  const needTikTok = videoEnabled() && tiktokEnabled() && params.wantTikTok !== false && (await tiktokSlotAvailable(params.kind));
  const needX = videoEnabled() && xVideoEnabled();
  if (!(needTikTok || needX) || !(params.scene || params.template)) return none;

  const { kind, artist, title, caption } = params;
  try {
    const preview = await findPreview(artist, title);
    const coverSrc = params.coverUrl ?? (await getTrackThumbnail(params.trackUrl));
    if (!coverSrc) throw new Error('Kapak gorseli bulunamadi');
    const cover = await fetchBuffer(coverSrc);
    if (!preview) {
      // Hicbir kaynakta ses yok: TikTok'a video gitmez (statik/sessiz risk), ama X'e foto yerine sessiz kapak videosu gider.
      console.log(`  Ses önizlemesi bulunamadı (${artist} - ${title}); X için sessiz kapak videosu hazırlanıyor.`);
      if (needX && remotionEnabled()) {
        try {
          const video = await renderSquare({ artist, title, cover, audioUrl: null });
          return {
            tiktok: null,
            x: { kind: `${kind}-x`, video, caption: caption ?? `${artist} - ${title}`, artists: [artist], note: 'remotion:CoverPlayer (sessiz)' },
          };
        } catch (err) {
          console.error(`  Sessiz video hatası (${kind}): ${String(err.message).split('\n')[0]}`);
        }
      }
      return none;
    }

    let tiktok = null;
    if (needTikTok) tiktok = await makeEventVideo(params);

    // Yil donumu + donem girisi: X'e de TikTok'taki dikey donem videosu gider (ayni video nesnesi, tek kez barindirilir).
    // X_ERA_VIDEO=0 ile eski kare oynatici. TikTok istenmediyse (sinir dolu) dikey video yine uretilir ama TikTok'a gonderilmez.
    if (
      needX &&
      remotionEnabled() &&
      process.env.X_ERA_VIDEO !== '0' &&
      params.template === 'Anniversary' &&
      eraClipsFor(Number(String(params.templateData?.releaseDate).slice(0, 4)))
    ) {
      const vertical = tiktok ?? (await makeEventVideo(params));
      if (vertical) return { tiktok, x: vertical };
      console.log('  Dikey dönem videosu üretilemedi, X için kare oynatıcıya düşülüyor.');
    }

    let x = null;
    if (needX && remotionEnabled()) {
      try {
        const video = await renderSquare({ artist, title, cover, audioUrl: preview.url });
        x = {
          kind: `${kind}-x`,
          video,
          caption: caption ?? `${artist} - ${title}`,
          artists: [artist],
          note: `remotion:CoverPlayer, ses: ${preview.source}`,
        };
      } catch (err) {
        console.error(`  Kare video hatası (${kind}): ${err.message.split('\n')[0]}`);
      }
    }
    if (!x && needX && !tiktok) x = await makeEventVideo(params); // kare olmadiysa dikey video X'e de gider
    return { tiktok, x: x ?? tiktok };
  } catch (err) {
    console.error(`  Video üretilemedi (${kind}): ${err.message}`);
    return none;
  }
}

// Eski API: uret + TikTok'a gonder.
export async function tiktokSceneVideoPost(params) {
  if (!tiktokEnabled() || !videoEnabled()) return false;
  return postVideoToTikTok(await makeEventVideo(params));
}

// Yeni sarki/yil donumu/trend olaylari bunu kullanir.
// Sahne bilgisi (scene) varsa hareketli video, yoksa (veya TIKTOK_VIDEO=0 ise) foto kart.
export async function tiktokSmartPost(params) {
  if (!tiktokEnabled()) return false;
  if (videoEnabled() && (params.scene || params.template)) return tiktokSceneVideoPost(params);
  return tiktokFeaturePost(params);
}

// Video onceden uretildiyse (X ile ortak) TikTok'a onu gonderir; uretilemediyse foto karta duser.
export async function tiktokPostPrepared(handle, params) {
  if (!tiktokEnabled()) return false;
  if (handle) return postVideoToTikTok(handle);
  if (!videoEnabled() || !(params.scene || params.template)) return tiktokFeaturePost(params);
  return false; // statik gonderi riskli: video yoksa TikTok'u atla
}

function headerParts(header) {
  const [region, period] = header.split(' ');
  const weekly = period === 'HAFTALIK';
  return { region, period, periodWord: weekly ? 'BU HAFTA' : 'BUGÜN', weekly };
}

// Chart icin en ust 5 sarkiyla "geri sayim" videosu uretir (paylasmaz).
export async function makeChartVideo({ kind, header, date, entries }) {
  if (!(videoEnabled() && tiktokEnabled())) return null;
  if (!(await tiktokSlotAvailable(kind))) return null;

  try {
    const top = entries.slice(0, 5);
    const { region, period, periodWord, weekly } = headerParts(header);
    const items = [];
    for (const e of [...top].reverse()) {
      const coverUrl = await getTrackThumbnail(e.trackUrl).catch(() => null);
      if (!coverUrl) continue;
      const artist = e.artists.map((a) => a.name).join(' & ');
      const preview = await findPreview(e.artists[0].name, e.trackName);
      items.push({
        rank: e.rank,
        title: e.trackName,
        artist,
        sub: `${formatStreams(e.streams)} stream`,
        streamsText: formatStreams(e.streams),
        change: typeof e.positionChange === 'number' ? e.positionChange : null,
        cover: await fetchBuffer(coverUrl),
        audioUrl: preview?.url ?? null,
      });
    }
    if (items.length < 3) throw new Error('Yeterli sarki gorseli bulunamadi');

    let video = null;
    let engine = '';
    if (remotionEnabled()) {
      try {
        const [dd, mm, yyyy] = String(date).split('.');
        const dateShort = yyyy ? `${dd}.${mm}.${yyyy.slice(2)}` : String(date);
        const prepared = await prepTopBoard({
          items: items.map((i) => ({
            rank: i.rank,
            title: i.title,
            artist: i.artist,
            streams: i.streamsText,
            change: i.change,
            cover: i.cover,
            audioUrl: i.audioUrl,
          })),
          header: {
            hookTop: '1 NUMARAYI',
            hookBottom: 'TAHMİN ET',
            midTop: `${region} ${period}`.slice(0, 16),
            midBottom: `TOP ${items.length} · ${dateShort}`,
            heroTop: weekly ? 'ZİRVEDE BU HAFTA' : 'ZİRVEDE BUGÜN',
            closeTop: weekly ? 'HAFTAYA YENİ' : 'YARIN YENİ LİSTE',
            closeBottom: '@YENISARKILARIM',
          },
          heroLabel: 'ZİRVE · BİRİNCİ SIRA',
          date,
          dateShort,
        });
        video = await renderPrepared(prepared);
        engine = 'remotion:TopBoard';
      } catch (err) {
        console.error(`  Remotion hatası (${kind}), dahili motora geçiliyor: ${err.message.split('\n')[0]}`);
      }
    }
    if (!video) {
      video = await renderVideo({
        scene: 'top5',
        palette: 'studio',
        data: {
          items,
          intro: {
            l1: region === 'DÜNYA' ? `DÜNYADA ${periodWord}` : `${periodWord} EN ÇOK`,
            l2: 'DİNLENEN',
            big: String(items.length),
            small: 'ŞARKI',
          },
          pill: `${region} ${period} LİSTE`,
          outroHead: weekly ? "HAFTANIN TOP 5'İ" : "BUGÜNÜN TOP 5'İ",
          showRank: true,
          cta: 'Sence sıralama doğru mu?',
        },
      });
      engine = 'top5';
    }
    return {
      kind,
      video,
      caption: chartDescription(`${header} TOP ${top.length}`, date, top, kind),
      artists: chartArtists(top),
      note: `${engine}, ${items.filter((i) => i.audioUrl).length} sesli`,
    };
  } catch (err) {
    console.error(`  Video üretilemedi (${kind}): ${err.message}`);
    return null;
  }
}

// X icin chart thread'i: ilk 5 sarkinin her biri ayri kare "kapak + oynatici" videosu.
// Dondurur: [{ rank, entry, coverUrl, handle|null }] (en az 3 videolu degilse null)
export async function makeChartThread({ kind, entries }) {
  if (!(videoEnabled() && xVideoEnabled() && remotionEnabled())) return null;
  try {
    const out = [];
    for (const e of entries.slice(0, 5)) {
      const artist = e.artists.map((a) => a.name).join(' & ');
      const coverUrl = await getTrackThumbnail(e.trackUrl).catch(() => null);
      let handle = null;
      if (coverUrl) {
        try {
          const preview = await findPreview(e.artists[0].name, e.trackName);
          // onizleme yoksa da video (sessiz kapak hareketi): thread'in hicbir tweeti foto kalmasin
          const video = await renderSquare({
            artist,
            title: e.trackName,
            cover: await fetchBuffer(coverUrl),
            audioUrl: preview?.url ?? null,
          });
          handle = {
            kind: `${kind}-x${e.rank}`,
            video,
            caption: `${artist} - ${e.trackName}`,
            artists: [artist],
            note: preview ? `remotion:CoverPlayer, ses: ${preview.source}` : 'remotion:CoverPlayer (sessiz)',
          };
        } catch (err) {
          console.error(`  Kare video hatası (${kind} #${e.rank}): ${err.message.split('\n')[0]}`);
        }
      }
      out.push({ rank: e.rank, entry: e, coverUrl, handle });
    }
    if (out.filter((o) => o.handle).length < 3) return null;
    return out;
  } catch (err) {
    console.error(`  Chart thread videoları üretilemedi (${kind}): ${err.message}`);
    return null;
  }
}

// makeChartThread sonucundan Buffer thread ogeleri (ilk oge rootText'i tasir).
export async function buildChartThreadItems(thread, rootText, kind) {
  const items = await Promise.all(thread.map(async (o, i) => {
    const e = o.entry;
    const artist = e.artists.map((a) => a.name).join(' & ');
    const ch = typeof e.positionChange === 'number' && e.positionChange !== 0 ? ` ${e.positionChange > 0 ? '▲' : '▼'}${Math.abs(e.positionChange)}` : '';
    const plain = i === 0 ? rootText : `${e.rank}. ${artist} - ${e.trackName}\n${formatStreams(e.streams)} stream${ch}\n${e.trackUrl}`;
    const text = i === 0 ? plain : await tagText(plain, e.artists);
    return o.handle ? { text, videoUrl: hostVideo(o.handle) } : { text, imageUrl: o.coverUrl ?? undefined };
  }));
  // Ana tweet 280 karakteri doldurdugu icin soru thread'in kapanis tweetinde sorulur.
  const question = kind ? ctaFor(kind) : null;
  if (question) items.push({ text: `💬 ${question}` });
  return items;
}

// Eski API: chart videosu uret + TikTok'a gonder (video kapaliysa foto kart).
export async function tiktokChartSmartPost({ kind, header, date, entries, maxRows = 8 }) {
  if (!tiktokEnabled()) return false;
  if (!videoEnabled()) return tiktokChartPost({ kind, header, date, entries, maxRows });
  return postVideoToTikTok(await makeChartVideo({ kind, header, date, entries }));
}

// Chart videosu onceden uretildiyse (X ile ortak) onu gonderir.
export async function tiktokChartPostPrepared(handle, { kind, header, date, entries, maxRows = 8 }) {
  if (!tiktokEnabled()) return false;
  if (handle) return postVideoToTikTok(handle);
  if (!videoEnabled()) return tiktokChartPost({ kind, header, date, entries, maxRows });
  return false;
}

// Duello: ilk 10'dan iki sarki, "hangisi daha cok dinlendi?" tahmin videosu (dikey; X ve TikTok ortak). Paylasmaz.
// Cevap (kazanan) yalnizca videoda aciklanir; metinlerde yazilmaz.
// Doner: { kind, video, caption, artists, note, pair } ya da null.
export async function makeDuelVideo({ date, entries, excludeKeys = [] }) {
  if (!(wantVideo() && remotionEnabled())) return null;
  const seed = Number(String(date).replace(/\D/g, ''));
  const label = (e) => e.artists.map((a) => a.name).join(' & ');
  const tried = [...excludeKeys];

  for (let attempt = 0; attempt < 4; attempt++) {
    const pair = pickDuelPair(entries, { excludeKeys: tried, seed });
    if (!pair) break;
    tried.push(pair.key);
    try {
      const side = async (e) => {
        const preview = await findPreview(e.artists[0].name, e.trackName);
        if (!preview) throw new Error(`Ses önizlemesi yok: ${label(e)} - ${e.trackName}`);
        const coverUrl = await getTrackThumbnail(e.trackUrl);
        if (!coverUrl) throw new Error(`Kapak yok: ${e.trackName}`);
        return { artist: label(e), title: e.trackName, cover: await fetchBuffer(coverUrl), audioUrl: preview.url, rank: e.rank, streams: e.streams };
      };
      const a = await side(pair.a);
      const b = await side(pair.b);
      const [dd, mm, yyyy] = String(date).split('.');
      const video = await renderPrepared(await prepDuel({ a, b, dateShort: yyyy ? `${dd}.${mm}.${yyyy.slice(2)}` : String(date) }));
      const question = ctaFor('duel');
      return {
        kind: 'duel',
        video,
        caption: [
          'Hangisi daha çok dinlendi? ⚔️',
          '',
          `A: ${a.artist} - ${a.title}`,
          `B: ${b.artist} - ${b.title}`,
          ...(question ? ['', question] : []),
        ].join('\n'),
        artists: [pair.a.artists[0].name, pair.b.artists[0].name],
        note: `remotion:Duel, fark %${(pair.gap * 100).toFixed(1)}`,
        pair,
      };
    } catch (err) {
      console.error(`  Düello çifti atlandı (${err.message.split('\n')[0]}), yenisi deneniyor.`);
    }
  }
  return null;
}

function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso ?? '';
}

// Haftalik ozet videosu: en son 5 yeni cikis, her biri kendi sesiyle (paylasmaz).
export async function makeDigestVideo({ log, description, artists = [] }) {
  if (!wantVideo()) return null;

  try {
    const picked = log.filter((e) => e.imageUrl).slice(-5);
    const items = [];
    for (const [i, e] of picked.entries()) {
      const preview = await findPreview(e.artistName, e.songName);
      items.push({
        rank: picked.length - i,
        title: e.songName,
        artist: e.artistName,
        sub: formatDate(e.releaseDate),
        shortDate: formatDate(e.releaseDate).slice(0, 5),
        cover: await fetchBuffer(e.imageUrl),
        audioUrl: preview?.url ?? null,
      });
    }
    if (items.length < 2) throw new Error('Yeterli sarki yok'); // ses olmasa da video (sessiz liste) uretilir

    let video = null;
    let engine = '';
    if (remotionEnabled() && items.length >= 3) {
      try {
        const now = new Date();
        const prepared = await prepTopBoard({
          items: items.map((i) => ({
            rank: i.rank,
            title: i.title,
            artist: i.artist,
            streams: i.shortDate,
            change: null,
            cover: i.cover,
            audioUrl: i.audioUrl,
          })),
          header: {
            hookTop: 'BU HAFTA KİM',
            hookBottom: 'ŞARKI ÇIKARDI?',
            midTop: 'HAFTANIN',
            midBottom: 'YENİ ŞARKILARI',
            heroTop: 'SON ÇIKAN',
            closeTop: 'PAZAR GECELERİ',
            closeBottom: '@YENISARKILARIM',
          },
          heroLabel: 'SON ÇIKAN',
          date: formatDate(now.toISOString().slice(0, 10)),
          dateShort: formatDate(now.toISOString().slice(0, 10)).slice(0, 5),
        });
        video = await renderPrepared(prepared);
        engine = 'remotion:TopBoard';
      } catch (err) {
        console.error(`  Remotion hatası (weekly-digest), dahili motora geçiliyor: ${err.message.split('\n')[0]}`);
      }
    }
    if (!video) {
      video = await renderVideo({
        scene: 'top5',
        palette: 'studio',
        data: {
          items,
          intro: { l1: 'BU HAFTA ÇIKAN', l2: 'YENİ ŞARKILAR', big: String(items.length), small: 'ŞARKI' },
          pill: 'HAFTANIN YENİLERİ',
          outroHead: 'BU HAFTANIN YENİLERİ',
          showRank: false,
          cta: 'En çok hangisini beğendin?',
        },
      });
      engine = 'ozet';
    }
    return { kind: 'weekly-digest', video, caption: description, artists, note: `${engine}, ${items.length} şarkı` };
  } catch (err) {
    console.error(`  Video üretilemedi (weekly-digest): ${err.message}`);
    return null;
  }
}

// Haftalik ozet: video onceden uretildiyse (X ile ortak) onu, yoksa (video kapaliysa) liste kartini gonderir.
export async function tiktokDigestPostPrepared(handle, { header, subheader, rows, description, artists = [] }) {
  if (!tiktokEnabled()) return false;
  if (handle) return postVideoToTikTok(handle);
  if (!videoEnabled()) return tiktokListPost({ kind: 'weekly-digest', header, subheader, rows, description, artists });
  return false;
}

// Eski API: uret + TikTok'a gonder.
export async function tiktokDigestPost(args) {
  if (!tiktokEnabled()) return false;
  if (!videoEnabled()) return tiktokDigestPostPrepared(null, args);
  return postVideoToTikTok(await makeDigestVideo(args));
}
