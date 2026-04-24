/**
 * /api/calendar — Create a Google Calendar event via Calendar API v3.
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_KEY  — full JSON string of the service account credentials
 *   GOOGLE_CALENDAR_ID          — calendar to write to (e.g. stephanie@gmail.com)
 *                                  Share your calendar with the service account email:
 *                                  "Make changes to events" permission required.
 *
 * POST body: { title: string, date?: string, description?: string }
 *   date: any parseable date string (e.g. "Tuesday, April 29, 2025")
 *         if omitted or unparseable → defaults to next business day at 9:00 AM
 *
 * Response: { success: true, eventTitle, date, eventId, link }
 */
import { getGoogleAccessToken } from './_auth.js';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

// Timezone matches Stephanie's location
const TIMEZONE = process.env.CALENDAR_TIMEZONE || 'America/Los_Angeles';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, date, description } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Missing required field: title' });
  }

  try {
    const token = await getGoogleAccessToken(SCOPES);

    // Resolve calendar ID — GOOGLE_CALENDAR_ID should be Stephanie's Gmail address
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

    // Parse event date; default to next business day if blank/invalid
    const eventDate = parseEventDate(date);
    const dateStr = toLocalDateString(eventDate); // YYYY-MM-DD in local time

    const eventBody = {
      summary: title,
      description: [
        description || '',
        'Added by Supervisor Command Center'
      ].filter(Boolean).join('\n\n'),
      start: {
        dateTime: `${dateStr}T09:00:00`,
        timeZone: TIMEZONE
      },
      end: {
        dateTime: `${dateStr}T10:00:00`,
        timeZone: TIMEZONE
      }
    };

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventBody)
      }
    );

    const calData = await calRes.json();

    if (!calData.id) {
      throw new Error(`Calendar event creation failed: ${JSON.stringify(calData)}`);
    }

    const displayDate = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: TIMEZONE
    });

    console.log(`[api/calendar] Created event: "${title}" on ${displayDate}`);
    return res.status(200).json({
      success: true,
      eventTitle: title,
      date: displayDate,
      eventId: calData.id,
      link: calData.htmlLink || null
    });

  } catch (err) {
    console.error('[api/calendar] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Attempt to parse a date string from the AI triage output.
 * Falls back to the next business day if blank or unparseable.
 */
function parseEventDate(dateStr) {
  if (!dateStr) return nextBusinessDay();

  // Try direct Date parse first
  const direct = new Date(dateStr);
  if (!isNaN(direct)) return direct;

  // Try stripping day-of-week prefix: "Monday, April 28, 2025" → "April 28, 2025"
  const stripped = dateStr.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/i, '');
  const stripped2 = new Date(stripped);
  if (!isNaN(stripped2)) return stripped2;

  // Give up → next business day
  console.warn(`[api/calendar] Could not parse date "${dateStr}" — defaulting to next business day`);
  return nextBusinessDay();
}

function nextBusinessDay() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  // Skip weekends
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

/** Return YYYY-MM-DD from a Date object using local time (not UTC). */
function toLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
