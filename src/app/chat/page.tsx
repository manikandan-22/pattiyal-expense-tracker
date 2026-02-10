'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Paperclip,
  X,
  Loader2,
  MessageSquare,
  Search,
  BarChart2,
  FileInput,
  CheckCircle2,
  XCircle,
  Bot,
  RefreshCw,
  AlertTriangle,
  Square,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useSettings } from '@/context/SettingsContext';
import { ChatMessage, ChatAttachment, ToolResultDisplay } from '@/types';
import { smoothSpring } from '@/lib/animations';

const CHAT_STORAGE_KEY = 'pattiyal-chat-history';
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function loadChatHistory(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: ChatMessage[] = JSON.parse(raw);
    const cutoff = Date.now() - ONE_MONTH_MS;
    return parsed.filter((m) => new Date(m.timestamp).getTime() > cutoff);
  } catch {
    return [];
  }
}

function saveChatHistory(messages: ChatMessage[]) {
  try {
    // Strip base64 from attachments to avoid bloating localStorage
    const light = messages.map((m) => ({
      ...m,
      attachments: m.attachments?.map(({ base64, ...rest }) => ({ ...rest, base64: '' })),
    }));
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(light));
  } catch {
    // Quota exceeded — silently ignore
  }
}

function ChatSkeleton() {
  return (
    <div className="min-h-screen ios26-bg flex flex-col">
      <header className="">
        <div className="max-w-app mx-auto px-5 md:px-8 py-4">
          <div className="h-6 w-32 skeleton rounded" />
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    </div>
  );
}

// Suggestion chips for empty state
const SUGGESTIONS = [
  { text: 'Add an expense', icon: MessageSquare },
  { text: "What did I spend this month?", icon: BarChart2 },
  { text: 'Search my expenses', icon: Search },
  { text: 'Import a bank statement', icon: FileInput },
];

