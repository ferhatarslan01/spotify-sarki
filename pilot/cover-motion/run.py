# Kaggle (GPU) uzerinde calisir: album kapaklarindan kisa "hareket dongusu" klipleri uretir (pilot).
# Cikti: /kaggle/working/*.mp4 + results.json  (kapak adi, sure, hata)
import json, os, subprocess, sys, time, traceback, urllib.request

subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "-U", "diffusers", "transformers", "accelerate", "sentencepiece", "imageio", "imageio-ffmpeg"])

# Kaggle'in hazir torchao'su yeni diffusers ile uyumsuz (FqnToConfig yok); kullanmadigimiz icin kaldiriyoruz.
subprocess.call([sys.executable, "-m", "pip", "uninstall", "-y", "-q", "torchao"])

import torch
print("torch:", torch.__version__, flush=True)
from diffusers import LTXImageToVideoPipeline
from diffusers.utils import export_to_video, load_image

COVERS = json.loads(r'''__COVERS_JSON__''')
MODEL = os.environ.get("MOTION_MODEL", "Lightricks/LTX-Video")
OUT = "/kaggle/working"
PROMPT = (
    "Subtle cinematic motion of the album artwork: slow camera push-in, soft light shifting across the scene, "
    "gentle floating dust particles, natural breathing movement. Keep the composition, people and lettering faithful to the image."
)
NEGATIVE = "morphing, distorted face, extra limbs, warped text, new objects, flicker, watermark, low quality, jitter"

print("GPU:", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "yok", flush=True)


def load_pipe():
    for dtype in (torch.bfloat16, torch.float16):
        try:
            p = LTXImageToVideoPipeline.from_pretrained(MODEL, torch_dtype=dtype)
            p.enable_model_cpu_offload()
            p.vae.enable_tiling()
            print("dtype:", dtype, flush=True)
            return p
        except Exception as e:  # noqa: BLE001
            print("yukleme hatasi", dtype, repr(e)[:200], flush=True)
    raise RuntimeError("model yuklenemedi")


t0 = time.time()
pipe = load_pipe()
print(f"model hazir ({time.time() - t0:.0f} sn)", flush=True)

results = []
for c in COVERS:
    name = c["name"]
    info = {"name": name, "ok": False}
    try:
        img_path = f"/tmp/{name}.jpg"
        req = urllib.request.Request(c["url"], headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as r, open(img_path, "wb") as f:
            f.write(r.read())
        image = load_image(img_path).convert("RGB").resize((512, 512))
        t1 = time.time()
        gen = torch.Generator("cuda").manual_seed(7)
        frames = pipe(
            image=image,
            prompt=PROMPT,
            negative_prompt=NEGATIVE,
            width=512,
            height=512,
            num_frames=97,
            num_inference_steps=30,
            guidance_scale=3.0,
            generator=gen,
        ).frames[0]
        export_to_video(frames, f"{OUT}/{name}.mp4", fps=24)
        info.update(ok=True, seconds=round(time.time() - t1, 1))
        print(f"{name}: tamam ({info['seconds']} sn)", flush=True)
    except Exception as e:  # noqa: BLE001
        info["error"] = repr(e)[:300]
        print(f"{name}: HATA {info['error']}", flush=True)
        traceback.print_exc()
    results.append(info)
    torch.cuda.empty_cache()

json.dump(results, open(f"{OUT}/results.json", "w"), ensure_ascii=False, indent=2)
print("bitti", flush=True)
