import { google, gmail_v1 } from 'googleapis';

export interface GmailEmail {
  id: string;
  subject: string;
  from: string;
  date: string;
  body: string;
}

export function createGmailClient(accessToken: string): gmail_v1.Gmail {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth });
}

const TRANSACTION_QUERY =
  'subject:(transaction OR debited OR credited OR payment OR UPI OR alert OR spent OR withdrawn)';

/**
 * Phase 1: Fast — fetch only message IDs, filter out already-processed ones.
 * Returns new IDs + stats. No body fetching here.
 */
export async function fetchNewMessageIds(
  accessToken: string,
  afterDate: string | null,
  processedIds: string[]
): Promise<{ newIds: string[]; totalFound: number; skippedDupes: number }> {
  const gmail = createGmailClient(accessToken);
  const processedSet = new Set(processedIds);

  let query = TRANSACTION_QUERY;
  if (afterDate) {
    const formatted = afterDate.replace(/-/g, '/');
    query += ` after:${formatted}`;
  } else {
    // Explicit 6-month backfill date (newer_than:6m is unreliable)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const y = sixMonthsAgo.getFullYear();
    const m = String(sixMonthsAgo.getMonth() + 1).padStart(2, '0');
    const d = String(sixMonthsAgo.getDate()).padStart(2, '0');
    query += ` after:${y}/${m}/${d}`;
  }

  const allMessageIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 100,
      pageToken,
    });

    const messages = listRes.data.messages || [];
    for (const msg of messages) {
      if (msg.id) allMessageIds.push(msg.id);
    }

    pageToken = listRes.data.nextPageToken || undefined;
  } while (pageToken && allMessageIds.length < 500);

  const totalFound = allMessageIds.length;
  const newIds = allMessageIds.filter((id) => !processedSet.has(id));
  const skippedDupes = totalFound - newIds.length;

  return { newIds, totalFound, skippedDupes };
}

/**
 * Phase 2: Fetch full bodies for a chunk of message IDs.
 * Call this repeatedly with slices of newIds.
 */
export async function fetchEmailBodies(
  accessToken: string,
  messageIds: string[]
): Promise<GmailEmail[]> {
  const gmail = createGmailClient(accessToken);
  const emails: GmailEmail[] = [];

  // Fetch in parallel batches of 20
  const batchSize = 20;
  for (let i = 0; i < messageIds.length; i += batchSize) {
    const batch = messageIds.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((id) =>
        gmail.users.messages
          .get({ userId: 'me', id, format: 'full' })
          .catch(() => null)
      )
    );

    for (const res of results) {
      if (!res?.data) continue;
      const email = extractEmailContent(res.data);
      if (email) emails.push(email);
    }
  }

  return emails;
}

function extractEmailContent(
  message: gmail_v1.Schema$Message
): GmailEmail | null {
  const headers = message.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

  const id = message.id || '';
  const subject = getHeader('Subject');
  const from = getHeader('From');
  const dateStr = getHeader('Date');

  const body = extractBody(message.payload || {});
  if (!body) return null;

  return { id, subject, from, date: dateStr, body };
}

function extractBody(payload: gmail_v1.Schema$MessagePart): string {
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === 'text/plain') return decoded;
    if (payload.mimeType === 'text/html') return stripHtml(decoded);
  }

  const parts = payload.parts || [];

  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
  }

  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      return stripHtml(decodeBase64Url(part.body.data));
    }
  }

  for (const part of parts) {
    if (part.parts) {
      const result = extractBody(part);
      if (result) return result;
    }
  }

  return '';
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
