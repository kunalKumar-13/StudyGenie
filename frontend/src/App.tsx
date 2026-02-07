import { useState, useCallback, type FC } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { AuthPage } from './components/AuthPage';
import { Sidebar } from './components/Sidebar';

const App: FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [username, setUsername] = useState<string>(localStorage.getItem('username') || '');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleLogin = (accessToken: string, user: string) => {
    localStorage.setItem('token', accessToken);
    localStorage.setItem('username', user);
    setToken(accessToken);
    setUsername(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
    setUsername('');
    setCurrentSessionId(null);
  };

  const handleNewChat = useCallback(() => {
    setCurrentSessionId(null);
  }, []);

  const handleSelectSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
  }, []);

  const handleSessionCreated = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const handleRefreshSidebar = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Not logged in → show auth page
  if (!token) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar
        currentSessionId={currentSessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onLogout={handleLogout}
        username={username}
        refreshTrigger={refreshTrigger}
      />
      <ChatInterface
        sessionId={currentSessionId}
        onSessionCreated={handleSessionCreated}
        onRefreshSidebar={handleRefreshSidebar}
      />
    </div>
  );
};

export default App;
