import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { usePresence } from '../context/PresenceContext';
import { getFullImageUrl } from '../utils/api';
import { Flame, Clock, Users, BarChart3, Trophy, LogIn, LogOut, Sparkles, BookOpen, Sun, Moon, Radio, ShieldCheck, User, Edit3 } from 'lucide-react';

export default function Navbar({ currentView, setCurrentView, onOpenAuth, onOpenEditProfile }) {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { totalActive, authenticatedCount, anonymousCount } = usePresence();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

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

          {isAuthenticated && (
            <button
              onClick={() => setCurrentView('profile')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-none text-xs font-semibold transition-all ${
                currentView === 'profile'
                  ? 'bg-[#CCD5AE] text-[#40382F] border border-[rgba(64,56,47,0.2)]'
                  : 'text-[#75695A] hover:text-[#40382F] hover:bg-[#E9EDC9]/60'
              }`}
            >
              <User className="w-4 h-4 text-[#D4A373]" />
              <span>My Profile</span>
            </button>
          )}

          {user && (user.isSuperAdmin || user.email?.toLowerCase() === 'ujjwalprakash1812@gmail.com') && (
            <button
              onClick={() => setCurrentView('admin')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-none text-xs font-bold transition-all ${
                currentView === 'admin'
                  ? 'bg-[#D4A373] text-[#40382F] border border-[#40382F]/20'
                  : 'bg-[#FAEDCD] text-[#D4A373] hover:bg-[#E9EDC9] border border-[#D4A373]/40'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#D4A373]" />
              <span>Super Admin</span>
            </button>
          )}
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

              {/* User Avatar Dropdown & Logout */}
              <div className="relative flex items-center space-x-2 pl-2 border-l border-[rgba(64,56,47,0.2)]">
                {user && (user.isSuperAdmin || user.email?.toLowerCase() === 'ujjwalprakash1812@gmail.com') && (
                  <div 
                    onClick={() => setCurrentView('admin')}
                    className="cursor-pointer hidden lg:flex items-center space-x-1 px-2 py-0.5 bg-[#D4A373] text-[#40382F] text-[10px] font-black border border-[#40382F]/20"
                    title="Super Admin • Verified System Owner"
                  >
                    <ShieldCheck className="w-3 h-3 text-[#40382F]" />
                    <span>ADMIN</span>
                  </div>
                )}
                
                {/* Clickable Profile Avatar */}
                <div 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="w-8 h-8 rounded-none overflow-hidden bg-[#D4A373] text-[#FEFAE0] font-bold text-xs flex items-center justify-center cursor-pointer border border-[#40382F]/20 hover:scale-105 transition-transform"
                  title={`${user.display_name} — Click for student options`}
                >
                  {user.avatar_url ? (
                    <img 
                      src={getFullImageUrl(user.avatar_url)} 
                      alt={user.display_name} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <span>{(user.display_name || 'U').charAt(0).toUpperCase()}</span>
                  )}
                </div>

                {/* User Dropdown Menu */}
                {isUserMenuOpen && (
                  <div 
                    className="absolute right-0 top-11 w-52 bg-[#FEFAE0] dark:bg-[#1E2218] border border-[rgba(64,56,47,0.25)] dark:border-[#40382F]/50 shadow-xl py-1 z-50 animate-fadeIn"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <div className="px-3 py-2 border-b border-[rgba(64,56,47,0.1)] dark:border-[#40382F]/30 bg-[#FAEDCD]/50 dark:bg-[#25291F]">
                      <p className="text-xs font-bold text-[#40382F] dark:text-[#FEFAE0] truncate">
                        {user.display_name}
                      </p>
                      <p className="text-[10px] text-[#75695A] dark:text-[#A8A29E] font-mono truncate">
                        @{user.username}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setCurrentView('profile');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-[#40382F] dark:text-[#FEFAE0] hover:bg-[#FAEDCD] dark:hover:bg-[#25291F] flex items-center space-x-2 transition-colors"
                    >
                      <User className="w-3.5 h-3.5 text-[#D4A373]" />
                      <span>My Profile</span>
                    </button>

                    <button
                      onClick={() => {
                        if (onOpenEditProfile) onOpenEditProfile();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-[#40382F] dark:text-[#FEFAE0] hover:bg-[#FAEDCD] dark:hover:bg-[#25291F] flex items-center space-x-2 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#D4A373]" />
                      <span>Edit Profile</span>
                    </button>

                    <button
                      onClick={() => {
                        setCurrentView('analytics');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-[#40382F] dark:text-[#FEFAE0] hover:bg-[#FAEDCD] dark:hover:bg-[#25291F] flex items-center space-x-2 transition-colors"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-[#75695A]" />
                      <span>Stats & Streaks</span>
                    </button>

                    <div className="border-t border-[rgba(64,56,47,0.1)] dark:border-[#40382F]/30 my-1" />

                    <button
                      onClick={() => {
                        logout();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center space-x-2 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}

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
