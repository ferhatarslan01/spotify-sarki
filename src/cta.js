// Gonderi sonuna eklenen kisa, kolay cevaplanan sorular (yorum surtunmesini dusurur).
// "Begen/takip et" demiyoruz; yalnizca soru sorulur, "yaz" gibi komut eklenmez.
// CTA_QUESTIONS=0 ile kapatilir.

const QUESTIONS = {
  release: [
    'Hit olur mu? 👇',
    'Puanın kaç? 👇',
    "Repeat'e alır mısın? 👇",
    'İlk dinleyişte nasıl? 👇',
  ],
  anniversary: [
    'Hâlâ çalma listende mi? 👇',
    'Bu şarkıyı ilk sen mi keşfetmiştin? 👇',
    'Şarkı hâlâ eskimedi mi? 👇',
  ],
  'trend-jump': ['Sence zirveye çıkar mı? 👇', "Top 10'a girer mi? 👇"],
  'trend-top10': ['Sence kaçıncı olur? 👇', 'Zirveye çıkar mı? 👇'],
  'trend-milestone': ['Sen de dinledin mi? 👇', 'Sence hak etti mi? 👇'],
  'trend-global': ['Gurur duydun mu? 👇', 'Dünyada da büyür mü? 👇'],
  'daily-tr': ['Yarın 1 numara değişir mi? 👇', 'Yarın da zirvede kalır mı? 👇'],
  'weekly-tr': ['Haftaya 1 numara değişir mi? 👇', 'Haftaya da zirvede kalır mı? 👇'],
  'daily-global': ['Yarın 1 numara değişir mi? 👇'],
  'weekly-digest': ['Haftanın şarkısı hangisi? 👇'],
  duel: ['A mı B mi? 👇', 'Sen hangisini seçerdin? 👇'],
};

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Gonderi turune uygun soru; ayar kapaliysa ya da tur bilinmiyorsa null.
export function ctaFor(kind) {
  if (process.env.CTA_QUESTIONS === '0') return null;
  const list = QUESTIONS[kind];
  return list ? pick(list) : null;
}
