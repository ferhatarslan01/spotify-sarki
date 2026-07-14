import 'dotenv/config';

const { BUFFER_API_KEY } = process.env;

if (!BUFFER_API_KEY) {
  console.error('BUFFER_API_KEY .env dosyasinda eksik.');
  process.exit(1);
}

async function graphql(query, variables = {}) {
  const res = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BUFFER_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL hata: ${JSON.stringify(json.errors, null, 2)}`);
  }
  return json.data;
}

const orgData = await graphql(`
  query GetOrganizations {
    account {
      organizations {
        id
      }
    }
  }
`);

const orgId = orgData.account.organizations[0]?.id;
console.log('Organization ID:', orgId);

if (!orgId) {
  console.error('Organizasyon bulunamadi.');
  process.exit(1);
}

const channelsData = await graphql(
  `
    query GetChannels($organizationId: OrganizationId!) {
      channels(input: { organizationId: $organizationId }) {
        id
        name
        service
        displayName
      }
    }
  `,
  { organizationId: orgId }
);

console.log('\nBagli kanallar:');
for (const ch of channelsData.channels) {
  console.log(`- [${ch.service}] ${ch.displayName ?? ch.name} -> id: ${ch.id}`);
}
