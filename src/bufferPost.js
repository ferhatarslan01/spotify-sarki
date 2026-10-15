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

export async function publishPost(text, imageUrl, videoUrl) {
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
      assets: videoUrl ? [{ video: { url: videoUrl } }] : imageUrl ? [{ image: { url: imageUrl } }] : undefined,
    }
  );

  return data.createPost;
}

// TikTok foto gonderisi: 1-10 gorsel + baslik (title) + aciklama (text)
export async function publishTikTokPhoto(channelId, { text, imageUrls, title }) {
  const data = await graphql(
    `
      mutation CreateTikTokPost(
        $text: String!
        $channelId: ChannelId!
        $assets: [AssetInput!]
        $title: String
      ) {
        createPost(
          input: {
            text: $text
            channelId: $channelId
            schedulingType: automatic
            mode: shareNow
            assets: $assets
            metadata: { tiktok: { title: $title } }
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
      channelId,
      assets: imageUrls.map((url) => ({ image: { url } })),
      title,
    }
  );

  return data.createPost;
}

// TikTok video gonderisi: tek MP4 (herkese acik URL) + aciklama (text)
export async function publishTikTokVideo(channelId, { text, videoUrl }) {
  const data = await graphql(
    `
      mutation CreateTikTokVideo($text: String!, $channelId: ChannelId!, $assets: [AssetInput!]) {
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
    { text, channelId, assets: [{ video: { url: videoUrl } }] }
  );

  return data.createPost;
}

// items: [{ text, imageUrl? }, ...] - ilk eleman kok (root) tweet, digerleri sirayla yanit olarak zincirlenir
export async function publishThread(items) {
  const toAssets = (imageUrl, videoUrl) =>
    videoUrl ? [{ video: { url: videoUrl } }] : imageUrl ? [{ image: { url: imageUrl } }] : [];

  const data = await graphql(
    `
      mutation CreateThread(
        $text: String!
        $channelId: ChannelId!
        $assets: [AssetInput!]
        $thread: [ThreadedPostInput!]!
      ) {
        createPost(
          input: {
            text: $text
            channelId: $channelId
            schedulingType: automatic
            mode: shareNow
            assets: $assets
            metadata: { twitter: { thread: $thread } }
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
      text: items[0].text,
      channelId: BUFFER_CHANNEL_ID,
      assets: toAssets(items[0].imageUrl, items[0].videoUrl),
      thread: items.map((item) => ({ text: item.text, assets: toAssets(item.imageUrl, item.videoUrl) })),
    }
  );

  return data.createPost;
}

// Gonderi durumu: { status, error } (sending | sent | error ...)
export async function getPostStatus(id) {
  const data = await graphql(
    `query PostStatus($id: PostId!) { post(input: { id: $id }) { id status error { message } } }`,
    { id }
  );
  return data.post;
}

// "sending" bitene kadar bekler; sonuc belirsiz kalirsa (zaman asimi) son durumu doner.
export async function waitForPost(id, { timeoutMs = 150_000, intervalMs = 6_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      last = await getPostStatus(id);
    } catch {
      continue;
    }
    if (last && last.status !== 'sending' && last.status !== 'scheduled' && last.status !== 'queued') return last;
  }
  return last;
}

function isFailed(post) {
  return Boolean(post && (post.status === 'error' || post.status === 'failed' || post.error));
}

// X'e video ile paylasir; Buffer hata verirse (aninda ya da yayin sirasinda) gorselli/duz tweete duser.
export async function publishPostWithVideo(text, imageUrl, videoUrl) {
  if (!videoUrl) return publishPost(text, imageUrl);
  try {
    const result = await publishPost(text, null, videoUrl);
    if (!result.message) {
      const status = await waitForPost(result.post.id);
      if (!isFailed(status)) {
        console.log(`  X video tweeti gönderildi (durum: ${status?.status ?? 'belirsiz'})`);
        return result;
      }
      console.error(`  X video tweeti başarısız (${status?.error?.message ?? status?.status}), görsele düşülüyor.`);
    } else {
      console.error(`  X video tweeti reddedildi (${result.message}), görsele düşülüyor.`);
    }
  } catch (err) {
    console.error(`  X video tweeti hatası (${err.message.split('\n')[0]}), görsele düşülüyor.`);
  }
  return publishPost(text, imageUrl);
}

// Thread'in kokunde video varsa ayni dogrulama/yedek mantigi; fallback: yedek paylasimi yapan fonksiyon.
export async function publishThreadWithVideo(items, fallback) {
  if (!items[0]?.videoUrl) return publishThread(items);
  try {
    const result = await publishThread(items);
    if (!result.message) {
      const status = await waitForPost(result.post.id);
      if (!isFailed(status)) {
        console.log(`  X video thread'i gönderildi (durum: ${status?.status ?? 'belirsiz'})`);
        return result;
      }
      console.error(`  X video thread'i başarısız (${status?.error?.message ?? status?.status}), görsele düşülüyor.`);
    } else {
      console.error(`  X video thread'i reddedildi (${result.message}), görsele düşülüyor.`);
    }
  } catch (err) {
    console.error(`  X video thread hatası (${err.message.split('\n')[0]}), görsele düşülüyor.`);
  }
  return fallback ? fallback() : publishThread(items.map((i) => ({ ...i, videoUrl: undefined })));
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const testImageUrl = process.argv[2];
  const text = `Test paylasimi (gorselli) - bot kurulumu calisiyor ✅ (${new Date().toLocaleTimeString('tr-TR')})`;
  const result = await publishPost(text, testImageUrl);
  console.log(JSON.stringify(result, null, 2));
}
