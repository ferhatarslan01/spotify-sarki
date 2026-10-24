import { readFile } from 'node:fs/promises';
import { postWindowOpen, isOpeningRun } from './postWindow.js';
import { artists } from './artists.js';
import { getAccessToken, getRecentReleases, findAlbumByUpc, findAlbumByName, QuotaError } from './spotify.js';
import { loadSpotifyBlock, saveSpotifyBlock } from './spotifyBlock.js';
import { loadState, saveState } from './state.js';
import { publishPostWithVideo } from './bufferPost.js';
import { tagText } from './artistHandles.js';
import { buildPostText } from './postText.js';
import { ctaFor } from './cta.js';
import { appendToWeeklyLog } from './weeklyLog.js';
import { loadAnniversaryState, saveAnniversaryState } from './anniversaryState.js';
import { makeEventVideos, hostVideo, tiktokPostPrepared } from './tiktokVideo.js';
import { loadCursor, saveCursor, pickBatch } from './checkCursor.js';
import { getArtistAlbums, getAlbumUpc, normName, todayTRT } from './deezer.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Yeni yayin tespiti varsayilan olarak Deezer'dan yapilir (Spotify kotasina bagli degil, tum sanatcilar her turda taranir).
// Spotify yalnizca paylasimdaki albumun linkini bulmak icin ve Deezer'da guvenilir hesabi olmayan sanatcilar icin kullanilir.
// RELEASE_SOURCE=spotify eski davranisi (yalnizca Spotify) geri getirir. DRY_RUN=1: hicbir sey paylasilmaz/kaydedilmez, ne olacagi yazdirilir.
const SOURCE = process.env.RELEASE_SOURCE === 'spotify' ? 'spotify' : 'deezer';
const DRY_RUN = process.env.DRY_RUN === '1';
const BATCH_COUNT = 2; // Spotify yolunda (cok sanatci varsa) her calistirma listenin yarisini kontrol eder (imlec ile sirayla)
const FRESH_DAYS = 14; // Deezer'da "yeni cikti" sayilmak icin en fazla kac gun once yayinlanmis olmali
// Yil donumu: Deezer'da tum katalog taranir (gunde ~6 aday cikar); remix/canli/derleme gibi surumler elenir, adaylar onem sirasina
// (once albumler, sonra populerlik) dizilir ve gunde en fazla ANNIV_DAILY_MAX (varsayilan 3) tanesi paylasilir.
const ANNIV_DAILY_MAX = Number(process.env.ANNIV_DAILY_MAX || 3);
// Katalog yeniden yayinlari / derlemeler "yeni cikti" sayilmaz (yalnizca sessizce kaydedilir).
const NEW_SKIP_RE = /best of|greatest hits|koleksiyon|collection|remaster|box set|the very best|altın seri|hits|reissue|yeniden/i;
const ANNIV_SKIP_RE = /remix|\blive\b|canlı|instrumental|akustik|acoustic|version|sped up|slowed|karaoke|box set|best of|greatest hits|koleksiyon|collection|\(edit\)|\bmix\b/i;

function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso ?? '';
}

function checkAnniversary(release, today) {
  const releaseDate = new Date(release.releaseDate);
  if (Number.isNaN(releaseDate.getTime())) return null;

  const yearsAgo = today.getUTCFullYear() - releaseDate.getUTCFullYear();
  if (yearsAgo < 1) return null;
  if (releaseDate.getUTCMonth() !== today.getUTCMonth()) return null;
  if (releaseDate.getUTCDate() !== today.getUTCDate()) return null;

  return yearsAgo;
}

function daysSince(isoDate, today) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return Math.round((today.getTime() - d.getTime()) / 86_400_000);
}

async function loadDeezerMap() {
  try {
    return JSON.parse(await readFile(new URL('../data/deezerArtists.json', import.meta.url), 'utf-8'));
  } catch {
    return {};
  }
}

