import { ctaFor } from './cta.js';

const HOOKS = [
  '🔥 YENİ ÇIKTI',
  '🚨 YENİ PARÇA ALARMI',
  '💥 SICAK YENİ',
  '🎧 YENİ YAYIN',
  '⚡ TAZE ÇIKTI',
];

// Soru kapaliysa (CTA_QUESTIONS=0) eski cagrilar kullanilir.
const FALLBACK_CTAS = [
  'Şimdi dinle 👇',
  'Hemen aç, dinle 🎶',
  'Kaçırma, dinle 👇',
  'Sıraya al, dinle 🔊',
];

const TYPE_LABEL = {
  single: 'yeni parça',
  album: 'yeni albüm',
};

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Son satir URL: X'te ilk yanita tasinir (bufferPost.splitLink), TikTok aciklamasinda atilir.
export function buildPostText(artistName, release) {
  const hook = pick(HOOKS);
  const cta = ctaFor('release') ?? pick(FALLBACK_CTAS);
  const label = TYPE_LABEL[release.albumType] ?? 'yeni yayın';

  return [
    hook,
    '',
    `${artistName} - ${release.name} (${label})`,
    '',
    cta,
    release.url,
  ].join('\n');
}
