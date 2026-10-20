// Gonderi sonuna eklenen, tek harf / tek sayiyla cevaplanabilen sorular (yorum surtunmesini dusurur).
// "Begen/takip et" demiyoruz; "Hit olur mu?" gibi kolay cevaplanan bir soru ve kendi fikrini soyleme firsati veriyoruz ("E / H yaz" gibi komut eklenmez).
// CTA_QUESTIONS=0 ile kapatilir.

const QUESTIONS = {
  release: [
    'Hit olur mu? 👇',
    'Puanın kaç? 1-10 yaz 👇',
    "Repeat'e alır mısın? 👇",
    'İlk dinleyişte nasıl? 1-10 yaz 👇',
  ],
  anniversary: [
    'Hâlâ çalma listende mi? 👇',
    'Bu şarkıyı ilk sen mi keşfetmiştin? 👇',
    'Şarkı hâlâ eskimedi mi? 👇',
  ],
  'trend-jump': ['Sence zirveye çıkar mı? 👇', "Top 10'a girer mi? 👇"],
  'trend-top10': ['Sence kaçıncı olur? Sayı yaz 👇', 'Zirveye çıkar mı? 👇'],
  'trend-milestone': ['Sen de dinledin mi? 👇', 'Sence hak etti mi? 👇'],
  'trend-global': ['Gurur duydun mu? 👇', 'Dünyada da büyür mü? 👇'],
  'daily-tr': ['Yarın 1 numara değişir mi? 👇', 'Yarın da zirvede kalır mı? 👇'],
  'weekly-tr': ['Haftaya 1 numara değişir mi? 👇', 'Haftaya da zirvede kalır mı? 👇'],
  'daily-global': ['Yarın 1 numara değişir mi? 👇'],
  'weekly-digest': ['Haftanın şarkısı hangisi? Sanatçı adını yaz 👇'],
  duel: ['A mı B mi? A / B yaz 👇', 'Sen hangisini seçerdin? A / B yaz 👇'],
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
