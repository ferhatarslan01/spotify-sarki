// Video stili anahtari. VIDEO_STYLE=canvas (varsayilan): tek sarkilik olay videolari (yeni cikti, yil donumu, liste hareketleri)
// ONCE Spotify Canvas (arka plan videosu) ile yapilir. Sarkinin Canvas'i yoksa (ya da SP_DC tanimli degilse) ESKI sablon sistemi
// yalnizca o olay icin yedek olarak calisir. Liste/duello/ozet videolarinin Canvas karsiligi olmadigindan eskisi gibi uretilir.
// VIDEO_STYLE=classic Canvas'i tamamen kapatir (yalniz eski sablonlar).
export function videoStyle() {
  return process.env.VIDEO_STYLE === 'classic' ? 'classic' : 'canvas';
}

export function canvasStyle() {
  return videoStyle() === 'canvas';
}
