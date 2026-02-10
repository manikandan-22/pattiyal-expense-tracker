import { callLLMNonStreaming } from '@/lib/ai-client';
import { ParsedEmailTransaction } from '@/types';
import { GmailEmail } from '@/lib/gmail-client';

const LLM_BATCH_SIZE = 10;
const MAX_BODY_LENGTH = 1500;

interface LLMParsedItem {
  emailIndex: number;
  type: 'debit' | 'credit' | 'not-a-transaction';
  amount?: number;
  date?: string;
  description?: string;
}

/**
 * Strip markdown code fences that LLMs sometimes wrap around JSON.
 */
function cleanJsonResponse(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

/**
 * Strip bank/UPI jargon prefixes from transaction descriptions.
 * "UPI Debit to SWIGGY" → "Swiggy"
 * "Credit card payment for Amazon India" → "Amazon India"
 * "NEFT transfer to John Doe" → "John Doe"
 */
function cleanDescription(raw: string): string {
  const prefixes = [
    /^UPI\s*(?:Debit|Credit|Txn|Transaction|Payment|Transfer)\s*(?:to|for|from|at|via|-)\s*/i,
    /^(?:Credit|Debit)\s*Card\s*(?:Debit|Credit|Payment|Transaction|Txn)\s*(?:to|for|from|at|-)\s*/i,
    /^(?:IMPS|NEFT|RTGS|Net\s*Banking)\s*(?:Debit|Credit|Transfer|Payment|Txn)\s*(?:to|for|from|at|-)\s*/i,
    /^(?:Payment|Txn|Transaction|Transfer|Debit|Paid)\s*(?:to|for|from|at|via|-)\s*/i,
    /^(?:POS|ATM)\s*(?:Debit|Withdrawal|Transaction|Txn|Purchase)\s*(?:to|for|from|at|-)\s*/i,
    /^(?:Auto[\s-]?Pay|EMI|Mandate)\s*(?:Debit|Payment)?\s*(?:to|for|from|at|-)\s*/i,
    /^(?:Bill\s*Payment|Recharge)\s*(?:to|for|from|at|-)\s*/i,
    /^(?:Spent|Purchased|Bought)\s*(?:at|on|from)?\s*/i,
  ];

  let cleaned = raw.trim();
  for (const regex of prefixes) {
    cleaned = cleaned.replace(regex, '');
  }

  // Trim trailing reference numbers like "Ref: 12345" or "(Ref 12345)"
  cleaned = cleaned
    .replace(/\s*[-–]\s*Ref\.?\s*:?\s*\S+$/i, '')
    .replace(/\s*\(?\s*Ref\.?\s*:?\s*\S+\s*\)?$/i, '')
    .trim();

  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned || raw.trim();
}

/**
 * Parse a batch of emails using LLM.
 * Returns only debit transactions with valid amount and date.
 */
export async function parseBatch(emails: GmailEmail[]): Promise<ParsedEmailTransaction[]> {
  const emailTexts = emails.map((email, idx) => {
    const body = email.body.slice(0, MAX_BODY_LENGTH);
    return `--- Email ${idx + 1} ---
Subject: ${email.subject}
From: ${email.from}
Date: ${email.date}
Body: ${body}`;
  }).join('\n\n');

  const prompt = `You are a transaction email parser. Extract transaction details from bank/UPI alert emails.

For each email below, determine if it's a transaction alert and extract details.

${emailTexts}

Respond with ONLY a JSON object (no markdown, no code fences) containing a "transactions" array. Each item must have:
- "emailIndex": the email number (1-based)
- "type": "debit", "credit", or "not-a-transaction"
- "amount": the transaction amount as a number (no currency symbols)
- "date": transaction date in YYYY-MM-DD format (extract from email content or email date)
- "description": ONLY the merchant or payee name. Do NOT include prefixes like "UPI Debit to", "Credit card payment for", "Payment to", "Txn at", etc. Just the clean merchant/payee/store name.
  Good: "Swiggy", "Amazon India", "Zomato", "BigBazaar", "John Doe"
  Bad: "UPI Debit to Swiggy", "Credit card payment for Amazon", "Payment to Zomato"

Only include entries where you can confidently extract the amount. Skip promotional emails, OTP messages, and non-transaction notifications.

Example: {"transactions": [{"emailIndex": 1, "type": "debit", "amount": 500, "date": "2025-01-15", "description": "Amazon"}]}`;

  const raw = await callLLMNonStreaming(prompt);
  const content = cleanJsonResponse(raw);
  const parsed = JSON.parse(content);
  const items: LLMParsedItem[] = parsed.transactions || [];

  const results: ParsedEmailTransaction[] = [];

  for (const item of items) {
    if (item.type !== 'debit') continue;
    if (!item.amount || item.amount <= 0) continue;
    if (!item.date || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) continue;

    const emailIdx = item.emailIndex - 1;
    if (emailIdx < 0 || emailIdx >= emails.length) continue;

    const rawDesc = item.description || emails[emailIdx].subject;

    results.push({
      emailId: emails[emailIdx].id,
      amount: item.amount,
      date: item.date,
      description: cleanDescription(rawDesc),
    });
  }

  return results;
}

/**
 * Process a chunk of emails: split into LLM-sized batches, parse each, collect results.
 * Tolerates individual LLM batch failures.
 */
export async function parseEmailChunk(
  emails: GmailEmail[]
): Promise<ParsedEmailTransaction[]> {
  const results: ParsedEmailTransaction[] = [];

  for (let i = 0; i < emails.length; i += LLM_BATCH_SIZE) {
    const batch = emails.slice(i, i + LLM_BATCH_SIZE);
    try {
      const parsed = await parseBatch(batch);
      results.push(...parsed);
    } catch (error) {
      console.error(`Gmail parser: LLM batch failed, skipping:`, error);
    }
  }

  return results;
}
