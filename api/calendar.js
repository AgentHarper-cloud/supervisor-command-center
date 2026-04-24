const ZAPIER_TOKEN = process.env.ZAPIER_TOKEN;
const ZAPIER_MCP_URL = 'https://mcp.zapier.com/api/v1/connect';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, date, description } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Missing required field: title' });
  }

  if (!ZAPIER_TOKEN) {
    return res.status(500).json({ error: 'ZAPIER_TOKEN not configured on server' });
  }

  // Build event description text
  const eventDate = date || new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const eventDesc = description ? `${description}\n\nAdded by Supervisor Command Center` : 'Added by Supervisor Command Center';

  // Use quick add format: "Event title on [date] at 9:00am"
  const quickAddText = `${title} on ${eventDate} at 9:00am`;

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
          name: 'google_calendar_quick_add_event',
          arguments: {
            instructions: `Create a Google Calendar event: "${quickAddText}". Description: ${eventDesc}`,
            text: quickAddText,
            description: eventDesc
          }
        }
      })
    });

    if (!zapierRes.ok) {
      const errText = await zapierRes.text().catch(() => '');
      console.error('[api/calendar] Zapier error:', zapierRes.status, errText);
      return res.status(502).json({ error: `Zapier MCP error: ${zapierRes.status}`, details: errText });
    }

    const zapierData = await zapierRes.json();
    console.log('[api/calendar] Zapier response:', JSON.stringify(zapierData));

    return res.status(200).json({ success: true, eventTitle: title, date: eventDate });

  } catch (err) {
    console.error('[api/calendar] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
