import { fetchDailyChart, getTrackThumbnail } from './dailyChart.js';
import { publishPost } from './bufferPost.js';

const TOP_N = 50;
const MAX_LENGTH = 270;
const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];

function aggregate(entries) {
  const byArtist = new Map();

  for (const entry of entries) {
    for (const artist of entry.artists) {
      const row = byArtist.get(artist.id) ?? {
        name: artist.name,
        count: 0,
        bestRank: entry.rank,
        bestEntry: entry,
      };
      row.count += 1;
      if (entry.rank < row.bestRank) {
        row.bestRank = entry.rank;
        row.bestEntry = entry;
      }
      byArtist.set(artist.id, row);
    }
  }

  return [...byArtist.values()].sort((a, b) => b.count - a.count || a.bestRank - b.bestRank);
}

function buildText(date, rows, top) {
  const totalSongs = top.length;
  const artistCount = rows.length;

  // Düet/feat şarkıları iki kez saymamak için benzersiz şarkı sayısı
  const topThreeNames = new Set(rows.slice(0, 3).map((r) => r.name));
  const topThreeSongs = top.filter((e) => e.artists.some((a) => topThreeNames.has(a.name))).length;
  const share = Math.round((topThreeSongs / totalSongs) * 100);

  const header = `🔥 Türkiye Top ${TOP_N}'de kim kaç şarkıyla var? (${date})`;
  const footer = `\n👀 ${totalSongs} şarkı, sadece ${artistCount} sanatçı. İlk 3 sanatçı listenin %${share}'ini tutuyor!`;

  for (let n = Math.min(rows.length, MEDALS.length); n >= 1; n--) {
    const lines = rows
      .slice(0, n)
      .map((r, i) => `${MEDALS[i]} ${r.name} — ${r.count} şarkı`);
    const text = [header, '', ...lines, footer].join('\n');
    if (text.length <= MAX_LENGTH) return { text, shown: n };
  }

  return { text: [header, footer].join('\n'), shown: 0 };
}

async function main() {
  const dryRun = process.argv.includes('--dry');

  const { date, entries } = await fetchDailyChart();
  if (!date || entries.length < TOP_N) {
    console.error('Chart verisi yetersiz, çıkılıyor.');
    process.exitCode = 1;
    return;
  }

  const top = entries.filter((e) => e.rank <= TOP_N);
  const rows = aggregate(top);
  const { text, shown } = buildText(date, rows, top);

  console.log(text);
  console.log(`\n(${text.length} karakter, ${shown} sanatçı gösteriliyor)`);

  if (dryRun) {
    console.log('\n--dry: paylaşılmadı.');
    return;
  }

  const imageUrl = await getTrackThumbnail(rows[0].bestEntry.trackUrl).catch(() => null);
  const result = await publishPost(text, imageUrl);
  if (result.message) {
    console.error(`Buffer hatası: ${result.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Paylaşıldı (post id: ${result.post.id})`);
}

main();
