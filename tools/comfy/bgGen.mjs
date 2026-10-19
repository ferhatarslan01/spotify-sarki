// Yerel ComfyUI (Wan 2.2 TI2V 5B) ile arka plan videosu uretir. Tek seferlik: sonuc repoya konur, bulutta GPU gerekmez.
// Kullanim: node tools/comfy/bgGen.mjs <stil> [--draft] [--seed N] [--frames 121]
//   stil: room | vhs | film | radio1 | radio2 | pc1 | pc2 | phone1 | phone2   (asagidaki STYLES)
//   --draft: kucuk boyut (480x864) hizli onizleme; yoksa 704x1280.
//   --cool N / --rest S: GPU N C altinda ve S sn bosta kalana kadar bekle (varsayilan 50 C / 0 sn: GPU 50 C altina inince baslar; --cool 0 = bekleme yok).
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

// Insan iceren sahneler icin negatif ('people' yok): yuz/el bozulmasi ve metin engellenir.
const NEGATIVE_PERSON =
  'text, letters, logo, watermark, subtitles, blurry details, overexposed, static frame, low quality, jpeg artifacts, ' +
  'deformed hands, extra fingers, fused fingers, distorted body, extra limbs, ugly, face close-up, looking at camera, worst quality, ' +
  '色调艳丽，过曝，静态，字幕，丑陋的，畸形的，多余的手指，画得不好的手部，畸形的毁容的';

// Sirti donuk planlar: yuz/profil/agiz gorunmesin.
const NEGATIVE_BACK =
  NEGATIVE_PERSON + ', profile view, side view, visible face, face visible, open mouth, smiling, looking sideways, turning head';

