/**
 * /api/oauth-start — Redirects to Google OAuth consent page.
 *
 * Visit this URL after setting GOOGLE_CLIENT_ID in Vercel.
 * You'll be redirected to Google sign-in, approve the scopes,
 * then land on /api/oauth-callback which shows your refresh token.
 */
export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return res.status(400).send(`
      <html><body style="font-family:monospace;padding:40px;background:#111;color:#f88">
        <h2>Missing GOOGLE_CLIENT_ID</h2>
        <p>Add GOOGLE_CLIENT_ID to your Vercel environment variables first, then redeploy.</p>
      </body></html>
    `);
  }

  const redirectUri = `${getBaseUrl(req)}/api/oauth-callback`;

  const scopes = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         scopes.join(' '),
    access_type:   'offline',   // Required to get a refresh token
    prompt:        'consent',   // Force re-consent so refresh token is always returned
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  res.redirect(302, authUrl);
}

function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host  = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}
