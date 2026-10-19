// ComfyUI ciktisini kusursuz donguye cevirir: son 1 sn, bastaki 1 sn ile capraz eriyerek birlestirilir; 30 fps, dikey 1080x1920.
// Kullanim: node tools/comfy/makeLoop.mjs <girdi.mp4> <cikti.mp4> [--overlap 1] [--w 1080] [--h 1920]
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const args = process.argv.slice(2);
const [input, output] = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!input || !output) {
  console.error('Kullanim: node tools/comfy/makeLoop.mjs <girdi.mp4> <cikti.mp4> [--overlap 1] [--w 1080] [--h 1920]');
  process.exit(1);
}
const opt = (n, d) => (args.includes(n) ? Number(args[args.indexOf(n) + 1]) : d);
const o = opt('--overlap', 1);
const W = opt('--w', 1080);
const H = opt('--h', 1920);

const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', input]);
const L = Number(stdout.trim());
if (!(L > 2 * o + 0.5)) throw new Error(`Video cok kisa: ${L} sn`);

// govde [o, L-o), kuyruk [L-o, L) -> bas [0, o) ile eriyerek; dongu noktasinda kare surekliligi korunur.
const graph = [
  `[0:v]fps=30,scale=${W}:${H}:flags=lanczos,setsar=1,split=3[a][b][c]`,
  `[a]trim=start=${o}:end=${(L - o).toFixed(3)},setpts=PTS-STARTPTS[body]`,
  `[b]trim=start=${(L - o).toFixed(3)}:end=${L.toFixed(3)},setpts=PTS-STARTPTS[tail]`,
  `[c]trim=start=0:end=${o},setpts=PTS-STARTPTS[head]`,
  `[tail][head]xfade=transition=fade:duration=${o}:offset=0[fade]`,
  `[body][fade]concat=n=2:v=1:a=0[v]`,
].join(';');

await run('ffmpeg', ['-y', '-v', 'error', '-i', input, '-filter_complex', graph, '-map', '[v]', '-an', '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-pix_fmt', 'yuv420p', output]);
const probe = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=nb_read_frames', '-count_frames', '-of', 'default=nw=1', output]);
console.log(`${output} hazir (${probe.stdout.trim().replace(/\n/g, ', ')})`);
