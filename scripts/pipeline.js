#!/usr/bin/env node
/**
 * sirXbane Daily Pipeline — runs via GitHub Actions cron
 * Generates tweets and schedules them to Buffer automatically
 */

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const BUFFER_TOKEN = process.env.BUFFER_ACCESS_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const DEFAULT_CONTEXT = {
  topic: 'Building autonomous systems & AI agent orchestration that kill busywork',
  tone: 'direct, builder-brained, no fluff, slightly contrarian',
  audience: 'developers, solopreneurs, AI builders in Africa & globally',
  avoid: 'generic AI hype, motivational fluff, promotional language',
  examples: `Most devs build automation wrong — they automate tasks, not decisions.
The busiest founders I know are the least automated.
Unpopular: you don't need LangChain. Here's what I actually use to ship agents fast ↓`,
  pillars: ['Agent orchestration', 'Autonomous systems', 'AI for builders'],
};

const CONTENT_TYPES = ['hot-take', 'quick-tip', 'builder-story', 'engagement'];

async function generate() {
  const type = CONTENT_TYPES[Math.floor(Math.random() * CONTENT_TYPES.length)];
  const prompt = `You are @sirXbane. Topic: ${DEFAULT_CONTEXT.topic}. Tone: ${DEFAULT_CONTEXT.tone}. Content type: ${type}. Generate 1 tweet under 280 chars. Return only the tweet text.`;
  
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await resp.json();
  return { text: data.content[0].text.trim(), type };
}

async function getBufferProfile() {
  const resp = await fetch(`https://api.bufferapp.com/1/profiles.json?access_token=${BUFFER_TOKEN}`);
  const profiles = await resp.json();
  return profiles.find(p => p.service === 'twitter') || profiles[0];
}

async function scheduleToBuffer(profileId, text) {
  const body = new URLSearchParams({ access_token: BUFFER_TOKEN, 'profile_ids[]': profileId, text });
  const resp = await fetch('https://api.bufferapp.com/1/updates/create.json', { method: 'POST', body });
  return resp.json();
}

async function saveTweet(tweet) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/tweets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify({ text: tweet.text, status: 'scheduled', content_type: tweet.type }),
  });
}

async function main() {
  console.log('🚀 sirXbane daily pipeline starting...');
  const tweet = await generate();
  console.log(`✦ Generated [${tweet.type}]: ${tweet.text}`);
  const profile = await getBufferProfile();
  await scheduleToBuffer(profile.id, tweet.text);
  console.log(`→ Scheduled to Buffer for @${profile.service_username}`);
  await saveTweet(tweet);
  console.log('✓ Saved to Supabase');
}

main().catch(console.error);
