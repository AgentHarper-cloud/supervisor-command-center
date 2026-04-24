const ZAPIER_TOKEN = process.env.ZAPIER_TOKEN;
const ZAPIER_MCP_URL = 'https://mcp.zapier.com/api/v1/connect';
const DEFAULT_FOLDER = '1P-vYMRPUGXXGQH-yAyZvRnCuFbUbAtz0';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, content, folderId } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Missing required fields: title, content' });
  }

  if (!ZAPIER_TOKEN) {
    return res.status(500).json({ error: 'ZAPIER_TOKEN not configured on server' });
  }

  const folder = folderId || DEFAULT_FOLDER;

  // Encode content as base64 for file upload
  const base64Content = Buffer.from(content, 'utf8').toString('base64');
  const fileDataUrl = `data:text/plain;base64,${base64Content}`;

  try {
    const zapierRes = await fetch(ZAPIER_MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZAPIER_TOKEN}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        id: 1,
        params: {
          name: 'google_drive_upload_file',
          arguments: {
            instructions: `Upload this file to Google Drive and convert it to a Google Doc. Place it in folder ID: ${folder}. Name it: ${title}`,
            file: fileDataUrl,
            folder: folder,
            new_name: title,
            convert: true
          }
        }
      })
    });

    if (!zapierRes.ok) {
      const errText = await zapierRes.text().catch(() => '');
      console.error('[api/drive] Zapier error:', zapierRes.status, errText);
      return res.status(502).json({ error: `Zapier MCP error: ${zapierRes.status}`, details: errText });
    }

    const zapierData = await zapierRes.json();
    console.log('[api/drive] Zapier response:', JSON.stringify(zapierData));

    // Extract link from response if available
    let link = null;
    try {
      const resultContent = zapierData?.result?.content;
      if (resultContent) {
        const text = Array.isArray(resultContent) ? resultContent.map(c => c.text || '').join('') : JSON.stringify(resultContent);
        const urlMatch = text.match(/https:\/\/docs\.google\.com\/[^\s"')]+/);
        if (urlMatch) link = urlMatch[0];
        if (!link) {
          const driveMatch = text.match(/https:\/\/drive\.google\.com\/[^\s"')]+/);
          if (driveMatch) link = driveMatch[0];
        }
      }
    } catch (e) {
      console.warn('[api/drive] Could not extract link:', e.message);
    }

    return res.status(200).json({ success: true, title, link });

  } catch (err) {
    console.error('[api/drive] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