async function main() {
  // Paylaşım penceresi (TRT): pencere dışındaysa hiçbir şey paylaşılmaz, durum dosyalarına dokunulmaz.
  if (!postWindowOpen('Yeni şarkı kontrolü')) return;

  const block = await loadSpotifyBlock();
  const dzMap = SOURCE === 'deezer' ? await loadDeezerMap() : {};
  const useDeezer = (a) => Boolean(dzMap[a.id]?.deezerId);
  const dzArtists = artists.filter(useDeezer);
  // Ek (extra) sanatcilar yalnizca Deezer'da dogrulandiysa takip edilir; Spotify yoluna dusurulmezler (kota yuku olmasin).
  const spArtists = artists.filter((a) => !useDeezer(a) && !a.extra);

  const spotifyCtx = { token: null, blocked: Boolean(block) };
  if (block) {
    console.log(`Spotify kotası dolu; engel ${block.until} tarihine kadar sürüyor (~${Math.round(block.remainingSeconds / 3600)} saat).`);
    if (dzArtists.length === 0) {
      console.log('Deezer ile takip edilen sanatçı yok, bu tur atlanıyor.');
      return;
    }
    console.log('Deezer ile takip edilenler kontrol edilecek; Spotify linkleri arama bağlantısı olarak verilecek.\n');
  }

  async function getSpotifyToken() {
    if (!spotifyCtx.token) spotifyCtx.token = await getAccessToken();
    return spotifyCtx.token;
  }

  function onQuota(err) {
    spotifyCtx.blocked = true;
    console.error('Spotify kotası doldu; Spotify gerektiren işlemler bu turda atlanıyor.');
    if (err.retryAfter >= 60 && !DRY_RUN) {
      return saveSpotifyBlock(err.retryAfter).then((until) => console.error(`Spotify engeli ${until} tarihine kadar kaydedildi.`));
    }
    return Promise.resolve();
  }

  // Deezer'dan gelen yayin icin Spotify album linkini (mumkunse tam eslesme: UPC) bulur; bulunamazsa/engelliyse arama baglantisi kullanilir.
  // Spotify'da album bulunursa albumun sanatci kimligi takip edilen sanatciyla dogrulanir (Deezer'da ayni adli sanatcilar birlesebiliyor);
  // uyusmazsa false doner ve yayin paylasilmaz.
  async function attachSpotifyLink(release, artist) {
    if (release.url) return true;
    let found = null;
    if (!spotifyCtx.blocked) {
      try {
        const token = await getSpotifyToken();
        const upc = await getAlbumUpc(release.dzId).catch(() => null);
        if (upc) found = await findAlbumByUpc(token, upc);
        found ??= await findAlbumByName(token, release.name, artist.name, artist.id);
      } catch (err) {
        if (err instanceof QuotaError) await onQuota(err);
        else console.error(`  Spotify linki bulunamadı (${err.message.split('\n')[0]}); arama bağlantısı kullanılacak.`);
      }
    }
    if (found?.url && Array.isArray(found.artistIds) && !found.artistIds.includes(artist.id)) {
      console.log(`  Spotify albümü başka bir sanatçıya ait (${found.artists.join(', ')}); ${artist.name} - ${release.name} paylaşılmayacak.`);
      return false;
    }
    release.url = found?.url ?? `https://open.spotify.com/search/${encodeURIComponent(`${artist.name} ${release.name}`)}`;
    console.log(found?.url ? `  Spotify albümü bulundu: ${found.url}` : `  Spotify arama bağlantısı kullanılıyor: ${release.url}`);
    return true;
  }

  const annCandidates = [];

  async function postAnniversary(c) {
    const { artist, release, yearsAgo, key, source } = c;
    if (source === 'deezer' && !(await attachSpotifyLink(release, artist))) return false;
    const annQuestion = ctaFor('anniversary');
    const annText = [
      `📅 ${artist.name} - ${release.name}`,
      '',
      `Üzerinden tam ${yearsAgo} yıl geçti! 🎂`,
      ...(annQuestion ? ['', annQuestion] : []),
      release.url,
    ].join('\n');
    console.log(`[YIL DÖNÜMÜ] ${artist.name}: ${release.name} (${yearsAgo} yıl) -> paylaşılıyor...`);
    if (DRY_RUN) {
      console.log(`  [DRY] paylaşılacak metin:\n${annText.split('\n').map((l) => `    ${l}`).join('\n')}\n  [DRY] kapak: ${release.imageUrl}`);
      return true; // simulasyonda gunluk siniri gercek gibi isletmek icin
    }
    try {
      const tiktokParams = {
        kind: 'anniversary',
        artist: artist.name,
        label: 'YIL DÖNÜMÜ',
        headline: `${yearsAgo}. YIL`,
        title: release.name,
        subtitle: artist.name,
        coverUrl: release.imageUrl,
        caption: annText,
        template: 'Anniversary',
        templateData: { releaseDate: release.releaseDate },
        scene: 'anniv',
        palette: 'altin',
        sceneData: {
          number: yearsAgo,
          suffix: '',
          pill: 'YIL DÖNÜMÜ',
          small: 'şarkısı çıkalı',
          l1: 'KAÇ YIL',
          l2: 'OLDU?',
          label: 'YIL ÖNCE ÇIKTI',
          dateText: formatDate(release.releaseDate),
          cta: 'Sen hâlâ dinliyor musun?',
        },
      };
      const handle = await makeEventVideos(tiktokParams);
      const result = await publishPostWithVideo(await tagText(annText, [artist]), release.imageUrl, handle.x ? hostVideo(handle.x) : null, {
        aiGenerated: Boolean(handle.x?.aiGenerated) && process.env.X_AI_LABEL !== '0', // yapay zeka (ComfyUI) goruntusu varsa X etiketi
      });
      if (result.message) {
        console.error(`  Buffer hatası: ${result.message}`);
        return false;
      }
      console.log(`  Paylaşıldı (post id: ${result.post.id})`);
      anniversaryState.announced.push(key);
      await saveAnniversaryState(anniversaryState); // calisma ortasinda cokerse ayni yil donumu tekrar paylasilmasin
      await tiktokPostPrepared(handle.tiktok, tiktokParams);
      return true;
    } catch (err) {
      console.error(`  Buffer hatası: ${err.message}`);
      return false;
    }
  }

  const previousState = await loadState();
  const isFirstRun = previousState === null;
  const oldState = { ...(previousState ?? {}) };
  if (DRY_RUN && process.env.DRY_STATE) Object.assign(oldState, JSON.parse(process.env.DRY_STATE)); // test: eski kayit enjekte et
  const newState = {};

  if (isFirstRun) {
    console.log('İlk çalıştırma: mevcut yayınlar kaydedilecek, tweet atılmayacak.\n');
  }
  if (DRY_RUN) console.log('*** DRY_RUN: paylaşım yapılmayacak, durum kaydedilmeyecek ***\n');

  const anniversaryState = await loadAnniversaryState();
  const todayStr = todayTRT();
  const today = new Date(`${todayStr}T12:00:00Z`);
  const currentYear = today.getUTCFullYear();
  // Deezer'a gecis gunu: yil donumu anahtarlari degistigi icin o gun Deezer kaynakli yil donumleri atlanir (cift paylasimi onler).
  if (!anniversaryState.deezerFrom && dzArtists.length > 0) anniversaryState.deezerFrom = todayStr;
  const skipDeezerAnniversaries = anniversaryState.deezerFrom === todayStr && !(DRY_RUN && process.env.DRY_ANNIV === '1');

  // Spotify yolu: cok sanatci varsa kota icin iki gruba bolunur (kalici sira imleci); az sanatci varsa (Deezer'da bulunmayanlar) hepsi her turda.
  const openingRun = isOpeningRun();
  const checkAll = process.env.CHECK_ALL === '1' || openingRun;
  const cursor = await loadCursor();
  const useCursor = spArtists.length > 10 && !checkAll;
  const spBatch = useCursor ? pickBatch(spArtists, cursor, BATCH_COUNT) : spArtists;
  let processed = 0; // Spotify gruplarinda bu turda gercekten kontrol edilen sanatci sayisi (imleci bu kadar ilerletiriz)
  console.log(
    `Bu çalıştırmada ${dzArtists.length} sanatçı Deezer'dan, ${spBatch.length}/${spArtists.length} sanatçı Spotify'dan kontrol ediliyor${useCursor ? ` (imleç ${cursor}/${spArtists.length})` : ''}.\n`
  );

  let hadErrors = false;
  let quotaStopped = false;
  const work = [...dzArtists.map((artist) => ({ artist, source: 'deezer' })), ...spBatch.map((artist) => ({ artist, source: 'spotify' }))];

  for (const { artist, source } of work) {
    let releases;
    if (source === 'deezer') {
      try {
        releases = await getArtistAlbums(dzMap[artist.id].deezerId);
      } catch (err) {
        console.error(`[HATA] ${artist.name} (Deezer): ${err.message}`);
        hadErrors = true;
        continue;
      }
      await sleep(300);
    } else {
      if (spotifyCtx.blocked) {
        console.log(`- ${artist.name}: Spotify engeli sürüyor, bu tur atlandı`);
        continue;
      }
      processed += 1;
      try {
        releases = await getRecentReleases(await getSpotifyToken(), artist.id);
      } catch (err) {
        console.error(`[HATA] ${artist.name}: ${err.message}`);
        hadErrors = true;
        if (err instanceof QuotaError) {
          quotaStopped = true;
          processed -= 1; // bu sanatci kontrol edilemedi
          await onQuota(err);
        }
        continue;
      }
    }

    const latest = releases[0] ?? null;

    if (!latest) {
      console.log(`- ${artist.name}: yayın bulunamadı`);
      continue;
    }

    newState[artist.id] = latest.id;

    // Durumda kaydi olmayan sanatci (ilk tarama, listeye yeni eklenen ya da kaynagi degisen) sessizce kaydedilir.
    const old = oldState[artist.id];
    const sameKind = typeof old === 'string' && (source === 'deezer' ? old.startsWith('dz:') : !old.startsWith('dz:'));
    const known = old !== undefined && sameKind;
    let isNew = !isFirstRun && known && old !== latest.id;
    // Deezer: yayindan cok sonra "yeni" gorunen kayitlar (silinen/geri alinan albumler) yeni cikti sayilmaz.
    if (isNew && source === 'deezer' && NEW_SKIP_RE.test(latest.name)) {
      console.log(`- ${artist.name}: son yayın bir derleme/yeniden yayın gibi görünüyor, yeni çıktı sayılmadı: ${latest.name}`);
      isNew = false;
    }
    if (isNew && source === 'deezer' && daysSince(latest.releaseDate, today) > FRESH_DAYS) {
      console.log(`- ${artist.name}: son yayın değişti ama ${latest.releaseDate} tarihli (eski), yeni çıktı sayılmadı: ${latest.name}`);
      isNew = false;
    }

    if (isNew && source === 'deezer' && !(await attachSpotifyLink(latest, artist))) isNew = false;

    if (isNew) {
      const text = buildPostText(artist.name, latest);

      console.log(`[YENİ] ${artist.name}: ${latest.name} (${latest.releaseDate}) -> paylaşılıyor...`);
      if (DRY_RUN) {
        console.log(`  [DRY] paylaşılacak metin:\n${text.split('\n').map((l) => `    ${l}`).join('\n')}\n  [DRY] kapak: ${latest.imageUrl}`);
      } else {
        try {
          const tiktokParams = {
            kind: 'release',
            artist: artist.name,
            label: latest.albumType === 'album' ? 'YENİ ALBÜM' : 'YENİ ŞARKI',
            headline: artist.name,
            title: latest.name,
            subtitle: formatDate(latest.releaseDate),
            coverUrl: latest.imageUrl,
            caption: text,
            template: 'NewRelease',
            variantSeed: latest.id, // sarkiya gore yeni cikti sablonu (ayni sarki hep ayni sablon)
            templateData: {
              dateText: formatDate(latest.releaseDate),
            },
            scene: 'new',
            palette: 'studio',
            sceneData: {
              dateText: formatDate(latest.releaseDate),
              pill: 'ÇIKTI, ŞİMDİ DİNLE',
              hook1: latest.albumType === 'album' ? 'YENİ ALBÜMÜ' : 'YENİ ŞARKISI',
              hook2: 'GELDİ!!!',
              sub: latest.albumType === 'album' ? 'yeni albümü çıktı!' : 'yeni şarkısı çıktı!',
              badge: 'YENİ',
              cta: 'Dinledin mi?',
            },
          };
          const handle = await makeEventVideos(tiktokParams);
          const result = await publishPostWithVideo(await tagText(text, [artist]), latest.imageUrl, handle.x ? hostVideo(handle.x) : null);
          if (result.message) {
            console.error(`  Buffer hatası: ${result.message}`);
          } else {
            console.log(`  Paylaşıldı (post id: ${result.post.id})`);
            await saveState({ ...oldState, ...newState }); // calisma ortasinda cokerse ayni yeni cikti tekrar paylasilmasin
            await appendToWeeklyLog({
              artistName: artist.name,
              songName: latest.name,
              releaseDate: latest.releaseDate,
              url: latest.url,
              imageUrl: latest.imageUrl,
            });
            await tiktokPostPrepared(handle.tiktok, tiktokParams);
          }
        } catch (err) {
          console.error(`  Buffer hatası: ${err.message}`);
        }
      }
    } else {
      console.log(`- ${artist.name}: değişiklik yok (son: ${latest.name}, ${latest.releaseDate})`);
    }

    if (!isFirstRun) {
      // Yil donumu adaylari (paylasim dongu bitince onem sirasina gore yapilir). Deezer: tum katalog; Spotify: son 10 yayin.
      for (const release of releases) {
        const yearsAgo = checkAnniversary(release, today);
        if (yearsAgo === null) continue;
        if (source === 'deezer' && ANNIV_SKIP_RE.test(release.name)) continue;

        const key = source === 'deezer' ? `${artist.id}:${normName(release.name)}-${currentYear}` : `${release.id}-${currentYear}`;
        if (anniversaryState.announced.includes(key)) continue;
        if (annCandidates.some((c) => c.key === key)) continue; // ayni sanatci/ad cift kayit (tek + album)
        if (source === 'deezer' && skipDeezerAnniversaries) {
          console.log(`[YIL DÖNÜMÜ] ${artist.name}: ${release.name} (${yearsAgo} yıl) Deezer geçiş günü olduğu için bugün atlandı.`);
          continue;
        }
        const score = (release.albumType === 'album' ? 1e9 : 0) + (release.fans ?? 0) * 10 + (dzMap[artist.id]?.fans ?? 0) / 1000;
        annCandidates.push({ artist, release, yearsAgo, key, source, score });
      }
    }

    if (source === 'spotify') await sleep(5000);
  }

  // Yil donumleri: onem sirasina gore, gunluk sinira kadar paylasilir (kalanlar o gun icin atlanir).
  if (annCandidates.length > 0) {
    annCandidates.sort((a, b) => b.score - a.score);
    const daily = anniversaryState.daily?.date === todayStr ? anniversaryState.daily : { date: todayStr, count: 0 };
    const slots = Math.max(0, ANNIV_DAILY_MAX - daily.count);
    console.log(`\nYıl dönümü adayı: ${annCandidates.length}; bugün kalan hak: ${slots}/${ANNIV_DAILY_MAX}.`);
    let posted = 0;
    for (const c of annCandidates) {
      if (posted >= slots) {
        console.log(`  (sıra dışı kaldı) ${c.artist.name} - ${c.release.name} (${c.yearsAgo} yıl)`);
        continue;
      }
      if (await postAnniversary(c)) {
        daily.count += 1;
        posted += 1;
        await sleep(2000);
      }
    }
    anniversaryState.daily = daily;
  }

  // Kontrol edilemeyen sanatcilarin eski kaydi korunur; basarili olanlar kaydedilir.
  // Boylece hata olsa bile ilerleme kaybolmaz, sadece hatalilar sonraki turda tekrar denenir.
  const succeeded = Object.keys(newState).length;
  if (succeeded > 0 && !DRY_RUN) {
    await saveState({ ...oldState, ...newState });
    await saveAnniversaryState(anniversaryState);
    if (useCursor) await saveCursor((cursor + processed) % spArtists.length);
    console.log(`\nDurum dosyası güncellendi (${succeeded} sanatçı).`);
  }

  if (hadErrors) {
    console.log('\nBazı sanatçılarda hata oluştu; hatalı olanlar sonraki turda tekrar denenecek.');
    // Hic ilerleme yoksa (hepsi basarisiz) calistirmayi basarisiz say ki bildirim gelsin.
    if (succeeded === 0 && !quotaStopped) process.exitCode = 1;
  }
}

main();
