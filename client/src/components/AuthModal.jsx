import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Sparkles, User, Mail, Lock, Key, AlertCircle, CheckCircle2 } from 'lucide-react';
import { signInWithGoogle, isFirebaseConfigured, initFirebase } from '../utils/firebase';

export default function AuthModal({ isOpen, onClose }) {
  const { login, register, loginWithGoogle } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [showConfigHelper, setShowConfigHelper] = useState(false);
  const [pastedConfig, setPastedConfig] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
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

  const handleGoogleAuth = async () => {
    setError('');
    setInfoMessage('');

    if (!isFirebaseConfigured()) {
      setShowConfigHelper(true);
      return;
    }

    setGoogleSubmitting(true);
    try {
      const googleProfile = await signInWithGoogle();
      await loginWithGoogle(googleProfile);
      onClose();
    } catch (err) {
      console.error('Google Auth Error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Google sign-in popup was closed before completing');
      } else if (err.code === 'auth/invalid-api-key') {
        setError('Invalid Firebase API key. Please check your credentials in client/.env');
        setShowConfigHelper(true);
      } else {
        setError(err.message || 'Google authentication failed');
      }
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleApplyPastedConfig = (e) => {
    e.preventDefault();
    try {
      let parsed = null;
      try {
        parsed = JSON.parse(pastedConfig);
      } catch (err) {
        const clean = pastedConfig.replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":').replace(/'/g, '"');
        parsed = JSON.parse(clean);
      }

      if (parsed && parsed.apiKey) {
        const res = initFirebase(parsed);
        if (res.configured) {
          setShowConfigHelper(false);
          setInfoMessage('Firebase configuration applied! Click Google Sign-In again.');
          setError('');
        } else {
          setError('Could not initialize Firebase with provided keys.');
        }
      } else {
        setError('Config object must contain at least apiKey and authDomain.');
      }
    } catch (err) {
      setError('Failed to parse Firebase config. Please paste valid JSON or provide keys in client/.env');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#40382F]/70 font-['Inter',sans-serif]">
      <div 
        className="relative w-full max-w-md bg-[#FEFAE0] dark:bg-[#25291F] border border-[rgba(64,56,47,0.25)] dark:border-[#555C48] rounded-none p-6 sm:p-8 shadow-2xl transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#75695A] dark:text-[#CCD5AE] hover:text-[#40382F] dark:hover:text-[#FEFAE0] rounded-none hover:bg-[#FAEDCD] dark:hover:bg-[#343B2B] border border-transparent hover:border-[rgba(64,56,47,0.2)] dark:hover:border-[#555C48] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-none bg-[#D4A373] dark:bg-[#A66F3F] text-[#FEFAE0] mb-3 border border-[rgba(64,56,47,0.2)] dark:border-[#555C48]">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-[#40382F] dark:text-[#FEFAE0] tracking-tight uppercase">
            {isRegisterMode ? 'Join StudyStream' : 'Welcome Back'}
          </h2>
          <p className="text-xs sm:text-sm text-[#75695A] dark:text-[#CCD5AE] mt-1 font-normal">
            {isRegisterMode
              ? 'Start studying alongside thousands of focused scholars'
              : 'Sign in to access your streaks, rooms, and live statistics'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-none bg-rose-100 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs">
            {error}
          </div>
        )}

        {infoMessage && (
          <div className="mb-4 p-3 rounded-none bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* Google One-Click Authentication Button */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={submitting || googleSubmitting}
          className="w-full py-2.5 px-4 mb-4 rounded-none bg-[#FAEDCD] dark:bg-[#343B2B] border border-[rgba(64,56,47,0.25)] dark:border-[#555C48] text-[#40382F] dark:text-[#FEFAE0] hover:bg-[#E9EDC9] dark:hover:bg-[#454D37] text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2.5 transition-colors disabled:opacity-50"
        >
          {/* Official Google G Logo SVG */}
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>
            {googleSubmitting
              ? 'Connecting to Google...'
              : isRegisterMode
              ? 'Sign up with Google'
              : 'Sign in with Google'}
          </span>
        </button>

        {/* Inline Firebase Configuration Helper when keys needed */}
        {showConfigHelper && (
          <div className="mb-4 p-4 rounded-none bg-[#FAEDCD] dark:bg-[#343B2B] border border-[#D4A373] text-xs">
            <div className="flex items-start space-x-2.5 mb-2">
              <Key className="w-4 h-4 text-[#D4A373] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold text-[#40382F] dark:text-[#FEFAE0] uppercase tracking-wider">Firebase Setup Ready</p>
                <p className="text-[11px] text-[#75695A] dark:text-[#CCD5AE] mt-0.5">
                  Paste your Firebase config object below or place it in <code className="font-mono bg-[#E9EDC9] dark:bg-[#454D37] px-1 py-0.5">client/.env</code>:
                </p>
              </div>
            </div>

            <form onSubmit={handleApplyPastedConfig} className="mt-2 space-y-2">
              <textarea
                rows={4}
                value={pastedConfig}
                onChange={(e) => setPastedConfig(e.target.value)}
                placeholder={'{\n  "apiKey": "AIzaSy...",\n  "authDomain": "your-app.firebaseapp.com",\n  "projectId": "your-project"\n}'}
                className="w-full font-mono text-[11px] bg-[#FEFAE0] dark:bg-[#25291F] border border-[rgba(64,56,47,0.25)] dark:border-[#555C48] rounded-none p-2 text-[#40382F] dark:text-[#FEFAE0] focus:outline-none focus:border-[#D4A373]"
              />
              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowConfigHelper(false)}
                  className="px-2.5 py-1 text-[11px] text-[#75695A] dark:text-[#CCD5AE] hover:underline uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 rounded-none bg-[#D4A373] dark:bg-[#A66F3F] text-[#40382F] dark:text-[#FEFAE0] font-bold uppercase tracking-wider text-[11px] hover:bg-[#C59361] border border-[rgba(64,56,47,0.2)]"
                >
                  Save & Connect
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="relative flex py-2 items-center mb-4">
          <div className="flex-grow border-t border-[rgba(64,56,47,0.2)] dark:border-[#555C48]"></div>
          <span className="flex-shrink mx-3 text-[#75695A] dark:text-[#CCD5AE] text-[10px] uppercase tracking-wider font-bold">
            or continue with credentials
          </span>
          <div className="flex-grow border-t border-[rgba(64,56,47,0.2)] dark:border-[#555C48]"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegisterMode && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#40382F] dark:text-[#FEFAE0] mb-1.5">Display Name</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-[#75695A] dark:text-[#CCD5AE]" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#FAEDCD] dark:bg-[#343B2B] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none pl-10 pr-4 py-2.5 text-xs text-[#40382F] dark:text-[#FEFAE0] placeholder-[#9E9080] dark:placeholder-[#CCD5AE]/60 focus:outline-none focus:border-[#D4A373]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#40382F] dark:text-[#FEFAE0] mb-1.5">
              {isRegisterMode ? 'Username' : 'Username or Email'}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-4 h-4 text-[#75695A] dark:text-[#CCD5AE]" />
              <input
                type="text"
                required
                placeholder="your_handle"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#FAEDCD] dark:bg-[#343B2B] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none pl-10 pr-4 py-2.5 text-xs text-[#40382F] dark:text-[#FEFAE0] placeholder-[#9E9080] dark:placeholder-[#CCD5AE]/60 focus:outline-none focus:border-[#D4A373]"
              />
            </div>
          </div>

          {isRegisterMode && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#40382F] dark:text-[#FEFAE0] mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-[#75695A] dark:text-[#CCD5AE]" />
                <input
                  type="email"
                  required
                  placeholder="you@domain.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#FAEDCD] dark:bg-[#343B2B] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none pl-10 pr-4 py-2.5 text-xs text-[#40382F] dark:text-[#FEFAE0] placeholder-[#9E9080] dark:placeholder-[#CCD5AE]/60 focus:outline-none focus:border-[#D4A373]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#40382F] dark:text-[#FEFAE0] mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-[#75695A] dark:text-[#CCD5AE]" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#FAEDCD] dark:bg-[#343B2B] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none pl-10 pr-4 py-2.5 text-xs text-[#40382F] dark:text-[#FEFAE0] placeholder-[#9E9080] dark:placeholder-[#CCD5AE]/60 focus:outline-none focus:border-[#D4A373]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-2.5 px-4 rounded-none bg-[#D4A373] hover:bg-[#C59361] dark:bg-[#A66F3F] dark:hover:bg-[#D4A373] text-[#40382F] dark:text-[#FEFAE0] font-bold text-xs uppercase tracking-wider border border-[rgba(64,56,47,0.25)] dark:border-[#555C48] transition-colors disabled:opacity-50"
          >
            {submitting ? 'Authenticating...' : isRegisterMode ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-5 text-center text-xs text-[#75695A] dark:text-[#CCD5AE]">
          {isRegisterMode ? (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setIsRegisterMode(false); setError(''); }}
                className="text-[#D4A373] hover:text-[#B88252] font-bold underline ml-1 uppercase"
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
                className="text-[#D4A373] hover:text-[#B88252] font-bold underline ml-1 uppercase"
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
