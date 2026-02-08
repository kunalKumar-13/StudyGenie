import React, { useState, useEffect } from 'react';
import { Plus, MessageSquare, FileText, Trash2, LogOut, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { chatApi, type SessionSummary, type DocumentInfo } from '../api/client';
import { clsx } from 'clsx';

interface SidebarProps {
  currentSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onLogout: () => void;
  username: string;
  refreshTrigger: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSessionId,
  onNewChat,
  onSelectSession,
  onLogout,
  username,
  refreshTrigger,
}) => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'chats' | 'docs'>('chats');
  const [collapsed, setCollapsed] = useState(false);

  const loadSessions = async () => {
    try {
      const data = await chatApi.getSessions();
      setSessions(data);
    } catch (e) {
      console.error('Failed to load sessions', e);
    }
  };

  const loadDocuments = async () => {
    try {
      const data = await chatApi.getDocuments();
      setDocuments(data);
    } catch (e) {
      console.error('Failed to load documents', e);
    }
  };

  useEffect(() => {
    loadSessions();
    loadDocuments();
  }, [refreshTrigger]);

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    try {
      await chatApi.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) onNewChat();
    } catch (e) {
      console.error('Failed to delete session', e);
    }
  };

  const handleDeleteDocument = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    if (!confirm('Delete this document?')) return;
    try {
      await chatApi.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (e) {
      console.error('Failed to delete document', e);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (collapsed) {
    return (
      <div className="w-16 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-300 flex flex-col items-center py-5 gap-4 shrink-0 border-r border-slate-800/50 shadow-2xl relative overflow-hidden">
        {/* Subtle gradient accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-3xl" />
        
        <button onClick={() => setCollapsed(false)} className="relative z-10 p-2.5 hover:bg-slate-800 rounded-xl transition-all duration-200 hover:scale-110 hover:text-violet-400" title="Expand sidebar">
          <ChevronRight size={20} />
        </button>
        <button onClick={onNewChat} className="relative z-10 p-2.5 hover:bg-slate-800 rounded-xl transition-all duration-200 hover:scale-110 hover:text-violet-400" title="New chat">
          <Plus size={20} />
        </button>
        <button onClick={() => { setActiveTab('chats'); setCollapsed(false); }} className={clsx("relative z-10 p-2.5 hover:bg-slate-800 rounded-xl transition-all duration-200 hover:scale-110", activeTab === 'chats' && "text-violet-400 bg-slate-800")} title="Chats">
          <MessageSquare size={20} />
        </button>
        <button onClick={() => { setActiveTab('docs'); setCollapsed(false); }} className={clsx("relative z-10 p-2.5 hover:bg-slate-800 rounded-xl transition-all duration-200 hover:scale-110", activeTab === 'docs' && "text-violet-400 bg-slate-800")} title="Documents">
          <FileText size={20} />
        </button>
        <div className="flex-1" />
        <button onClick={onLogout} className="relative z-10 p-2.5 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all duration-200 hover:scale-110" title="Logout">
          <LogOut size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-200 flex flex-col shrink-0 border-r border-slate-800/50 shadow-2xl relative overflow-hidden">
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)`,
        backgroundSize: '40px 40px'
      }} />
      
      {/* Glowing accent */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl" />
      
      {/* Header */}
      <div className="relative z-10 p-4 border-b border-slate-800/50 flex items-center gap-3">
        <button
          onClick={onNewChat}
          className="group flex-1 relative flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-violet-500/20 hover:shadow-xl hover:shadow-violet-500/30 hover:-translate-y-0.5 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
          <Plus size={18} className="relative z-10" />
          <span className="relative z-10">New Chat</span>
        </button>
        <button onClick={() => setCollapsed(true)} className="p-2.5 hover:bg-slate-800 rounded-xl transition-all duration-200 hover:scale-110 hover:text-violet-400">
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="relative z-10 flex border-b border-slate-800/50">
        <button
          onClick={() => setActiveTab('chats')}
          className={clsx(
            'flex-1 py-3 text-xs font-semibold text-center transition-all duration-200 relative',
            activeTab === 'chats' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <MessageSquare size={15} />
            <span>Chats ({sessions.length})</span>
          </div>
          {activeTab === 'chats' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-indigo-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={clsx(
            'flex-1 py-3 text-xs font-semibold text-center transition-all duration-200 relative',
            activeTab === 'docs' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <FileText size={15} />
            <span>Docs ({documents.length})</span>
          </div>
          {activeTab === 'docs' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-indigo-500" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto relative z-10">
        {activeTab === 'chats' && (
          <div className="p-3 space-y-2">
            {sessions.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare size={32} className="mx-auto mb-3 text-slate-700" />
                <p className="text-slate-500 text-sm">No conversations yet</p>
                <p className="text-slate-600 text-xs mt-1">Start a new chat to get going</p>
              </div>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                className={clsx(
                  'group flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-sm transition-all duration-200 hover-lift',
                  currentSessionId === s.id
                    ? 'bg-gradient-to-r from-violet-600/20 to-indigo-600/20 text-white border border-violet-500/30 shadow-lg shadow-violet-500/10'
                    : 'hover:bg-slate-800/50 text-slate-300 border border-transparent hover:border-slate-700'
                )}
              >
                <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", currentSessionId === s.id ? "bg-violet-500/20" : "bg-slate-800")}>
                  <MessageSquare size={16} className={currentSessionId === s.id ? "text-violet-400" : "text-slate-500"} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-sm">{s.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{formatDate(s.updated_at)} · {s.message_count} msg{s.message_count !== 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(e, s.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-200"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="p-3 space-y-2">
            {documents.length === 0 && (
              <div className="text-center py-12">
                <FileText size={32} className="mx-auto mb-3 text-slate-700" />
                <p className="text-slate-500 text-sm">No documents yet</p>
                <p className="text-slate-600 text-xs mt-1">Upload notes to get started</p>
              </div>
            )}
            {documents.map((d) => (
              <div
                key={d.id}
                className="group flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800/50 text-sm transition-all duration-200 border border-transparent hover:border-slate-700 hover-lift"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-sm text-slate-300">{d.filename}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{formatSize(d.file_size)} · {d.chunks_count} chunk{d.chunks_count !== 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={(e) => handleDeleteDocument(e, d.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-200"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User info */}
      <div className="relative z-10 p-4 border-t border-slate-800/50 bg-slate-800/30 backdrop-blur-sm flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-lg shadow-violet-500/20">
          <User size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate text-white">{username}</p>
          <p className="text-xs text-slate-500">Student</p>
        </div>
        <button
          onClick={onLogout}
          className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-all duration-200 hover:scale-110"
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
};
