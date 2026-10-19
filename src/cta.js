// Gonderi sonuna eklenen, tek harf / tek sayiyla cevaplanabilen sorular (yorum surtunmesini dusurur).
// "Begen/takip et" demiyoruz; "E / H yaz" gibi kolay bir cevap ve kendi fikrini soyleme firsati veriyoruz.
// CTA_QUESTIONS=0 ile kapatilir.

const QUESTIONS = {
  release: [
    'Hit olur mu? E / H yaz 👇',
    'Puanın kaç? 1-10 yaz 👇',
    "Repeat'e alır mısın? E / H yaz 👇",
    'İlk dinleyişte nasıl? 1-10 yaz 👇',
  ],
  anniversary: [
    'Hâlâ çalma listende mi? E / H yaz 👇',
    'Bu şarkıyı ilk sen mi keşfetmiştin? E / H yaz 👇',
    'Şarkı hâlâ eskimedi mi? E / H yaz 👇',
  ],
  'trend-jump': ['Sence zirveye çıkar mı? E / H yaz 👇', "Top 10'a girer mi? E / H yaz 👇"],
  'trend-top10': ['Sence kaçıncı olur? Sayı yaz 👇', 'Zirveye çıkar mı? E / H yaz 👇'],
  'trend-milestone': ['Sen de dinledin mi? E / H yaz 👇', 'Sence hak etti mi? E / H yaz 👇'],
  'trend-global': ['Gurur duydun mu? E / H yaz 👇', 'Dünyada da büyür mü? E / H yaz 👇'],
  'daily-tr': ['Yarın 1 numara değişir mi? E / H yaz 👇', 'Yarın da zirvede kalır mı? E / H yaz 👇'],
  'weekly-tr': ['Haftaya 1 numara değişir mi? E / H yaz 👇', 'Haftaya da zirvede kalır mı? E / H yaz 👇'],
  'daily-global': ['Yarın 1 numara değişir mi? E / H yaz 👇'],
  'weekly-digest': ['Haftanın şarkısı hangisi? Sanatçı adını yaz 👇'],
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
