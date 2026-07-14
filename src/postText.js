const HOOKS = [
  '🔥 YENİ ÇIKTI',
  '🚨 YENİ PARÇA ALARMI',
  '💥 SICAK YENİ',
  '🎧 YENİ YAYIN',
  '⚡ TAZE ÇIKTI',
];

const CTAS = [
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

export function buildPostText(artistName, release) {
  const hook = pick(HOOKS);
  const cta = pick(CTAS);
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
