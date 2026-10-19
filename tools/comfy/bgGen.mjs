// Yerel ComfyUI (Wan 2.2 TI2V 5B) ile arka plan videosu uretir. Tek seferlik: sonuc repoya konur, bulutta GPU gerekmez.
// Kullanim: node tools/comfy/bgGen.mjs <stil> [--draft] [--seed N] [--frames 121]
//   stil: room | vhs | film   (asagidaki STYLES)
//   --draft: kucuk boyut (480x864) hizli onizleme; yoksa 704x1280.
//   --tiled: VAE'yi parcali cozer (8 GB VRAM'de buyuk boyutta takilmayi onler).
// Onkosul: ComfyUI http://127.0.0.1:8188 adresinde calisiyor (D:\ComfyUI\ComfyUI_windows_portable).
import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const HOST = process.env.COMFY_HOST ?? 'http://127.0.0.1:8188';
const COMFY_OUT = process.env.COMFY_OUTPUT ?? 'D:/ComfyUI/ComfyUI_windows_portable/ComfyUI/output';
const OUT_DIR = 'tools/comfy/out';

const NEGATIVE =
  'people, person, face, hands, text, letters, logo, watermark, subtitles, blurry details, overexposed, static frame, ' +
  'low quality, jpeg artifacts, deformed, ugly, cluttered background, worst quality, 色调艳丽，过曝，静态，字幕，丑陋的，畸形的';

const STYLES = {
  room: {
    note: 'Nostalji odasi: CRT TV + plak calar',
    prompt:
      'Cinematic vertical shot of a cozy dimly lit 1990s living room at night. An old CRT television in the corner flickers soft blue light, ' +
      'a vinyl record spins on a turntable on a wooden cabinet, stacks of cassette tapes, a warm tungsten lamp glows, dust particles float in the light. ' +
      'Analog film grain, faint VHS tracking noise, shallow depth of field, slow gentle camera push-in, warm nostalgic mood, no people.',
  },
  vhs: {
    note: 'VHS / kaset: neon kirmizi-mavi, donen makaralar',
    prompt:
      'Macro cinematic shot of a retro cassette tape and a VHS tape in a dark room, the cassette reels slowly turning, ' +
      'neon magenta and cyan light glowing from behind, analog glitch lines, soft bokeh lights, floating dust, film grain, ' +
      'slow camera drift, nostalgic 1990s synthwave mood, no people, no text.',
  },
  film: {
    note: 'Eski sinema: projektor isigi, amber isik sizintisi',
    prompt:
      'An old film projector beam cutting through a dark room full of drifting dust particles, warm amber light leaks, ' +
      'flickering 8mm film look with soft vignette and heavy film grain, scratches and dust on the film, ' +
      'slow camera drift toward the light, deep shadows, nostalgic cinematic mood, no people, no text.',
  },
};

const args = process.argv.slice(2);
const style = args.find((a) => !a.startsWith('--') && STYLES[a]);
if (!style) {
  console.error(`Stil seç: ${Object.keys(STYLES).join(' | ')}`);
  process.exit(1);
}
const draft = args.includes('--draft');
const tiled = args.includes('--tiled');
const opt = (name, def) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : def);
const seed = opt('--seed', Math.floor(Math.random() * 1e9));
const frames = opt('--frames', 121);
const [width, height] = draft ? [480, 864] : [704, 1280];
const prefix = `video/annivbg_${style}${draft ? '_draft' : ''}${tiled ? '_tiled' : ''}_${seed}`;

const prompt = {
  37: { class_type: 'UNETLoader', inputs: { unet_name: 'wan2.2_ti2v_5B_fp16.safetensors', weight_dtype: 'default' } },
  38: { class_type: 'CLIPLoader', inputs: { clip_name: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors', type: 'wan', device: 'default' } },
  39: { class_type: 'VAELoader', inputs: { vae_name: 'wan2.2_vae.safetensors' } },
  48: { class_type: 'ModelSamplingSD3', inputs: { model: ['37', 0], shift: 8 } },
  6: { class_type: 'CLIPTextEncode', inputs: { clip: ['38', 0], text: STYLES[style].prompt } },
  7: { class_type: 'CLIPTextEncode', inputs: { clip: ['38', 0], text: NEGATIVE } },
  55: { class_type: 'Wan22ImageToVideoLatent', inputs: { vae: ['39', 0], width, height, length: frames, batch_size: 1 } },
  3: {
    class_type: 'KSampler',
    inputs: {
      model: ['48', 0],
      positive: ['6', 0],
      negative: ['7', 0],
      latent_image: ['55', 0],
      seed,
      steps: 20,
      cfg: 5,
      sampler_name: 'uni_pc',
      scheduler: 'simple',
      denoise: 1,
    },
  },
  8: tiled
    ? { class_type: 'VAEDecodeTiled', inputs: { samples: ['3', 0], vae: ['39', 0], tile_size: 256, overlap: 64, temporal_size: 32, temporal_overlap: 8 } }
    : { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['39', 0] } },
  57: { class_type: 'CreateVideo', inputs: { images: ['8', 0], fps: 24 } },
  58: { class_type: 'SaveVideo', inputs: { video: ['57', 0], filename_prefix: prefix, format: 'auto', codec: 'auto' } },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
console.log(`${style} (${STYLES[style].note}) ${width}x${height}, ${frames} kare, seed ${seed}${draft ? ' [taslak]' : ''}`);

const queued = await (await fetch(`${HOST}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) })).json();
if (!queued.prompt_id) {
  console.error('ComfyUI reddetti:', JSON.stringify(queued).slice(0, 1500));
  process.exit(1);
}
console.log('kuyruga alindi:', queued.prompt_id);

let files = null;
for (;;) {
  await sleep(10_000);
  const hist = await (await fetch(`${HOST}/history/${queued.prompt_id}`)).json();
  const h = hist[queued.prompt_id];
  if (h?.status?.status_str === 'error') {
    console.error('Hata:', JSON.stringify(h.status.messages?.slice(-2)).slice(0, 1500));
    process.exit(1);
  }
  if (h?.outputs && Object.keys(h.outputs).length > 0) {
    files = Object.values(h.outputs).flatMap((o) => [...(o.images ?? []), ...(o.videos ?? [])]);
    break;
  }
  process.stdout.write(`\r  bekleniyor... ${Math.round((Date.now() - t0) / 1000)} sn`);
}
console.log(`\n  tamam: ${Math.round((Date.now() - t0) / 1000)} sn`);

await mkdir(OUT_DIR, { recursive: true });
for (const f of files) {
  const src = join(COMFY_OUT, f.subfolder ?? '', f.filename);
  const dst = join(OUT_DIR, f.filename);
  await copyFile(src, dst);
  console.log('kaydedildi:', dst);
}
