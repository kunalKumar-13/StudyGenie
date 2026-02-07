import React, { useState } from 'react';
import { GraduationCap, LogIn, UserPlus, Loader2, BookOpen, Brain, FileText, MessageSquare, Sparkles } from 'lucide-react';
import { authApi } from '../api/client';

interface AuthPageProps {
  onLogin: (token: string, username: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      if (isLogin) {
        const res = await authApi.login(username, password);
        onLogin(res.access_token, res.username);
      } else {
        await authApi.register(username, password, fullName);
        setSuccessMsg('Account created! You can now log in.');
        setIsLogin(true);
        setPassword('');
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex animate-fadeIn">
      {/* Left side - branding & features */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-600 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.1),transparent)]" />
        <div className="relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles size={40} />
            <h1 className="text-3xl font-bold">StudyGenie</h1>
          </div>
          <p className="text-violet-100 text-lg mt-2">Your intelligent study companion powered by AI</p>
        </div>

        <div className="space-y-6 relative z-10">
          <div className="flex items-start gap-4 group hover:translate-x-2 transition-transform duration-300">
            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl group-hover:bg-white/30 transition-colors shadow-lg"><BookOpen size={24} /></div>
            <div>
              <h3 className="font-semibold text-lg">Upload Study Materials</h3>
              <p className="text-violet-100 text-sm">Upload PDFs, text files, or markdown notes and let AI understand them.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 group hover:translate-x-2 transition-transform duration-300">
            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl group-hover:bg-white/30 transition-colors shadow-lg"><Brain size={24} /></div>
            <div>
              <h3 className="font-semibold text-lg">Context-Aware Answers</h3>
              <p className="text-violet-100 text-sm">Get accurate, step-by-step explanations based only on your materials.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 group hover:translate-x-2 transition-transform duration-300">
            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl group-hover:bg-white/30 transition-colors shadow-lg"><FileText size={24} /></div>
            <div>
              <h3 className="font-semibold text-lg">Source Citations</h3>
              <p className="text-violet-100 text-sm">Every answer shows exactly which document and section it came from.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 group hover:translate-x-2 transition-transform duration-300">
            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl group-hover:bg-white/30 transition-colors shadow-lg"><MessageSquare size={24} /></div>
            <div>
              <h3 className="font-semibold text-lg">Chat History</h3>
              <p className="text-violet-100 text-sm">Your conversations are saved so you can revisit them anytime.</p>
            </div>
          </div>
        </div>

        <p className="text-violet-200 text-sm relative z-10">&copy; 2026 StudyGenie. Built for students, by students.</p>
        </div>
      </div>

      {/* Right side - auth form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <Sparkles size={32} className="text-violet-600" />
            <h1 className="text-2xl font-bold text-gray-800">StudyGenie</h1>
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/50 p-8 hover:shadow-3xl transition-shadow duration-300">
            <h2 className="text-2xl font-bold text-gray-800 mb-1">
              {isLogin ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-gray-500 mb-6 text-sm">
              {isLogin ? 'Log in to continue learning' : 'Sign up to start your AI-powered study sessions'}
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !username || !password}
                className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : isLogin ? (
                  <LogIn size={18} />
                ) : (
                  <UserPlus size={18} />
                )}
                {isLogin ? 'Log In' : 'Create Account'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMsg(''); }}
                className="text-sm text-violet-600 hover:text-violet-700 font-medium"
              >
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
