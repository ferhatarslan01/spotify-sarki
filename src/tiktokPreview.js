// Onizleme: gercek verilerle her TikTok sahnesinden bir ornek video uretir, HICBIR YERDE PAYLASMAZ.
// Kullanim: node src/tiktokPreview.js [cikti_klasoru] [--only anniv,rise,new,top10,milestone,top5,digest]
import { mkdir, writeFile } from 'node:fs/promises';
import { fetchDailyChart, getTrackThumbnail, formatStreams } from './dailyChart.js';
import { findPreview } from './tiktokVideo.js';
import { renderVideo } from './videoEngine.js';

const args = process.argv.slice(2);
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1].split(',') : null;
const outDir = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--only') ?? 'preview';

async function buf(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`indirilemedi: ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

const names = (e) => e.artists.map((a) => a.name).join(' & ');

async function trackData(e) {
  const pv = await findPreview(e.artists[0].name, e.trackName);
  return {
    artist: names(e),
    title: e.trackName,
    cover: await buf(await getTrackThumbnail(e.trackUrl)),
    audioUrl: pv?.url ?? null,
  };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const { entries } = await fetchDailyChart();
  const jobs = [];
  const want = (n) => !only || only.includes(n);

  if (want('anniv')) {
    jobs.push(async () => {
      const r = await (await fetch('https://itunes.apple.com/search?term=Tarkan+Kuzu+Kuzu&country=TR&entity=song&limit=1')).json();
      const s = r.results[0];
      const rd = new Date(s.releaseDate);
      return {
        name: 'yildonumu',
        scene: 'anniv',
        palette: 'altin',
        data: {
          artist: s.artistName,
          title: s.trackName,
          cover: await buf(s.artworkUrl100.replace('100x100bb', '640x640bb')),
          audioUrl: s.previewUrl,
          number: new Date().getUTCFullYear() - rd.getUTCFullYear(),
          suffix: '',
          pill: 'YIL DÖNÜMÜ',
          small: 'şarkısı çıkalı',
          l1: 'KAÇ YIL',
          l2: 'OLDU?',
          label: 'YIL ÖNCE ÇIKTI',
          dateText: `${String(rd.getUTCDate()).padStart(2, '0')}.${String(rd.getUTCMonth() + 1).padStart(2, '0')}.${rd.getUTCFullYear()}`,
          cta: 'Sen hâlâ dinliyor musun?',
        },
      };
    });
  }
  if (want('rise')) {
    jobs.push(async () => {
      const e = entries.find((x) => x.rank > 3 && typeof x.positionChange === 'number' && x.positionChange > 0) ?? entries[7];
      const ch = typeof e.positionChange === 'number' && e.positionChange > 0 ? e.positionChange : 6;
      return {
        name: 'sira-yukseldi',
        scene: 'rise',
        palette: 'altin',
        data: { ...(await trackData(e)), from: e.rank + ch, to: e.rank, pill: 'TÜRKİYE GÜNLÜK LİSTE', cta: 'Sence zirveye çıkar mı?' },
      };
    });
  }
  if (want('new')) {
    jobs.push(async () => {
      const e = entries[3];
      const n = new Date();
      return {
        name: 'yeni-sarki',
        scene: 'new',
        palette: 'studio',
        data: {
          ...(await trackData(e)),
          dateText: `${String(n.getDate()).padStart(2, '0')}.${String(n.getMonth() + 1).padStart(2, '0')}.${n.getFullYear()}`,
          pill: 'ÇIKTI, ŞİMDİ DİNLE',
          hook1: 'YENİ ŞARKISI',
          hook2: 'GELDİ!!!',
          sub: 'yeni şarkısı çıktı!',
          badge: 'YENİ',
          cta: 'Dinledin mi? Yorumlara yaz!',
        },
      };
    });
  }
  if (want('top10')) {
    jobs.push(async () => {
      const e = entries[8];
      return {
        name: 'top10-giris',
        scene: 'new',
        palette: 'studio',
        data: {
          ...(await trackData(e)),
          dateText: `Türkiye günlük listesi · ${e.rank}. sıra`,
          pill: 'İLK KEZ TOP 10',
          hook1: "TÜRKİYE TOP 10'A",
          hook2: 'GİRDİ!!!',
          sub: `${e.rank}. sıraya yerleşti!`,
          badge: `#${e.rank}`,
          cta: 'Sence kaçıncı olur?',
        },
      };
    });
  }
  if (want('milestone')) {
    jobs.push(async () => {
      const e = entries[1];
      return {
        name: 'stream-rekoru',
        scene: 'anniv',
        palette: 'altin',
        data: {
          ...(await trackData(e)),
          number: 10,
          suffix: 'M',
          pill: 'STREAM REKORU',
          small: 'şarkısı',
          l1: 'REKOR',
          l2: 'KIRDI!',
          label: "STREAM'İ GEÇTİ",
          dateText: 'Türkiye günlük listesi',
          cta: 'Sen kaç kere dinledin?',
        },
      };
    });
  }
  if (want('top5')) {
    jobs.push(async () => {
      const items = [];
      for (const e of [...entries.slice(0, 5)].reverse()) {
        const td = await trackData(e);
        items.push({ rank: e.rank, title: td.title, artist: td.artist, sub: `${formatStreams(e.streams)} stream`, cover: td.cover, audioUrl: td.audioUrl });
      }
      return {
        name: 'top5',
        scene: 'top5',
        palette: 'studio',
        data: {
          items,
          intro: { l1: 'BUGÜN EN ÇOK', l2: 'DİNLENEN', big: '5', small: 'ŞARKI' },
          pill: 'TÜRKİYE GÜNLÜK LİSTE',
          outroHead: "BUGÜNÜN TOP 5'İ",
          showRank: true,
          cta: 'Sence sıralama doğru mu? Yaz!',
        },
      };
    });
  }
  if (want('digest')) {
    jobs.push(async () => {
      const items = [];
      for (const [i, e] of entries.slice(5, 9).entries()) {
        const td = await trackData(e);
        items.push({ rank: i + 1, title: td.title, artist: td.artist, sub: '14.10.2026', cover: td.cover, audioUrl: td.audioUrl });
      }
      return {
        name: 'haftalik-ozet',
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
      };
    });
  }

  for (const job of jobs) {
    const spec = await job();
    const t0 = Date.now();
    try {
      const video = await renderVideo({ scene: spec.scene, palette: spec.palette, data: spec.data });
      await writeFile(`${outDir}/${spec.name}.mp4`, video);
      console.log(`${spec.name}: tamam (${Math.round((Date.now() - t0) / 1000)} sn, ${(video.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      console.error(`${spec.name}: HATA ${err.message}`);
      process.exitCode = 1;
    }
  }
}

main();
