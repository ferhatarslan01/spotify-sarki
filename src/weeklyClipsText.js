// Haftalik klipli liste: X ve TikTok metinleri. Yalnizca gercek liste verisi kullanilir (sira, sanatci, sarki, tarih araligi).
import { weekRangeText } from './videoPrep.js';

const names = (e) => e.artists.map((a) => a.name).join(' & ');
const line = (e) => `${e.rank}. ${names(e)} – ${e.trackName}`;

// X: 280 karakter (etiketler icin pay birakilir); sigmazsa satir sayisi 5'ten 3'e kadar azaltilir. TikTok: Top 10.
export function weeklyClipsTexts(date, entries) {
  const range = weekRangeText(date);
  const head = ['🎵 HAFTANIN EN ÇOK DİNLENEN ŞARKILARI', range, ''];
  let x = '';
  for (let n = 5; n >= 3; n--) {
    x = [...head, ...entries.slice(0, n).map(line), '', 'Tüm liste videoda 👇'].join('\n');
    if (x.length <= 250) break;
  }
  const tiktok = [...head, ...entries.slice(0, 10).map(line), '', 'Her hafta yeni liste: takip et 🎧'].join('\n');
  return { x, tiktok, range };
}
