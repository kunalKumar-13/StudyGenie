import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, Loader2, CheckCircle, AlertCircle, Sparkles, BookOpen, FileText, X } from 'lucide-react';
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
  content: "Hey there! 👋 I'm **StudyGenie** — your AI study assistant.\n\nUpload your notes or documents and ask me anything. I'll give you clear, step-by-step explanations with source citations.",
};

/** Enhanced collapsible sources panel */
const SourcesPanel: React.FC<{ sources: Source[] }> = ({ sources }) => {
  const [open, setOpen] = useState(true);

  // De-duplicate by source name
  const seen = new Set<string>();
  const unique = sources.filter((s) => {
    const key = s.metadata?.source || '';
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-violet-600 transition-colors group mb-2"
      >
        <BookOpen size={12} className="group-hover:text-violet-500" />
        <span>{unique.length} source{unique.length !== 1 ? 's' : ''} referenced</span>
        <div className={clsx("ml-auto w-4 h-4 rounded bg-slate-100 flex items-center justify-center transition-transform", open && "rotate-180")}>
          <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 11L3 6h10l-5 5z"/>
          </svg>
        </div>
      </button>

      {open && (
        <div className="space-y-1.5 animate-slideDown">
          {unique.map((source, idx) => (
            <div
              key={idx}
              className="group flex items-start gap-2 px-3 py-2 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100/50 rounded-lg hover:border-violet-200 transition-all duration-200 hover:shadow-sm"
            >
              <FileText size={13} className="text-violet-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{prettifySource(source.metadata?.source)}</p>
                {source.metadata?.page !== undefined && (
                  <p className="text-[10px] text-slate-500">Page {source.metadata.page + 1}</p>
                )}
              </div>
            </div>
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
    <div className="flex flex-col h-screen flex-1 bg-slate-50 relative overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-50/30 via-transparent to-indigo-50/30 pointer-events-none" />
      
      {/* Header */}
      <header className="relative z-10 px-6 py-4 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-200">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent leading-tight">StudyGenie</h1>
            <p className="text-[10px] text-slate-500 font-medium">AI Study Assistant</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {uploadStatus && (
            <div className={clsx(
              "flex items-center gap-2 text-xs px-4 py-2 rounded-full animate-slideDown font-medium shadow-sm",
              uploadStatus.success ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"
            )}>
              {uploadStatus.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              <span>{uploadStatus.text}</span>
              <button onClick={() => setUploadStatus(null)} className="ml-1 hover:bg-black/5 rounded-full p-0.5">
                <X size={12} />
              </button>
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.txt,.md" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="group relative px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all duration-200 shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/40 hover:-translate-y-0.5 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
            {isUploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
            <span className="relative z-10">Upload Document</span>
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={clsx("flex gap-4 animate-slideUp", msg.role === 'user' ? "justify-end" : "")}>
              {msg.role === 'assistant' && (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-200 ring-2 ring-white">
                  <Sparkles size={16} className="text-white" />
                </div>
              )}

              <div className={clsx(
                "max-w-[75%] rounded-2xl px-5 py-4 text-[14.5px] leading-relaxed transition-all duration-200",
                msg.role === 'user'
                  ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-br-sm shadow-xl shadow-violet-200/50"
                  : "bg-white text-slate-800 border border-slate-200/60 rounded-bl-sm shadow-lg hover:shadow-xl",
                msg.isError && "!bg-red-50 !border-red-200 !text-red-700 !shadow-red-100",
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
                          <div className="bg-slate-900 text-slate-100 p-4 rounded-xl my-3 overflow-x-auto text-xs font-mono border border-slate-700 shadow-inner">
                            <code className={className} {...props}>{children}</code>
                          </div>
                        ) : (
                          <code className={clsx("px-2 py-0.5 rounded-md text-xs font-mono", msg.role === 'user' ? "bg-white/20 text-white" : "bg-violet-50 text-violet-700 border border-violet-100")} {...props}>
                            {children}
                          </code>
                        );
                      },
                      p({ children }) {
                        return <p className="mb-3 last:mb-0 text-[14.5px]">{children}</p>;
                      },
                      ul({ children }) {
                        return <ul className="list-disc pl-5 mb-3 space-y-1.5">{children}</ul>;
                      },
                      ol({ children }) {
                        return <ol className="list-decimal pl-5 mb-3 space-y-1.5">{children}</ol>;
                      },
                      strong({ children }) {
                        return <strong className="font-semibold text-slate-900">{children}</strong>;
                      },
                      a({ children, href }) {
                        return <a href={href} className="text-violet-600 hover:text-violet-700 underline" target="_blank" rel="noopener noreferrer">{children}</a>;
                      },
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>

                  {/* Streaming cursor */}
                  {msg.isStreaming && msg.content && (
                    <span className="inline-block w-1.5 h-5 bg-violet-500 rounded-sm animate-pulse ml-1 align-text-bottom" />
                  )}
                </div>

                {/* Sources — enhanced, always visible when present */}
                {msg.sources && msg.sources.length > 0 && !msg.isStreaming && (
                  <SourcesPanel sources={msg.sources} />
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 text-white text-[11px] font-bold shadow-lg ring-2 ring-white uppercase tracking-wide">
                  You
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator when waiting for stream */}
          {isLoading && messages.length > 0 && messages[messages.length - 1]?.content === '' && (
            <div className="flex gap-4 animate-slideUp">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-200 ring-2 ring-white">
                <Sparkles size={16} className="text-white" />
              </div>
              <div className="bg-white px-5 py-4 rounded-2xl rounded-bl-sm border border-slate-200/60 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-slate-500 font-medium">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="relative z-10 p-6 bg-white/80 backdrop-blur-xl border-t border-slate-200/50 shadow-2xl">
        <div className="max-w-4xl mx-auto">
          <div className="relative flex items-end bg-white border-2 border-slate-200 rounded-2xl focus-within:border-violet-500 focus-within:ring-4 focus-within:ring-violet-500/10 transition-all duration-200 shadow-lg hover:shadow-xl">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your notes... (Shift+Enter for new line)"
              rows={1}
              className="flex-1 bg-transparent py-4 pl-5 pr-16 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none max-h-[150px] leading-relaxed"
              disabled={isLoading}
              style={{ color: '#1e293b' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={clsx(
                "absolute right-2 bottom-2 p-3 rounded-xl transition-all duration-200 shadow-lg group overflow-hidden",
                input.trim() && !isLoading
                  ? "text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 hover:shadow-xl shadow-violet-500/30 hover:-translate-y-0.5"
                  : "text-slate-300 bg-slate-100 cursor-not-allowed shadow-slate-200"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
              {isLoading ? <Loader2 className="animate-spin relative z-10" size={18} /> : <Send size={18} className="relative z-10" />}
            </button>
          </div>
          <p className="text-[10px] text-center text-slate-400 mt-3 font-medium">
            StudyGenie is powered by AI and can make mistakes. Always verify important information.
          </p>
        </div>
      </div>
    </div>
  );
};
