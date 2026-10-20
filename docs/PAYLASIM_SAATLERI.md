# Paylaşım saatleri (Türkiye, TRT = UTC+3, yaz/kış saati yok)

> Hazırlanma: 20 Ekim 2026. Dış kaynaklar ticari bloglar ve genel (çoğu ABD) veri; Türkiye'ye özel güncel bir saatlik çalışma bulunamadı.
> En değerli kanıt kendi hesaplarımızın Buffer metrikleri, ama örnek küçük ve hesaplar yeni. **Kesin kural değil, test edilecek varsayım.**

## 1. Dış kaynaklar (özet)

| Platform | Bulgu | Güven |
|---|---|---|
| TikTok TR | Hafta içi 19:00-22:00 (en güçlü), 12:00-13:00 (en güvenilir ikinci), 06:00-09:00; hafta sonu 10:00-12:00 ve 18:00-22:00; kaçın: 02:00-05:00 ([TokPortal](https://www.tokportal.com/learn/best-time-to-post-on-tiktok/turkey), yöntem belirtilmemiş, ticari) | düşük-orta |
| TikTok TR | 21:00 en yüksek, 20:00 ve 22:00 yakın ([timetopost.co](https://timetopost.co/best-time-to-post/tiktok/turkey/)); Türkçe bloglar 08-10, 12-14, 18-22 ([Webtekno](https://www.webtekno.com/tiktok-ta-kesfete-dusmek-icin-en-dogru-saatler-neler-h206997.html)) | düşük |
| TikTok global | Tek sihirli saat yok; zamanlama zayıf içeriği kurtarmaz ([Buffer, 7,1 milyon gönderi](https://buffer.com/resources//best-time-to-post-on-tiktok/)); Sprout hafta ortası 14-18 diyor, Buffer pazar sabahı 9 (yerel saat) | orta |
| X global | Hafta içi sabahları 8-11, salı-çarşamba güçlü ([Buffer, 8,7 milyon](https://buffer.com/resources/best-time-to-post-on-twitter-x-x/), [SocialPilot](https://www.socialpilot.co/blog/best-time-to-post-on-twitter)); ABD verisi, Türkiye'ye özel değil | düşük (TR için) |
| X Türkiye | En yoğun tweet saatleri **21:00-23:00**, en yoğun gün **cuma**, TV ikinci ekran etkisi ([Webrazzi 2013](https://webrazzi.com/2013/03/20/tv-basinda-gunde-2-5-milyon-turkce-tweet-atiliyor/), [2015](https://webrazzi.com/2015/06/23/turkiye-twitter-kahve-muhabbeti/)); **eski veri** (2012-2015) | düşük |
| Müzik | Spotify dinleme gün boyu yayılır, akşam zirve yapar (tek, tarihsiz araştırma); yeni müzik cuma 00:01 yerel saatle çıkar ([blog](https://soyutbeden.substack.com/p/new-music-friday-neden-cuma)) | düşük |

## 2. Kendi verimiz (Buffer, son 14 gün; X: 226 gönderi, TikTok: 44 gönderi)

Genel: X toplam 48 bin gösterim ama **ilk 2 gönderi %65'ini** aldı; medyan gönderi 33 gösterim, toplam 91 beğeni. TikTok toplam 2.366 izlenme, medyan 5.

**X, saat dilimine göre (2 uç gönderi hariç, ilk %25'e giren gönderi oranı):**

| Dilim (TRT) | gönderi | ilk %25 oranı |
|---|---|---|
| 00:00-06:59 | 103 | %29 |
| 07:00-09:59 | 34 | %12 |
| 10:00-12:29 | 16 | %19 (etkileşimde %56) |
| 12:30-14:29 | 1 | (tek gönderi: Gazapizm yıl dönümü, 33 beğeni) |
| 14:30-17:59 | 24 | %21 |
| 18:00-20:29 | 11 | %0 |
| **20:30-22:29** | **19** | **%47** (medyan üstü %74) |
| 22:30-23:59 | 16 | %25 |

- 20:30-22:30 diliminde, nispeten yeterli örnekle, açık ara en iyi sonuç. Dış kaynaklarla (X TR 21-23, TikTok TR 19-22) örtüşüyor.
- Gece (00-07) en çok gönderi attığımız saat (gönderilerin %46'sı) ve ortalama düzeyde: gösterimler sonradan birikiyor. Sabah 07-10 zayıf.
- Hafta sonu medyanı (42) hafta içinden (30) biraz yüksek.

**TikTok:** Sonuç **güvenilmez**: (1) hesap kısıtlıydı ve son günlerde toparlandı, (2) izlenme zamanla birikir, yeni gönderiler eksik görünür, (3) hesap ABD'de açıldı, kitle coğrafyası bilinmiyor. 20:30-22:30'daki 7 gönderinin hiçbiri ilk %25'e girmedi, ama bu saatler ABD'de öğleden sonraya denk gelir. En çok izlenenler pazartesi 03:33, 07:28, 08:22 TRT (ABD akşamı/gecesi).

## 3. İçerik bulguları (saatten daha önemli)

- **"Türkiye Top 50'de kim kaç şarkıyla var?"**: tek başına 25.6 bin gösterim (cumartesi 21:39). `src/postTop50Stats.js` var ama **hiçbir workflow'a bağlı değil**.
- **Yıl dönümü, sevilen şarkı** (Gazapizm - Yeraltı Edebiyatı, salı 13:02): 1.611 gösterim ve **33 beğeni**, tüm hesabın en yüksek etkileşimi.
- **Hayran kitleli sanatçı** (Motive/UZI 10M rekoru): 5.9 bin gösterim.
- Hepsi saat farkından çok içerik farkı. Sıra atlama gönderilerinin medyanı çok düşük (130 gönderi, ort. 35 gösterim).

## 4. Öneri (varsayım, 2 haftada test edilecek)

Pencereler: **A 12:30-13:30**, **B 20:30-22:30**, (TikTok testi için) **C 08:00-09:00**. Gece 00:00-07:30 acil olmayan içerik için kullanılmaz.

| İçerik | Saat (TRT) | Gerekçe |
|---|---|---|
| Günlük Türkiye Top 5 | 20:45 | B penceresi; liste videolu thread |
| Düello | 21:00 (şu an 20:00) | B penceresi |
| Yıl dönümü | 12:45 (gün önceden bilinir) | A penceresi; en yüksek etkileşim öğle |
| Yeni şarkı/albüm | Hemen (08:00-23:30), gece tespit edilirse 08:30 | tazelik + uyuyan kitleye atma |
| Trend olayları | Yalnızca A ve B pencerelerinde, en fazla 2/pencere, 30 dk arayla | şu an aynı dakikada 5 tweet atılıyor, birbirini boğuyor |
| Haftalık Top | Cuma 21:00 | cuma TR'de en yoğun gün; B penceresi |
| Haftalık özet | Cumartesi 13:00 (şu an Pazar 22:00) | A penceresi, hafta sonu |
| **Top 50 sanatçı sayımı (yeni, haftalık)** | Cumartesi 21:30 | kanıtlanmış en iyi içerik, aynı saat |
| TikTok (günde 3) | 12:45, 21:00 + 1 deneme (08:30 / 17:30 dönüşümlü) | TR kaynakları; coğrafya doğrulanana kadar deneme |

## 5. Test planı

- 14 gün aynı kural; ölçüt: X'te gösterim ve etkileşim medyanı, TikTok'ta **48 saat dolmuş** gönderilerin izlenmesi (yaşa göre normalize).
- TikTok Analytics → Takipçiler: "en aktif zamanlar" ve "bölge" ekran görüntüsü alınmalı. Kitle ABD ağırlıklıysa pencereler değişir.
- Ölçüm: `tools/xMediaReport.mjs` (medya türü) ve bu analizin betiği Buffer `metrics` alanından okur.
