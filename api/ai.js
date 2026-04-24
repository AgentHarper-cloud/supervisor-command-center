export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, systemPrompt, apiKey, provider } = req.body;

  if (!prompt || !apiKey || !provider) {
    return res.status(400).json({ error: 'Missing required fields: prompt, apiKey, provider' });
  }

  try {
    let text;

    if (provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 4096,
          system: systemPrompt || 'You are a helpful assistant.',
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return res.status(response.status).json({ error: err.error?.message || `Anthropic API error ${response.status}` });
      }

      const data = await response.json();
      text = data.content?.[0]?.text || '';

    } else if (provider === 'openai') {
      const messages = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push({ role: 'user', content: prompt });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          max_tokens: 4096
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return res.status(response.status).json({ error: err.error?.message || `OpenAI API error ${response.status}` });
      }

      const data = await response.json();
      text = data.choices?.[0]?.message?.content || '';

    } else {
      return res.status(400).json({ error: 'Invalid provider. Use "anthropic" or "openai".' });
    }

    return res.status(200).json({ text });

  } catch (err) {
    console.error('[api/ai] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
