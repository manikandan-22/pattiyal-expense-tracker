// LLM client with Ollama (primary) and Gemini (fallback)
// Ollama uses native /api/chat format; Gemini uses OpenAI-compatible format

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[] | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type ChatChunk =
  | { type: 'text_delta'; content: string }
  | { type: 'tool_call'; id: string; name: string; arguments: string }
  | { type: 'tool_result'; tool: string; summary: string; success: boolean }
  | { type: 'done'; finishReason: string; model?: string }
  | { type: 'error'; message: string };

interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface LLMConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  name: string;
}

function getOllamaConfig(): LLMConfig | null {
  const baseUrl = process.env.OLLAMA_BASE_URL;
  const model = process.env.OLLAMA_MODEL;
  const apiKey = process.env.OLLAMA_API_KEY || '';
  if (!baseUrl || !model) return null;
  return { baseUrl, model, apiKey, name: 'Ollama' };
}

function getGeminiConfig(): LLMConfig | null {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  if (!apiKey) return null;
  return {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model,
    apiKey,
    name: 'Gemini',
  };
}

// ── Ollama Native API ──────────────────────────────────────────────────

// Convert LLMMessage[] to Ollama's message format
function toOllamaMessages(messages: LLMMessage[]): Record<string, unknown>[] {
  return messages.map((m) => {
    const msg: Record<string, unknown> = { role: m.role };

    // Handle content: convert ContentPart[] to string + images
    if (Array.isArray(m.content)) {
      const textParts: string[] = [];
      const images: string[] = [];
      for (const part of m.content) {
        if (part.type === 'text' && part.text) {
          textParts.push(part.text);
        } else if (part.type === 'image_url' && part.image_url?.url) {
          // Extract base64 data from data URL
          const url = part.image_url.url;
          const base64Match = url.match(/^data:[^;]+;base64,(.+)$/);
          images.push(base64Match ? base64Match[1] : url);
        }
      }
      msg.content = textParts.join('\n') || '';
      if (images.length > 0) msg.images = images;
    } else {
      msg.content = m.content || '';
    }

    // Convert tool_calls for assistant messages
    if (m.tool_calls && m.tool_calls.length > 0) {
      msg.tool_calls = m.tool_calls.map((tc) => ({
        function: {
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        },
      }));
    }

    return msg;
  });
}

// Parse NDJSON stream from Ollama
async function* parseNDJSONStream(
  response: Response
): AsyncGenerator<Record<string, unknown>> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        yield JSON.parse(trimmed);
      } catch {
        // Skip malformed lines
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim()) {
    try {
      yield JSON.parse(buffer.trim());
    } catch {
      // Skip
    }
  }
}

// Build Ollama API URL from base URL
function getOllamaEndpoint(baseUrl: string): string {
  // Strip trailing slashes
  let url = baseUrl.replace(/\/+$/, '');
  // If URL already ends with /api, just append /chat
  if (url.endsWith('/api')) {
    return `${url}/chat`;
  }
  // Otherwise append /api/chat
  return `${url}/api/chat`;
}

