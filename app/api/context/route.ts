import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('channel_context')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ context: data });
}

export async function POST(req: NextRequest) {
  try {
    const context = await req.json();
    const { data: existing } = await supabase.from('channel_context').select('id').limit(1).single();

    let result;
    if (existing?.id) {
      result = await supabase
        .from('channel_context')
        .update({ ...context, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      result = await supabase.from('channel_context').insert(context).select().single();
    }

    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    return NextResponse.json({ context: result.data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Context save error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
