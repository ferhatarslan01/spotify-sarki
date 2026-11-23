// Bir sarki icin arka plan videosu: once Spotify Canvas (dikey dongu, tam ekran), yoksa iTunes resmi klip onizlemesi (yatay), ikisi de yoksa null.
// Canvas yalnizca SP_DC ve sarki kimligi varsa denenir; kimlik/sinir sorunu olursa bu calistirmada devre disi kalir (klip, o da yoksa kapak + onizleme ile devam edilir).
import { fetchMusicVideo } from './clipSource.js';
import { fetchCanvasVideo, CanvasAuthError } from './spotifyCanvas.js';
import { ghWarning } from './canvasHealth.js';

let canvasOff = false;

// { buffer, kind: 'clip' | 'canvas', source } ya da null
let warnedNoSecret = false;
export async function fetchBackdrop(artistName, title, trackId) {
  if (!process.env.SP_DC && !warnedNoSecret) {
    warnedNoSecret = true;
    ghWarning('Canvas atlanıyor', 'SP_DC secret tanımlı değil: videolar Canvas olmadan (klip/kapak) üretiliyor');
  }
  if (trackId && process.env.SP_DC && !canvasOff) {
    try {
      const c = await fetchCanvasVideo(trackId);
      if (c) return { buffer: c.buffer, kind: 'canvas', source: c.url };
    } catch (err) {
      if (err instanceof CanvasAuthError) {
        canvasOff = true;
        console.error(`  Canvas devre dışı: ${err.message}`);
        ghWarning('Canvas devre dışı', err.message);
      } else {
        console.error(`  Canvas hatası (${artistName} - ${title}): ${String(err.message).split('\n')[0]}`);
      }
    }
  }
  const clip = await fetchMusicVideo(artistName, title);
  if (clip) return { buffer: clip.buffer, kind: 'clip', source: `${clip.artist} - ${clip.title}` };
  return null;
}