// Call Ollama using native API format
async function* callOllamaProvider(
  config: LLMConfig,
  messages: LLMMessage[],
  tools: ToolDefinition[]
): AsyncGenerator<ChatChunk> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const ollamaMessages = toOllamaMessages(messages);

  const body: Record<string, unknown> = {
    model: config.model,
    messages: ollamaMessages,
    stream: true,
  };
  if (tools.length > 0) {
    body.tools = tools;
  }

  const endpoint = getOllamaEndpoint(config.baseUrl);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API error ${response.status}: ${errorText}`);
  }

  let toolCallCounter = 0;

  for await (const chunk of parseNDJSONStream(response)) {
    const done = chunk.done as boolean;
    const message = chunk.message as Record<string, unknown> | undefined;

    if (!message) continue;

    // Stream text content
    const content = message.content as string | undefined;
    if (content) {
      yield { type: 'text_delta', content };
    }

    // Handle tool calls (typically arrive in the final chunk)
    const toolCalls = message.tool_calls as Array<Record<string, unknown>> | undefined;
    if (toolCalls) {
      for (const tc of toolCalls) {
        const fn = tc.function as Record<string, unknown>;
        if (!fn) continue;
        const name = fn.name as string;
        const args = fn.arguments as Record<string, unknown>;
        const id = `ollama_call_${toolCallCounter++}`;
        yield {
          type: 'tool_call',
          id,
          name,
          arguments: JSON.stringify(args),
        };
      }
    }

    if (done) {
      yield { type: 'done', finishReason: toolCalls ? 'tool_calls' : 'stop', model: config.model };
      return;
    }
  }

  yield { type: 'done', finishReason: 'stop', model: config.model };
}

// ── OpenAI-Compatible API (Gemini) ─────────────────────────────────────

// Parse SSE stream from OpenAI-compatible API
async function* parseSSEStream(
  response: Response
): AsyncGenerator<Record<string, unknown>> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') return;
      try {
        yield JSON.parse(data);
      } catch {
        // Skip malformed chunks
      }
    }
  }
}

// Call OpenAI-compatible provider (Gemini)
async function* callOpenAIProvider(
  config: LLMConfig,
  messages: LLMMessage[],
  tools: ToolDefinition[]
): AsyncGenerator<ChatChunk> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    stream: true,
  };
  if (tools.length > 0) {
    body.tools = tools;
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${config.name} API error ${response.status}: ${errorText}`);
  }

  // Accumulate tool calls across chunks (they arrive in pieces)
  const toolCallAccum: Array<{ id: string; name: string; arguments: string } | null> = [];
  let finishReason = '';

  for await (const chunk of parseSSEStream(response)) {
    const choices = chunk.choices as Array<Record<string, unknown>> | undefined;
    if (!choices || choices.length === 0) continue;

    const choice = choices[0];
    const delta = choice.delta as Record<string, unknown> | undefined;
    finishReason = (choice.finish_reason as string) || finishReason;

    if (!delta) continue;

    // Text content
    const content = delta.content as string | undefined;
    if (content) {
      yield { type: 'text_delta', content };
    }

    // Tool calls (streamed incrementally)
    const toolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined;
    if (toolCalls) {
      for (const tc of toolCalls) {
        const index = tc.index as number;

        // Grow array if needed
        while (toolCallAccum.length <= index) {
          toolCallAccum.push(null);
        }

        const existing = toolCallAccum[index];
        if (!existing) {
          toolCallAccum[index] = {
            id: (tc.id as string) || `call_${index}`,
            name: ((tc.function as Record<string, unknown>)?.name as string) || '',
            arguments: ((tc.function as Record<string, unknown>)?.arguments as string) || '',
          };
        } else {
          const fn = tc.function as Record<string, unknown> | undefined;
          if (fn?.name) existing.name += fn.name as string;
          if (fn?.arguments) existing.arguments += fn.arguments as string;
        }
      }
    }
  }

  // Emit accumulated tool calls
  for (const tc of toolCallAccum) {
    if (tc) {
      yield { type: 'tool_call', id: tc.id, name: tc.name, arguments: tc.arguments };
    }
  }

  yield { type: 'done', finishReason: finishReason || 'stop', model: config.model };
}

// ── Non-Streaming LLM Call ──────────────────────────────────────────────

export async function callLLMNonStreaming(prompt: string): Promise<string> {
  const ollama = getOllamaConfig();
  const gemini = getGeminiConfig();

  if (ollama) {
    try {
      const endpoint = getOllamaEndpoint(ollama.baseUrl);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (ollama.apiKey) headers['Authorization'] = `Bearer ${ollama.apiKey}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: ollama.model,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          format: 'json',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.message?.content || '{}';
      }
    } catch (e) {
      console.error('Ollama non-streaming failed:', e);
    }
  }

  if (gemini) {
    const res = await fetch(`${gemini.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gemini.apiKey}`,
      },
      body: JSON.stringify({
        model: gemini.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '{}';
    }
    throw new Error(`Gemini API error: ${res.status}`);
  }

  throw new Error('No LLM provider configured');
}

// ── Main Entry Point ───────────────────────────────────────────────────

// Stream with Ollama (native API), fallback to Gemini (OpenAI-compatible)
export async function* streamChatCompletion(
  messages: LLMMessage[],
  tools: ToolDefinition[]
): AsyncGenerator<ChatChunk> {
  const ollama = getOllamaConfig();
  const gemini = getGeminiConfig();

  if (!ollama && !gemini) {
    yield { type: 'error', message: 'No LLM provider configured. Set OLLAMA_BASE_URL/OLLAMA_MODEL or GEMINI_API_KEY in environment.' };
    return;
  }

  // Try Ollama first (native API)
  if (ollama) {
    try {
      yield* callOllamaProvider(ollama, messages, tools);
      return;
    } catch (error) {
      console.error('Ollama failed, trying Gemini fallback:', error);
    }
  }

  // Fallback to Gemini (OpenAI-compatible)
  if (gemini) {
    try {
      yield* callOpenAIProvider(gemini, messages, tools);
      return;
    } catch (error) {
      yield {
        type: 'error',
        message: `LLM request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  } else {
    yield { type: 'error', message: 'Ollama failed and no Gemini fallback configured.' };
  }
}
