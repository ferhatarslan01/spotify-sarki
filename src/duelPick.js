// Duello icin gunluk listeden iki sarki secer: farkli sanatcilar, birbirine yakin ama esit olmayan stream.
// Tahmin edilmesi zor (ilgi cekici) ciftler tercih edilir; sonuc "kesin belli" olmasin diye ~%8 fark hedeflenir.
const names = (e) => e.artists.map((a) => a.name).join(' & ');

// excludeKeys: son gunlerde kullanilan "trackIdA|trackIdB" anahtarlari (tekrar etmesin)
export function pickDuelPair(entries, { limit = 10, excludeKeys = [], seed = 0 } = {}) {
  const top = entries.slice(0, limit).filter((e) => Number.isFinite(e.streams) && e.streams > 0);
  const pairs = [];
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      const hi = top[i];
      const lo = top[j];
      if (hi.artists[0].id === lo.artists[0].id) continue; // ayni sanatci olmasin
      const key = [hi.trackId, lo.trackId].sort().join('|');
      if (excludeKeys.includes(key)) continue;
      const gap = (hi.streams - lo.streams) / hi.streams;
      if (gap < 0.02) continue; // neredeyse esit: sonuc anlamsiz
      // hedef ~%8 fark; ust siralar daha ilgi cekici
      const score = Math.abs(gap - 0.08) + (hi.rank + lo.rank) * 0.004;
      pairs.push({ hi, lo, gap, key, score });
    }
  }
  pairs.sort((x, y) => x.score - y.score);
  if (pairs.length === 0) return null;
  // seed ile ilk 3 aday arasinda donulur (her gun ayni cift cikmasin); A/B sirasi da seed'e gore
  const pick = pairs[Math.abs(seed) % Math.min(3, pairs.length)];
  const aFirst = Math.abs(seed) % 2 === 0;
  const [a, b] = aFirst ? [pick.hi, pick.lo] : [pick.lo, pick.hi];
  return { a, b, key: pick.key, gap: pick.gap, names: [names(a), names(b)] };
}
