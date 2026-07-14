import 'dotenv/config';
import { TwitterApi } from 'twitter-api-v2';

const { TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET } = process.env;

if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
  console.error('Twitter anahtarlarindan biri .env dosyasinda eksik.');
  process.exit(1);
}

const client = new TwitterApi({
  appKey: TWITTER_API_KEY,
  appSecret: TWITTER_API_SECRET,
  accessToken: TWITTER_ACCESS_TOKEN,
  accessSecret: TWITTER_ACCESS_SECRET,
});

const rwClient = client.readWrite;

const text = `Test tweeti - bot kurulumu calisiyor ✅ (${new Date().toLocaleTimeString('tr-TR')})`;

const tweet = await rwClient.v2.tweet(text);
console.log('Tweet atildi:', tweet.data);
