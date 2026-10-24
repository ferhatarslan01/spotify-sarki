# Yeni Şarkılarım botu

Türk sanatçıların Spotify çıkışlarını, listelerini ve trendlerini X (Buffer) ve TikTok'a otomatik paylaşır.
Her şey GitHub Actions üzerinde çalışır (bilgisayar açık olmak zorunda değil).

## Ne zaman ne paylaşılır

TikTok'a **dikey** (1080×1920) sahne videoları, X'e **kare** (1080×1080) "kapak + oynatıcı" videoları gider.

| Olay | X | TikTok (Remotion şablonu) |
|---|---|---|
| Yeni şarkı/albüm (3 saatte bir) | kare oynatıcı videosu | **NewRelease** ailesi: 9 şablon (aşağıda), şarkıya göre dönüşümlü |
| Yıl dönümü | kare oynatıcı videosu | **Anniversary**: VHS geri sarma |
| Sırada +10 ve üstü yükseliş | kare oynatıcı videosu | **RankRise** ailesi: 7 şablon (aşağıda), sıralı döngü |
| İlk kez Top 10 / stream rekoru / dünya listesi | kare oynatıcı videosu | **NewRelease** (özel metinlerle) |
| Haftalık Türkiye Top 5 (günlük paylaşım kapalı) | **5 tweetlik thread**: her şarkı kendi kare videosu | **TopBoard**: kalkış tablosu |
| Pazar gecesi haftalık özet | thread (ilk tweet video) | **TopBoard** (haftanın yeni şarkıları) |
| **Düello** (her gün 20:00 TRT) | dikey video + ilk yanıtta 2 Spotify linki; cevap metinde yazılmaz, yalnızca videoda açıklanır | **Duel**: iki şarkı, "hangisi daha çok dinlendi?" tahmini, sonuç anı |
| Dünya günlük Top 5 | 5 tweetlik thread | kapalı (açmak için `TIKTOK_GLOBAL=1`) |

- **Kare oynatıcı** (`CoverPlayer`): kapak tüm karede, üstte "ŞİMDİ ÇALIYOR", altta şarkı/sanatçı, ilerleme çubuğu ve
  oynatıcı düğmeleri; şarkının en enerjili 20 saniyesi çalar.
- **Top 5 thread'i**: ilk tweet liste metnini + 1. şarkının videosunu taşır; 2-5. şarkılar yanıt olarak gelir.
- X'te video tweet'i Buffer'da hata verirse otomatik olarak eski görselli tweet'e düşülür.
- **X'te her gönderi video olur:** Trend olayları dahil her tweet için kare oynatıcı videosu üretilir. TikTok videosu ise çalıştırma başına en fazla 1 trend olayı için (ve günlük 3 sınırı içinde) üretilir; sınır dolunca olay yine X'e videolu gider.
- **Önizleme (ses) bulma:** Deezer parça → iTunes parça → Deezer düz arama → parantez/" - Live" ekleri temizlenmiş ad → albümün ilk parçası (iTunes/Deezer). Hiçbir kaynakta ses yoksa X'e foto yerine **sessiz kapak videosu** (8 sn, "SPOTIFY'DA DİNLE" etiketi, oynatıcı çubuğu yok) gider; TikTok'a ses olmadan video gönderilmez.
- **Spotify linki X'te ilk yanıtta:** Ana tweet'teki dış link erişimi düşürdüğü için tekli paylaşımlarda (yeni şarkı, yıl dönümü, trend olayları)
  link ana tweet'ten çıkarılıp "🎧 Spotify'da dinle:" yanıtına konur (thread olarak). Top 5 thread'inde zaten her şarkının linki yanıttadır.
- **Kolay cevaplanan soru:** Her paylaşımın sonunda "Hit olur mu? 👇", "Puanın kaç? 👇" gibi kısa bir soru olur; "yaz" gibi komut eklenmez (`src/cta.js`).
  Top 5 / haftalık liste tweetinde yer kalmadığı için soru thread'in son tweetinde sorulur; TikTok açıklamasında liste altındadır.
