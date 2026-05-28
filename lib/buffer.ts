const BUFFER_API = 'https://api.bufferapp.com/1';

async function bufferFetch(url: string, opts?: RequestInit) {
  const resp = await fetch(url, opts);
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Buffer API ${resp.status}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Buffer API bad JSON: ${text.slice(0, 200)}`);
  }
}

export async function getBufferProfiles(token: string) {
  const data = await bufferFetch(
    `${BUFFER_API}/profiles.json?access_token=${encodeURIComponent(token)}`
  );
  return Array.isArray(data) ? data : [];
}

export async function scheduleBufferUpdate(opts: {
  token: string;
  profileId: string;
  text: string;
  scheduledAt?: string;
}) {
  const body = new URLSearchParams();
  body.append('access_token', opts.token);
  body.append('profile_ids[]', opts.profileId);
  body.append('text', opts.text);
  if (opts.scheduledAt) {
    body.append('scheduled_at', opts.scheduledAt);
  } else {
    body.append('now', 'true');
  }

  return bufferFetch(`${BUFFER_API}/updates/create.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
}

export async function getBufferQueue(token: string, profileId: string) {
  try {
    return await bufferFetch(
      `${BUFFER_API}/profiles/${profileId}/updates/pending.json?access_token=${encodeURIComponent(token)}`
    );
  } catch {
    return { updates: [] };
  }
}

export async function getBufferSent(token: string, profileId: string) {
  try {
    return await bufferFetch(
      `${BUFFER_API}/profiles/${profileId}/updates/sent.json?access_token=${encodeURIComponent(token)}`
    );
  } catch {
    return { updates: [] };
  }
}