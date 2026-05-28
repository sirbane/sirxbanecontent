const BUFFER_API = 'https://api.bufferapp.com/1';

export async function getBufferProfiles(token: string) {
  const resp = await fetch(`${BUFFER_API}/profiles.json?access_token=${token}`);
  if (!resp.ok) throw new Error(`Buffer profiles error: ${resp.status}`);
  return resp.json();
}

export async function scheduleBufferUpdate(opts: {
  token: string;
  profileId: string;
  text: string;
  scheduledAt?: string; // ISO string
}) {
  const body = new URLSearchParams({
    access_token: opts.token,
    'profile_ids[]': opts.profileId,
    text: opts.text,
    ...(opts.scheduledAt ? { scheduled_at: opts.scheduledAt } : { now: 'true' }),
  });

  const resp = await fetch(`${BUFFER_API}/updates/create.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Buffer schedule error: ${resp.status} ${err}`);
  }
  return resp.json();
}

export async function getBufferQueue(token: string, profileId: string) {
  const resp = await fetch(
    `${BUFFER_API}/profiles/${profileId}/updates/pending.json?access_token=${token}`
  );
  if (!resp.ok) throw new Error(`Buffer queue error: ${resp.status}`);
  return resp.json();
}

export async function getBufferSent(token: string, profileId: string) {
  const resp = await fetch(
    `${BUFFER_API}/profiles/${profileId}/updates/sent.json?access_token=${token}`
  );
  if (!resp.ok) throw new Error(`Buffer sent error: ${resp.status}`);
  return resp.json();
}
