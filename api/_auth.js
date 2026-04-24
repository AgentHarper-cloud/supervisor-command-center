/**
 * Google OAuth2 access token helper.
 *
 * Primary method: refresh token (OAuth2 user auth via GOOGLE_REFRESH_TOKEN)
 * This avoids service account JSON keys entirely — works even when
 * iam.disableServiceAccountKeyCreation org policy is active.
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID       — OAuth 2.0 client ID
 *   GOOGLE_CLIENT_SECRET   — OAuth 2.0 client secret
 *   GOOGLE_REFRESH_TOKEN   — long-lived refresh token from one-time auth flow
 *
 * Refresh tokens don't expire unless revoked. They give the app access
 * to Stephanie's own Drive and Calendar without any folder-sharing setup.
 */

/**
 * Returns a short-lived access token by exchanging the stored refresh token.
 * The `scopes` parameter is accepted for API compatibility but not used here —
 * scopes were fixed at the time the refresh token was originally granted.
 *
 * @param {string[]} _scopes - ignored (scopes fixed at auth time)
 * @returns {Promise<string>} OAuth2 access token
 */
export async function getGoogleAccessToken(_scopes) {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId)     throw new Error('GOOGLE_CLIENT_ID environment variable is not set');
  if (!clientSecret) throw new Error('GOOGLE_CLIENT_SECRET environment variable is not set');
  if (!refreshToken) throw new Error('GOOGLE_REFRESH_TOKEN environment variable is not set');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token'
    })
  });

  const data = await res.json();

  if (!data.access_token) {
    // Surface the exact Google error so it's actionable
    const reason = data.error_description || data.error || JSON.stringify(data);
    throw new Error(`Token refresh failed: ${reason}`);
  }

  return data.access_token;
}
