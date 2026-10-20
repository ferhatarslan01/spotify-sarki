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
