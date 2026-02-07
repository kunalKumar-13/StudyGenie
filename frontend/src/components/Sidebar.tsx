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
      <div className="w-14 bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 text-gray-300 flex flex-col items-center py-4 gap-3 shrink-0 border-r border-gray-800 shadow-2xl">
        <button onClick={() => setCollapsed(false)} className="p-2 hover:bg-gray-800 rounded-lg transition-all duration-200 hover:scale-110" title="Expand sidebar">
          <ChevronRight size={20} />
        </button>
        <button onClick={onNewChat} className="p-2 hover:bg-gray-800 rounded-lg transition-all duration-200 hover:scale-110" title="New chat">
          <Plus size={20} />
        </button>
        <button onClick={() => { setActiveTab('chats'); setCollapsed(false); }} className="p-2 hover:bg-gray-800 rounded-lg transition-all duration-200 hover:scale-110" title="Chats">
          <MessageSquare size={20} />
        </button>
        <button onClick={() => { setActiveTab('docs'); setCollapsed(false); }} className="p-2 hover:bg-gray-800 rounded-lg transition-all duration-200 hover:scale-110" title="Documents">
          <FileText size={20} />
        </button>
        <div className="flex-1" />
        <button onClick={onLogout} className="p-2 hover:bg-red-600/20 hover:text-red-400 rounded-lg transition-all duration-200 hover:scale-110" title="Logout">
          <LogOut size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 text-gray-200 flex flex-col shrink-0 border-r border-gray-800 shadow-2xl">
      {/* Header */}
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <button
          onClick={onNewChat}
          className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          <Plus size={16} />
          New Chat
        </button>
        <button onClick={() => setCollapsed(true)} className="ml-2 p-1.5 hover:bg-gray-800 rounded-lg transition-all duration-200 hover:scale-110">
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('chats')}
          className={clsx(
            'flex-1 py-2.5 text-xs font-semibold text-center transition-all duration-200',
            activeTab === 'chats' ? 'text-white border-b-2 border-violet-500 bg-gray-800/50' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'
          )}
        >
          <MessageSquare size={14} className="inline mr-1 -mt-0.5" />
          Chats ({sessions.length})
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={clsx(
            'flex-1 py-2 text-xs font-medium text-center transition-colors',
            activeTab === 'docs' ? 'text-white border-b-2 border-violet-500' : 'text-gray-400 hover:text-gray-200'
          )}
        >
          <FileText size={14} className="inline mr-1 -mt-0.5" />
          Docs ({documents.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'chats' && (
          <div className="p-2 space-y-1">
            {sessions.length === 0 && (
              <p className="text-gray-500 text-xs text-center py-4">No conversations yet</p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                className={clsx(
                  'group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-all duration-200',
                  currentSessionId === s.id
                    ? 'bg-gradient-to-r from-violet-600/20 to-indigo-600/20 text-white border-l-2 border-violet-500 shadow-lg'
                    : 'hover:bg-gray-800 text-gray-300 hover:translate-x-1'
                )}
              >
                <MessageSquare size={14} className="shrink-0 text-gray-500" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm">{s.title}</p>
                  <p className="text-xs text-gray-500">{formatDate(s.updated_at)} · {s.message_count} msgs</p>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(e, s.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 hover:bg-red-400/10 rounded transition-all duration-200"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="p-2 space-y-1">
            {documents.length === 0 && (
              <p className="text-gray-500 text-xs text-center py-4">No documents uploaded yet</p>
            )}
            {documents.map((d) => (
              <div
                key={d.id}
                className="group flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-gray-800 text-sm transition-all duration-200 hover:translate-x-1"
              >
                <FileText size={14} className="shrink-0 text-blue-400" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm text-gray-300">{d.filename}</p>
                  <p className="text-xs text-gray-500">{formatSize(d.file_size)} · {d.chunks_count} chunks</p>
                </div>
                <button
                  onClick={(e) => handleDeleteDocument(e, d.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 hover:bg-red-400/10 rounded transition-all duration-200"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User info */}
      <div className="p-3 border-t border-gray-800 bg-gray-800/50 flex items-center gap-3">
        <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-lg">
          <User size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{username}</p>
        </div>
        <button
          onClick={onLogout}
          className="p-2 hover:bg-red-600/20 rounded-lg text-gray-400 hover:text-red-400 transition-all duration-200 hover:scale-110"
          title="Logout"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
};
