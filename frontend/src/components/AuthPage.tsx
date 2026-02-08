import React, { useState } from 'react';
import { ArrowRight, Loader2, BookOpen, Brain, Zap, Shield, Sparkles, User, Lock } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-50 flex relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-50/40 via-transparent to-indigo-50/40 pointer-events-none" />
      
      {/* Animated orbs (subtle) */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-violet-200/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl animate-float-delayed" />
      {/* Animated orbs (subtle) */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-violet-200/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl animate-float-delayed" />

      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-2/5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }} />
        
        {/* Glowing accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 space-y-16">
          {/* Logo & Title */}
          <div className="space-y-4 animate-slideInLeft">
            <div className="inline-flex items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 px-4 py-2 rounded-full">
              <Sparkles className="text-violet-400" size={20} />
              <span className="text-sm font-medium text-white/90 tracking-wide">AI-Powered Learning</span>
            </div>
            <h1 className="text-5xl font-bold leading-tight">
              Study<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">Genie</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-md">Your personal AI study assistant. Upload notes, ask questions, get instant answers with citations.</p>
          </div>

          {/* Features */}
          <div className="space-y-6">
            <div className="group flex items-start gap-4 animate-slideInLeft" style={{animationDelay: '0.1s'}}>
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-violet-500/20 to-violet-600/20 backdrop-blur-sm border border-violet-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:border-violet-400/40 transition-all duration-300">
                <Brain className="text-violet-400" size={20} />
              </div>
              <div className="pt-1">
                <h3 className="font-semibold text-white mb-1">Smart RAG Pipeline</h3>
                <p className="text-sm text-slate-400 leading-relaxed">Retrieval-augmented generation ensures answers are grounded in your materials</p>
              </div>
            </div>

            <div className="group flex items-start gap-4 animate-slideInLeft" style={{animationDelay: '0.2s'}}>
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 backdrop-blur-sm border border-indigo-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:border-indigo-400/40 transition-all duration-300">
                <Zap className="text-indigo-400" size={20} />
              </div>
              <div className="pt-1">
                <h3 className="font-semibold text-white mb-1">Real-Time Streaming</h3>
                <p className="text-sm text-slate-400 leading-relaxed">Watch answers generate live with instant, token-by-token responses</p>
              </div>
            </div>

            <div className="group flex items-start gap-4 animate-slideInLeft" style={{animationDelay: '0.3s'}}>
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500/20 to-purple-600/20 backdrop-blur-sm border border-purple-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:border-purple-400/40 transition-all duration-300">
                <BookOpen className="text-purple-400" size={20} />
              </div>
              <div className="pt-1">
                <h3 className="font-semibold text-white mb-1">Source Citations</h3>
                <p className="text-sm text-slate-400 leading-relaxed">Every answer shows exactly which document it came from</p>
              </div>
            </div>

            <div className="group flex items-start gap-4 animate-slideInLeft" style={{animationDelay: '0.4s'}}>
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-pink-500/20 to-pink-600/20 backdrop-blur-sm border border-pink-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:border-pink-400/40 transition-all duration-300">
                <Shield className="text-pink-400" size={20} />
              </div>
              <div className="pt-1">
                <h3 className="font-semibold text-white mb-1">100% Local</h3>
                <p className="text-sm text-slate-400 leading-relaxed">Your data stays on your machine. No cloud dependency required</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-slate-500 text-sm relative z-10">Built for students who want AI-powered learning without the hallucinations.</p>
      </div>

      {/* Right side - auth form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 relative z-10">
        <div className="w-full max-w-md animate-slideInRight">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex items-center gap-2 mb-2">
              <Sparkles className="text-violet-600" size={28} />
              <h1 className="text-3xl font-bold">
                Study<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">Genie</span>
              </h1>
            </div>
            <p className="text-slate-500 text-sm">AI-powered study assistant</p>
          </div>

          {/* Form card */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-900/10 border border-white/20 p-8 sm:p-10 relative overflow-hidden hover-lift">
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            
            <div className="relative z-10">
              {/* Header */}
              <div className="mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                  {isLogin ? 'Welcome back' : 'Get started'}
                </h2>
                <p className="text-slate-500">
                  {isLogin ? 'Continue your learning journey' : 'Create your account to begin'}
                </p>
              </div>

              {/* Alerts */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm flex items-start gap-2 animate-shake">
                  <div className="w-1 h-full bg-red-500 rounded-full absolute left-0 top-0 bottom-0" />
                  <span className="ml-2">{error}</span>
                </div>
              )}
              {successMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl mb-6 text-sm flex items-start gap-2 animate-slideDown">
                  <div className="w-1 h-full bg-emerald-500 rounded-full absolute left-0 top-0 bottom-0" />
                  <span className="ml-2">{successMsg}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && (
                  <div className="group">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-500 transition-colors" size={18} />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all duration-200 bg-white hover:border-slate-300 text-slate-900 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                )}
                
                <div className="group">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-500 transition-colors" size={18} />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your username"
                      required
                      className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all duration-200 bg-white hover:border-slate-300 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="group">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-500 transition-colors" size={18} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all duration-200 bg-white hover:border-slate-300 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !username || !password}
                  className="w-full mt-6 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/40 hover:-translate-y-0.5 active:translate-y-0 group relative overflow-hidden"
                >
                  {/* Button shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                  
                  {isLoading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              {/* Toggle */}
              <div className="mt-8 text-center">
                <button
                  onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMsg(''); }}
                  className="text-sm text-slate-600 hover:text-violet-600 font-medium transition-colors inline-flex items-center gap-1 group"
                >
                  {isLogin ? "Don't have an account?" : 'Already have an account?'}
                  <span className="text-violet-600 group-hover:translate-x-0.5 transition-transform">
                    {isLogin ? 'Sign up' : 'Sign in'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
