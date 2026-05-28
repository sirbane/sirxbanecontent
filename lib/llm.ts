import type { LLMProvider, ContentType } from '@/types';

const CONTENT_TYPE_PROMPTS: Record<ContentType, string> = {
  'hot-take': 'Write a bold, contrarian hot take about AI agents, autonomous systems, or software orchestration. Should challenge common assumptions builders have.',
  'quick-tip': 'Write a practical quick tip (3-5 steps or insights) about building AI agents, workflow automation, or cutting busywork with autonomous systems.',
  'builder-story': 'Write a first-person builder story — a personal win, fail, or insight from building autonomous systems and AI agents. Honest and specific.',
  'engagement': 'Write a thought-provoking question that sparks genuine debate among developers and AI builders about agents, automation, or software architecture.',
};

export function buildPrompt(opts: {
  contentType: ContentType;
  count: number;
  topic: string;
  tone: string;
  audience: string;
  avoid: string;
  examples: string;
  pillars: string[];
  extraContext?: string;
}) {
  return `You are a content creator for @sirXbane on X (Twitter).

Channel: ${opts.topic}
Tone: ${opts.tone}
Audience: ${opts.audience}
Content pillars: ${opts.pillars.join(', ')}
Avoid: ${opts.avoid}
Content type: ${CONTENT_TYPE_PROMPTS[opts.contentType]}
${opts.extraContext ? `Additional angle: ${opts.extraContext}` : ''}

Example post style:
${opts.examples}

Generate exactly ${opts.count} tweet(s). Each tweet must:
- Be under 280 characters
- Sound like a real builder, not a marketer
- Be distinct from each other — different hooks/angles
- NOT use the words "delve", "leverage", "game-changer", or "unlock"

Return ONLY a JSON array like: ["tweet 1 text", "tweet 2 text"]
No preamble, no markdown backticks, just the raw JSON array.`;
}

export async function generateWithAnthropic(prompt: string, apiKey: string): Promise<string[]> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) throw new Error(`Anthropic error: ${resp.status}`);
  const data = await resp.json();
  return parseJSON(data.content[0].text);
}

export async function generateWithGroq(prompt: string, apiKey: string, model = 'llama-3.3-70b-versatile'): Promise<string[]> {
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) throw new Error(`Groq error: ${resp.status}`);
  const data = await resp.json();
  return parseJSON(data.choices[0].message.content);
}

export async function generateWithOllama(prompt: string, baseUrl: string, model = 'llama3.2'): Promise<string[]> {
  const resp = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  });
  if (!resp.ok) throw new Error(`Ollama error: ${resp.status}`);
  const data = await resp.json();
  return parseJSON(data.response);
}

function parseJSON(raw: string): string[] {
  const cleaned = raw.trim().replace(/^```json\n?|\n?```$/g, '');
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    return [String(parsed)];
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    return [cleaned];
  }
}

export const GROQ_MODELS = [
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Versatile)' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Fast)' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
  { value: 'gemma2-9b-it', label: 'Gemma 2 9B' },
];

export const OLLAMA_MODELS = [
  { value: 'llama3.2', label: 'Llama 3.2 (3B)' },
  { value: 'llama3.1', label: 'Llama 3.1 (8B)' },
  { value: 'mistral', label: 'Mistral 7B' },
  { value: 'phi3', label: 'Phi-3 Mini' },
  { value: 'deepseek-r1', label: 'DeepSeek R1' },
  { value: 'qwen2.5', label: 'Qwen 2.5' },
];
