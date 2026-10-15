# Yeni Şarkılarım botu

Türk sanatçıların Spotify çıkışlarını, listelerini ve trendlerini X (Buffer) ve TikTok'a otomatik paylaşır.
Her şey GitHub Actions üzerinde çalışır (bilgisayar açık olmak zorunda değil).

## Ne zaman ne paylaşılır

| Olay | X | TikTok videosu (Remotion şablonu) |
|---|---|---|
| Yeni şarkı/albüm (3 saatte bir) | resimli tweet | **NewRelease**: "yükleniyor → DROP" |
| Yıl dönümü | resimli tweet | **Anniversary**: VHS geri sarma, "kaç yıl oldu" |
| Sırada +10 ve üstü yükseliş | tweet | **RankRise**: sıralama yarışı |
| İlk kez Top 10 / stream rekoru / dünya listesine giriş | tweet | **NewRelease** (özel metinlerle) |
| Günlük / haftalık Türkiye Top 5 | kolajlı tweet | **TopBoard**: kalkış tablosu |
| Pazar gecesi haftalık özet | thread | **TopBoard** (haftanın yeni şarkıları) |
| Dünya günlük Top 5 | kolajlı tweet | kapalı (açmak için `TIKTOK_GLOBAL=1`) |

Aynı video hem **X'e** (tweetin medyası olarak) hem **TikTok'a** gider. X'te video tweet'i Buffer'da hata verirse
otomatik olarak eski görselli tweet'e düşülür. Günlük/haftalık Top 5'te ana tweet video, kolaj yanıt olarak eklenir;
haftalık özet thread'inin ilk tweeti videodur.

Trend olayları için çalıştırma başına en fazla 1 video üretilir (X ve TikTok ortak).

## Klasörler

- `src/` bot kodu. `videoPrep.js` (veri + ses), `remotionRender.js` (render), `tiktokVideo.js` (karar + paylaşım).
- `src/videoEngine.js` Remotion çalışmazsa devreye giren yedek video motoru.
- `video/` Remotion projesi (4 şablon: `TopBoard`, `NewRelease`, `RankRise`, `Anniversary`).
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

## Önizleme

Actions → **TikTok preview** → Run workflow. Hiçbir yere paylaşım yapmaz; bütün şablonların örnek videolarını
artifact olarak yükler.

## Yerelde render

```bash
cd video && npm ci
cd .. && node --env-file=.env src/tiktokPreview.js preview --only new,anniv,rise,board,digest
```
