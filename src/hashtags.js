// TikTok aciklamalarina eklenen hashtag'ler. TIKTOK_HASHTAGS=0 ile kapatilir.
// Amac: az sayida, ilgili ve gonderi turune gore degisen etiket (hepsi ayni olursa spam gibi gorunur).

const DISCOVERY = ['#keşfet', '#fyp', '#keşfetteyiz', '#keşfetbeniöneçıkar'];

const KIND_TAGS = {
  release: ['#yenişarkı', '#yeniçıkanlar', '#türkçemüzik'],
  anniversary: ['#nostalji', '#yıldönümü', '#türkçemüzik'],
  'trend-jump': ['#spotifytürkiye', '#trend', '#yükselenşarkılar'],
  'trend-top10': ['#spotifytürkiye', '#top10', '#trend'],
  'trend-milestone': ['#spotifytürkiye', '#rekor', '#stream'],
  'trend-global': ['#spotifyglobal', '#dünyalistesi', '#türkçemüzik'],
  'daily-tr': ['#spotifytürkiye', '#günlükliste', '#top5'],
  'weekly-tr': ['#spotifytürkiye', '#haftalıkliste', '#top5'],
  'daily-global': ['#spotifyglobal', '#dünyalistesi', '#top5'],
  'weekly-digest': ['#yenişarkılar', '#buhaftaçıkanlar', '#türkçemüzik'],
};

const FALLBACK_TAGS = ['#spotify', '#müzik', '#türkçemüzik'];

function pickRandom(list, count) {
  const pool = [...list];
  const picked = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picked;
}

function artistTag(name) {
  const cleaned = String(name).replace(/[^\p{L}\p{N}]+/gu, '');
  return cleaned.length >= 2 ? `#${cleaned}` : null;
}

// Sanatci adlari: ["manifest", "BLOK3 & Poizi"] gibi girdileri ayirip en fazla `limit` benzersiz etiket uretir.
function artistTags(artists, limit) {
  const names = artists
    .flatMap((a) => String(a).split(/ & | ft\.? | feat\.? /i))
    .map((n) => n.trim())
    .filter(Boolean);

  const tags = [];
  for (const name of names) {
    const tag = artistTag(name);
    if (tag && !tags.some((t) => t.toLowerCase() === tag.toLowerCase())) tags.push(tag);
    if (tags.length >= limit) break;
  }
  return tags;
}

export function buildHashtags({ kind, artists = [] }) {
  const base = KIND_TAGS[kind] ?? FALLBACK_TAGS;
  const all = [...base.slice(0, 3), ...artistTags(artists, 2), ...pickRandom(DISCOVERY, 2)];

  const seen = new Set();
  return all.filter((t) => !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).slice(0, 7);
}

export function withHashtags(description, { kind, artists = [] }) {
  if (process.env.TIKTOK_HASHTAGS === '0') return description;
  const tags = buildHashtags({ kind, artists });
  return tags.length > 0 ? `${description}\n\n${tags.join(' ')}` : description;
}