- **TikTok hacmi:** Son 24 saatte en fazla 8 TikTok gönderisi (TikTok'un resmi limiti ~15, Buffer'ın 25; trend olayları en fazla 4 slot kullanır, geri kalanı Top 5, düello, yeni şarkı ve yıl dönümü için ayrılır).
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

## Yıl dönümü videosu: dönem girişleri (canlı, 20 Ekim 2026)

TikTok'taki **yıl dönümü** videosu, şarkının çıkış yılına göre 8 sn'lik bir giriş sahnesiyle başlar (ComfyUI ile üretilmiş 2 sahne + radyo/cihaz sesinden yükselen şarkı), ardından "KAÇ YIL OLDU?" gelir:

| Çıkış yılı | Giriş | Vurgu |
|---|---|---|
| 1979 ve öncesi, 1980-89 | plak / pikap | kırmızı-turuncu |
| 1990-99 | radyo | amber |
| 2000-09 | bilgisayar | camgöbeği |
| 2010-19, 2020 ve sonrası | telefon + bluetooth hoparlör | pembe |

- Varsayılan **açık**; kapatmak için `ERA_INTROS=0`, yalnızca bazı dönemler için `ERA_INTROS=90s,2000s`.
- **X'e de aynı dikey (9:16) dönem videosu gider** (TikTok'la aynı video, tek kez barındırılır; TikTok günlük sınırı dolsa bile X videoyu alır). Eski kare oynatıcıya dönmek için `X_ERA_VIDEO=0`.
- Bu videolarda yapay zekâ görüntüsü olduğu için **"AI ile üretildi" etiketi otomatik açılır**: TikTok (`isAiGenerated`, yalnızca video gönderilerinde) ve X (`isAiGenerated`). Kapatmak için `TIKTOK_AI_LABEL=0` / `X_AI_LABEL=0`.
- Giriş klipleri `video/assets/era*.mp4`, üretim/araçlar `tools/comfy/`, ayrıntı `docs/DONEM_GIRISI_90LAR.md`.
- Bulutta render hata verirse video otomatik olarak yedek (Node) motora düşer, paylaşım durmaz.

## Yeni çıktı şablonları (9'lu aile)

Gerçek yeni şarkı/albüm için TikTok videosu 9 şablondan birini alır. Seçim **sıralı döngü**: en uzun süredir kullanılmayan şablon seçilir (hiç kullanılmayanlar önce), bir önceki şablon tekrar edilmez; 9'u da çıkmadan hiçbiri ikinci kez gelmez. Bir şarkı bir kez atandıysa aynı şablonu korur. Durum `data/nrTemplateState.json` içinde tutulur (release-check workflow'u commit eder; kod `src/nrTemplateState.js`).

| Şablon | Konsept | Arka plan |
|---|---|---|
| `drop` | "yükleniyor → DROP" (ilk şablon) | yok |
| `fragman` | Sinema fragmanı: BU HAFTA / YENİ BİR ŞARKI / SANATÇI vuruşları, flaş, afiş | ComfyUI (projektör) |
| `bulten` | Müzik Bülteni: "SON DAKİKA", alt bant, kayan yazı | ComfyUI (yayın stüdyosu) |
| `kilit` | Kilit ekranı bildirimi → oynatıcı | yok (kapaktan türer) |
| `neon` | Neon tüpler, harf harf yanan sanatçı adı, neon çerçeveli kapak | ComfyUI (dumanlı sahne) |
| `kaset` | Kalemle yazılan kaset etiketi, PLAY, dönen makaralar, VU ibreleri | ComfyUI (sıcak masa) |
| `tahmin` | "Bu şarkıyı tanıdın mı?": şarkı baştan çalar, bulanık kapak netleşir, harf ipuçları + geri sayım, cevap sonda | yok |
| `radyo` | Frekans arama: parazit içinde bantlı ses, sinyal oturunca kapak açılır ve ses berraklaşır | yok |
| `mesaj` | Sohbet: "yazıyor…" noktaları, mesajlar, Spotify link kartı, "Hemen açıyorum" → şarkı | yok |

