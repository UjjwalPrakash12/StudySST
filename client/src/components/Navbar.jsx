import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Flame, Clock, Users, BarChart3, Trophy, LogIn, LogOut, Sparkles } from 'lucide-react';

export default function Navbar({ currentView, setCurrentView, onOpenAuth }) {
  const { user, logout, isAuthenticated } = useAuth();

  const totalHours = user ? (user.total_focus_minutes / 60).toFixed(1) : '0.0';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#0c0e14]/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentView('lobby')}>
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-pink-500 shadow-lg shadow-indigo-500/25">
            <Sparkles className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-[#0c0e14]"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-lg text-white tracking-tight">StudyStream</span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase tracking-wider">
                Live
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Virtual 24/7 Focus Hall</p>
          </div>
        </div>

        {/* Center Nav Views */}
        <nav className="hidden md:flex items-center space-x-1 bg-white/5 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setCurrentView('lobby')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentView === 'lobby'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Study Halls</span>
          </button>

          <button
            onClick={() => setCurrentView('analytics')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentView === 'analytics'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Stats & Streaks</span>
          </button>

          <button
            onClick={() => setCurrentView('leaderboard')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentView === 'leaderboard'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Leaderboard</span>
          </button>
        </nav>

        {/* Right Section: Badges & Auth */}
        <div className="flex items-center space-x-3">
          {isAuthenticated ? (
            <>
              {/* Streak badge */}
              <div 
                onClick={() => setCurrentView('analytics')}
                className="cursor-pointer flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition-all"
                title={`${user.current_streak} Day Focus Streak!`}
              >
                <Flame className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
                <span>{user.current_streak || 0}d streak</span>
              </div>

              {/* Total Hours badge */}
              <div 
                onClick={() => setCurrentView('analytics')}
                className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-medium hover:bg-indigo-500/20 transition-all"
              >
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>{totalHours}h focused</span>
              </div>

              {/* User Avatar & Logout */}
              <div className="flex items-center space-x-2 pl-2 border-l border-white/10">
                <div 
                  onClick={() => setCurrentView('analytics')}
                  className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 text-white font-bold text-xs flex items-center justify-center cursor-pointer ring-2 ring-indigo-500/30 hover:ring-indigo-500 transition-all"
                  title={user.display_name}
                >
                  {user.display_name.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={logout}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-all"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={onOpenAuth}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In / Demo</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
