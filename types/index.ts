export type LLMProvider = 'anthropic' | 'groq' | 'ollama';

export type ContentType = 'hot-take' | 'quick-tip' | 'builder-story' | 'engagement';

export type TweetStatus = 'draft' | 'approved' | 'scheduled' | 'posted';

export interface Tweet {
  id: string;
  text: string;
  status: TweetStatus;
  content_type: ContentType;
  scheduled_at?: string;
  buffer_update_id?: string;
  created_at: string;
  user_id: string;
}

export interface ChannelContext {
  id?: string;
  topic: string;
  tone: string;
  audience: string;
  avoid: string;
  examples: string;
  pillars: string[];
  user_id?: string;
}

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string; // for Groq (client-side stored, never sent to DB)
  ollamaUrl?: string;
}

export interface BufferProfile {
  id: string;
  service: string;
  service_username: string;
}

export interface QueueMetrics {
  scheduledToday: number;
  scheduledThisWeek: number;
  approvedDrafts: number;
  postedTotal: number;
}
