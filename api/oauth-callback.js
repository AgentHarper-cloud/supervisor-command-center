/**
 * /api/oauth-callback — Receives Google auth code, exchanges for refresh token,
 * and displays it on screen with copy instructions.
 *
 * This is a one-time setup endpoint. After completing, add GOOGLE_REFRESH_TOKEN
 * to Vercel env vars and redeploy. You can delete this route after setup.
 */
export default async function handler(req, res) {
  const { code, error } = req.query;

  // Handle user denying consent
  if (error) {
    return res.status(400).send(errorPage(`Google returned: ${error}`));
  }

  if (!code) {
    return res.status(400).send(errorPage('No authorization code received.'));
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).send(errorPage('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set in Vercel.'));
  }

  const redirectUri = `${getBaseUrl(req)}/api/oauth-callback`;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code'
      })
    });

    const tokens = await tokenRes.json();

    if (!tokens.refresh_token) {
      const msg = tokens.error_description || tokens.error || JSON.stringify(tokens);
      return res.status(400).send(errorPage(`Token exchange failed: ${msg}`));
    }

    return res.status(200).send(successPage(tokens.refresh_token));

  } catch (err) {
    return res.status(500).send(errorPage(err.message));
  }
}

function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host  = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function successPage(refreshToken) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>OAuth Setup Complete</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0f0f0f;
      color: #e8e4dc;
      font-family: 'DM Sans', system-ui, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 12px;
      padding: 40px;
      max-width: 680px;
      width: 100%;
    }
    .badge {
      display: inline-block;
      background: #1c3a1e;
      color: #6ec88a;
      font-size: 12px;
      font-family: 'DM Mono', monospace;
      letter-spacing: 0.08em;
      padding: 4px 10px;
      border-radius: 4px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 22px;
      font-weight: 600;
      margin-bottom: 10px;
      color: #6ec88a;
    }
    p { color: #999; font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
    .token-box {
      background: #111;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 16px;
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      word-break: break-all;
      color: #c8a96e;
      margin-bottom: 20px;
      position: relative;
      user-select: all;
    }
    .copy-btn {
      background: #c8a96e;
      color: #0f0f0f;
      border: none;
      border-radius: 6px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      margin-bottom: 24px;
    }
    .copy-btn:hover { background: #d4b97e; }
    .copy-btn.copied { background: #6ec88a; }
    .steps {
      background: #111;
      border: 1px solid #2a2a2a;
      border-radius: 8px;
      padding: 20px;
    }
    .steps h3 { font-size: 13px; color: #888; letter-spacing: 0.06em; margin-bottom: 12px; }
    .steps ol { padding-left: 18px; }
    .steps li { font-size: 13px; color: #aaa; line-height: 1.8; }
    .steps code {
      background: #1e1e1e;
      color: #c8a96e;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'DM Mono', monospace;
      font-size: 11px;
    }
    .warning {
      margin-top: 16px;
      padding: 12px 16px;
      background: #1a1200;
      border: 1px solid #3a2a00;
      border-radius: 6px;
      font-size: 12px;
      color: #c8a96e;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">✓ AUTH COMPLETE</div>
    <h1>Your refresh token is ready</h1>
    <p>Copy this token and add it to Vercel as <strong style="color:#e8e4dc">GOOGLE_REFRESH_TOKEN</strong>. Once saved and redeployed, Drive exports and Calendar events will work.</p>

    <div class="token-box" id="token">${refreshToken}</div>

    <button class="copy-btn" id="copyBtn" onclick="copyToken()">Copy Token</button>

    <div class="steps">
      <h3>NEXT STEPS</h3>
      <ol>
        <li>Copy the token above</li>
        <li>Go to: <a href="https://vercel.com/agentharper-clouds-projects/supervisor-command-center/settings/environment-variables" style="color:#7eb8c8" target="_blank">Vercel → Environment Variables</a></li>
        <li>Add variable: <code>GOOGLE_REFRESH_TOKEN</code> = (paste token)</li>
        <li>Set to <strong style="color:#e8e4dc">Production + Preview</strong></li>
        <li>Save → then message Harper to redeploy</li>
      </ol>
      <div class="warning">⚠️ Treat this token like a password — it grants access to your Drive and Calendar. Don't paste it anywhere else.</div>
    </div>
  </div>

  <script>
    function copyToken() {
      const token = document.getElementById('token').textContent.trim();
      navigator.clipboard.writeText(token).then(() => {
        const btn = document.getElementById('copyBtn');
        btn.textContent = '✓ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy Token';
          btn.classList.remove('copied');
        }, 2000);
      });
    }
  </script>
</body>
</html>`;
}

function errorPage(message) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>OAuth Error</title>
  <style>
    body { background:#0f0f0f; color:#e8e4dc; font-family:system-ui; padding:40px; }
    .card { background:#1a1a1a; border:1px solid #3a1a1a; border-radius:12px; padding:40px; max-width:580px; }
    h1 { color:#c86e6e; margin-bottom:12px; }
    code { background:#111; padding:12px; border-radius:6px; display:block; margin-top:16px; color:#f88; font-size:12px; word-break:break-all; }
  </style>
</head>
<body>
  <div class="card">
    <h1>OAuth Error</h1>
    <p>Something went wrong during setup.</p>
    <code>${message}</code>
  </div>
</body>
</html>`;
}