- Kapatmak için `NR_VARIANTS=0` (hep `drop`); havuzu kısıtlamak için `NR_ONLY=fragman,kaset` gibi.
- Şablon hazırlanamazsa otomatik `drop`'a, o da olmazsa yedek Node motoruna düşer.
- ComfyUI arka planı olan şablonlarda **"AI ile üretildi" etiketi** otomatik açılır (`kilit`, `tahmin`, `radyo`, `mesaj` ve `drop`'ta açılmaz).
- X'e yeni şablonlar gitmez: X kare "kapak + oynatıcı" videosunu alır.
- Önizleme: `node --env-file=.env src/tiktokPreview.js preview --only nr-fragman,nr-bulten,nr-kilit,nr-neon,nr-kaset,nr-tahmin,nr-radyo,nr-mesaj` (hepsi: `--only nr`) (çıktı `preview/yeni-*.mp4`).
- Kod: `video/src/NR*.tsx`, ses/seçici `src/videoPrep.js` (`NR_TEMPLATES`), arka plan döngüleri `video/assets/nr-*-bg.mp4`, ComfyUI sahneleri `tools/comfy/bgGen.mjs`.

## Yükselen şarkı şablonları

"Sıra atladı" olayında (günlük listede +10 ve üstü yükseliş) TikTok videosu aşağıdaki şablonlardan birini alır. Seçim yeni çıktı ailesindeki gibi **sıralı döngü**dür
(en uzun süredir kullanılmayan şablon, art arda tekrar yok; durum `data/riseTemplateState.json`, `chart-trends` workflow'u commit eder).

| Şablon | Konsept |
|---|---|
| `rise` | Sıra merdiveni (ilk şablon): kart listede komşuları geçerek yükselir |
| `terminal` | Piyasa raporu: finans terminali, ticker kodu, dün → bugün sıra grafiği, istatistik kartları, kayan komşu bandı |
| `yayin` | Canlı yayın: TV/spor grafiği, dönen sıra göstergesi (DÜN → BUGÜN), "+N SIRA" slam'i, alt bant |
| `kart` | Dergi kartı: düz renk blokları, dev tipografi, kart geçişleri, zirve ilerleme çubuğu |
| `roket` | Görev kontrol: sıra = irtifa; geri sayım, kalkış, akan irtifa cetveli, kapak "yük" olarak, "yörüngeye X sıra kaldı" |
| `transfer` | Transfer haberi: SON DAKİKA → sözleşme + imza → RESMEN damgası + konfeti → forma (numara = yeni sıra) ve oyuncu kartı |
| `radar` | Hız radarı: sınır 10 sıra/gün, kapak yaklaşır, radar okuması +N, flaş, ceza makbuzu (aşım = N/10) |

- Tüm rakamlar gerçek: dün/bugün sırası, günlük + toplam stream, zirveye kalan sıra, listedeki komşular. Grafikteki eğri yalnızca iki gerçek nokta arasındaki görsel geçiştir.
- Kapatmak için `RISE_VARIANTS=0` (hep `rise`); havuzu kısıtlamak için `RISE_ONLY=terminal,roket`.
- Şablon hazırlanamazsa otomatik klasik `rise`'a, o da olmazsa yedek Node motoruna düşer. AI etiketi gerekmez (ComfyUI yok).
- X'e kare "kapak + oynatıcı" videosu gitmeye devam eder.
- Önizleme: `node --env-file=.env src/tiktokPreview.js preview --only rv` (ya da `rv-terminal`, `rv-yayin`, `rv-kart`, `rv-roket`, `rv-transfer`, `rv-radar`); çıktı `preview/yukselis-*.mp4`.
- Kod: `video/src/Rise*.tsx`, veri + ses `src/videoPrep.js` (`RISE_TEMPLATES`, `prepRiseVariant`).

## Haftalık liste şablonları

Türkiye haftalık listesinin TikTok videosu (`weekly-tr`) üç şablondan birini alır; seçim diğer ailelerdeki gibi **sıralı döngü**dür (haftada bir paylaşım, durum `data/weeklyTemplateState.json`, `weekly-chart` workflow'u commit eder).

| Şablon | Konsept |
|---|---|
| `board` | Klasik Top 5 "kalkış tablosu" (ilk şablon) |
| `countdown` | Hit listesi geri sayımı: 10 → 1; üstte o anki şarkı (geçen haftaya göre sıra değişimi, kaçıncı hafta, haftalık dinlenme), altta liste aşağıdan yukarı dolar, #1 final sahnesi |
| `rapor` | Haftanın raporu (story formatı): haftanın zirvesi (2.'ye oranı), en çok yükselen, en yüksek yeni giriş, listenin kıdemlisi, Top 5 özeti |

- Veri kworb haftalık listesinden: `weekChange` (geçen haftaya göre sıra, `NEW` dahil), `weeks`, `peak`/`peakTimes`, `streams`, `streamsChange`, `totalStreams` (`src/weeklyChart.js`). Rapor kartları bu veriden türetilir; olmayan kart (örn. yeni giriş yoksa) atlanır. Tüm rakamlar gerçektir.
- Müzik: haftanın 1 numaralı şarkısının önizlemesi (bulunamazsa sessiz, yalnızca efektler).
- Kapatmak için `WEEKLY_VARIANTS=0` (hep `board`); havuzu kısıtlamak için `WEEKLY_ONLY=rapor,countdown`. Şablon hazırlanamazsa otomatik klasik TopBoard'a, o da olmazsa yedek motora düşer.
- X tarafı değişmez (5 tweetlik kare video thread'i).
- Önizleme: `node --env-file=.env src/tiktokPreview.js preview --only wk` (ya da `wk-countdown`, `wk-rapor`); çıktı `preview/haftalik-*.mp4`.
- Kod: `video/src/Weekly*.tsx`, veri + ses `src/videoPrep.js` (`WEEKLY_TEMPLATES`, `weeklyCards`, `prepWeeklyVariant`).

## Günlük Top 5 şablonları

> **Günlük Türkiye Top 5 paylaşımı şu an KAPALI** (yalnızca haftalık liste paylaşılır). `daily-chart.yml` içindeki `schedule` zamanlaması kaldırıldı; elle çalıştırma açık. Yeniden açmak için workflow dosyasındaki yorum satırlarındaki `schedule` bloğunu geri ekle. Aşağıdaki şablonlar hazır bekliyor.

Türkiye günlük listesinin TikTok videosu (`daily-tr`) dört şablondan birini alır; seçim diğer ailelerdeki gibi **sıralı döngü**dür (günde bir paylaşım, durum `data/dailyTemplateState.json`, `daily-chart` workflow'u commit eder).

| Şablon | Konsept |
|---|---|
| `board` | Klasik Top 5 "kalkış tablosu" (ilk şablon) |
| `podyum` | Podyum: 5 → 1 basamaklar yükselir, kapaklar tepeye konar; #1'de spot ışığı, taç ve konfeti |
| `gazete` | Gazete: günün ilk sayfası dönerek gelir; #1 manşet ("Rakamlarla zirve" kutusu), 2-5 sütun haberleri |
| `galeri` | Galeri: müze sergisi; kamera duvar boyunca 5'ten 1'e kayar, kapaklar altın çerçevede, her eserin müze etiketi |

- Veri kworb günlük listesinden: `dayChange` (`=` dahil), `days` (listede kaç gün), `peak`/`peakTimes`, `streamsChange` (dünden fark), `weekStreams`, `totalStreams` (`src/dailyChart.js`). Başlık ve etiket metinleri bu veriden türetilir; tüm rakamlar gerçektir.
- Müzik: her şarkı kendi gösterim anında kendi önizleme hook'uyla çalar (önizlemesi bulunamayan şarkıda yedek olarak başka bir şarkı kullanılır).
- Kapatmak için `DAILY_VARIANTS=0` (hep `board`); havuzu kısıtlamak için `DAILY_ONLY=podyum,gazete`. Şablon hazırlanamazsa otomatik klasik TopBoard'a, o da olmazsa yedek motora düşer.
- X tarafı değişmez (5 tweetlik kare video thread'i). Yalnızca `daily-tr` etkilenir; dünya günlük listesi klasik kalır.
- Önizleme: `node --env-file=.env src/tiktokPreview.js preview --only dy` (ya da `dy-podyum`, `dy-gazete`, `dy-galeri`); çıktı `preview/gunluk-*.mp4`.
- Kod: `video/src/Daily*.tsx`, veri + ses `src/videoPrep.js` (`DAILY_TEMPLATES`, `prepDailyVariant`, `buildSequenceMusic`).

## Paylaşım penceresi (Türkiye saati)

Tüm saatler **Türkiye saatiyle** (Europe/Istanbul, UTC+3) hesaplanır; kullanıcının ya da makinenin yerel saati (ör. ABD) hiçbir yerde kullanılmaz.
**Varsayılan pencere 09:00-23:30 TRT.** Bu aralığın dışında çalışan paylaşım betikleri hiçbir şey paylaşmadan ve durum dosyalarına dokunmadan çıkar;
gece biriken olaylar (yeni şarkı, liste değişimi) sabah pencere açılınca yakalanıp paylaşılır. Pencere açılış turunda (ilk 3 saat) yeni şarkı kontrolü
tüm sanatçıları tarar, böylece gece çıkan şarkı sabah gecikmeden bulunur.

- Pencereyi değiştirmek: GitHub → Settings → Secrets and variables → Actions → **Variables** → `POST_WINDOW` = örn. `10:00-23:00` (kodda değişiklik gerekmez).
- Elle çalıştırma (Actions → Run workflow) pencereyi **yok sayar** (`POST_WINDOW=off`), test için.
- Yerelde: `POST_WINDOW=off node --env-file=.env src/postDuel.js` gibi.
- Mantık `src/postWindow.js` içinde; gece yarısını aşan pencereler (örn. `22:00-02:00`) de desteklenir.

**Yeni çıkan kontrolü (`release-check`):** Spotify kotasını zorlamamak için her çalışma 61 sanatçının yarısını kontrol eder; hangi yarı olduğu saate değil `data/checkCursor.json` içindeki **kalıcı sıra imlecine** bağlıdır (kontrol edilen sanatçı sayısı kadar ilerler). Böylece GitHub zamanlayıcısı kaysa ya da bir çalışma atlansa bile ardışık iki çalışma tüm listeyi kapsar. Pencere açılış turunda (ve `CHECK_ALL=1` ile) hepsi bir seferde kontrol edilir.

## Klasörler

- `src/` bot kodu. `videoPrep.js` (veri + ses), `remotionRender.js` (render), `tiktokVideo.js` (karar + paylaşım).
- `src/videoEngine.js` Remotion çalışmazsa devreye giren yedek video motoru.
- `video/` Remotion projesi (şablonlar: `TopBoard`, `NewRelease`, `RankRise`, `Anniversary`, `CoverPlayer`, `Duel`, `EraIntro`, yeni çıktı ailesi `NRFragman`/`NRBulten`/`NRKilit`/`NRNeon`/`NRKaset`/`NRTahmin`/`NRRadyo`/`NRMesaj`).
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
- `TIKTOK_DAILY_MAX=N` son 24 saatteki TikTok sınırı (varsayılan 8, `0` = sınırsız); GitHub → Settings → Secrets and variables → Actions → **Variables** → `TIKTOK_DAILY_MAX` ile kodsuz değiştirilebilir. `TIKTOK_TREND_RESERVE=N` trend olaylarına kapalı tutulan slot sayısı (varsayılan 4).

## Önizleme

Actions → **TikTok preview** → Run workflow. Hiçbir yere paylaşım yapmaz; bütün şablonların örnek videolarını
artifact olarak yükler.

## Yerelde render

```bash
cd video && npm ci
cd .. && node --env-file=.env src/tiktokPreview.js preview --only new,anniv,rise,board,digest
```
