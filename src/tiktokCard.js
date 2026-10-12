import sharp from 'sharp';

const W = 1080;
const H = 1920;
const ACCENT = '#1DB954';
const FONT = "'DejaVu Sans', Arial, Helvetica, sans-serif";
const HANDLE = '@yenisarkilarim';

async function fetchBuffer(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Gorsel alinamadi: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function wrap(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || !current) current = next;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Metni verilen genislige sigdirmak icin fontu kucultur, gerekirse satirlara boler.
function fitText(text, maxWidth, startSize, minSize, maxLines) {
  for (let size = startSize; size >= minSize; size -= 4) {
    const perLine = Math.floor(maxWidth / (size * 0.6));
    const lines = wrap(text, perLine);
    if (lines.length <= maxLines && lines.every((l) => l.length <= perLine)) return { lines, size };
  }
  const perLine = Math.floor(maxWidth / (minSize * 0.6));
  const lines = wrap(text, perLine).slice(0, maxLines);
  lines[lines.length - 1] = truncate(lines[lines.length - 1], perLine);
  return { lines, size: minSize };
}

async function rounded(buffer, size, radius) {
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}"/></svg>`
  );
  return sharp(buffer)
    .resize(size, size, { fit: 'cover' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function background(coverBuffer) {
  return sharp(coverBuffer)
    .resize(W, H, { fit: 'cover' })
    .blur(36)
    .modulate({ brightness: 0.38, saturation: 1.25 })
    .toBuffer();
}

function footerSvg() {
  return `<text x="${W / 2}" y="${H - 70}" font-size="42" fill="#ffffff" fill-opacity="0.75"
    text-anchor="middle" font-family="${FONT}">${HANDLE}</text>`;
}

function wrapSvg(inner) {
  return Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`
  );
}

// Tek sarki/olay kartinin parcalari (ayri SVG'ler). Statik kart hepsini birlestirir,
// animasyonlu videoda ise ayri katmanlar olarak sirayla belirir.
function featureParts({ label, headline, title, subtitle }) {
  const pillW = Math.min(960, label.length * 34 + 110);
  let y = 1215;
  const parts = { pill: '', headline: '', title: '', subtitle: '', footer: footerSvg() };

  parts.pill += `<rect x="${(W - pillW) / 2}" y="130" width="${pillW}" height="96" rx="48" fill="${ACCENT}"/>`;
  parts.pill += `<text x="${W / 2}" y="196" font-size="46" font-weight="700" fill="#000000"
    text-anchor="middle" letter-spacing="3" font-family="${FONT}">${esc(label)}</text>`;

  if (headline) {
    const h = fitText(headline, 940, 150, 70, 2);
    for (const line of h.lines) {
      y += h.size;
      parts.headline += `<text x="${W / 2}" y="${y}" font-size="${h.size}" font-weight="800" fill="${ACCENT}"
        text-anchor="middle" font-family="${FONT}">${esc(line)}</text>`;
      y += h.size * 0.12;
    }
    y += 24;
  }

  if (title) {
    const t = fitText(title, 940, 66, 40, 2);
    for (const line of t.lines) {
      y += t.size;
      parts.title += `<text x="${W / 2}" y="${y}" font-size="${t.size}" font-weight="700" fill="#ffffff"
        text-anchor="middle" font-family="${FONT}">${esc(line)}</text>`;
      y += t.size * 0.15;
    }
    y += 16;
  }

  if (subtitle) {
    const s = fitText(subtitle, 940, 52, 34, 2);
    for (const line of s.lines) {
      y += s.size;
      parts.subtitle += `<text x="${W / 2}" y="${y}" font-size="${s.size}" fill="#ffffff" fill-opacity="0.8"
        text-anchor="middle" font-family="${FONT}">${esc(line)}</text>`;
      y += s.size * 0.15;
    }
  }

  return parts;
}

// Animasyonlu video icin katmanlar: sabit taban (bulanik arka plan + etiket + imza) ve
// sirayla belirecek parcalar (kapak, sira, sarki adi, sanatci/stream).
// Kapak (840x840) taban uzerinde left:120, top:290 konumundadir.
export async function renderFeatureLayers({ label, headline, title, subtitle, coverUrl }) {
  const coverBuffer = await fetchBuffer(coverUrl);
  const bg = await background(coverBuffer);
  const cover = await rounded(coverBuffer, 840, 48);
  const parts = featureParts({ label, headline, title, subtitle });

  const base = await sharp(bg)
    .composite([{ input: wrapSvg(parts.pill + parts.footer), left: 0, top: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();

  const layer = (inner) => sharp(wrapSvg(inner)).png().toBuffer();
  return {
    base,
    cover,
    headline: await layer(parts.headline),
    title: await layer(parts.title),
    subtitle: await layer(parts.subtitle),
  };
}

// Tek bir sarki/olay karti: { label, headline, title, subtitle, coverUrl }
export async function renderFeatureCard({ label, headline, title, subtitle, coverUrl }) {
  const coverBuffer = await fetchBuffer(coverUrl);
  const bg = await background(coverBuffer);
  const cover = await rounded(coverBuffer, 840, 48);

  const parts = featureParts({ label, headline, title, subtitle });
  const svg = parts.pill + parts.headline + parts.title + parts.subtitle + parts.footer;

  return sharp(bg)
    .composite([
      { input: cover, left: 120, top: 290 },
      { input: wrapSvg(svg), left: 0, top: 0 },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();
}

// Liste karti: rows = [{ rank?, coverUrl, line1, line2, line3? }]
export async function renderListCard({ header, subheader, rows }) {
  const covers = [];
  for (const row of rows) {
    try {
      covers.push(await fetchBuffer(row.coverUrl));
    } catch {
      covers.push(null);
    }
  }

  const firstCover = covers.find(Boolean);
  const bg = firstCover
    ? await background(firstCover)
    : await sharp({ create: { width: W, height: H, channels: 3, background: '#101010' } }).png().toBuffer();

  const ROW_H = 178;
  const START_Y = 330;
  const composites = [];
  let svg = '';

  const h = fitText(header, 960, 78, 48, 2);
  let hy = 60;
  for (const line of h.lines) {
    hy += h.size;
    svg += `<text x="${W / 2}" y="${hy}" font-size="${h.size}" font-weight="800" fill="#ffffff"
      text-anchor="middle" font-family="${FONT}">${esc(line)}</text>`;
    hy += h.size * 0.1;
  }
  if (subheader) {
    svg += `<text x="${W / 2}" y="${hy + 52}" font-size="44" fill="${ACCENT}" font-weight="700"
      text-anchor="middle" font-family="${FONT}">${esc(subheader)}</text>`;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const top = START_Y + i * ROW_H;

    if (covers[i]) {
      composites.push({ input: await rounded(covers[i], 140, 18), left: 170, top: top + 14 });
    }

    if (row.rank != null) {
      svg += `<text x="100" y="${top + 105}" font-size="${row.rank >= 10 ? 56 : 66}" font-weight="800"
        fill="#ffffff" text-anchor="middle" font-family="${FONT}">${row.rank}</text>`;
    } else {
      svg += `<circle cx="100" cy="${top + 84}" r="14" fill="${ACCENT}"/>`;
    }

    svg += `<text x="335" y="${top + 66}" font-size="42" font-weight="700" fill="#ffffff"
      font-family="${FONT}">${esc(truncate(row.line1, 27))}</text>`;
    svg += `<text x="335" y="${top + 114}" font-size="37" fill="#ffffff" fill-opacity="0.78"
      font-family="${FONT}">${esc(truncate(row.line2 ?? '', 30))}</text>`;
    if (row.line3) {
      svg += `<text x="335" y="${top + 156}" font-size="32" font-weight="700" fill="${ACCENT}"
        font-family="${FONT}">${esc(row.line3)}</text>`;
    }
  }

  svg += footerSvg();
  composites.push({ input: wrapSvg(svg), left: 0, top: 0 });

  return sharp(bg).composite(composites).jpeg({ quality: 88 }).toBuffer();
}

// Acilis/baslik karti: ortada buyuk baslik. { label, headline, subtitle, coverUrl }
export async function renderTitleCard({ label, headline, subtitle, coverUrl }) {
  const coverBuffer = await fetchBuffer(coverUrl);
  const bg = await background(coverBuffer);

  // Basliktaki \n satir sonlarina uyulur; yoksa otomatik bolunur.
  let h;
  if (headline.includes('\n')) {
    const lines = headline.split('\n');
    const longest = Math.max(...lines.map((l) => l.length));
    const size = Math.max(72, Math.min(132, Math.floor(880 / (longest * 0.66))));
    h = { lines, size };
  } else {
    h = fitText(headline, 940, 132, 72, 3);
  }
  const s = subtitle ? fitText(subtitle, 940, 50, 34, 2) : null;

  const PILL_H = 96;
  const GAP_PILL = 80;
  const GAP_SUB = 56;
  const headlineH = h.lines.length * h.size * 1.12;
  const subtitleH = s ? s.lines.length * s.size * 1.2 : 0;
  const blockH = PILL_H + GAP_PILL + headlineH + (s ? GAP_SUB + subtitleH : 0);
  let y = (H - blockH) / 2;

  const pillW = Math.min(960, label.length * 34 + 110);
  let svg = '';

  svg += `<rect x="${(W - pillW) / 2}" y="${y}" width="${pillW}" height="${PILL_H}" rx="48" fill="${ACCENT}"/>`;
  svg += `<text x="${W / 2}" y="${y + 66}" font-size="46" font-weight="700" fill="#000000"
    text-anchor="middle" letter-spacing="3" font-family="${FONT}">${esc(label)}</text>`;
  y += PILL_H + GAP_PILL;

  for (const line of h.lines) {
    y += h.size;
    svg += `<text x="${W / 2}" y="${y}" font-size="${h.size}" font-weight="800" fill="#ffffff"
      text-anchor="middle" font-family="${FONT}">${esc(line)}</text>`;
    y += h.size * 0.12;
  }

  if (s) {
    y += GAP_SUB;
    for (const line of s.lines) {
      y += s.size;
      svg += `<text x="${W / 2}" y="${y}" font-size="${s.size}" font-weight="700" fill="${ACCENT}"
        text-anchor="middle" font-family="${FONT}">${esc(line)}</text>`;
      y += s.size * 0.2;
    }
  }

  svg += footerSvg();

  return sharp(bg)
    .composite([{ input: wrapSvg(svg), left: 0, top: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();
}
