import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOrCreateSpreadsheet, getCategories, getSettings } from '@/lib/google-sheets';
import { TOOL_DEFINITIONS, executeTool, buildSystemPrompt, type ToolContext } from '@/lib/ai-tools';
import { streamChatCompletion, type LLMMessage, type ChatChunk } from '@/lib/ai-client';

// Check if any message contains PDF attachments
function hasPdfContent(messages: Array<{ role: string; content: string | unknown[] }>): boolean {
  return messages.some((msg) => {
    if (!Array.isArray(msg.content)) return false;
    return (msg.content as Array<Record<string, unknown>>).some((part) => {
      const imageUrl = part.image_url as { url: string } | undefined;
      return part.type === 'image_url' && imageUrl?.url?.startsWith('data:application/pdf;base64,');
    });
  });
}

// Convert PDF base64 to array of JPEG base64 images (max 5 pages, low res)
const MAX_PDF_PAGES = 5;
async function pdfToImages(pdfBase64: string): Promise<string[]> {
  const { pdf } = await import('pdf-to-img');
  const sharp = (await import('sharp')).default;
  const buffer = Buffer.from(pdfBase64, 'base64');
  const images: string[] = [];
  const pages = await pdf(buffer, { scale: 1 });
  for await (const page of pages) {
    if (images.length >= MAX_PDF_PAGES) break;
    const jpeg = await sharp(page).jpeg({ quality: 70 }).toBuffer();
    images.push(jpeg.toString('base64'));
  }
  return images;
}

// Preprocess messages: convert PDF data URLs to PNG image data URLs
// Only called when PDFs are actually present
async function preprocessMessages(
  messages: Array<{ role: string; content: string | unknown[] }>
): Promise<Array<{ role: string; content: string | unknown[] }>> {
  const result = [];
  for (const msg of messages) {
    if (!Array.isArray(msg.content)) {
      result.push(msg);
      continue;
    }
    const newContent: unknown[] = [];
    for (const part of msg.content as Array<Record<string, unknown>>) {
      const imageUrl = part.image_url as { url: string } | undefined;
      if (
        part.type === 'image_url' &&
        imageUrl?.url?.startsWith('data:application/pdf;base64,')
      ) {
        const base64 = imageUrl.url.split(',')[1];
        const images = await pdfToImages(base64);
        for (const img of images) {
          newContent.push({
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${img}` },
          });
        }
      } else {
        newContent.push(part);
      }
    }
    result.push({ ...msg, content: newContent });
  }
  return result;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { messages: rawMessages } = await request.json();
  const accessToken = session.accessToken as string;

  // Only convert PDFs to images when PDFs are actually present
  const messages = hasPdfContent(rawMessages)
    ? await preprocessMessages(rawMessages)
    : rawMessages;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (chunk: ChatChunk) => {
        controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));
      };

      try {
        // Load user context for system prompt
        const spreadsheetId = await getOrCreateSpreadsheet(accessToken);
        const [categories, settings] = await Promise.all([
          getCategories(accessToken, spreadsheetId),
          getSettings(accessToken, spreadsheetId),
        ]);

        const systemPrompt = buildSystemPrompt(categories, settings.currency);

        // Shared context for all tool executions in this request
        const toolContext: ToolContext = {
          accessToken,
          spreadsheetId,
          categories,
          currency: settings.currency,
        };

        // Build LLM messages with system prompt
        const llmMessages: LLMMessage[] = [
          { role: 'system', content: systemPrompt },
          ...messages.map((m: { role: string; content: string | unknown[] }) => ({
            role: m.role as LLMMessage['role'],
            content: m.content as LLMMessage['content'],
          })),
        ];

        // Tool-calling loop (max 5 iterations to prevent runaway)
        let iterations = 0;
        const MAX_ITERATIONS = 5;
        let modelName: string | undefined;

        while (iterations < MAX_ITERATIONS) {
          iterations++;
          let assistantContent = '';
          const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];

          for await (const chunk of streamChatCompletion(llmMessages, TOOL_DEFINITIONS)) {
            if (chunk.type === 'text_delta') {
              assistantContent += chunk.content;
              send(chunk);
            } else if (chunk.type === 'tool_call') {
              toolCalls.push(chunk);
            } else if (chunk.type === 'done') {
              modelName = chunk.model;
            } else if (chunk.type === 'error') {
              send(chunk);
              controller.close();
              return;
            }
          }

          if (toolCalls.length === 0) {
            // No tools called - LLM finished its response
            send({ type: 'done', finishReason: 'stop', model: modelName });
            break;
          }

          // Execute tool calls
          for (const tc of toolCalls) {
            try {
              const args = JSON.parse(tc.arguments);
              const result = await executeTool(tc.name, args, toolContext);
              send({
                type: 'tool_result',
                tool: tc.name,
                summary: result.summary,
                success: result.success,
              });

              // Append assistant message with tool calls to conversation
              llmMessages.push({
                role: 'assistant',
                content: assistantContent || null,
                tool_calls: [{
                  id: tc.id,
                  type: 'function',
                  function: { name: tc.name, arguments: tc.arguments },
                }],
              });

              // Append tool result
              llmMessages.push({
                role: 'tool',
                content: JSON.stringify(result.data),
                tool_call_id: tc.id,
              });
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Tool execution failed';
              send({
                type: 'tool_result',
                tool: tc.name,
                summary: errorMsg,
                success: false,
              });

              llmMessages.push({
                role: 'assistant',
                content: assistantContent || null,
                tool_calls: [{
                  id: tc.id,
                  type: 'function',
                  function: { name: tc.name, arguments: tc.arguments },
                }],
              });

              llmMessages.push({
                role: 'tool',
                content: JSON.stringify({ error: errorMsg }),
                tool_call_id: tc.id,
              });
            }
          }

          // Reset assistant content for the next iteration
          assistantContent = '';
          // Loop continues - LLM will see tool results and generate follow-up
        }
      } catch (error) {
        send({
          type: 'error',
          message: error instanceof Error ? error.message : 'Chat failed',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