// Message bubble component
function MessageBubble({
  message,
  onRetry,
  onDismiss,
}: {
  message: ChatMessage;
  onRetry?: () => void;
  onDismiss?: (id: string) => void;
}) {
  const isUser = message.role === 'user';

  // Error message styling
  if (message.isError) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={smoothSpring}
        className="flex justify-start"
      >
        <div className="max-w-[85%] space-y-2">
          <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-red-500/10 border border-red-500/20 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 dark:text-red-400 leading-relaxed">{message.content}</p>
            </div>
            <div className="flex items-center gap-2 mt-2 ml-6">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-400 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </button>
              )}
              {onDismiss && (
                <button
                  type="button"
                  onClick={() => onDismiss(message.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-text-muted hover:text-text-secondary rounded-lg transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={smoothSpring}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[85%] space-y-2`}>
        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {message.attachments.map((att, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-1 bg-surface rounded text-xs text-text-muted"
              >
                <Paperclip className="w-3 h-3" />
                {att.name}
              </span>
            ))}
          </div>
        )}

        {/* Message content */}
        {message.content && (
          <div
            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              isUser
                ? 'bg-accent text-white rounded-br-md whitespace-pre-wrap'
                : 'glass-card text-text-primary rounded-bl-md'
            }`}
          >
            {isUser ? (
              message.content
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-pre:my-2 prose-pre:bg-background/50 prose-pre:rounded-lg prose-code:text-xs prose-code:before:content-none prose-code:after:content-none">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Tool results */}
        {message.toolResults && message.toolResults.length > 0 && (
          <div className="space-y-1">
            {message.toolResults.map((tr, i) => (
              <ToolResultCard key={i} result={tr} />
            ))}
          </div>
        )}

        {/* Model name */}
        {!isUser && message.model && message.id !== 'streaming' && (
          <p className="text-[10px] text-text-muted/60 px-1">{message.model}</p>
        )}
      </div>
    </motion.div>
  );
}

function ToolResultCard({ result }: { result: ToolResultDisplay }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
        result.success
          ? 'bg-green-500/10 text-green-700 dark:text-green-400'
          : 'bg-red-500/10 text-red-700 dark:text-red-400'
      }`}
    >
      {result.success ? (
        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
      ) : (
        <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
      )}
      <span>{result.summary}</span>
    </div>
  );
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { settings, isLoading: settingsLoading } = useSettings();

  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChatHistory());
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Persist chat history to localStorage (skip while streaming)
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last?.id === 'streaming') return;
    saveChatHistory(messages);
  }, [messages]);

  // Auth guards
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated' && !settingsLoading && !settings.onboardingCompleted) {
      router.push('/onboarding');
    }
  }, [status, settingsLoading, settings.onboardingCompleted, router]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const adjustTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, []);

  // File upload handler
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      const isPdf = file.type === 'application/pdf';
      setAttachments((prev) => [
        ...prev,
        {
          type: isPdf ? 'pdf' : 'image',
          name: file.name,
          base64,
          mimeType: file.type,
        },
      ]);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    e.target.value = '';
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Send message
  const sendMessage = useCallback(
    async (text?: string) => {
      const content = text || input.trim();
      if (!content && attachments.length === 0) return;
      if (isStreaming) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: content || '',
        timestamp: new Date().toISOString(),
        attachments: attachments.length > 0 ? [...attachments] : undefined,
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setAttachments([]);
      setIsStreaming(true);

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      // Build API messages (only last 20, excluding error messages)
      const allMessages = [...messages, userMessage];
      const validMessages = allMessages.filter((m) => !m.isError);
      const recentMessages = validMessages.slice(-20);

      const apiMessages = recentMessages.map((msg) => {
        // Only include attachments that have actual base64 data
        const validAttachments = msg.attachments?.filter((att) => att.base64 && att.base64.length > 0);
        if (validAttachments?.length) {
          return {
            role: msg.role,
            content: [
              { type: 'text', text: msg.content || 'Please analyze this file.' },
              ...validAttachments.map((att) => ({
                type: 'image_url',
                image_url: { url: `data:${att.mimeType};base64,${att.base64}` },
              })),
            ],
          };
        }
        return { role: msg.role, content: msg.content };
      });

      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMessages }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let assistantContent = '';
        const toolResults: ToolResultDisplay[] = [];
        let buffer = '';
        let modelName = '';

        const processLine = (line: string) => {
          if (!line.trim()) return;
          try {
            const chunk = JSON.parse(line);

            if (chunk.type === 'text_delta') {
              assistantContent += chunk.content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && last.id === 'streaming') {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, content: assistantContent, toolResults: toolResults.length > 0 ? [...toolResults] : undefined },
                  ];
                }
                return [
                  ...prev,
                  {
                    id: 'streaming',
                    role: 'assistant' as const,
                    content: assistantContent,
                    timestamp: new Date().toISOString(),
                    toolResults: toolResults.length > 0 ? [...toolResults] : undefined,
                  },
                ];
              });
            } else if (chunk.type === 'tool_result') {
              toolResults.push({
                tool: chunk.tool,
                summary: chunk.summary,
                success: chunk.success,
              });
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && last.id === 'streaming') {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, toolResults: [...toolResults] },
                  ];
                }
                return [
                  ...prev,
                  {
                    id: 'streaming',
                    role: 'assistant' as const,
                    content: '',
                    timestamp: new Date().toISOString(),
                    toolResults: [...toolResults],
                  },
                ];
              });
            } else if (chunk.type === 'done') {
              if (chunk.model) modelName = chunk.model;
            } else if (chunk.type === 'error') {
              throw new Error(chunk.message);
            }
          } catch (e) {
            // Only rethrow non-JSON-parse errors
            if (e instanceof Error && !(e instanceof SyntaxError)) {
              throw e;
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            processLine(line);
          }
        }

        // Process any remaining data in buffer
        if (buffer.trim()) {
          processLine(buffer);
        }

        // Finalize the assistant message with model name
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.id === 'streaming') {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                id: crypto.randomUUID(),
                model: modelName || undefined,
              },
            ];
          }
          // If stream ended without creating any assistant message, show a fallback
          if (!assistantContent && toolResults.length === 0) {
            return [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: 'assistant' as const,
                content: 'No response received. Please try again.',
                timestamp: new Date().toISOString(),
                isError: true,
              },
            ];
          }
          return prev;
        });
      } catch (error) {
        // Don't show error for user-initiated abort
        if (error instanceof DOMException && error.name === 'AbortError') {
          // Finalize any partial streaming message
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.id === 'streaming') {
              return [
                ...prev.slice(0, -1),
                { ...last, id: crypto.randomUUID(), content: last.content || '(Stopped)' },
              ];
            }
            return prev;
          });
        } else {
          console.error('Chat error:', error);
          setMessages((prev) => {
            const filtered = prev.filter((m) => m.id !== 'streaming');
            return [
              ...filtered,
              {
                id: crypto.randomUUID(),
                role: 'assistant' as const,
                content:
                  error instanceof Error
                    ? `${error.message}`
                    : 'Something went wrong. Please try again.',
                timestamp: new Date().toISOString(),
                isError: true,
              },
            ];
          });
        }
      } finally {
        abortControllerRef.current = null;
        setIsStreaming(false);
      }
    },
    [input, attachments, isStreaming, messages]
  );

  // Stop streaming
  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // Retry: find the last user message before the error and resend it
  const handleRetry = useCallback(() => {
    if (isStreaming) return;
    // Find the last user message
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) return;

    // Remove error messages AND the last user message (sendMessage will re-add it)
    setMessages((prev) =>
      prev.filter((m) => !m.isError && m.id !== lastUserMsg.id)
    );
    // Small delay to let state settle, then resend
    setTimeout(() => {
      sendMessage(lastUserMsg.content);
    }, 50);
  }, [messages, isStreaming, sendMessage]);

  // Dismiss an error message
  const handleDismissError = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  if (status === 'loading' || !session) {
    return <ChatSkeleton />;
  }

  if (!settingsLoading && !settings.onboardingCompleted) {
    return <ChatSkeleton />;
  }

  return (
    <div className="min-h-screen ios26-bg flex flex-col">
      {/* Header */}
      <header className="">
        <div className="max-w-app mx-auto px-5 md:px-8 py-4">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-text-secondary" />
            <h1 className="text-xl font-semibold text-text-primary">Chat</h1>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-app mx-auto px-4 py-6 space-y-4">
          {/* Welcome screen when no messages */}
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={smoothSpring}
              className="flex flex-col items-center justify-center pt-12 pb-8"
            >
              <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center mb-4">
                <Bot className="w-7 h-7 text-text-secondary" />
              </div>
              <h2 className="text-lg font-semibold text-text-primary mb-1">
                Hey! How can I help?
              </h2>
              <p className="text-sm text-text-muted mb-6 text-center max-w-xs">
                I can add expenses, search your spending, import statements, and more.
              </p>

              <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                {SUGGESTIONS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <motion.button
                      key={s.text}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => sendMessage(s.text)}
                      className="flex items-center gap-2 px-3 py-2.5 glass-card hover:bg-surface-hover rounded-xl text-sm text-text-secondary text-left transition-colors"
                    >
                      <Icon className="w-4 h-4 text-text-muted flex-shrink-0" />
                      <span>{s.text}</span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Message list */}
          <AnimatePresence>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onRetry={msg.isError ? handleRetry : undefined}
                onDismiss={msg.isError ? handleDismissError : undefined}
              />
            ))}
          </AnimatePresence>

          {/* Streaming indicator */}
          {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="px-4 py-2.5 glass-card rounded-2xl rounded-bl-md">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="sticky bottom-20 z-30">
        <div className="max-w-app mx-auto px-4 py-3">
          {/* Attachment preview */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {attachments.map((att, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 pl-2 pr-1 py-1 glass-pill rounded-lg text-xs text-text-secondary"
                >
                  <Paperclip className="w-3 h-3" />
                  <span className="max-w-[120px] truncate">{att.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="p-0.5 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Input row — glass capsule */}
          <div className="flex items-end gap-2 glass-tab-bar p-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-text-muted hover:text-text-secondary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-xl transition-colors flex-shrink-0 mb-0.5"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                adjustTextarea();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Message Pattiyal AI..."
              rows={1}
              className="flex-1 resize-none bg-transparent rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none max-h-[120px]"
            />

            {isStreaming ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={handleStop}
                className="p-2 bg-red-500 text-white rounded-xl flex-shrink-0 mb-0.5 transition-opacity"
              >
                <Square className="w-5 h-5 fill-current" />
              </motion.button>
            ) : (
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => sendMessage()}
                disabled={!input.trim() && attachments.length === 0}
                className="p-2 bg-accent text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 mb-0.5 transition-opacity shadow-sm"
              >
                <Send className="w-5 h-5" />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
