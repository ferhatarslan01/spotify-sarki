"""ComfyUI ciktisindaki yanip sonen parlak lekeleri (ornek: duvardaki "pencere isigi" kalintilari) temizler.

Mantik: secilen bolgede her piksel icin zaman boyunca alt yuzdelik (PCT) "taban" alinir; kare, tabanin +-TOL araligina sinirlanir.
Gecici parlamalar ve koyu halkalar (lekeler) kalkar, kalici icerik (esyalar) ve bolge disindaki canli isiklar (lamba, TV) degismez.

Kullanim: python -I tools/comfy/cleanBlobs.py girdi.mp4 cikti.mp4 [--region x0,y0,x1,y1]   (oranlar 0-1; varsayilan 0,0,0.62,0.68)
"""
import subprocess
import sys

import numpy as np

args = sys.argv[1:]
if len(args) < 2:
    sys.exit(__doc__)
src, dst = args[0], args[1]
region = (0.0, 0.0, 0.62, 0.68)
if "--region" in args:
    region = tuple(float(v) for v in args[args.index("--region") + 1].split(","))
PCT = 15  # taban: zaman boyunca bu alt yuzdelik (lekeler cogu zaman aciksa medyan onlari icerir)
TOL = 4  # tabanin ustunde/altinda izin verilen sapma (0-255)
FEATHER = 0.02  # bolge kenari yumusatma (oran)

probe = subprocess.run(
    ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate", "-of", "csv=p=0", src],
    capture_output=True, text=True, check=True,
).stdout.strip().split(",")
w, h = int(probe[0]), int(probe[1])
num, den = probe[2].split("/")
fps = float(num) / float(den)

raw = subprocess.run(
    ["ffmpeg", "-v", "error", "-i", src, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    capture_output=True, check=True,
).stdout
frames = np.frombuffer(raw, dtype=np.uint8).reshape(-1, h, w, 3)
n = frames.shape[0]
print(f"{n} kare, {w}x{h}, {fps:g} fps")

x0, y0, x1, y1 = (int(region[0] * w), int(region[1] * h), int(region[2] * w), int(region[3] * h))
reg = frames[:, y0:y1, x0:x1, :].astype(np.int16)
base = np.percentile(reg, PCT, axis=0).astype(np.int16)
clamped = np.clip(reg, base - TOL, base + TOL)

# yumusak kenarli maske (bolge ici 1, disi 0)
yy = np.arange(y1 - y0)[:, None]
xx = np.arange(x1 - x0)[None, :]
fx, fy = max(1, int(FEATHER * w)), max(1, int(FEATHER * h))
mask = np.minimum.reduce([
    np.clip(xx / fx, 0, 1) * np.ones_like(yy),
    np.clip((x1 - x0 - 1 - xx) / fx, 0, 1) * np.ones_like(yy),
    np.clip(yy / fy, 0, 1) * np.ones_like(xx),
    np.clip((y1 - y0 - 1 - yy) / fy, 0, 1) * np.ones_like(xx),
])[..., None]
# bolge goruntunun kenarina dayaliysa (x0=0 / y0=0) o kenarda yumusatma gerekmez
if x0 == 0:
    mask[:, :fx, :] = np.maximum(mask[:, :fx, :], 1.0)
if y0 == 0:
    mask[:fy, :, :] = np.maximum(mask[:fy, :, :], 1.0)

out = frames.copy()
blended = reg * (1 - mask) + clamped * mask
out[:, y0:y1, x0:x1, :] = np.clip(blended, 0, 255).astype(np.uint8)

enc = subprocess.Popen(
    ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", f"{fps:g}", "-i", "-",
     "-c:v", "libx264", "-crf", "12", "-preset", "slow", "-pix_fmt", "yuv420p", dst],
    stdin=subprocess.PIPE,
)
enc.communicate(out.tobytes())
if enc.returncode != 0:
    sys.exit("kodlama hatasi")
changed = float(np.mean(np.abs(out.astype(np.int16) - frames.astype(np.int16))))
print(f"{dst} hazir (ortalama degisim {changed:.2f}/255)")
