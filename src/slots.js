// Paylasim zamanlama: GitHub zamanlayicisi (cron) saatlerce gecikebiliyor (olculen: 4-6 saat). Bu yuzden isler gun icinde birkac kez
// ve ERKEN calisir; video hazirlanir ve Buffer'a hedef saate (Turkiye saati) ZAMANLANIR. Cron gecikse de paylasim tam saatinde cikar.
//   plan.mode === 'schedule': hedef saat henuz gelmedi -> Buffer'a o ana zamanlanir
//   plan.mode === 'now':      hedef saat gecti ama paylasim penceresi aciksa hemen paylasilir
//   plan.mode === 'skip':     hedef saat gecti ve pencere kapali -> bugun icin atlanir (yarin/sonraki calistirmada tekrar denenir)
import { postWindowOpen } from './postWindow.js';
import { setPublishSchedule } from './bufferPost.js';

const TRT_OFFSET_H = 3; // Europe/Istanbul: UTC+3, yaz/kis saati yok

export function trtDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(now); // YYYY-MM-DD
}

// 0 = Pazar ... 6 = Cumartesi (Turkiye gunu)
export function trtWeekday(now = new Date()) {
  const [y, m, d] = trtDate(now).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Bugunun (Turkiye gunu) hh:mm TRT ani
export function slotAt(hour, minute = 0, now = new Date()) {
  const [y, m, d] = trtDate(now).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour - TRT_OFFSET_H, minute));
}

export function planPost({ hour, minute = 0, now = new Date(), label = 'Paylaşım', minLeadMin = 3 }) {
  const target = slotAt(hour, minute, now);
  const hhmm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  if (target.getTime() - now.getTime() >= minLeadMin * 60e3) return { mode: 'schedule', dueAt: target.toISOString(), hhmm };
  if (postWindowOpen(label)) return { mode: 'now', hhmm };
  return { mode: 'skip', hhmm };
}

// plani uygular (zamanlama modunu acar/kapatir) ve ne yapilacagini loglar
export function applyPlan(plan, label) {
  setPublishSchedule(plan.mode === 'schedule' ? plan.dueAt : null);
  if (plan.mode === 'schedule') console.log(`${label}: paylaşım bugün ${plan.hhmm} (TRT) için Buffer'a zamanlanacak.`);
  else if (plan.mode === 'now') console.log(`${label}: ${plan.hhmm} geçti, pencere açık: hemen paylaşılıyor.`);
  else console.log(`${label}: ${plan.hhmm} geçti ve paylaşım penceresi kapalı, bugün için atlanıyor.`);
}
