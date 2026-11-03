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

## 2000'ler (hazır, 19 Ekim 2026)
- Kompozisyon ortak: `EraIntro` (dönem etiketi, vurgu rengi ve klipler veriden gelir). Dönem tablosu `src/videoPrep.js` içinde `ERAS` (90s: amber, 2000s: camgöbeği `#4dd2ff`, PC hoparlör profili hp 200 / lp 7000 Hz, fare tıkı 2,4. sn).
- Sahne 1: bilgisayar başında oturan, sırtı dönük biri (parlak mavi CRT, iki stüdyo hoparlörü, CD'ler). Sahne 2: mavi/yeşil LED'li siyah masaüstü hoparlör-kule (hareket az; bas ile atma Remotion'da eklenir).
- Klipler: `video/assets/era2000-s1.mp4`, `era2000-s2.mp4`. Önizleme: `node --env-file=.env src/tiktokPreview.js preview --only era2000`.
- Not: sahne 2'nin taslağı (`annivbg_pc2_draft_51`) net bir bobinli hoparlör gösteriyordu, tam kalite hâli daha soyut çıktı. İstenirse farklı seed ile (örn. 52) yeniden üretilebilir (~15 dk).
- Canlı akışta **kapalı**: `ERA_INTROS=1` (tüm dönemler) ya da `ERA_INTROS=90s,2000s`.

## 2010'lar (hazır, 19 Ekim 2026)
- `ERAS['2010s']`: etiket "2010'LAR", pembe `#ff5fa2`, hoparlör profili hp 120 / lp 10000 Hz, S1_END 4.4 sn, telefon anı (şarkı girişi) 3.5. sn.
- Sahne 1: yatak kenarında oturan, sırtı dönük, ters şapkalı ve kapüşonlu biri (sarı led ışık zinciri, polaroidler, mor led şerit); sonunda telefonunu kaldırır. Sahne 2: pembe halkalı silindirik bluetooth hoparlör, yanında ekranı yanan telefon, altın/pembe bokeh.
- İlk sahne denemesi profilden çekimdi ve yüz görünüyordu (reddedildi); yeniden sırtı dönük olarak üretildi (`NEGATIVE_BACK` ile).
- Klipler: `video/assets/era2010-s1.mp4` (leke temizliği `cleanBlobs.py --region 0,0,0.6,0.28`), `era2010-s2.mp4`. Önizleme: `node --env-file=.env src/tiktokPreview.js preview --only era2010`.

## 80'ler (hazır, 19 Ekim 2026)
- `ERAS['80s']`: vurgu kırmızı-turuncu `#ff5a36`, plak profili hp 60 / lp 12000 Hz, plak cızırtısı (`crackle`), S1_END 4.8 sn, şarkı girişi 2.2. sn. Dönem etiketi artık gösterilmiyor (yalnızca "KAÇ YIL OLDU?" kancası).
- Sahne 1: yerde bağdaş kurmuş, sırtı dönük, kıvırcık saçlı, petrol yeşili ceketli biri pikabın başında (ahşap panel, turuncu abajur). İlk deneme (kamburlaşmış poz, ceket sırtında logo karalaması) reddedildi; `vinyl1b` istemi (geniş kadraj, sade ceket, `NEGATIVE_BACK` + logo engeli) ile yeniden üretildi.
- Sahne 2: dönen, turuncu etiketli plak ve pikap (soluk benek artefaktları `cleanBlobs.py --region 0,0,1,0.3` ile temizlendi).
- Klipler: `video/assets/era80-s1.mp4`, `era80-s2.mp4`. Önizleme: `node --env-file=.env src/tiktokPreview.js preview --only era80`.
- Canlıya açmak: `ERA_INTROS=80s,90s,2000s,2010s` (ya da `1`).

## Canlıya alındı (20 Ekim 2026)
- Dönem girişleri **varsayılan açık** (`ERA_INTROS` yoksa = açık). Yıl eşlemesi: 1979 ve öncesi → 80'ler, 1980-89 → 80'ler, 90'lar, 2000'ler, 2010-19 ve 2020 sonrası → 2010'lar.
- TikTok'ta `isAiGenerated` etiketi bu videolarda (ve oda arka planlı yıl dönümü videolarında) otomatik açık (`TIKTOK_AI_LABEL=0` ile kapanır). Buffer bunu yalnızca video gönderilerinde kabul eder, foto gönderilerinde hata verir.
- X'e hâlâ kare oynatıcı gidiyor; dikey dönem videosunu X'e koymak ayrı karar.
- **X'e de dönem videosu** (20 Ekim 2026): yıl dönümü tweet'i artık TikTok'taki dikey dönem videosuyla gider; `X_ERA_VIDEO=0` eski kare oynatıcıyı geri getirir. X'te de `isAiGenerated` etiketi açık (`X_AI_LABEL=0` ile kapanır).

## Alternatif girişler: son 10 yıl ve 2006-2016 (2 Kasım 2026)
Esas dönem girişlerinin yanında üç **alternatif** giriş eklendi. İlgili yıl penceresinde şarkıya göre (sanatçı|şarkı karması, aynı şarkı hep aynı girişi alır) esas girişle **eşit dönüşümlü** kullanılır.

| Kimlik | Klipler | Pencere | Sahneler | Vurgu |
|---|---|---|---|---|
| `2020s` | `era2020-s1/s2.mp4` | son 10 yıl (`yıl >= bu yıl - 10`) | Gece masa başı: sırtı dönük, kulaklıklı biri, ultrawide ekran, RGB şeritler (sahne 1); kulaklık kutusu açılır, neon bokeh (sahne 2) | menekşe `#8f6bff` |
| `2020sb` | `era2020b-s1/s2.mp4` | son 10 yıl | Gece arabanın içinden: ıslak cam, şehir bokeh'i, torpidoda parlayan telefon (sahne 1); ışık halkalı akıllı hoparlör bas ile atar (sahne 2) | nane `#2ee6a6` |
| `memory` | `era2006-s1/s2.mp4` | 2006-2016 | "Hatıra odası": gece yatak odası, komodinde MP3 çalar, dolaşık kulaklık, CD ve telefon (sahne 1); ekolayzer çubukları oynayan MP3 çalar ve beyaz kulaklıklar (sahne 2) | LCD yeşili `#c6ff3d` |

- **Seçim:** `eraClipsFor(yıl, tohum)` (`src/videoPrep.js`). Pencerede olan alternatifler + esas giriş eşit olasılıkla seçilir (örn. 2016: 2010'lar, 2020s, 2020sb, memory; 2006-2009: 2000'ler + memory; 2010-2015: 2010'lar + memory; 2017+: 2010'lar + 2020s + 2020sb). Alternatif klipleri yoksa esas giriş kullanılır (davranış değişmez).
- **Anahtarlar:** `ERA_RECENT=0` alternatifleri kapatır (yalnızca esas girişler), `ERA_RECENT=only` yalnızca alternatifleri kullanır, `ERA_RECENT=<kimlik>` (`2020s`, `2020sb`, `memory`) belirli girişi zorlar (önizleme için). `ERA_INTROS=90s,2000s,2020sb` gibi alt küme listesinde alternatif kimlikleri de yazılabilir.
- **`s2Sync`:** `EraIntro.tsx` içinde 2. sahne klibi normalde kompozisyon saatiyle akar (hoparlör gibi hareketsiz sahneler için sorun değil). Alternatiflerde `s2Sync: true`: klip, görünmeye başladığı anda **başından** oynar (kapak açılışı, ekolayzer gibi hareketli sahneler görünsün diye). Esas dönemler etkilenmez.
- **Önizleme:** `node --env-file=.env src/tiktokPreview.js preview --only era-son10` (2020s), `era-son10b` (2020sb), `era-hatira` (memory).
- **Üretim notları (ComfyUI, Wan 2.2 5B):**
  - Final çözünürlükte (704x1280) kompozisyon taslaktan (480x864) farklı çıkar ve geniş kadraja gider; sıkı kadraj için isteme "extreme macro, fills the frame" gibi güçlü ifadeler gerekir (`drawer2b`).
  - Lekeler `tools/comfy/cleanBlobs.py` ile temizlenir. Yeni `--pct` / `--tol` parametreleri daha sıkı temizlik içindir. Bölge, çevresindeki sabit içeriği (ön cam gibi) kesmemelidir; aksi halde dikdörtgen "dikiş" görünür.
  - Gamma yükseltmek gizli leke/halka izlerini görünür kılar; klip hazırlanınca gamma yükseltilmiş hâliyle de kontrol edin.
  - Stiller (`tools/comfy/bgGen.mjs`): `stream1`, `stream2`, `stream2b` (2020s/2020sb), `drive1`, `drawer1`, `drawer2`, `drawer2b`. Kullanılan tohumlar: 2020s 203/202, 2020sb 302/311, memory 402/421. Kırpma, gamma ve temizlik ayarları: s1 2020s `--region 0.08,0.4,0.95,0.95 --pct 8 --tol 1` + `--crop 0.1,0.2,0.8,0.8 --gamma 1.3`; 2020sb `--region 0.58,0.525,0.96,0.62 --pct 5 --tol 1` + `--crop 0.1,0.08,0.8,0.8`; memory s1 `--region 0,0,0.42,0.5` ve `--region 0.02,0.8,0.62,1.0` + `--crop 0,0.08,0.92,0.92 --gamma 1.15`; memory s2 `--crop 0.1,0.28,0.7,0.7`.
- **bgGen:** `--rest 0` iken yalnızca sıcaklığa bakılır (masaüstü yüzünden GPU boştayken bile %15-20 kullanım görünür ve eski koşul hiç sağlanmazdı).
