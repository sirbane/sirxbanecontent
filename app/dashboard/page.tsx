'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { ContentType, LLMProvider, Tweet, ChannelContext } from '@/types';
import { GROQ_MODELS, OLLAMA_MODELS } from '@/lib/llm';

// ─── Types ───────────────────────────────────────────────────────────────────
interface DraftTweet { id: string; text: string; type: ContentType; status: 'draft' | 'approved'; }
interface BufferMetrics { scheduledToday: number; scheduledThisWeek: number; pendingTotal: number; sentTotal: number; }

// ─── Default context ─────────────────────────────────────────────────────────
const DEFAULT_CTX: ChannelContext = {
  topic: 'Building autonomous systems & AI agent orchestration that kill busywork',
  tone: 'direct, builder-brained, no fluff, slightly contrarian',
  audience: 'developers, solopreneurs, AI builders in Africa & globally',
  avoid: 'generic AI hype, motivational fluff, promotional language, long rambling threads',
  examples: `Most devs build automation wrong — they automate tasks, not decisions. Here's how agent orchestration is different 👇\nThe busiest founders I know are the least automated. Counterintuitive? No. Here's what I see happening...\nUnpopular: you don't need LangChain. Here's what I actually use to ship agents fast ↓`,
  pillars: ['Agent orchestration', 'n8n & workflow tools', 'Autonomous systems', 'Software architecture', 'AI for builders'],
};

const CONTENT_TYPES: { value: ContentType; emoji: string; label: string; desc: string }[] = [
  { value: 'hot-take', emoji: '🔥', label: 'Hot take', desc: 'Contrarian opinion on AI/agents' },
  { value: 'quick-tip', emoji: '⚡', label: 'Quick tip', desc: '3-5 step agent workflow tip' },
  { value: 'builder-story', emoji: '🧱', label: 'Builder story', desc: 'Personal win or lesson building' },
  { value: 'engagement', emoji: '💬', label: 'Engagement Q', desc: 'Question that sparks debate' },
];

