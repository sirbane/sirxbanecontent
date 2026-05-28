# ⚡ @sirXbane Content Pipeline

Autonomous content pipeline — generate, approve, and schedule X posts powered by Claude, Groq, or Ollama, with Supabase persistence and Buffer scheduling.

## Stack
- **Next.js 15** (App Router) — full-stack React
- **Supabase** — auth + database persistence
- **Buffer API** — X/Twitter scheduling (pre-configured)
- **Multi-LLM** — Claude (Anthropic), Groq (cloud fast), Ollama (local/private)
- **Vercel** — host in 2 minutes

## Quick Start

```bash
npm install
cp .env.example .env.local  # keys already filled
npm run dev
```

Then visit http://localhost:3000 and sign in with your Supabase user.

## Supabase Setup

Run the SQL from the Setup tab of the dashboard in Supabase → SQL Editor.
Create your admin user in Supabase → Authentication → Users.

## Deploy to Vercel

```bash
npx vercel
```

Add all env vars from .env.example to your Vercel project settings.

## Daily Automation

Push to GitHub, add secrets (ANTHROPIC_API_KEY, BUFFER_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY), and `scripts/pipeline.js` runs daily at 7am UTC.
