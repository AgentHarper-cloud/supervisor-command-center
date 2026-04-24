/**
 * /api/drive — Create a Google Doc in the APO folder via Drive API v3.
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID      — OAuth 2.0 client ID
 *   GOOGLE_CLIENT_SECRET  — OAuth 2.0 client secret
 *   GOOGLE_REFRESH_TOKEN  — long-lived refresh token (user's own Drive — no sharing needed)
 *   APO_FOLDER_ID         — Google Drive folder ID for the APO folder (optional;
 *                           defaults to the known APO folder created 2026-04-24)
 *
 * POST body: { title: string, content: string, folderId?: string }
 * Response:  { success: true, title, link, fileId }
 */
import { getGoogleAccessToken } from './_auth.js';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents'
];

// Known APO folder ID (created 2026-04-24 in Stephanie's Google Drive)
const DEFAULT_APO_FOLDER_ID = '1P-vYMRPUGXXGQH-yAyZvRnCuFbUbAtz0';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, content, folderId } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Missing required fields: title, content' });
  }

  try {
    const token = await getGoogleAccessToken(SCOPES);

    // Resolve folder: explicit arg → env var → known default → search/create
    let apoFolderId = folderId || process.env.APO_FOLDER_ID || DEFAULT_APO_FOLDER_ID;
    if (!apoFolderId) {
      apoFolderId = await findOrCreateApoFolder(token);
    }

    // Handle duplicate filename: check if title already exists in folder
    const finalTitle = await resolveTitle(token, title, apoFolderId);

    // Create the Google Doc from plain text via multipart upload
    const fileId = await createGoogleDoc(token, finalTitle, content, apoFolderId);

    const link = `https://docs.google.com/document/d/${fileId}/edit`;
    console.log(`[api/drive] Created doc: ${finalTitle} → ${fileId}`);
    return res.status(200).json({ success: true, title: finalTitle, link, fileId });

  } catch (err) {
    console.error('[api/drive] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Find the APO folder the SA can see, or create one in the SA's drive. */
async function findOrCreateApoFolder(token) {
  const q = encodeURIComponent("name='APO' and mimeType='application/vnd.google-apps.folder' and trashed=false");
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create it (will be in the SA's drive — note: set APO_FOLDER_ID env var instead
  // to place files in Stephanie's shared Drive folder)
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'APO',
      mimeType: 'application/vnd.google-apps.folder'
    })
  });
  const createData = await createRes.json();
  if (!createData.id) throw new Error(`Failed to create APO folder: ${JSON.stringify(createData)}`);
  return createData.id;
}

/**
 * Check if a file with the same name already exists in the folder.
 * If so, append a timestamp suffix to avoid collision.
 */
async function resolveTitle(token, title, folderId) {
  const q = encodeURIComponent(`name='${title}' and '${folderId}' in parents and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();

  if (data.files && data.files.length > 0) {
    const ts = new Date().toISOString().replace('T', ' ').substring(0, 16);
    return `${title} (${ts})`;
  }
  return title;
}

/**
 * Upload plain text content as a Google Doc using Drive multipart upload.
 * The mimeType=application/vnd.google-apps.document triggers auto-conversion.
 */
async function createGoogleDoc(token, title, content, folderId) {
  const boundary = 'drive_upload_boundary_314159';

  const metadata = JSON.stringify({
    name: title,
    mimeType: 'application/vnd.google-apps.document',
    parents: [folderId]
  });

  // Build multipart body manually (no FormData — keeps this dependency-free)
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    content,
    `--${boundary}--`
  ].join('\r\n');

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`
      },
      body
    }
  );

  const uploadData = await uploadRes.json();

  if (!uploadData.id) {
    throw new Error(`Drive upload failed: ${JSON.stringify(uploadData)}`);
  }

  return uploadData.id;
}
