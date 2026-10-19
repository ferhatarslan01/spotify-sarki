# Dönem girişi: 90'lar ("kaç yıl oldu" öncesi sahne)

Fikir: çıkış yılına göre farklı bir **giriş sahnesi**, ardından mevcut "KAÇ YIL OLDU?" videosu. İlk dönem: 90'lar (1990-1999).
Oda arka planı (`video/assets/anniv-bg.mp4`) ana videoda olduğu gibi kalır.

## Sahneler (her biri ComfyUI + Wan 2.2 5B, ~5 sn, dikey)

| # | Sahne | Görüntü | Ses |
|---|---|---|---|
| 1 | **Radyo ve o** | 90'lar giyimli biri (iri yıkama kot ceket, bol pantolon, ters şapka) yerde, sırtı kameraya dönük, önünde kaset çalarlı radyo; yavaş yakınlaşma. Elini uzatıp ses düğmesini çeviriyor. | Oda sessizliği, hafif cızırtı; düğme tıkı; şarkı radyo filtresiyle (dar bant) kısık başlar |
| 2 | **Düğme / kadran** | Radyonun turuncu ışıklı kadranı ve düğmesi (yakın plan), ibre frekansta kayıyor, hoparlör titriyor. | Frekans tarama cızırtısı, şarkı yükselir |
| 3 | **Geçiş** | Kadran ışığı eriyerek mevcut "KAÇ YIL OLDU?" videosunun CRT ekranına dönüşür. | Şarkı radyo filtresinden tam banda açılır, VHS geri sarma sesi |

Ses planı: şarkının 30 sn'lik önizlemesi; giriş boyunca `lowpass 3400 / highpass 300` (radyo sesi) ve hacim 0,15 → 1,0 yükselir; ana videonun
başında filtre tam banda açılır. Mevcut `Anniversary` kompozisyonu `Sequence` içine alınarak girişin arkasına eklenecek (kendi kare sayacı sıfırdan başlar).

## Not
- Gerçekçi insan içerdiği için TikTok'ta **"AI ile üretildi" işareti** açık olmalı. Kişi sırtı dönük/yarı silüet çekildiği için yüz ve el bozulma riski düşük tutuldu.
- Her sahne bu PC'de ~15 dk (704x1280). Sahneler arasında GPU 60 °C altına inene kadar beklenir (`bgGen.mjs --cool`).
- Diğer dönemler (2000'ler, 2010'lar) aynı kalıpla: `video/assets/intro-<dönem>-*.mp4`.

## Durum (19 Ekim 2026)
- Sahne 1 (radyo başında oturan) ve Sahne 2 (hoparlör) ComfyUI ile 704x1280 üretildi; `video/assets/era90-s1.mp4`, `era90-s2.mp4`.
- `Era90s` kompozisyonu: 8 sn giriş (etiket "90'LAR", yükselen VOL çubuğu, bas ile atan hoparlör, radyo filtreli şarkı) + beyaz parlama + mevcut "KAÇ YIL OLDU?".
- Canlı akışta **kapalı**: `ERA_INTROS=1` ile açılır (onaydan sonra). Önizleme: `node --env-file=.env src/tiktokPreview.js preview --only era90`.
- Ses notu: yerel ffmpeg 8.1'de `apad` sonrası `atrim` sesi erken kesiyordu; tüm müzik hazırlayıcılarda `-t` ile değiştirildi.

## 2000'ler (devam ediyor, 19 Ekim 2026'da yarıda bırakıldı)
- Kompozisyon artık ortak: `EraIntro` (dönem etiketi, vurgu rengi ve klipler veriden gelir). Dönem tablosu `src/videoPrep.js` içinde `ERAS` (90s: amber, 2000s: camgöbeği `#4dd2ff`).
- Sahne fikri: **1.** bilgisayar başında oturan sırtı dönük biri (CRT monitör, masaüstü hoparlör, CD'ler), **2.** masaüstü hoparlör yakın planı (bas ile atar).
- Taslaklar tamam ve iyi: `tools/comfy/out/annivbg_pc1_draft_41_*.mp4`, `annivbg_pc2_draft_51_*.mp4`.
- Tam kalite: **sahne 1 hazır** (`tools/comfy/out/annivbg_pc1_tiled_41_00001_.mp4`, henüz kareleri incelenmedi), **sahne 2 henüz üretilmedi**.
- Kalan adımlar:
  1. ComfyUI'yi başlat (`D:\ComfyUI\ComfyUI_windows_portable`, `--disable-pinned-memory`), GPU < 50 °C iken `node tools/comfy/bgGen.mjs pc2 --seed 51 --tiled` (~15 dk).
  2. Klipleri hazırla: `node tools/comfy/makeEraClip.mjs <pc1.mp4> video/assets/era2000-s1.mp4 --dur 5` ve `<pc2.mp4> video/assets/era2000-s2.mp4 --dur 3.2` (gerekirse `--gamma`).
  3. Dokunma anı: `ERAS['2000s'].KNOB` değerini sahne 1'deki fare tıklama anına göre ayarla.
  4. Önizleme: `node --env-file=.env src/tiktokPreview.js preview --only era2000`.