const STYLES = {
  phone1: {
    note: '2010lar girisi, sahne 1: sirti donuk, yatak kenarinda telefonuyla muzik acan (yuz gorunmez)',
    negative: NEGATIVE_BACK,
    prompt:
      'Cinematic vertical shot from directly behind: a young person in 2010s clothes, an oversized grey hoodie and a snapback cap worn backwards, ' +
      'sits on the edge of a bed in a cozy bedroom at night, seen only from behind, facing the wall. In front of them are warm string fairy lights, ' +
      'polaroid photos taped on the wall and a pink and purple LED strip glow, a portable cylinder Bluetooth speaker stands on the desk. ' +
      'Over their shoulder the glow of a smartphone screen lights up their hand and the wall as they tap it. ' +
      'Slow camera push-in from behind the shoulder, analog film grain, shallow depth of field, nostalgic mood.',
  },
  phone2: {
    note: '2010lar girisi, sahne 2: bluetooth hoparlorun bas ile titremesi',
    negative: NEGATIVE_PERSON,
    prompt:
      'Close-up of a portable cylinder Bluetooth speaker on a bedside table pulsing with deep bass, its fabric grille vibrating, a small pink LED ring glowing, ' +
      'warm fairy lights bokeh in the background, a smartphone lying next to it with its screen lighting up, pink and purple neon glow, ' +
      'analog film grain, shallow depth of field, slow camera push-in, nostalgic mood, no hands, no text.',
  },
  pc1: {
    note: "2000ler girisi, sahne 1: bilgisayar basinda oturan, fareye tiklayan",
    negative: NEGATIVE_PERSON,
    prompt:
      'Cinematic vertical shot from behind: a teenager in early-2000s clothes, an oversized white t-shirt under an open baggy denim jacket, low-rise baggy jeans and a trucker cap, ' +
      'sits at a cluttered computer desk in a dim bedroom at night, his back to the camera. In front of him a chunky CRT computer monitor glows bright blue and green, ' +
      'a pair of small desktop speakers sits on either side, a stack of burned CDs, a Nokia phone and a soda can on the desk, posters on the wall. ' +
      'He grabs the mouse and clicks, the screen brightens. Cool blue monitor glow mixed with a warm desk lamp, analog film grain, shallow depth of field, ' +
      'slow camera push-in from behind his shoulder, nostalgic mood.',
  },
  pc2: {
    note: '2000ler girisi, sahne 2: masaustu hoparlorunun bas ile titremesi',
    negative: NEGATIVE_PERSON,
    prompt:
      'Close-up of a small early-2000s desktop PC speaker, silver and black plastic, on a desk next to a glowing CRT monitor: the speaker cone vibrates and pulses with deep bass, ' +
      'dust particles jump on the grille, a small blue LED and a green power light glow, cool blue monitor light mixed with warm lamp light, ' +
      'analog film grain, shallow depth of field, slow camera push-in, nostalgic mood, no hands, no text.',
  },
  radio1: {
    note: '90lar girisi, sahne 1: radyo basinda oturan, sesi acan',
    negative: NEGATIVE_PERSON,
    prompt:
      'Cinematic vertical shot from behind: a young man in 1990s clothing, an oversized stonewashed denim jacket, baggy jeans and a backwards baseball cap, ' +
      'sits cross-legged on the floor of a cozy 1990s bedroom at dusk, his back to the camera. In front of him on a low wooden table is a vintage boombox radio ' +
      'with a cassette deck and a glowing orange tuning dial. He reaches out with one hand and slowly turns the volume knob up. ' +
      'Warm tungsten lamp light, posters on the wall, dust floating in the light, analog film grain, shallow depth of field, ' +
      'slow camera push-in from behind his shoulder, nostalgic mood.',
  },
  radio2: {
    note: '90lar girisi, sahne 2: radyo hoparlorunun bas ile titremesi (ses yukseliyor)',
    negative: NEGATIVE_PERSON,
    prompt:
      'Close-up of the round speaker of a vintage 1990s boombox radio in a dim room: the speaker cone pulses and vibrates with deep bass, ' +
      'getting stronger and stronger, tiny dust particles jump on the metal speaker grille, small red and green LEDs flicker next to it, ' +
      'warm orange lamp light from the side, analog film grain, shallow depth of field, slow camera push-in, nostalgic mood, no hands, no text.',
  },
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
  7: { class_type: 'CLIPTextEncode', inputs: { clip: ['38', 0], text: STYLES[style].negative ?? NEGATIVE } },
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

// Laptopu dinlendirir: GPU sicakligi hedefin altinda VE bosta (<%10) olarak art arda `rest` saniye gectikten sonra devam eder.
// --cool 50 (varsayilan 50; 0 = bekleme yok), --rest 0 (istenirse ek bosta kalma suresi, sn). Cekirdek sicakligi yuk kalkinca bir dakikada duser,
// bu yuzden tek basina sicaklik yetmez; asil dinlenme icin bosta kalma suresi sarttir.
async function waitCool(target, rest) {
  if (!(target > 0)) return;
  const { execFile } = await import('node:child_process');
  const read = () =>
    new Promise((res) =>
      execFile('nvidia-smi', ['--query-gpu=temperature.gpu,utilization.gpu', '--format=csv,noheader,nounits'], (e, out) => {
        if (e) return res(null);
        const [t, u] = out.trim().split(',').map(Number);
        res({ t, u });
      }),
    );
  let idleSince = null;
  for (let i = 0; i < 240; i++) {
    const r = await read();
    if (!r) return;
    if (r.t <= target && r.u < 10) {
      idleSince ??= Date.now();
      const idle = (Date.now() - idleSince) / 1000;
      if (idle >= rest) return;
      console.log(`GPU ${r.t} C, bosta ${Math.round(idle)}/${rest} sn, dinlenme suruyor...`);
    } else {
      idleSince = null;
      console.log(`GPU ${r.t} C (%${r.u}), ${target} C altina inmesi bekleniyor...`);
    }
    await sleep(20_000);
  }
}
await waitCool(opt('--cool', 50), opt('--rest', 0));
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
