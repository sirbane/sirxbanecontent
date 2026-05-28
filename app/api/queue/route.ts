import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  let query = supabase.from('tweets').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tweets: data });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, tweet, tweetId, status, text } = body;

    if (action === 'save') {
      const { data, error } = await supabase.from('tweets').insert(tweet).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ tweet: data });
    }

    if (action === 'update_status') {
      const updates: Record<string, string> = { status };
      if (text) updates.text = text;
      const { data, error } = await supabase.from('tweets').update(updates).eq('id', tweetId).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ tweet: data });
    }

    if (action === 'delete') {
      const { error } = await supabase.from('tweets').delete().eq('id', tweetId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Queue error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
