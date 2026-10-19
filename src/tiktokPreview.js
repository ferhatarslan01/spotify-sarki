// Onizleme: gercek verilerle her Remotion sablonundan bir ornek video uretir, HICBIR YERDE PAYLASMAZ.
// Kullanim: node src/tiktokPreview.js [cikti_klasoru] [--only anniv,era90,era2000,era2010,rise,new,top10,board,digest,duel]
import { mkdir, writeFile } from 'node:fs/promises';
import { fetchDailyChart, getTrackThumbnail, formatStreams } from './dailyChart.js';
import { findPreview } from './tiktokVideo.js';
import { prepNewRelease, prepAnniversary, prepRankRise, prepTopBoard, prepCoverPlayer, prepDuel, prepAnniversaryAuto } from './videoPrep.js';
import { pickDuelPair } from './duelPick.js';
import { renderPrepared } from './remotionRender.js';

const args = process.argv.slice(2);
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1].split(',') : null;
const outDir = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--only') ?? 'preview';
const want = (n) => !only || only.includes(n);

async function buf(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`indirilemedi: ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

const names = (e) => e.artists.map((a) => a.name).join(' & ');

async function trackInput(e) {
  const pv = await findPreview(e.artists[0].name, e.trackName);
  if (!pv) throw new Error(`onizleme yok: ${e.trackName}`);
  return {
    artist: names(e),
    title: e.trackName,
    cover: await buf(await getTrackThumbnail(e.trackUrl)),
    audioUrl: pv.url,
  };
}

const today = () => {
  const n = new Date();
  return `${String(n.getDate()).padStart(2, '0')}.${String(n.getMonth() + 1).padStart(2, '0')}.${n.getFullYear()}`;
};

async function main() {
  await mkdir(outDir, { recursive: true });
  const { date, entries } = await fetchDailyChart();
  const jobs = [];

  if (want('new')) {
    jobs.push(['yeni-sarki', async () => prepNewRelease({ ...(await trackInput(entries[3])), dateText: today() })]);
  }
  if (want('player')) {
    jobs.push(['kare-oynatici', async () => prepCoverPlayer(await trackInput(entries[3]))]);
  }
  if (want('top10')) {
    jobs.push([
      'top10-giris',
      async () =>
        prepNewRelease({
          ...(await trackInput(entries[8])),
          dateText: 'Türkiye günlük listesi',
          pill: `İLK KEZ TOP 10 · #${entries[8].rank}`,
          loadingLabel: 'TOP 10 YÜKLENİYOR',
          radarLabel: 'TÜRKİYE · TOP 10 RADARI',
        }),
    ]);
  }
  if (want('anniv')) {
    jobs.push([
      'yildonumu',
      async () => {
        const r = await (await fetch('https://itunes.apple.com/search?term=Duman+Her+%C5%9Eeyi+Yak&country=TR&entity=song&limit=5')).json();
        const s = r.results.find((x) => x.trackName === 'Her Şeyi Yak' && x.artistName === 'Duman');
        return prepAnniversary({
          artist: s.artistName,
          title: s.trackName,
          releaseDate: s.releaseDate.slice(0, 10),
          cover: await buf(s.artworkUrl100.replace('100x100bb', '600x600bb')),
          audioUrl: s.previewUrl,
        });
      },
    ]);
  }
  if (want('rise')) {
    jobs.push([
      'yukselis',
      async () => {
        const featured =
          [...entries].filter((e) => typeof e.positionChange === 'number' && e.positionChange > 0).sort((a, b) => b.positionChange - a.positionChange)[0] ??
          null;
        if (!featured) throw new Error('bugun yukselen sarki yok');
        const pv = await findPreview(featured.artists[0].name, featured.trackName);
        return prepRankRise({ entries, featured, date, audioUrl: pv.url });
      },
    ]);
  }
  if (want('board')) {
    jobs.push([
      'top5',
      async () => {
        const items = [];
        for (const e of entries.slice(0, 5)) {
          const ti = await trackInput(e);
          items.push({ rank: e.rank, title: ti.title, artist: ti.artist, streams: formatStreams(e.streams), change: e.positionChange ?? null, cover: ti.cover, audioUrl: ti.audioUrl });
        }
        const [dd, mm, yyyy] = date.split('.');
        return prepTopBoard({
          items,
          header: {
            hookTop: '1 NUMARAYI',
            hookBottom: 'TAHMİN ET',
            midTop: 'TÜRKİYE GÜNLÜK',
            midBottom: `TOP 5 · ${dd}.${mm}.${yyyy.slice(2)}`,
            heroTop: 'ZİRVEDE BUGÜN',
            closeTop: 'YARIN YENİ LİSTE',
            closeBottom: '@YENISARKILARIM',
          },
          heroLabel: 'ZİRVE · BİRİNCİ SIRA',
          date,
          dateShort: `${dd}.${mm}.${yyyy.slice(2)}`,
        });
      },
    ]);
  }
  if (want('duel')) {
    jobs.push([
      'duello',
      async () => {
        const pair = pickDuelPair(entries, { seed: Number(date.replace(/\D/g, '')) });
        if (!pair) throw new Error('duello cifti bulunamadi');
        console.log(`  duello: A=${names(pair.a)} (#${pair.a.rank}) vs B=${names(pair.b)} (#${pair.b.rank}), fark %${(pair.gap * 100).toFixed(1)}`);
        const [dd, mm, yyyy] = date.split('.');
        const side = async (e) => ({ ...(await trackInput(e)), rank: e.rank, streams: e.streams });
        return prepDuel({ a: await side(pair.a), b: await side(pair.b), dateShort: `${dd}.${mm}.${yyyy.slice(2)}` });
      },
    ]);
  }
  // Donem girisli yil donumu onizlemeleri: era90 (1990-1999) ve era2000 (2000-2009); klipleri hazir olan donemler calisir.
  const ERA_PREVIEWS = [
    {
      key: 'era90',
      name: 'yildonumu-90lar',
      decade: /^199\d/,
      queries: ['Tarkan Simarik', 'MFO Ali Desidero', 'Sezen Aksu Gulumse', 'Mustafa Sandal Jest Oyna', 'Ajda Pekkan Bambaska Biri', 'Kenan Dogulu Yaparim Bilirsin'],
    },
    {
      key: 'era2010',
      name: 'yildonumu-2010lar',
      decade: /^201\d/,
      queries: ['Hadise Ask Kac Beden Giyer', 'Murat Boz Janti', 'Mabel Matiz Karmasik', 'Sila Yaz Bitmeden', 'Gripin Kafamda Deli Sorular', 'Mor ve Otesi Sonsuza Dek', 'Kenan Dogulu Yaparim Bilirsin', 'Yalin Sorma', 'Ceza Suspus', 'Sezen Aksu Gulumse'],
    },
    {
      key: 'era2000',
      name: 'yildonumu-2000ler',
      decade: /^200\d/,
      queries: ['Tarkan Kuzu Kuzu', 'Hakan Peker Karam', 'Mustafa Sandal Araba', 'Sertab Erener Everyway That I Can', 'Gulsen Be Adam', 'Teoman Papatya', 'Mor ve Otesi Daglari Delelim', 'Duman Her Seyi Yak'],
    },
  ];
  for (const era of ERA_PREVIEWS) {
    if (!want(era.key)) continue;
    process.env.ERA_INTROS = '1'; // onizlemede donem girisi her zaman acik
    jobs.push([
      era.name,
      async () => {
        // O donemde cikmis bir sarki bul (iTunes surumleri yeniden yayin tarihi gosterebilir; donem tarihli olani sec)
        for (const q of era.queries) {
          const r = await (await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&country=TR&entity=song&limit=10`)).json();
          const s = r.results.find((x) => x.previewUrl && era.decade.test(x.releaseDate ?? ''));
          if (s) {
            console.log(`  ${era.key}: ${s.artistName} - ${s.trackName} (${s.releaseDate.slice(0, 10)})`);
            return prepAnniversaryAuto({
              artist: s.artistName,
              title: s.trackName,
              releaseDate: s.releaseDate.slice(0, 10),
              cover: await buf(s.artworkUrl100.replace('100x100bb', '600x600bb')),
              audioUrl: s.previewUrl,
            });
          }
        }
        throw new Error('Donem tarihli onizlemeli sarki bulunamadi');
      },
    ]);
  }
  if (want('digest')) {
    jobs.push([
      'haftalik-ozet',
      async () => {
        const items = [];
        for (const [i, e] of entries.slice(5, 9).entries()) {
          const ti = await trackInput(e);
          items.push({ rank: i + 1, title: ti.title, artist: ti.artist, streams: `0${i + 6}.10`, change: null, cover: ti.cover, audioUrl: ti.audioUrl });
        }
        return prepTopBoard({
          items,
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
          date: today(),
          dateShort: today().slice(0, 5),
        });
      },
    ]);
  }

  for (const [name, make] of jobs) {
    const t0 = Date.now();
    try {
      const prepared = await make();
      const video = await renderPrepared(prepared);
      await writeFile(`${outDir}/${name}.mp4`, video);
      console.log(`${name}: tamam (${Math.round((Date.now() - t0) / 1000)} sn, ${(video.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      console.error(`${name}: HATA ${err.message}`);
      process.exitCode = 1;
    }
  }
}

main();
