import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, Loader2, CheckCircle, AlertCircle, Sparkles, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { chatApi, type ChatMessage, type Source } from '../api/client';
import { clsx } from 'clsx';

/** Turn a raw filename like "test_notes.txt" into "Test Notes" */
function prettifySource(raw?: string): string {
  if (!raw) return 'Document';
  // Strip path prefix and file extension
  const name = raw.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
  // Replace underscores/hyphens with spaces and title-case
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Message extends ChatMessage {
  id: string;
  sources?: Source[];
  isError?: boolean;
  isStreaming?: boolean;
}

interface ChatInterfaceProps {
  sessionId: string | null;
  onSessionCreated: (sessionId: string) => void;
  onRefreshSidebar: () => void;
}

const WELCOME_MSG: Message = {
  id: 'welcome',
  role: 'assistant',
  content: "Hey there! 👋 I'm **StudyGenie** — your AI study assistant.\n\nUpload your notes or documents and ask me anything. I'll give you clear, step-by-step explanations based on your materials.",
};

/** Collapsible references section — shows source doc names only, expandable */
const SourcesPanel: React.FC<{ sources: Source[] }> = ({ sources }) => {
  const [open, setOpen] = useState(false);

  // De-duplicate by source name
  const seen = new Set<string>();
  const unique = sources.filter((s) => {
    const key = s.metadata?.source || '';
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div className="mt-2.5 pt-2 border-t border-gray-100">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 hover:text-violet-500 transition-colors uppercase tracking-widest group"
      >
        <BookOpen size={10} className="group-hover:text-violet-400" />
        {unique.length} source{unique.length !== 1 ? 's' : ''} used
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>

      {open && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {unique.map((source, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-1 bg-violet-50 text-violet-700 border border-violet-100 rounded-md text-[11px] font-medium"
            >
              <BookOpen size={10} className="text-violet-400" />
              {prettifySource(source.metadata?.source)}
              {source.metadata?.page !== undefined && (
                <span className="text-violet-400 ml-0.5">p.{source.metadata.page + 1}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ sessionId, onSessionCreated, onRefreshSidebar }) => {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ text: string; success: boolean } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentSessionRef = useRef<string | null>(sessionId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [input]);

  // When sessionId prop changes, load that session's messages
  useEffect(() => {
    currentSessionRef.current = sessionId;
    if (!sessionId) {
      setMessages([WELCOME_MSG]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const detail = await chatApi.getSession(sessionId);
        if (cancelled) return;
        const loaded: Message[] = detail.messages.map((m, i) => ({
          id: `${sessionId}-${i}`,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          sources: m.sources,
        }));
        setMessages(loaded.length > 0 ? loaded : [WELCOME_MSG]);
      } catch {
        if (!cancelled) setMessages([WELCOME_MSG]);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    const streamMsgId = (Date.now() + 1).toString();

    setMessages(prev => [...prev, userMessage, {
      id: streamMsgId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    }]);
    setInput('');
    setIsLoading(true);

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      await chatApi.sendMessageStream(
        userMessage.content,
        currentSessionRef.current ?? undefined,
        // onMeta
        (meta) => {
          if (!currentSessionRef.current && meta.session_id) {
            currentSessionRef.current = meta.session_id;
            onSessionCreated(meta.session_id);
          }
          if (meta.sources?.length) {
            setMessages(prev => prev.map(m =>
              m.id === streamMsgId ? { ...m, sources: meta.sources } : m
            ));
          }
        },
        // onToken
        (token) => {
          setMessages(prev => prev.map(m =>
            m.id === streamMsgId ? { ...m, content: m.content + token } : m
          ));
        },
        // onDone
        () => {
          setMessages(prev => prev.map(m =>
            m.id === streamMsgId ? { ...m, isStreaming: false } : m
          ));
          setIsLoading(false);
          onRefreshSidebar();
        },
        // onError
        (error) => {
          setMessages(prev => prev.map(m =>
            m.id === streamMsgId ? { ...m, content: error, isError: true, isStreaming: false } : m
          ));
          setIsLoading(false);
        }
      );
    } catch (error: any) {
      setMessages(prev => prev.map(m =>
        m.id === streamMsgId ? {
          ...m,
          content: error?.response?.data?.detail || "Something went wrong. Please try again.",
          isError: true,
          isStreaming: false,
        } : m
      ));
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadStatus(null);
    try {
      const result = await chatApi.uploadDocument(file);
      setUploadStatus({ text: `${file.name} uploaded (${result.chunks_count} chunks indexed)`, success: true });
      onRefreshSidebar();
      setTimeout(() => setUploadStatus(null), 5000);
    } catch {
      setUploadStatus({ text: 'Upload failed. Please try again.', success: false });
      setTimeout(() => setUploadStatus(null), 5000);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen flex-1 bg-[#f8f9fc]">
      {/* Header */}
      <header className="px-5 py-3 bg-white border-b border-gray-200/80 flex justify-between items-center z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-md shadow-violet-200">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight tracking-tight">StudyGenie</h1>
            <p className="text-[10px] text-gray-400 leading-tight font-medium">AI-Powered Study Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {uploadStatus && (
            <div className={clsx(
              "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full animate-fadeIn font-medium",
              uploadStatus.success ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"
            )}>
              {uploadStatus.success ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
              {uploadStatus.text}
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.txt,.md" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 flex items-center gap-1.5 transition-all duration-200 shadow-sm shadow-violet-200 hover:shadow-md hover:shadow-violet-200"
          >
            {isUploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
            Upload Notes
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
          {messages.map((msg) => (
            <div key={msg.id} className={clsx("flex gap-3 animate-slideUp", msg.role === 'user' ? "justify-end" : "")}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm shadow-violet-200 mt-0.5">
                  <Sparkles size={14} className="text-white" />
                </div>
              )}

              <div className={clsx(
                "max-w-[80%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed",
                msg.role === 'user'
                  ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-br-md shadow-md shadow-violet-200"
                  : "bg-white text-gray-800 border border-gray-200/80 rounded-bl-md shadow-sm",
                msg.isError && "!bg-red-50 !border-red-200 !text-red-700",
              )}>
                <div className={clsx(
                  "prose prose-sm max-w-none break-words",
                  msg.role === 'user' && "prose-invert",
                  msg.isError && "prose-red"
                )}>
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        return !inline ? (
                          <div className="bg-gray-900 text-gray-100 p-3 rounded-lg my-2 overflow-x-auto text-xs font-mono">
                            <code className={className} {...props}>{children}</code>
                          </div>
                        ) : (
                          <code className={clsx("px-1.5 py-0.5 rounded text-xs font-mono", msg.role === 'user' ? "bg-white/20 text-white" : "bg-violet-50 text-violet-700 border border-violet-100")} {...props}>
                            {children}
                          </code>
                        );
                      },
                      p({ children }) {
                        return <p className="mb-2 last:mb-0">{children}</p>;
                      },
                      ul({ children }) {
                        return <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>;
                      },
                      ol({ children }) {
                        return <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>;
                      },
                      strong({ children }) {
                        return <strong className="font-semibold">{children}</strong>;
                      },
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>

                  {/* Streaming cursor */}
                  {msg.isStreaming && msg.content && (
                    <span className="inline-block w-1.5 h-4 bg-violet-500 rounded-sm animate-pulse ml-0.5 align-text-bottom" />
                  )}
                </div>

                {/* Sources — collapsible, clean */}
                {msg.sources && msg.sources.length > 0 && !msg.isStreaming && (
                  <SourcesPanel sources={msg.sources} />
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0 text-white text-[10px] font-bold shadow-sm mt-0.5 uppercase tracking-wide">
                  You
                </div>
              )}
            </div>
          ))}

          {/* Loading dots when streaming hasn't started yet */}
          {isLoading && messages.length > 0 && messages[messages.length - 1]?.content === '' && (
            <div className="flex gap-3 animate-slideUp">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm shadow-violet-200">
                <Sparkles size={14} className="text-white" />
              </div>
              <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md border border-gray-200/80 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-gray-400">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200/80">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end bg-gray-50 border border-gray-200 rounded-2xl focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-50 transition-all duration-200 shadow-sm">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your notes... (Shift+Enter for new line)"
              rows={1}
              className="flex-1 bg-transparent py-3.5 pl-4 pr-14 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none max-h-[150px] leading-relaxed"
              disabled={isLoading}
              style={{ color: '#1f2937' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={clsx(
                "absolute right-2 bottom-2 p-2.5 rounded-xl transition-all duration-200 shadow-sm",
                input.trim() && !isLoading
                  ? "text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 hover:shadow-md shadow-violet-200"
                  : "text-gray-300 bg-gray-100 cursor-not-allowed"
              )}
            >
              {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            </button>
          </div>
          <p className="text-[10px] text-center text-gray-300 mt-2 font-medium">
            StudyGenie can make mistakes — always verify important information.
          </p>
        </div>
      </div>
    </div>
  );
};
