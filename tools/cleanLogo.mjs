// Logo temizleme: kenardan baslayarak arka plani (beyaz / acik gri dama deseni) saydamlastirir, saydam kenarlari kirpar, PNG yazar.
// Kullanim: node tools/cleanLogo.mjs <girdi> <cikti.png> [maxYukseklik=800]
// Arka plan, resmin kenarindan birbirine bagli, dusuk doygunluklu ve acik renkli piksellerdir; logonun icindeki beyaz yazilar
// kalin bir dis cizgiyle cevrili oldugu icin kenara bagli degildir ve korunur. Girdi zaten saydamsa yalnizca kirpilir.
import sharp from 'sharp';

const [, , input, output, maxH = '800'] = process.argv;
if (!input || !output) {
  console.error('Kullanim: node tools/cleanLogo.mjs <girdi> <cikti.png> [maxYukseklik]');
  process.exit(1);
}

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const px = (x, y) => (y * W + x) * 4;
const hasAlpha = (() => {
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) n++;
  return n > W * H * 0.02;
})();

if (!hasAlpha) {
  const isBg = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return Math.max(r, g, b) - Math.min(r, g, b) <= 22 && Math.min(r, g, b) >= 170;
  };
  const seen = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const k = y * W + x;
    if (seen[k] || !isBg(k * 4)) return;
    seen[k] = 1;
    stack.push(k);
  };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (stack.length) {
    const k = stack.pop();
    const x = k % W, y = (k / W) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  for (let k = 0; k < W * H; k++) if (seen[k]) data[k * 4 + 3] = 0;
  // 1 piksellik acik kenar halesini sil (anti-alias kalintisi)
  const kill = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = px(x, y);
    if (data[i + 3] === 0) continue;
    const near = data[px(x + 1, y) + 3] === 0 || data[px(x - 1, y) + 3] === 0 || data[px(x, y + 1) + 3] === 0 || data[px(x, y - 1) + 3] === 0;
    if (!near) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (Math.min(r, g, b) >= 150 && Math.max(r, g, b) - Math.min(r, g, b) <= 70) kill.push(i);
  }
  for (const i of kill) data[i + 3] = 0;
}

let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (data[px(x, y) + 3] > 16) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
}
const pad = 6;
const left = Math.max(0, x0 - pad), top = Math.max(0, y0 - pad);
const cw = Math.min(W - left, x1 - x0 + 1 + 2 * pad), ch = Math.min(H - top, y1 - y0 + 1 + 2 * pad);
await sharp(data, { raw: { width: W, height: H, channels: 4 } })
  .extract({ left, top, width: cw, height: ch })
  .resize({ height: Number(maxH), withoutEnlargement: true })
  .png()
  .toFile(output);
console.log(`${input} -> ${output}  (${cw}x${ch}, ${hasAlpha ? 'zaten saydam' : 'arka plan silindi'})`);
