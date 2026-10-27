import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Sparkles, User, Mail, Lock } from 'lucide-react';

export default function AuthModal({ isOpen, onClose }) {
  const { login, register } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (isRegisterMode) {
        await register(username, email, password, displayName);
      } else {
        await login(username || email, password);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#40382F]/50 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-md bg-[#FEFAE0] border border-[rgba(64,56,47,0.14)] rounded-[16px] p-6 sm:p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#75695A] hover:text-[#40382F] rounded-[8px] hover:bg-[#FAEDCD] transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-[12px] bg-[#D4A373] text-[#FEFAE0] mb-3 shadow-sm">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-[#40382F] tracking-tight">
            {isRegisterMode ? 'Join StudyStream' : 'Welcome Back'}
          </h2>
          <p className="text-xs sm:text-sm text-[#75695A] mt-1 font-normal">
            {isRegisterMode
              ? 'Start studying alongside thousands of focused scholars'
              : 'Sign in to access your streaks, rooms, and live statistics'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-[10px] bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegisterMode && (
            <div>
              <label className="block text-xs font-bold text-[#40382F] mb-1.5">Display Name</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-[#75695A]" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#FAEDCD] border border-[rgba(64,56,47,0.14)] rounded-[10px] pl-10 pr-4 py-2.5 text-xs text-[#40382F] placeholder-[#9E9080] focus:outline-none focus:border-[#D4A373] focus:ring-1 focus:ring-[#D4A373] shadow-sm"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#40382F] mb-1.5">
              {isRegisterMode ? 'Username' : 'Username or Email'}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-4 h-4 text-[#75695A]" />
              <input
                type="text"
                required
                placeholder="your_handle"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#FAEDCD] border border-[rgba(64,56,47,0.14)] rounded-[10px] pl-10 pr-4 py-2.5 text-xs text-[#40382F] placeholder-[#9E9080] focus:outline-none focus:border-[#D4A373] focus:ring-1 focus:ring-[#D4A373] shadow-sm"
              />
            </div>
          </div>

          {isRegisterMode && (
            <div>
              <label className="block text-xs font-bold text-[#40382F] mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-[#75695A]" />
                <input
                  type="email"
                  required
                  placeholder="you@domain.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#FAEDCD] border border-[rgba(64,56,47,0.14)] rounded-[10px] pl-10 pr-4 py-2.5 text-xs text-[#40382F] placeholder-[#9E9080] focus:outline-none focus:border-[#D4A373] focus:ring-1 focus:ring-[#D4A373] shadow-sm"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#40382F] mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-[#75695A]" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#FAEDCD] border border-[rgba(64,56,47,0.14)] rounded-[10px] pl-10 pr-4 py-2.5 text-xs text-[#40382F] placeholder-[#9E9080] focus:outline-none focus:border-[#D4A373] focus:ring-1 focus:ring-[#D4A373] shadow-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-2.5 px-4 rounded-[10px] bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] font-bold text-xs shadow-sm transition-all disabled:opacity-50"
          >
            {submitting ? 'Authenticating...' : isRegisterMode ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-5 text-center text-xs text-[#75695A]">
          {isRegisterMode ? (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setIsRegisterMode(false); setError(''); }}
                className="text-[#D4A373] hover:text-[#B88252] font-bold underline ml-1"
              >
                Sign In
              </button>
            </>
          ) : (
            <>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => { setIsRegisterMode(true); setError(''); }}
                className="text-[#D4A373] hover:text-[#B88252] font-bold underline ml-1"
              >
                Create Account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
