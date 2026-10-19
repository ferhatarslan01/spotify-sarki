# Yeni Şarkılarım botu

Türk sanatçıların Spotify çıkışlarını, listelerini ve trendlerini X (Buffer) ve TikTok'a otomatik paylaşır.
Her şey GitHub Actions üzerinde çalışır (bilgisayar açık olmak zorunda değil).

## Ne zaman ne paylaşılır

TikTok'a **dikey** (1080×1920) sahne videoları, X'e **kare** (1080×1080) "kapak + oynatıcı" videoları gider.

| Olay | X | TikTok (Remotion şablonu) |
|---|---|---|
| Yeni şarkı/albüm (3 saatte bir) | kare oynatıcı videosu | **NewRelease**: "yükleniyor → DROP" |
| Yıl dönümü | kare oynatıcı videosu | **Anniversary**: VHS geri sarma |
| Sırada +10 ve üstü yükseliş | kare oynatıcı videosu | **RankRise**: sıralama yarışı |
| İlk kez Top 10 / stream rekoru / dünya listesi | kare oynatıcı videosu | **NewRelease** (özel metinlerle) |
| Günlük / haftalık Türkiye Top 5 | **5 tweetlik thread**: her şarkı kendi kare videosu | **TopBoard**: kalkış tablosu |
| Pazar gecesi haftalık özet | thread (ilk tweet video) | **TopBoard** (haftanın yeni şarkıları) |
| **Düello** (her gün 20:00 TRT) | dikey video + ilk yanıtta 2 Spotify linki; cevap metinde yazılmaz, yalnızca videoda açıklanır | **Duel**: iki şarkı, "hangisi daha çok dinlendi?" tahmini, sonuç anı |
| Dünya günlük Top 5 | 5 tweetlik thread | kapalı (açmak için `TIKTOK_GLOBAL=1`) |

- **Kare oynatıcı** (`CoverPlayer`): kapak tüm karede, üstte "ŞİMDİ ÇALIYOR", altta şarkı/sanatçı, ilerleme çubuğu ve
  oynatıcı düğmeleri; şarkının en enerjili 20 saniyesi çalar.
- **Top 5 thread'i**: ilk tweet liste metnini + 1. şarkının videosunu taşır; 2-5. şarkılar yanıt olarak gelir.
- X'te video tweet'i Buffer'da hata verirse otomatik olarak eski görselli tweet'e düşülür.
- Trend olayları için çalıştırma başına en fazla 1 video üretilir.
- **Spotify linki X'te ilk yanıtta:** Ana tweet'teki dış link erişimi düşürdüğü için tekli paylaşımlarda (yeni şarkı, yıl dönümü, trend olayları)
  link ana tweet'ten çıkarılıp "🎧 Spotify'da dinle:" yanıtına konur (thread olarak). Top 5 thread'inde zaten her şarkının linki yanıttadır.
- **Tek harfli soru:** Her paylaşımın sonunda "E / H yaz 👇", "Puanın kaç? 1-10 yaz 👇" gibi kolay cevaplanan bir soru olur (`src/cta.js`).
  Top 5 / haftalık liste tweetinde yer kalmadığı için soru thread'in son tweetinde sorulur; TikTok açıklamasında liste altındadır.
- **TikTok hacmi:** Son 24 saatte en fazla 3 TikTok gönderisi (trend olayları için en fazla 2; yeni şarkı ve liste için yer kalsın diye).
  Sayı Buffer'dan okunur; sınıra gelince o olay yalnızca X'e gider. Hashtag sayısı gönderi başına 5.
- **Sanatçı etiketleme (X):** Tüm X paylaşımlarında sanatçı adının yanına `(@hesap)` eklenir: yeni şarkı, yıl dönümü, trend olayları (en fazla 2 kişi), liste ve haftalık özet (280 karaktere sığdığı kadar, sırayla). Takip edilen sanatçıların hesapları
  `src/artistHandles.js` içinde elle doğrulanmış listede; liste dışı sanatçılar (liste girdileri) MusicBrainz + Wikidata ile çapraz kontrol
  edilerek bulunur, emin olunamazsa etiket eklenmez. TikTok açıklamalarına etiket eklenmez.

## ComfyUI ile üretilen arka plan (tek seferlik, yerelde)

Yıl dönümü videosunun arka planı (`video/assets/anniv-bg.mp4`, 4 sn'lik kusursuz döngü) bu PC'deki ComfyUI + Wan 2.2 5B ile **bir kez** üretildi;
bulutta GPU gerekmez. Yeniden üretmek için (ComfyUI'yi `D:\ComfyUI\ComfyUI_windows_portable` içinde `--disable-pinned-memory` ile başlat):

```bash
node tools/comfy/bgGen.mjs room --seed 7 --tiled        # 704x1280, ~15 dk (8 GB VRAM için parçalı VAE şart)
python -I tools/comfy/cleanBlobs.py girdi.mp4 temiz.mp4  # yanıp sönen leke artefaktlarını temizler
node tools/comfy/makeLoop.mjs temiz.mp4 video/assets/anniv-bg.mp4
```

Dosya yoksa şablon eski (ızgara) arka planla çalışır.

## Klasörler

- `src/` bot kodu. `videoPrep.js` (veri + ses), `remotionRender.js` (render), `tiktokVideo.js` (karar + paylaşım).
- `src/videoEngine.js` Remotion çalışmazsa devreye giren yedek video motoru.
- `video/` Remotion projesi (5 şablon: `TopBoard`, `NewRelease`, `RankRise`, `Anniversary`, `CoverPlayer`).
- `data/` botun durum dosyaları (workflow'lar commit eder).

## Anahtarlar (ortam değişkenleri / GitHub secrets)

`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `BUFFER_API_KEY`, `BUFFER_CHANNEL_ID` (X), `BUFFER_TIKTOK_CHANNEL_ID`.

## Anahtarlar (davranış)

- `data/TIKTOK_PAUSED` dosyası varsa TikTok gönderisi duraklar (dosyayı silince devam eder).
- `TIKTOK_VIDEO=0` hareketli video yerine sadece foto kart (X: görselli tweet).
- `X_VIDEO=0` X'e video göndermez (TikTok etkilenmez).
- `TIKTOK_REMOTION=0` Remotion yerine yedek (Node) video motoru.
- `TIKTOK_HASHTAGS=0` hashtag eklemeyi kapatır.
- `TIKTOK_GLOBAL=1` dünya günlük listesi videosunu açar.
- `X_TAGS=0` X tweetlerinde sanatçı etiketlemeyi (@hesap) kapatır.
- `X_LINK_REPLY=0` Spotify linkini ana tweet'te bırakır (yanıta taşımaz).
- `CTA_QUESTIONS=0` paylaşımlara soru eklemeyi kapatır.
- `TIKTOK_DAILY_MAX=N` son 24 saatteki TikTok sınırı (varsayılan 3, `0` = sınırsız).

## Önizleme

Actions → **TikTok preview** → Run workflow. Hiçbir yere paylaşım yapmaz; bütün şablonların örnek videolarını
artifact olarak yükler.

## Yerelde render

```bash
cd video && npm ci
cd .. && node --env-file=.env src/tiktokPreview.js preview --only new,anniv,rise,board,digest
```
