// ComfyUI sahne klibini dönem girişi için hazırlar: kırp, 30 fps, 1080x1920, (ops.) parlaklık/ısı düzeltmesi ve film greni.
// Kullanım: node tools/comfy/makeEraClip.mjs <girdi.mp4> <cikti.mp4> [--start 0] [--dur 5] [--gamma 1] [--sat 1] [--warm 0] [--grain 0] [--crop x,y,w,h]
//   --crop: kadrajin bir kismini (oran 0-1) alir, sonra 1080x1920'ye olcekler (en-boy orani korunmali). Ornek: --crop 0.1,0,0.9,0.9 (alt %10 ve sol %10 atilir).
//   --gamma 2.2  : karanlık sahneyi açar (ör. hoparlör sahnesi)   --warm 0.1: kırmızı/sarı yönüne ısıtır (yeşilimsi tonu giderir)
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const args = process.argv.slice(2);
const [input, output] = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!input || !output) {
  console.error('Kullanim: node tools/comfy/makeEraClip.mjs <girdi.mp4> <cikti.mp4> [--start 0] [--dur 5] [--gamma 1] [--sat 1] [--warm 0] [--grain 0]');
  process.exit(1);
}
const opt = (n, d) => (args.includes(n) ? Number(args[args.indexOf(n) + 1]) : d);
const start = opt('--start', 0);
const dur = opt('--dur', 5);
const gamma = opt('--gamma', 1);
const sat = opt('--sat', 1);
const warm = opt('--warm', 0);
const grain = opt('--grain', 0);
const cropArg = args.includes('--crop') ? args[args.indexOf('--crop') + 1].split(',').map(Number) : null;

const filters = [
  `trim=start=${start}:duration=${dur}`,
  'setpts=PTS-STARTPTS',
  ...(cropArg ? [`crop=iw*${cropArg[2]}:ih*${cropArg[3]}:iw*${cropArg[0]}:ih*${cropArg[1]}`] : []),
  'fps=30',
  'scale=1080:1920:flags=lanczos',
  'setsar=1',
  `eq=gamma=${gamma}:saturation=${sat}`,
];
if (warm) filters.push(`colorbalance=rs=${warm}:gs=${(warm * 0.3).toFixed(3)}:bs=${-warm}:rm=${(warm * 0.6).toFixed(3)}:bm=${(-warm * 0.6).toFixed(3)}`);
if (grain) filters.push(`noise=alls=${grain}:allf=t`);

await run('ffmpeg', ['-y', '-v', 'error', '-i', input, '-vf', filters.join(','), '-an', '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-pix_fmt', 'yuv420p', output]);
const probe = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'default=nw=1', output]);
console.log(`${output} hazir (${probe.stdout.trim().replace(/\n/g, ', ')})`);
