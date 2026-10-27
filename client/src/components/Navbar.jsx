import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { usePresence } from '../context/PresenceContext';
import { Flame, Clock, Users, BarChart3, Trophy, LogIn, LogOut, Sparkles, BookOpen, Sun, Moon, Radio } from 'lucide-react';

export default function Navbar({ currentView, setCurrentView, onOpenAuth }) {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { totalActive, authenticatedCount, anonymousCount } = usePresence();

  const totalLiveHours = user ? ((user.total_live_seconds || (user.total_focus_minutes * 60)) / 3600).toFixed(1) : '0.0';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[rgba(64,56,47,0.14)] bg-[#FEFAE0]/95 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <div 
          className="flex items-center space-x-3 cursor-pointer group" 
          onClick={() => setCurrentView('lobby')}
        >
          <div className="relative flex items-center justify-center w-10 h-10 rounded-none bg-[#D4A373] border border-[#40382F]/20 shadow-none transition-transform">
            <Sparkles className="w-5 h-5 text-[#FEFAE0]" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full bg-[#CCD5AE] opacity-80"></span>
              <span className="relative inline-flex h-2.5 w-2.5 bg-[#CCD5AE] border border-[#FEFAE0]"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-lg text-[#40382F] tracking-tight">StudyStream</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-none bg-[#CCD5AE] text-[#40382F] border border-[rgba(64,56,47,0.2)] uppercase tracking-wider">
                Live
              </span>
            </div>
            <p className="text-[10px] text-[#75695A] font-medium">Virtual 24/7 Focus Hall</p>
          </div>
        </div>

        {/* Center Navigation Views */}
        <nav className="hidden md:flex items-center space-x-1 bg-[#FAEDCD] p-1 rounded-none border border-[rgba(64,56,47,0.2)]">
          <button
            onClick={() => setCurrentView('lobby')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-none text-xs font-semibold transition-all ${
              currentView === 'lobby'
                ? 'bg-[#CCD5AE] text-[#40382F] border border-[rgba(64,56,47,0.2)]'
                : 'text-[#75695A] hover:text-[#40382F] hover:bg-[#E9EDC9]/60'
            }`}
          >
            <Users className="w-4 h-4 text-[#40382F]" />
            <span>Study Halls</span>
          </button>

          <button
            onClick={() => setCurrentView('blogs')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-none text-xs font-semibold transition-all ${
              currentView === 'blogs'
                ? 'bg-[#CCD5AE] text-[#40382F] border border-[rgba(64,56,47,0.2)]'
                : 'text-[#75695A] hover:text-[#40382F] hover:bg-[#E9EDC9]/60'
            }`}
          >
            <BookOpen className="w-4 h-4 text-[#D4A373]" />
            <span>Community Blogs</span>
          </button>

          <button
            onClick={() => setCurrentView('leaderboard')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-none text-xs font-semibold transition-all ${
              currentView === 'leaderboard'
                ? 'bg-[#CCD5AE] text-[#40382F] border border-[rgba(64,56,47,0.2)]'
                : 'text-[#75695A] hover:text-[#40382F] hover:bg-[#E9EDC9]/60'
            }`}
          >
            <Trophy className="w-4 h-4 text-[#D4A373]" />
            <span>Leaderboard</span>
          </button>

          <button
            onClick={() => setCurrentView('analytics')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-none text-xs font-semibold transition-all ${
              currentView === 'analytics'
                ? 'bg-[#CCD5AE] text-[#40382F] border border-[rgba(64,56,47,0.2)]'
                : 'text-[#75695A] hover:text-[#40382F] hover:bg-[#E9EDC9]/60'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-[#75695A]" />
            <span>Stats & Streaks</span>
          </button>
        </nav>

        {/* Right Section: Theme Toggle, Badges & Auth */}
        <div className="flex items-center space-x-2.5">
          {/* Live Active Visitors Badge */}
          <div 
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-none bg-[#FAEDCD] text-[#40382F] border border-[rgba(64,56,47,0.2)] text-xs font-bold"
            title={`${totalActive} active on StudySST (${authenticatedCount} signed in, ${anonymousCount} visitors)`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 bg-emerald-600"></span>
            </span>
            <span className="font-mono text-xs">{totalActive}</span>
            <span className="hidden sm:inline text-[10px] text-[#75695A] font-semibold uppercase tracking-wider">live</span>
          </div>

          {/* Light / Dark Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            title={isDark ? "Switch to Warm Ivory Light Mode" : "Switch to Coordinated Dark Mode"}
            className="p-2 rounded-none bg-[#FAEDCD] text-[#40382F] border border-[rgba(64,56,47,0.2)] hover:bg-[#E9EDC9] transition-all focus:outline-none"
          >
            {isDark ? (
              <Moon className="w-4 h-4 text-[#D4A373]" />
            ) : (
              <Sun className="w-4 h-4 text-[#D4A373]" />
            )}
          </button>

          {isAuthenticated ? (
            <>
              {/* Streak badge */}
              <div 
                onClick={() => setCurrentView('analytics')}
                className="cursor-pointer flex items-center space-x-1.5 px-3 py-1.5 rounded-none bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)] text-[#40382F] text-xs font-semibold hover:bg-[#E9EDC9] transition-all"
                title={`${user.current_streak} Day Focus Streak!`}
              >
                <Flame className="w-4 h-4 text-[#D4A373] fill-[#D4A373]" />
                <span>{user.current_streak || 0}d streak</span>
              </div>

              {/* Total Hours badge */}
              <div 
                onClick={() => setCurrentView('analytics')}
                className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-none bg-[#E9EDC9] border border-[rgba(64,56,47,0.2)] text-[#40382F] text-xs font-semibold hover:bg-[#CCD5AE] transition-all"
              >
                <Clock className="w-3.5 h-3.5 text-[#D4A373]" />
                <span>{totalLiveHours}h live</span>
              </div>

              {/* User Avatar & Logout */}
              <div className="flex items-center space-x-2 pl-2 border-l border-[rgba(64,56,47,0.2)]">
                <div 
                  onClick={() => setCurrentView('analytics')}
                  className="w-8 h-8 rounded-none bg-[#D4A373] text-[#FEFAE0] font-bold text-xs flex items-center justify-center cursor-pointer border border-[#40382F]/20"
                  title={user.display_name}
                >
                  {user.display_name.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={logout}
                  className="p-1.5 text-[#75695A] hover:text-[#D4A373] hover:bg-[#FAEDCD] rounded-none transition-all"
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
                className="flex items-center space-x-2 px-4 py-2 rounded-none bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] text-xs font-bold border border-[#40382F]/20 transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In / Register</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
