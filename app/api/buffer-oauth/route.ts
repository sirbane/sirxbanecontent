import { NextRequest, NextResponse } from 'next/server';

const CLIENT_ID = process.env.BUFFER_CLIENT_ID!;
const CLIENT_SECRET = process.env.BUFFER_CLIENT_SECRET!;

// Step 1: Redirect user to Buffer's authorization page
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/buffer-oauth`;

  // Step 2: Buffer redirected back with ?code=...
  if (code) {
    try {
      const body = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
        grant_type: 'authorization_code',
      });

      const resp = await fetch('https://api.bufferapp.com/1/oauth2/token.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const data = await resp.json();

      if (data.access_token) {
        // Show the token so you can save it to your env
        return new NextResponse(`
          <html>
            <body style="background:#0a0a0f;color:#e8e8f0;font-family:monospace;padding:2rem;">
              <h2 style="color:#22c55e">✓ Buffer connected!</h2>
              <p style="color:#7a7a9a;margin:1rem 0">Copy this access token and add it to your Vercel env vars as <code style="color:#818cf8">BUFFER_ACCESS_TOKEN</code></p>
              <div style="background:#111118;border:1px solid #2a2a3a;border-radius:8px;padding:1rem;word-break:break-all;font-size:14px;color:#22c55e">
                ${data.access_token}
              </div>
              <p style="color:#7a7a9a;margin-top:1rem;font-size:13px">Then redeploy on Vercel and the profiles will load.</p>
            </body>
          </html>
        `, { headers: { 'Content-Type': 'text/html' } });
      }

      return new NextResponse(`
        <html><body style="background:#0a0a0f;color:#fca5a5;font-family:monospace;padding:2rem;">
          <h2>⚠ OAuth error</h2>
          <pre>${JSON.stringify(data, null, 2)}</pre>
        </body></html>
      `, { headers: { 'Content-Type': 'text/html' } });

    } catch (err) {
      return new NextResponse(`Error: ${err}`, { status: 500 });
    }
  }

  // Step 1: Redirect to Buffer auth
  const authUrl = `https://bufferapp.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
  return NextResponse.redirect(authUrl);
}