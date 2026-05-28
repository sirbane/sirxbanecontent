import { NextRequest, NextResponse } from 'next/server';
import { scheduleBufferUpdate, getBufferProfiles, getBufferQueue, getBufferSent } from '@/lib/buffer';
import { supabase } from '@/lib/supabase';

const BUFFER_TOKEN = process.env.BUFFER_ACCESS_TOKEN!;

export async function POST(req: NextRequest) {
  try {
    const { tweetId, text, profileId, scheduledAt } = await req.json();
    if (!profileId) return NextResponse.json({ error: 'profileId required' }, { status: 400 });

    const result = await scheduleBufferUpdate({
      token: BUFFER_TOKEN,
      profileId,
      text,
      scheduledAt,
    });

    if (tweetId) {
      await supabase
        .from('tweets')
        .update({
          status: 'scheduled',
          buffer_update_id: result.update?.id,
          scheduled_at: scheduledAt || new Date().toISOString(),
        })
        .eq('id', tweetId);
    }

    return NextResponse.json({ success: true, update: result.update });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Scheduling failed';
    console.error('[Buffer POST]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const profileId = searchParams.get('profileId');

    if (!BUFFER_TOKEN) {
      return NextResponse.json({ error: 'BUFFER_ACCESS_TOKEN not set in environment' }, { status: 500 });
    }

    if (action === 'profiles') {
      const profiles = await getBufferProfiles(BUFFER_TOKEN);
      console.log('[Buffer profiles]', JSON.stringify(profiles).slice(0, 200));
      return NextResponse.json({ profiles });
    }

    if (action === 'queue' && profileId) {
      const [pending, sent] = await Promise.all([
        getBufferQueue(BUFFER_TOKEN, profileId),
        getBufferSent(BUFFER_TOKEN, profileId),
      ]);
      const today = new Date().toDateString();
      const scheduledToday = (pending.updates || []).filter((u: { scheduled_at: number }) =>
        new Date(u.scheduled_at * 1000).toDateString() === today
      ).length;
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const scheduledThisWeek = (pending.updates || []).filter((u: { scheduled_at: number }) =>
        u.scheduled_at * 1000 > weekAgo
      ).length;
      return NextResponse.json({
        pending: pending.updates || [],
        sent: sent.updates || [],
        metrics: {
          scheduledToday,
          scheduledThisWeek,
          pendingTotal: (pending.updates || []).length,
          sentTotal: (sent.updates || []).length,
        },
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Buffer API error';
    console.error('[Buffer GET]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}