const ALL_PILLARS = ['Agent orchestration', 'n8n & workflow tools', 'Autonomous systems', 'Software architecture', 'AI for builders', 'Kenyan tech scene', 'Startup ops', 'Tool comparisons'];

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = {
  card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.25rem' } as React.CSSProperties,
  label: { fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'block', marginBottom: 6 },
  btn: (variant: 'primary' | 'secondary' | 'ghost' | 'danger' = 'primary') => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 8,
    fontSize: 13, fontWeight: 500, border: 'none',
    cursor: 'pointer', transition: 'all 0.15s',
    ...(variant === 'primary' ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 0 12px rgba(99,102,241,0.2)' } : {}),
    ...(variant === 'secondary' ? { background: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border)' } : {}),
    ...(variant === 'ghost' ? { background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent' } : {}),
    ...(variant === 'danger' ? { background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' } : {}),
  } as React.CSSProperties),
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<'generate' | 'queue' | 'context' | 'setup'>('generate');
  const [user, setUser] = useState<{ email?: string } | null>(null);

  // Generate state
  const [contentType, setContentType] = useState<ContentType>('hot-take');
  const [count, setCount] = useState(3);
  const [extraContext, setExtraContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [drafts, setDrafts] = useState<DraftTweet[]>([]);
  const [genError, setGenError] = useState('');

  // LLM config
  const [provider, setProvider] = useState<LLMProvider>('anthropic');
  const [groqKey, setGroqKey] = useState('');
  const [groqModel, setGroqModel] = useState(GROQ_MODELS[0].value);
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState(OLLAMA_MODELS[0].value);
  const [anthropicKey, setAnthropicKey] = useState('');

  // Context
  const [ctx, setCtx] = useState<ChannelContext>(DEFAULT_CTX);
  const [ctxSaving, setCtxSaving] = useState(false);
  const [ctxSaved, setCtxSaved] = useState(false);

  // Queue
  const [queueTweets, setQueueTweets] = useState<Tweet[]>([]);
  const [bufferMetrics, setBufferMetrics] = useState<BufferMetrics | null>(null);
  const [bufferProfiles, setBufferProfiles] = useState<{ id: string; service_username: string }[]>([]);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);

  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login');
      else setUser(data.user);
    });
  }, [router]);

  // ── Load context from DB ────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/context').then(r => r.json()).then(({ context }) => {
      if (context) setCtx(context);
    }).catch(() => {});
  }, []);

  // ── Load queue ──────────────────────────────────────────────────────────────
  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const [qRes, pRes] = await Promise.all([
        fetch('/api/queue').then(r => r.json()),
        selectedProfile
          ? fetch(`/api/schedule-buffer?action=queue&profileId=${selectedProfile}`).then(r => r.json())
          : Promise.resolve(null),
      ]);
      setQueueTweets(qRes.tweets || []);
      if (pRes?.metrics) setBufferMetrics(pRes.metrics);
    } catch {}
    setQueueLoading(false);
  }, [selectedProfile]);

  useEffect(() => { if (tab === 'queue') loadQueue(); }, [tab, loadQueue]);

  // ── Load Buffer profiles ────────────────────────────────────────────────────
  useEffect(() => {
    if (tab === 'setup') {
      fetch('/api/schedule-buffer?action=profiles')
        .then(r => r.json())
        .then(({ profiles }) => {
          if (profiles) {
            setBufferProfiles(profiles.map((p: { id: string; service_username: string }) => ({ id: p.id, service_username: p.service_username })));
            if (profiles[0] && !selectedProfile) setSelectedProfile(profiles[0].id);
          }
        }).catch(() => {});
    }
  }, [tab, selectedProfile]);

  // ── Generate ────────────────────────────────────────────────────────────────
  async function generate() {
    setGenerating(true);
    setGenError('');
    setDrafts([]);
    try {
      const body: Record<string, unknown> = {
        contentType, count, extraContext,
        topic: ctx.topic, tone: ctx.tone, audience: ctx.audience,
        avoid: ctx.avoid, examples: ctx.examples, pillars: ctx.pillars,
        provider,
      };
      if (provider === 'anthropic' && anthropicKey) body.apiKey = anthropicKey;
      if (provider === 'groq') { body.apiKey = groqKey; body.model = groqModel; }
      if (provider === 'ollama') { body.ollamaUrl = ollamaUrl; body.model = ollamaModel; }

      const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDrafts(data.tweets.map((t: string, i: number) => ({ id: `draft-${Date.now()}-${i}`, text: t, type: contentType, status: 'draft' as const })));
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : 'Generation failed');
    }
    setGenerating(false);
  }

  async function approveDraft(id: string) {
    const draft = drafts.find(d => d.id === id);
    if (!draft) return;
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, status: d.status === 'approved' ? 'draft' : 'approved' } : d));

    if (draft.status === 'draft') {
      const res = await fetch('/api/queue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', tweet: { text: draft.text, status: 'approved', content_type: draft.type } }),
      });
      const data = await res.json();
      if (data.tweet) {
        setDrafts(prev => prev.map(d => d.id === id ? { ...d, id: data.tweet.id } : d));
      }
    }
  }

  async function scheduleToBuffer(tweet: Tweet) {
    if (!selectedProfile) { alert('Select a Buffer profile in Setup first'); return; }
    setScheduling(tweet.id);
    try {
      const res = await fetch('/api/schedule-buffer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweetId: tweet.id, text: tweet.text, profileId: selectedProfile }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      loadQueue();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Scheduling failed');
    }
    setScheduling(null);
  }

  async function deleteTweet(id: string) {
    await fetch('/api/queue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', tweetId: id }) });
    loadQueue();
  }

  async function saveContext() {
    setCtxSaving(true);
    await fetch('/api/context', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ctx) });
    setCtxSaving(false);
    setCtxSaved(true);
    setTimeout(() => setCtxSaved(false), 2000);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (!user) return null;

  const approvedDrafts = drafts.filter(d => d.status === 'approved').length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Top nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 56,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>Content Pipeline</span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 4 }}>@sirXbane</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{user.email}</span>
          <button onClick={logout} style={{ ...s.btn('ghost'), fontSize: 12, padding: '5px 10px' }}>Sign out</button>
        </div>
      </nav>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 4 }}>
          {(['generate', 'queue', 'context', 'setup'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '7px 12px', borderRadius: 7, border: 'none',
              fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
              background: tab === t ? 'var(--accent)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--text-muted)',
              textTransform: 'capitalize',
            }}>
              {t === 'generate' ? '✦ Generate' : t === 'queue' ? '◈ Queue' : t === 'context' ? '⊹ Context' : '⚙ Setup'}
            </button>
          ))}
        </div>

        {/* ── GENERATE TAB ─────────────────────────────────────────── */}
        {tab === 'generate' && (
          <div className="fade-in">
            {/* LLM Provider selector */}
            <div style={{ ...s.card, marginBottom: 12 }}>
              <label style={s.label}>AI Provider</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {([
                  { value: 'anthropic', label: '🟣 Claude', sublabel: 'Anthropic' },
                  { value: 'groq', label: '⚡ Groq', sublabel: 'Ultra-fast' },
                  { value: 'ollama', label: '🦙 Ollama', sublabel: 'Local/Private' },
                ] as const).map(p => (
                  <button key={p.value} onClick={() => setProvider(p.value)} style={{
                    padding: '8px 14px', borderRadius: 8, border: `1px solid ${provider === p.value ? '#6366f1' : 'var(--border)'}`,
                    background: provider === p.value ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                    color: provider === p.value ? '#818cf8' : 'var(--text-muted)',
                    fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                    {p.label} <span style={{ fontSize: 11, opacity: 0.7 }}>{p.sublabel}</span>
                  </button>
                ))}
              </div>

              {/* Provider-specific config */}
              {provider === 'anthropic' && (
                <div style={{ marginTop: 12 }}>
                  <label style={s.label}>Anthropic API Key <span style={{ opacity: 0.5 }}>(or set in .env)</span></label>
                  <input type="password" value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)} placeholder="sk-ant-… (optional if set in env)" />
                </div>
              )}
              {provider === 'groq' && (
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={s.label}>Groq API Key</label>
                    <input type="password" value={groqKey} onChange={e => setGroqKey(e.target.value)} placeholder="gsk_…" />
                  </div>
                  <div>
                    <label style={s.label}>Model</label>
                    <select value={groqModel} onChange={e => setGroqModel(e.target.value)}>
                      {GROQ_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {provider === 'ollama' && (
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={s.label}>Ollama URL</label>
                    <input value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)} placeholder="http://localhost:11434" />
                  </div>
                  <div>
                    <label style={s.label}>Model</label>
                    <select value={ollamaModel} onChange={e => setOllamaModel(e.target.value)}>
                      {OLLAMA_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Content type grid */}
            <div style={{ ...s.card, marginBottom: 12 }}>
              <label style={s.label}>Content type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {CONTENT_TYPES.map(ct => (
                  <button key={ct.value} onClick={() => setContentType(ct.value)} style={{
                    padding: '10px 12px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                    background: contentType === ct.value ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                    border: `1px solid ${contentType === ct.value ? '#6366f1' : 'var(--border)'}`,
                    transition: 'all 0.15s',
                  } as React.CSSProperties}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: contentType === ct.value ? '#818cf8' : 'var(--text)', marginBottom: 2 }}>
                      {ct.emoji} {ct.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{ct.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Count + extra context */}
            <div style={{ ...s.card, marginBottom: 16, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'start' }}>
              <div>
                <label style={s.label}>Count</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 3, 5].map(n => (
                    <button key={n} onClick={() => setCount(n)} style={{
                      width: 36, height: 36, borderRadius: 8, border: `1px solid ${count === n ? '#6366f1' : 'var(--border)'}`,
                      background: count === n ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                      color: count === n ? '#818cf8' : 'var(--text-muted)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    }}>{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={s.label}>Extra angle <span style={{ opacity: 0.5, textTransform: 'none' }}>(optional)</span></label>
                <input value={extraContext} onChange={e => setExtraContext(e.target.value)} placeholder="e.g. angle around n8n vs custom code for orchestration" />
              </div>
            </div>

            {/* Generate button */}
            <button onClick={generate} disabled={generating} style={{
              ...s.btn('primary'),
              width: '100%', justifyContent: 'center', padding: '12px',
              fontSize: 14, opacity: generating ? 0.7 : 1,
              marginBottom: 16,
            }}>
              {generating ? '⏳ Generating…' : '✦ Generate posts'}
            </button>

            {/* Error */}
            {genError && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#fca5a5', marginBottom: 12 }}>
                ⚠ {genError}
              </div>
            )}

            {/* Loading shimmer */}
            {generating && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Array(count).fill(0).map((_, i) => (
                  <div key={i} className="shimmer" style={{ borderRadius: 12, height: 120 }} />
                ))}
              </div>
            )}

            {/* Draft cards */}
            {!generating && drafts.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  {approvedDrafts} / {drafts.length} approved
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {drafts.map((d) => (
                    <TweetCard
                      key={d.id}
                      draft={d}
                      onApprove={() => approveDraft(d.id)}
                      onTextChange={(text) => setDrafts(prev => prev.map(dr => dr.id === d.id ? { ...dr, text } : dr))}
                    />
                  ))}
                </div>
              </>
            )}

            {!generating && drafts.length === 0 && !genError && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-dim)', fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>✦</div>
                Configure your options above and hit Generate
              </div>
            )}
          </div>
        )}

        {/* ── QUEUE TAB ────────────────────────────────────────────── */}
        {tab === 'queue' && (
          <div className="fade-in">
            {/* Buffer metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Scheduled today', val: bufferMetrics?.scheduledToday ?? '—' },
                { label: 'This week', val: bufferMetrics?.scheduledThisWeek ?? '—' },
                { label: 'Pending', val: bufferMetrics?.pendingTotal ?? '—' },
                { label: 'Sent', val: bufferMetrics?.sentTotal ?? '—' },
              ].map(m => (
                <div key={m.label} style={{ ...s.card, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{m.val}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* Profile selector */}
            <div style={{ ...s.card, marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
              <label style={{ ...s.label, margin: 0, whiteSpace: 'nowrap' }}>Buffer profile</label>
              <select value={selectedProfile} onChange={e => setSelectedProfile(e.target.value)} style={{ maxWidth: 260 }}>
                {bufferProfiles.length === 0 && <option value="">Add profile ID in Setup →</option>}
                {bufferProfiles.map(p => <option key={p.id} value={p.id}>@{p.service_username}</option>)}
              </select>
              <button onClick={loadQueue} style={{ ...s.btn('secondary'), whiteSpace: 'nowrap' }}>↻ Refresh</button>
            </div>

            {queueLoading && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>Loading queue…</div>}

            {!queueLoading && queueTweets.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-dim)', fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>◈</div>
                No tweets in queue — generate and approve some first
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {queueTweets.map(t => (
                <div key={t.id} style={{ ...s.card, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <StatusBadge status={t.status} />
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)' }}>{t.text}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {t.status === 'approved' && (
                      <button onClick={() => scheduleToBuffer(t)} disabled={scheduling === t.id} style={s.btn('primary')}>
                        {scheduling === t.id ? '⏳ Sending…' : '→ Schedule to Buffer'}
                      </button>
                    )}
                    {t.status === 'scheduled' && (
                      <span style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        ✓ Scheduled in Buffer
                      </span>
                    )}
                    <button onClick={() => deleteTweet(t.id)} style={s.btn('danger')}>✕ Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CONTEXT TAB ──────────────────────────────────────────── */}
        {tab === 'context' && (
          <div className="fade-in">
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#818cf8', marginBottom: 16 }}>
              ✦ This context is injected into every prompt. The richer it is, the more on-brand your posts.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={s.card}>
                <label style={s.label}>Channel topic</label>
                <input value={ctx.topic} onChange={e => setCtx(p => ({ ...p, topic: e.target.value }))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={s.card}>
                  <label style={s.label}>Tone</label>
                  <input value={ctx.tone} onChange={e => setCtx(p => ({ ...p, tone: e.target.value }))} />
                </div>
                <div style={s.card}>
                  <label style={s.label}>Audience</label>
                  <input value={ctx.audience} onChange={e => setCtx(p => ({ ...p, audience: e.target.value }))} />
                </div>
              </div>

              <div style={s.card}>
                <label style={s.label}>Content pillars</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {ALL_PILLARS.map(p => (
                    <button key={p} onClick={() => setCtx(prev => ({
                      ...prev,
                      pillars: prev.pillars.includes(p) ? prev.pillars.filter(x => x !== p) : [...prev.pillars, p],
                    }))} style={{
                      padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                      border: `1px solid ${ctx.pillars.includes(p) ? '#6366f1' : 'var(--border)'}`,
                      background: ctx.pillars.includes(p) ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                      color: ctx.pillars.includes(p) ? '#818cf8' : 'var(--text-muted)',
                      transition: 'all 0.15s',
                    }}>{p}</button>
                  ))}
                </div>
              </div>

              <div style={s.card}>
                <label style={s.label}>Avoid</label>
                <input value={ctx.avoid} onChange={e => setCtx(p => ({ ...p, avoid: e.target.value }))} />
              </div>

              <div style={s.card}>
                <label style={s.label}>Example posts (style reference)</label>
                <textarea rows={5} value={ctx.examples} onChange={e => setCtx(p => ({ ...p, examples: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
            </div>

            <button onClick={saveContext} disabled={ctxSaving} style={{ ...s.btn('primary'), marginTop: 16, width: '100%', justifyContent: 'center', padding: '11px' }}>
              {ctxSaved ? '✓ Saved!' : ctxSaving ? 'Saving…' : '✦ Save context'}
            </button>
          </div>
        )}

        {/* ── SETUP TAB ────────────────────────────────────────────── */}
        {tab === 'setup' && (
          <div className="fade-in">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Buffer */}
              <div style={s.card}>
                <label style={{ ...s.label, marginBottom: 12 }}>Buffer Configuration</label>
                <div style={{ background: 'var(--green-dim)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#86efac', marginBottom: 12 }}>
                  ✓ Buffer token is configured in your environment variables
                </div>
                <label style={s.label}>Connected X Profile</label>
                {bufferProfiles.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {bufferProfiles.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 16 }}>𝕏</span>
                        <span style={{ fontSize: 13, color: 'var(--text)' }}>@{p.service_username}</span>
                        <code style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace' }}>{p.id}</code>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Loading profiles… (ensure BUFFER_ACCESS_TOKEN is set in .env.local)</div>
                )}
              </div>

              {/* Supabase */}
              <div style={s.card}>
                <label style={{ ...s.label, marginBottom: 12 }}>Supabase Database</label>
                <div style={{ background: 'var(--green-dim)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#86efac', marginBottom: 12 }}>
                  ✓ Connected to ygivswshtwiyushaisxm.supabase.co
                </div>
                <label style={s.label}>Run this SQL to set up your tables</label>
                <pre style={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
                  padding: '12px', fontSize: 11, color: 'var(--text-muted)', overflowX: 'auto',
                  fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.7,
                }}>{SUPABASE_SQL}</pre>
              </div>

              {/* GitHub Actions cron */}
              <div style={s.card}>
                <label style={{ ...s.label, marginBottom: 8 }}>GitHub Actions — Daily Automation</label>
                <pre style={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
                  padding: '12px', fontSize: 11, color: 'var(--text-muted)', overflowX: 'auto',
                  fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.7,
                }}>{GITHUB_ACTIONS_YAML}</pre>
              </div>

              {/* Vercel deploy */}
              <div style={s.card}>
                <label style={{ ...s.label, marginBottom: 8 }}>Deploy to Vercel</label>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  1. Push this repo to GitHub<br />
                  2. Import at vercel.com → Add New Project<br />
                  3. Add all env vars from <code style={{ background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 4 }}>.env.example</code><br />
                  4. Deploy → your pipeline is live on mobile & desktop
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TweetCard({ draft, onApprove, onTextChange }: { draft: DraftTweet; onApprove: () => void; onTextChange: (t: string) => void; }) {
  const [text, setText] = useState(draft.text);
  const len = text.length;
  const over = len > 280;
  const warn = len > 260 && !over;

  return (
    <div className="fade-in" style={{
      background: 'var(--bg-card)',
      border: `1px solid ${draft.status === 'approved' ? '#22c55e' : 'var(--border)'}`,
      borderRadius: 12, padding: '1rem 1.25rem',
      transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 20,
          background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8',
        }}>
          {CONTENT_TYPES.find(c => c.value === draft.type)?.emoji} {CONTENT_TYPES.find(c => c.value === draft.type)?.label}
        </span>
        {draft.status === 'approved' && <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ Approved</span>}
      </div>

      <textarea
        value={text}
        onChange={e => { setText(e.target.value); onTextChange(e.target.value); }}
        rows={3}
        style={{ resize: 'none', border: 'none', background: 'transparent', padding: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--text)' }}
      />
      <div style={{ fontSize: 11, textAlign: 'right', color: over ? 'var(--red)' : warn ? 'var(--amber)' : 'var(--text-dim)', marginBottom: 10 }}>
        {len}/280
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={onApprove} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer',
          border: `1px solid ${draft.status === 'approved' ? '#22c55e' : 'var(--border)'}`,
          background: draft.status === 'approved' ? 'var(--green-dim)' : 'var(--bg-elevated)',
          color: draft.status === 'approved' ? 'var(--green)' : 'var(--text-muted)',
          transition: 'all 0.15s',
        }}>
          {draft.status === 'approved' ? '✓ Approved' : '✓ Approve'}
        </button>
        <button onClick={() => navigator.clipboard.writeText(text).catch(() => {})} style={{
          padding: '6px 12px', borderRadius: 7, fontSize: 12, border: '1px solid var(--border)',
          background: 'var(--bg-elevated)', color: 'var(--text-muted)', cursor: 'pointer',
        }}>⎘ Copy</button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    draft: { bg: 'rgba(99,102,241,0.1)', color: '#818cf8', border: 'rgba(99,102,241,0.3)' },
    approved: { bg: 'var(--green-dim)', color: 'var(--green)', border: 'rgba(34,197,94,0.3)' },
    scheduled: { bg: 'rgba(245,158,11,0.1)', color: 'var(--amber)', border: 'rgba(245,158,11,0.3)' },
    posted: { bg: 'rgba(99,102,241,0.1)', color: '#818cf8', border: 'rgba(99,102,241,0.3)' },
  };
  const c = colors[status] || colors.draft;
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {status}
    </span>
  );
}

// ─── SQL & YAML constants ─────────────────────────────────────────────────────

const SUPABASE_SQL = `-- Run in Supabase SQL Editor

create table if not exists tweets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  text text not null,
  status text default 'draft', -- draft | approved | scheduled | posted
  content_type text,
  scheduled_at timestamptz,
  buffer_update_id text,
  created_at timestamptz default now()
);

create table if not exists channel_context (
  id uuid primary key default gen_random_uuid(),
  topic text,
  tone text,
  audience text,
  avoid text,
  examples text,
  pillars jsonb default '[]',
  updated_at timestamptz default now()
);

-- Enable RLS
alter table tweets enable row level security;
alter table channel_context enable row level security;

-- Allow authenticated users full access
create policy "auth users" on tweets for all using (auth.role() = 'authenticated');
create policy "auth users" on channel_context for all using (auth.role() = 'authenticated');`;

const GITHUB_ACTIONS_YAML = `# .github/workflows/daily.yml
name: Daily content pipeline
on:
  schedule:
    - cron: "0 7 * * *"  # 7am UTC daily
  workflow_dispatch:

jobs:
  generate-and-schedule:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: node scripts/pipeline.js
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          BUFFER_ACCESS_TOKEN: \${{ secrets.BUFFER_ACCESS_TOKEN }}
          NEXT_PUBLIC_SUPABASE_URL: \${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: \${{ secrets.SUPABASE_ANON_KEY }}`;
