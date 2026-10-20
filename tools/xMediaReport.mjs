// X kanalına son N günde giden gönderilerin medya türünü (VIDEO / FOTO / metin) Buffer'dan okuyup özetler.
// Kullanım: node --env-file=.env tools/xMediaReport.mjs [gün=3] [--since "2026-10-20T00:00:00Z"]
//   --since verilirse o andan sonrası (bir düzeltmeden sonraki turu ölçmek için).
const BUFFER = 'https://api.buffer.com';
const { BUFFER_API_KEY, BUFFER_CHANNEL_ID } = process.env;
if (!BUFFER_API_KEY || !BUFFER_CHANNEL_ID) {
  console.error('BUFFER_API_KEY / BUFFER_CHANNEL_ID gerekli (.env).');
  process.exit(1);
}

const args = process.argv.slice(2);
const sinceArg = args.includes('--since') ? args[args.indexOf('--since') + 1] : null;
const days = Number(args.find((a) => /^\d+$/.test(a)) ?? 3);
const since = sinceArg ? new Date(sinceArg).toISOString() : new Date(Date.now() - days * 24 * 3600e3).toISOString();

async function gql(query, variables = {}) {
  const res = await fetch(BUFFER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BUFFER_API_KEY}` },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 400));
  return json.data;
}

const org = (await gql('query { account { organizations { id } } }')).account.organizations[0].id;
const posts = [];
let after = null;
for (let page = 0; page < 10; page++) {
  const data = await gql(
    `query P($org: OrganizationId!, $ch: [ChannelId!], $since: DateTime!, $after: String) {
      posts(first: 50, after: $after, input: { organizationId: $org, filter: { channelIds: $ch, createdAt: { start: $since } } }) {
        pageInfo { hasNextPage endCursor }
        edges { node { status createdAt text assets { type } } }
      }
    }`,
    { org, ch: [BUFFER_CHANNEL_ID], since, after }
  );
  posts.push(...data.posts.edges.map((e) => e.node));
  if (!data.posts.pageInfo.hasNextPage) break;
  after = data.posts.pageInfo.endCursor;
}

// Tur: metnin ilk satirindaki simgeden
const typeOf = (t) =>
  /^🚀/.test(t) ? 'trend: sıra atlama' :
  /^🎊/.test(t) ? 'trend: stream rekoru' :
  /^🎉/.test(t) ? 'trend: ilk kez Top 10' :
  /^🌍/.test(t) && /Dünya Günlük/.test(t) ? 'dünya listesi' :
  /^🌍/.test(t) ? 'trend: dünya geçişi' :
  /^🇹🇷/.test(t) ? 'Türkiye listesi' :
  /^📅/.test(t) ? 'yıl dönümü' :
  /^🎵/.test(t) ? 'haftalık özet' :
  /^⚔️/.test(t) ? 'düello' :
  /YENİ|TAZE|SICAK/.test(t.split('\n')[0]) ? 'yeni şarkı' : 'diğer';
const media = (p) => (p.assets.some((a) => a.type === 'video') ? 'VIDEO' : p.assets.some((a) => a.type === 'image') ? 'FOTO' : 'metin');

const rows = {};
for (const p of posts) {
  const k = typeOf(p.text);
  rows[k] ??= { VIDEO: 0, FOTO: 0, metin: 0 };
  rows[k][media(p)] += 1;
}
console.log(`Kanal: X | ${since.slice(0, 16)} sonrası | ${posts.length} gönderi\n`);
console.log('tür'.padEnd(26), 'video'.padStart(6), 'foto'.padStart(6), 'metin'.padStart(6));
const total = { VIDEO: 0, FOTO: 0, metin: 0 };
for (const [k, v] of Object.entries(rows).sort((a, b) => b[1].FOTO - a[1].FOTO)) {
  console.log(k.padEnd(26), String(v.VIDEO).padStart(6), String(v.FOTO).padStart(6), String(v.metin).padStart(6));
  for (const m of Object.keys(total)) total[m] += v[m];
}
console.log('-'.repeat(46));
console.log('TOPLAM'.padEnd(26), String(total.VIDEO).padStart(6), String(total.FOTO).padStart(6), String(total.metin).padStart(6));
const all = total.VIDEO + total.FOTO + total.metin;
if (all) console.log(`\nVideo oranı: %${Math.round((100 * total.VIDEO) / all)}`);
