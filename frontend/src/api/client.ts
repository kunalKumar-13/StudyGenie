import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Attach JWT token to every request
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// --- Types ---

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface Source {
    text: string;
    metadata: Record<string, any>;
}

export interface ChatResponse {
    answer: string;
    sources: Source[];
    session_id: string;
}

export interface SessionSummary {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    message_count: number;
}

export interface SessionDetail {
    id: string;
    title: string;
    created_at: string;
    messages: { role: string; content: string; created_at: string; sources?: Source[] }[];
}

export interface DocumentInfo {
    id: string;
    filename: string;
    file_size: number;
    chunks_count: number;
    status: string;
    uploaded_at: string;
}

export interface LoginResponse {
    access_token: string;
    token_type: string;
    user_id: string;
    username: string;
}

export interface UserResponse {
    id: string;
    username: string;
    full_name: string;
}

// --- Auth API ---

export const authApi = {
    register: async (username: string, password: string, full_name: string): Promise<UserResponse> => {
        const response = await apiClient.post<UserResponse>('/auth/register', { username, password, full_name });
        return response.data;
    },

    login: async (username: string, password: string): Promise<LoginResponse> => {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);
        const response = await apiClient.post<LoginResponse>('/auth/login', formData, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        return response.data;
    },
};

// --- Chat API ---

export const chatApi = {
    sendMessage: async (query: string, history: ChatMessage[], session_id?: string): Promise<ChatResponse> => {
        const response = await apiClient.post<ChatResponse>('/chat', { query, history, session_id });
        return response.data;
    },

    /**
     * Stream chat response via SSE. Returns an EventSource-like reader.
     * Calls onToken for each streamed token, onMeta for session/source info, onDone when complete.
     */
    sendMessageStream: async (
        query: string,
        session_id: string | undefined,
        onMeta: (meta: { session_id: string; sources: Source[] }) => void,
        onToken: (token: string) => void,
        onDone: () => void,
        onError: (error: string) => void,
    ): Promise<void> => {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`${API_URL}/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ query, session_id }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                onError(errData.detail || `Server error (${response.status})`);
                return;
            }

            const reader = response.body?.getReader();
            if (!reader) { onError('No response body'); return; }
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            onDone();
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.type === 'meta') {
                                onMeta({ session_id: parsed.session_id, sources: parsed.sources || [] });
                            } else if (parsed.type === 'token') {
                                onToken(parsed.content);
                            }
                        } catch { /* skip malformed */ }
                    }
                }
            }
            onDone();
        } catch (err: any) {
            onError(err?.message || 'Network error');
        }
    },

    getSessions: async (): Promise<SessionSummary[]> => {
        const response = await apiClient.get<{ sessions: SessionSummary[] }>('/chat/sessions');
        return response.data.sessions;
    },

    getSession: async (sessionId: string): Promise<SessionDetail> => {
        const response = await apiClient.get<SessionDetail>(`/chat/sessions/${sessionId}`);
        return response.data;
    },

    deleteSession: async (sessionId: string): Promise<void> => {
        await apiClient.delete(`/chat/sessions/${sessionId}`);
    },

    uploadDocument: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await apiClient.post('/documents/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    getDocuments: async (): Promise<DocumentInfo[]> => {
        const response = await apiClient.get<{ documents: DocumentInfo[] }>('/documents');
        return response.data.documents;
    },

    deleteDocument: async (docId: string): Promise<void> => {
        await apiClient.delete(`/documents/${docId}`);
    },
};
