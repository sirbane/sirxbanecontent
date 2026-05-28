import { NextRequest, NextResponse } from 'next/server';
import { buildPrompt, generateWithAnthropic, generateWithGroq, generateWithOllama } from '@/lib/llm';
import type { ContentType, LLMProvider } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      contentType,
      count = 3,
      topic,
      tone,
      audience,
      avoid,
      examples,
      pillars = [],
      extraContext,
      provider = 'anthropic',
      model,
      apiKey, // client-provided key for Groq/Ollama
      ollamaUrl,
    } = body;

    const prompt = buildPrompt({
      contentType: contentType as ContentType,
      count,
      topic,
      tone,
      audience,
      avoid,
      examples,
      pillars,
      extraContext,
    });

    let tweets: string[];

    switch (provider as LLMProvider) {
      case 'anthropic': {
        const key = process.env.ANTHROPIC_API_KEY || apiKey;
        if (!key) throw new Error('Anthropic API key not configured');
        tweets = await generateWithAnthropic(prompt, key);
        break;
      }
      case 'groq': {
        if (!apiKey) throw new Error('Groq API key required');
        tweets = await generateWithGroq(prompt, apiKey, model);
        break;
      }
      case 'ollama': {
        const url = ollamaUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        tweets = await generateWithOllama(prompt, url, model);
        break;
      }
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    return NextResponse.json({ tweets });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
