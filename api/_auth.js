/**
 * Google Service Account JWT auth helper.
 * Reads GOOGLE_SERVICE_ACCOUNT_KEY env var (JSON string),
 * builds a signed JWT, and exchanges it for a short-lived access token.
 *
 * No external dependencies — uses Node.js built-in `crypto`.
 */
import { createSign } from 'crypto';

/**
 * @param {string[]} scopes - Google API scopes to request
 * @returns {Promise<string>} - OAuth2 access token
 */
export async function getGoogleAccessToken(scopes) {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');

  let key;
  try {
    key = JSON.parse(keyJson);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON');
  }

  if (!key.client_email || !key.private_key) {
    throw new Error('Service account JSON is missing client_email or private_key');
  }

  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: key.client_email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  })).toString('base64url');

  const sigInput = `${header}.${payload}`;

  const signer = createSign('RSA-SHA256');
  signer.update(sigInput);
  const signature = signer.sign(key.private_key, 'base64url');

  const jwt = `${sigInput}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
}
