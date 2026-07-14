import 'dotenv/config';
import { fileURLToPath } from 'node:url';

const { BUFFER_API_KEY, BUFFER_CHANNEL_ID } = process.env;

if (!BUFFER_API_KEY || !BUFFER_CHANNEL_ID) {
  console.error('BUFFER_API_KEY / BUFFER_CHANNEL_ID .env dosyasinda eksik.');
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

export async function publishPost(text, imageUrl) {
  const data = await graphql(
    `
      mutation CreatePost($text: String!, $channelId: ChannelId!, $assets: [AssetInput!]) {
        createPost(
          input: {
            text: $text
            channelId: $channelId
            schedulingType: automatic
            mode: shareNow
            assets: $assets
          }
        ) {
          ... on PostActionSuccess {
            post {
              id
              text
            }
          }
          ... on MutationError {
            message
          }
        }
      }
    `,
    {
      text,
      channelId: BUFFER_CHANNEL_ID,
      assets: imageUrl ? [{ image: { url: imageUrl } }] : undefined,
    }
  );

  return data.createPost;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const testImageUrl = process.argv[2];
  const text = `Test paylasimi (gorselli) - bot kurulumu calisiyor ✅ (${new Date().toLocaleTimeString('tr-TR')})`;
  const result = await publishPost(text, testImageUrl);
  console.log(JSON.stringify(result, null, 2));
}
