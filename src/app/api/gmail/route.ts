import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { fetchNewMessageIds, fetchEmailBodies } from '@/lib/gmail-client';
import { parseEmailChunk } from '@/lib/gmail-parser';
import {
  getOrCreateSpreadsheet,
  getGmailSyncState,
  updateGmailSyncState,
  addPendingTransactions,
} from '@/lib/google-sheets';
import { PendingTransaction } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// How many email bodies to fetch + parse + save per chunk
const CHUNK_SIZE = 50;

type StreamEvent =
  | { type: 'scanning'; totalEmails: number; newEmails: number }
  | { type: 'progress'; chunk: number; totalChunks: number; saved: number; totalSaved: number }
  | { type: 'done'; totalSaved: number; emailsFound: number; dupsSkipped: number }
  | { type: 'error'; message: string };

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (body.type !== 'sync') {
    return new Response(
      JSON.stringify({ error: 'Invalid type' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const accessToken = session.accessToken;

  // Stream NDJSON back to client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      };

      try {
        const spreadsheetId = await getOrCreateSpreadsheet(accessToken);
        const syncState = await getGmailSyncState(accessToken, spreadsheetId);
        const afterDate = syncState.lastSyncDate || null;

        // Phase 1: Fetch message IDs (fast)
        let idResult;
        try {
          idResult = await fetchNewMessageIds(accessToken, afterDate, syncState.processedMessageIds);
        } catch (error: unknown) {
          const code = (error as { code?: number })?.code;
          if (code === 403) {
            emit({ type: 'error', message: 'Gmail access not granted. Please sign out and back in to grant Gmail permission.' });
          } else if (code === 401) {
            emit({ type: 'error', message: 'Session expired. Please sign in again.' });
          } else {
            emit({ type: 'error', message: 'Failed to search Gmail.' });
          }
          controller.close();
          return;
        }

        const { newIds, totalFound, skippedDupes } = idResult;
        emit({ type: 'scanning', totalEmails: totalFound, newEmails: newIds.length });

        if (newIds.length === 0) {
          // Update lastSyncDate even with no new emails
          await updateGmailSyncState(accessToken, spreadsheetId, {
            ...syncState,
            lastSyncDate: new Date().toISOString().split('T')[0],
          });
          emit({ type: 'done', totalSaved: 0, emailsFound: totalFound, dupsSkipped: skippedDupes });
          controller.close();
          return;
        }

        // Phase 2: Process in chunks — fetch bodies → parse → save → emit progress
        const totalChunks = Math.ceil(newIds.length / CHUNK_SIZE);
        let totalSaved = 0;
        const allProcessedIds: string[] = [...syncState.processedMessageIds];

        for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
          const chunkIds = newIds.slice(chunkIdx * CHUNK_SIZE, (chunkIdx + 1) * CHUNK_SIZE);

          // Fetch bodies for this chunk
          const emails = await fetchEmailBodies(accessToken, chunkIds);

          // Parse with LLM
          const parsed = await parseEmailChunk(emails);

          // Build pending transactions and save to sheet
          if (parsed.length > 0) {
            const now = new Date().toISOString();
            const pending: PendingTransaction[] = parsed.map((t) => ({
              id: `${new Date(t.date).getFullYear()}-${uuidv4()}`,
              date: t.date,
              description: t.description,
              amount: t.amount,
              status: 'uncategorized' as const,
              source: 'Gmail',
              createdAt: now,
            }));

            await addPendingTransactions(accessToken, spreadsheetId, pending);
            totalSaved += parsed.length;
          }

          // Track processed IDs for this chunk
          allProcessedIds.push(...chunkIds);

          emit({
            type: 'progress',
            chunk: chunkIdx + 1,
            totalChunks,
            saved: parsed.length,
            totalSaved,
          });
        }

        // Update sync state with all processed IDs
        await updateGmailSyncState(accessToken, spreadsheetId, {
          lastSyncDate: new Date().toISOString().split('T')[0],
          processedMessageIds: allProcessedIds,
        });

        emit({ type: 'done', totalSaved, emailsFound: totalFound, dupsSkipped: skippedDupes });
      } catch (error) {
        console.error('Gmail sync stream error:', error);
        emit({ type: 'error', message: 'Gmail sync failed unexpectedly.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'Transfer-Encoding': 'chunked',
    },
  });
}
