// Canvas sağlık kontrolü: SP_DC tanımlı mı ve Spotify bu çerezi kabul ediyor mu?
// Bulutta (GitHub Actions) Canvas çalışmazsa videolar sessizce eski usulle (klip/kapak) çıkar; bu kontrol bunu görünür kılar
// (watchdog her çalışmada çağırır, sonucu data/canvasHealth.json'a yazar ve sorun uzarsa çalışmayı kırmızı bitirir).
import { getCanvas } from './spotifyCanvas.js';

// Herhangi bir geçerli Spotify şarkı kimliği: Canvas'ı olması gerekmez, yalnızca kimlik doğrulamanın çalıştığını sınarız
const PROBE_TRACK_ID = '0VjIjW4GlUZAMYd2vXMi3b';

// { ok, hasSecret, error, checkedAt }
export async function canvasHealth() {
  const checkedAt = new Date().toISOString();
  if (!(process.env.SP_DC ?? '').trim()) return { ok: false, hasSecret: false, error: 'SP_DC secret tanımlı değil', checkedAt };
  try {
    await getCanvas(PROBE_TRACK_ID); // Canvas yoksa null döner (sorun değil); kimlik/sınır hatasında fırlatır
    return { ok: true, hasSecret: true, error: null, checkedAt };
  } catch (err) {
    return { ok: false, hasSecret: true, error: String(err.message).split('\n')[0], checkedAt };
  }
}

// GitHub Actions'ta çalıştırma özetine görünen uyarı ("annotation"): halka açık depoda giriş yapmadan da okunabilir
export function ghWarning(title, message) {
  if (process.env.GITHUB_ACTIONS) console.log(`::warning title=${title}::${String(message).replace(/\r?\n/g, ' ')}`);
}
