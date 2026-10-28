import React, { useState, useEffect } from 'react';
import { api, getFullImageUrl } from '../utils/api';
import { 
  User, Mail, MapPin, Calendar, BookOpen, GraduationCap, Flame, 
  Clock, Trophy, Award, Zap, TrendingUp, FileText, Users, Share2, 
  Edit3, Check, Shield, Lock, Radio, AlertCircle, Loader2, Sparkles,
  ExternalLink, ArrowLeft, Target
} from 'lucide-react';

export default function ProfileView({ 
  userId, 
  username, 
  onBack, 
  onEditProfile,
  onOpenBlog,
  onJoinRoom 
}) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'badges' | 'blogs' | 'activity'

  const identifier = userId || username || 'me';

  useEffect(() => {
    let isMounted = true;
    async function fetchProfile() {
      setLoading(true);
      setError('');
      try {
        let idToFetch = identifier;
        if (idToFetch === 'me') {
          // Fetch current user from /api/auth/me to get ID
          const meRes = await api.getMe();
          if (meRes && meRes.user) {
            idToFetch = meRes.user.id;
          }
        }
        const data = await api.getUserProfile(idToFetch);
        if (isMounted) {
          if (data && data.profile) {
            setProfile(data.profile);
          } else {
            setError('Could not load student profile.');
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Fetch profile error:', err);
          setError(err.message || 'Failed to load student profile');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchProfile();
    return () => { isMounted = false; };
  }, [identifier]);

  const handleShare = () => {
    const url = window.location.origin + (profile?.username ? `/?profile=${profile.username}` : '');
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }).catch(() => {
      // Fallback
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const getBadgeIcon = (iconName) => {
    switch (iconName) {
      case 'Zap': return <Zap className="w-5 h-5 text-amber-500" />;
      case 'Clock': return <Clock className="w-5 h-5 text-blue-500" />;
      case 'BookOpen': return <BookOpen className="w-5 h-5 text-emerald-500" />;
      case 'Award': return <Award className="w-5 h-5 text-purple-500" />;
      case 'Flame': return <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />;
      case 'FileText': return <FileText className="w-5 h-5 text-indigo-500" />;
      case 'TrendingUp': return <TrendingUp className="w-5 h-5 text-emerald-600" />;
      case 'Users': return <Users className="w-5 h-5 text-rose-500" />;
      default: return <Award className="w-5 h-5 text-[#D4A373]" />;
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-[#D4A373] animate-spin" />
        <p className="text-xs font-semibold text-[#75695A] dark:text-[#A8A29E]">
          Loading student profile & study records...
        </p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-[#FAEDCD] dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-[#40382F] dark:text-[#FEFAE0] mb-2">Student Profile Not Found</h2>
        <p className="text-xs text-[#75695A] dark:text-[#A8A29E] mb-6">
          {error || 'The requested student profile does not exist or may have been removed.'}
        </p>
        {onBack && (
          <button
            onClick={onBack}
            className="px-5 py-2 bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] font-bold text-xs border border-[#40382F]/20 transition-all"
          >
            Go Back
          </button>
        )}
      </div>
    );
  }

  const { isOwnProfile, stats, badges, blogs, recentActivity, privacy } = profile;
  const parseList = (str) => {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(Boolean);
  };

  const academicInterestsList = parseList(profile.academicInterests);
  const subjectsList = parseList(profile.subjects);
  const skillsList = parseList(profile.skills);
  const languagesList = parseList(profile.languages);

  const formattedJoinDate = profile.memberSince 
    ? new Date(profile.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Recently';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fadeIn">
      {/* Top back button if requested */}
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 text-xs font-bold text-[#75695A] hover:text-[#40382F] dark:text-[#A8A29E] dark:hover:text-[#FEFAE0] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to previous view</span>
        </button>
      )}

      {/* SECTION A: PROFILE HEADER */}
      <div className="bg-[#FAEDCD]/70 dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 shadow-sm p-6 sm:p-8 relative overflow-hidden">
        {/* Decorative corner accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#CCD5AE]/20 pointer-events-none transform rotate-45 translate-x-16 -translate-y-16" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar Photo */}
            <div className="relative">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-none overflow-hidden bg-[#D4A373] text-[#FEFAE0] font-black text-3xl flex items-center justify-center border-2 border-[#40382F]/20 shadow-md">
                {profile.avatarUrl ? (
                  <img
                    src={getFullImageUrl(profile.avatarUrl)}
                    alt={profile.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{(profile.displayName || 'S').charAt(0).toUpperCase()}</span>
                )}
              </div>
              
              {profile.isLive && (
                <span 
                  className="absolute -bottom-1.5 -right-1.5 flex items-center space-x-1 px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-bold border border-white"
                  title="Currently studying in a live room!"
                >
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  <span>STUDYING</span>
                </span>
              )}
            </div>

            {/* Profile Info */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-[#40382F] dark:text-[#FEFAE0] tracking-tight">
                  {profile.displayName}
                </h1>
                <span className="text-xs font-mono text-[#75695A] dark:text-[#A8A29E]">
                  @{profile.username}
                </span>

                {profile.role === 'superadmin' && (
                  <span className="px-2 py-0.5 bg-[#D4A373] text-[#40382F] text-[10px] font-black border border-[#40382F]/20 flex items-center space-x-1">
                    <Shield className="w-3 h-3" />
                    <span>SUPER ADMIN</span>
                  </span>
                )}

                {isOwnProfile ? (
                  <span className="px-2 py-0.5 bg-[#CCD5AE] text-[#40382F] text-[10px] font-bold border border-[rgba(64,56,47,0.2)]">
                    You
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-[#E9EDC9]/80 text-[#40382F] text-[10px] font-medium border border-[rgba(64,56,47,0.15)]">
                    Scholar
                  </span>
                )}
              </div>

              {/* Bio */}
              <p className="text-xs sm:text-sm text-[#40382F] dark:text-[#E2E8F0] max-w-2xl font-normal leading-relaxed">
                {profile.bio || 'Ready to focus and achieve big academic milestones!'}
              </p>

              {/* Academic Tags & Meta */}
              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 pt-1 text-xs text-[#75695A] dark:text-[#A8A29E]">
                {profile.college && (
                  <div className="flex items-center space-x-1">
                    <GraduationCap className="w-3.5 h-3.5 text-[#D4A373]" />
                    <span className="font-semibold text-[#40382F] dark:text-[#FEFAE0]">
                      {profile.college}
                    </span>
                    {profile.course && <span>• {profile.course}</span>}
                    {profile.yearOfStudy && <span>({profile.yearOfStudy})</span>}
                  </div>
                )}

                {profile.location && (
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-[#D4A373]" />
                    <span>{profile.location}</span>
                  </div>
                )}

                <div className="flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-[#75695A]" />
                  <span>Joined {formattedJoinDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-row md:flex-col items-center gap-2 self-stretch md:self-auto justify-end">
            {isOwnProfile && (
              <button
                onClick={onEditProfile}
                className="flex-1 md:flex-initial px-4 py-2 bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] font-bold text-xs border border-[#40382F]/20 transition-all flex items-center justify-center space-x-1.5 shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            )}

            <button
              onClick={handleShare}
              className="flex-1 md:flex-initial px-4 py-2 bg-[#FEFAE0] dark:bg-[#25291F] hover:bg-[#E9EDC9] dark:hover:bg-[#2F3427] text-[#40382F] dark:text-[#FEFAE0] font-bold text-xs border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 transition-all flex items-center justify-center space-x-1.5"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 dark:text-emerald-400">Link Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-[#75695A]" />
                  <span>Share Profile</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION B: STUDY STATISTICS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#75695A] dark:text-[#A8A29E] flex items-center space-x-2">
            <Trophy className="w-4 h-4 text-[#D4A373]" />
            <span>Verified Study Statistics</span>
          </h2>
          {isOwnProfile && (
            <span className="text-[11px] text-[#75695A] dark:text-[#A8A29E]">
              Authoritative records synced to cloud
            </span>
          )}
        </div>

        {stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total Hours */}
            <div className="p-4 bg-[#FEFAE0] dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 shadow-sm">
              <div className="flex items-center justify-between text-[#75695A] dark:text-[#A8A29E] mb-1">
                <span className="text-[11px] font-semibold">Live Focus</span>
                <Clock className="w-4 h-4 text-[#D4A373]" />
              </div>
              <div className="text-2xl font-black text-[#40382F] dark:text-[#FEFAE0]">
                {stats.totalHours}
                <span className="text-xs font-semibold ml-1 text-[#75695A]">hrs</span>
              </div>
              <p className="text-[10px] text-[#75695A] dark:text-[#A8A29E] mt-1">
                Verified live room time
              </p>
            </div>

            {/* Completed Sessions */}
            <div className="p-4 bg-[#FEFAE0] dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 shadow-sm">
              <div className="flex items-center justify-between text-[#75695A] dark:text-[#A8A29E] mb-1">
                <span className="text-[11px] font-semibold">Sessions</span>
                <Zap className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-[#40382F] dark:text-[#FEFAE0]">
                {stats.sessionsCompleted}
              </div>
              <p className="text-[10px] text-[#75695A] dark:text-[#A8A29E] mt-1">
                Focus milestones
              </p>
            </div>

            {/* Current Streak */}
            <div className="p-4 bg-[#FEFAE0] dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 shadow-sm">
              <div className="flex items-center justify-between text-[#75695A] dark:text-[#A8A29E] mb-1">
                <span className="text-[11px] font-semibold">Current Streak</span>
                <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
              </div>
              <div className="text-2xl font-black text-[#40382F] dark:text-[#FEFAE0]">
                {stats.currentStreak}
                <span className="text-xs font-semibold ml-1 text-[#75695A]">days</span>
              </div>
              <p className="text-[10px] text-[#75695A] dark:text-[#A8A29E] mt-1">
                Best: {stats.longestStreak} days
              </p>
            </div>

            {/* Leaderboard Rank */}
            <div className="p-4 bg-[#FEFAE0] dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 shadow-sm">
              <div className="flex items-center justify-between text-[#75695A] dark:text-[#A8A29E] mb-1">
                <span className="text-[11px] font-semibold">Global Rank</span>
                <Trophy className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-[#40382F] dark:text-[#FEFAE0]">
                #{stats.leaderboardRank}
              </div>
              <p className="text-[10px] text-[#75695A] dark:text-[#A8A29E] mt-1">
                of {stats.totalStudents} scholars
              </p>
            </div>

            {/* Blogs Published */}
            <div className="p-4 bg-[#FEFAE0] dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 shadow-sm">
              <div className="flex items-center justify-between text-[#75695A] dark:text-[#A8A29E] mb-1">
                <span className="text-[11px] font-semibold">Blogs</span>
                <FileText className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-black text-[#40382F] dark:text-[#FEFAE0]">
                {stats.blogsPublished}
              </div>
              <p className="text-[10px] text-[#75695A] dark:text-[#A8A29E] mt-1">
                Knowledge shares
              </p>
            </div>

            {/* Rooms Created */}
            <div className="p-4 bg-[#FEFAE0] dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 shadow-sm">
              <div className="flex items-center justify-between text-[#75695A] dark:text-[#A8A29E] mb-1">
                <span className="text-[11px] font-semibold">Halls Created</span>
                <Users className="w-4 h-4 text-[#D4A373]" />
              </div>
              <div className="text-2xl font-black text-[#40382F] dark:text-[#FEFAE0]">
                {stats.roomsCreated}
              </div>
              <p className="text-[10px] text-[#75695A] dark:text-[#A8A29E] mt-1">
                Collaborative rooms
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-[#FAEDCD]/40 dark:bg-[#1E2218] border border-[rgba(64,56,47,0.15)] text-center text-xs text-[#75695A] dark:text-[#A8A29E] flex items-center justify-center space-x-2">
            <Lock className="w-4 h-4 text-[#D4A373]" />
            <span>This student has set their study statistics to private.</span>
          </div>
        )}
      </div>

      {/* TABS FOR DEEPER SECTIONS */}
      <div className="border-b border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 flex space-x-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
            activeTab === 'overview'
              ? 'border-[#D4A373] text-[#40382F] dark:text-[#FEFAE0]'
              : 'border-transparent text-[#75695A] hover:text-[#40382F] dark:text-[#A8A29E]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>About & Goals</span>
        </button>

        <button
          onClick={() => setActiveTab('badges')}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
            activeTab === 'badges'
              ? 'border-[#D4A373] text-[#40382F] dark:text-[#FEFAE0]'
              : 'border-transparent text-[#75695A] hover:text-[#40382F] dark:text-[#A8A29E]'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Verified Badges ({badges?.filter(b => b.unlocked).length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('blogs')}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
            activeTab === 'blogs'
              ? 'border-[#D4A373] text-[#40382F] dark:text-[#FEFAE0]'
              : 'border-transparent text-[#75695A] hover:text-[#40382F] dark:text-[#A8A29E]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Published Blogs ({blogs?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('activity')}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
            activeTab === 'activity'
              ? 'border-[#D4A373] text-[#40382F] dark:text-[#FEFAE0]'
              : 'border-transparent text-[#75695A] hover:text-[#40382F] dark:text-[#A8A29E]'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Recent Sessions</span>
        </button>
      </div>

      {/* TAB 1: ABOUT & GOALS */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
          {/* Academic Interests & Subjects */}
          <div className="p-6 bg-[#FEFAE0] dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#75695A] dark:text-[#A8A29E] flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-[#D4A373]" />
              <span>Academic Interests & Subjects</span>
            </h3>

            {subjectsList.length > 0 ? (
              <div>
                <span className="text-[11px] text-[#75695A] dark:text-[#A8A29E] block mb-1.5 font-semibold">
                  Currently Studying:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {subjectsList.map((subj, idx) => (
                    <span 
                      key={idx} 
                      className="px-2.5 py-1 bg-[#FAEDCD] dark:bg-[#25291F] text-[#40382F] dark:text-[#FEFAE0] text-xs font-medium border border-[rgba(64,56,47,0.15)] dark:border-[#40382F]/30"
                    >
                      {subj}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#75695A] dark:text-[#A8A29E] italic">
                No specific subjects listed yet.
              </p>
            )}

            {academicInterestsList.length > 0 && (
              <div className="pt-2 border-t border-[rgba(64,56,47,0.1)] dark:border-[#40382F]/20">
                <span className="text-[11px] text-[#75695A] dark:text-[#A8A29E] block mb-1.5 font-semibold">
                  Academic Focus & Research Interests:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {academicInterestsList.map((interest, idx) => (
                    <span 
                      key={idx} 
                      className="px-2.5 py-1 bg-[#E9EDC9]/70 dark:bg-[#25291F] text-[#40382F] dark:text-[#FEFAE0] text-xs font-medium border border-[rgba(64,56,47,0.15)] dark:border-[#40382F]/30"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {skillsList.length > 0 && (
              <div className="pt-2 border-t border-[rgba(64,56,47,0.1)] dark:border-[#40382F]/20">
                <span className="text-[11px] text-[#75695A] dark:text-[#A8A29E] block mb-1.5 font-semibold">
                  Developing Skills:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {skillsList.map((skill, idx) => (
                    <span 
                      key={idx} 
                      className="px-2.5 py-1 bg-[#CCD5AE]/40 dark:bg-[#25291F] text-[#40382F] dark:text-[#FEFAE0] text-xs font-medium border border-[rgba(64,56,47,0.15)] dark:border-[#40382F]/30"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {languagesList.length > 0 && (
              <div className="pt-2 border-t border-[rgba(64,56,47,0.1)] dark:border-[#40382F]/20">
                <span className="text-[11px] text-[#75695A] dark:text-[#A8A29E] block mb-1.5 font-semibold">
                  Languages Spoken:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {languagesList.map((lang, idx) => (
                    <span 
                      key={idx} 
                      className="px-2.5 py-1 bg-[#FEFAE0] dark:bg-[#25291F] text-[#40382F] dark:text-[#FEFAE0] text-xs font-medium border border-[rgba(64,56,47,0.15)] dark:border-[#40382F]/30"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Learning Goals & Targets */}
          <div className="p-6 bg-[#FEFAE0] dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#75695A] dark:text-[#A8A29E] flex items-center space-x-2">
              <Target className="w-4 h-4 text-[#D4A373]" />
              <span>Learning Goals & Targets</span>
            </h3>

            {profile.dailyGoalMinutes ? (
              <div className="p-4 bg-[#FAEDCD]/60 dark:bg-[#25291F] border border-[rgba(64,56,47,0.15)] dark:border-[#40382F]/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[#40382F] dark:text-[#FEFAE0]">
                    Daily Focus Commitment
                  </span>
                  <span className="text-xs font-black text-[#D4A373]">
                    {profile.dailyGoalMinutes} mins / day ({((profile.dailyGoalMinutes) / 60).toFixed(1)} hrs)
                  </span>
                </div>
                <div className="w-full bg-black/10 dark:bg-white/10 h-2 rounded-none overflow-hidden mt-2">
                  <div 
                    className="bg-[#D4A373] h-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.round(((stats?.totalLiveSeconds || 0) % 86400) / (profile.dailyGoalMinutes * 60) * 100))}%` }}
                  />
                </div>
              </div>
            ) : null}

            <div>
              <span className="text-[11px] text-[#75695A] dark:text-[#A8A29E] block mb-1.5 font-semibold">
                Current Academic Objectives:
              </span>
              <p className="text-xs text-[#40382F] dark:text-[#E2E8F0] leading-relaxed bg-[#FAEDCD]/30 dark:bg-[#25291F]/50 p-3 border border-[rgba(64,56,47,0.1)]">
                {profile.learningGoals || 'No specific goals published yet. Maintaining daily study habits and expanding academic horizons!'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: VERIFIED BADGES & ACHIEVEMENTS */}
      {activeTab === 'badges' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="p-4 bg-[#FAEDCD]/50 dark:bg-[#1E2218] border border-[rgba(64,56,47,0.15)] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-[#D4A373]" />
              <span className="text-xs font-bold text-[#40382F] dark:text-[#FEFAE0]">
                Authoritative Badges
              </span>
            </div>
            <span className="text-xs text-[#75695A] dark:text-[#A8A29E]">
              Calculated exclusively from verified database study metrics
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {badges && badges.map((badge) => (
              <div 
                key={badge.id}
                className={`p-4 border transition-all ${
                  badge.unlocked
                    ? 'bg-[#FEFAE0] dark:bg-[#1E2218] border-[#D4A373] shadow-sm'
                    : 'bg-[#FAEDCD]/20 dark:bg-[#1A1D15] border-[rgba(64,56,47,0.1)] opacity-70'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className={`p-2 rounded-none border ${
                    badge.unlocked 
                      ? 'bg-[#FAEDCD] dark:bg-[#25291F] border-[#D4A373]/50' 
                      : 'bg-black/5 dark:bg-white/5 border-transparent'
                  }`}>
                    {getBadgeIcon(badge.icon)}
                  </div>
                  {badge.unlocked ? (
                    <span className="px-2 py-0.5 bg-[#CCD5AE] text-[#40382F] text-[10px] font-black border border-[rgba(64,56,47,0.2)]">
                      UNLOCKED
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-[#75695A]">
                      {badge.progress}%
                    </span>
                  )}
                </div>

                <h4 className="text-xs font-bold text-[#40382F] dark:text-[#FEFAE0]">
                  {badge.title}
                </h4>
                <p className="text-[11px] text-[#75695A] dark:text-[#A8A29E] mt-1 leading-snug">
                  {badge.description}
                </p>

                {!badge.unlocked && (
                  <div className="mt-3 w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-none overflow-hidden">
                    <div 
                      className="bg-[#D4A373] h-full"
                      style={{ width: `${badge.progress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PUBLISHED BLOGS */}
      {activeTab === 'blogs' && (
        <div className="space-y-4 animate-fadeIn">
          {blogs && blogs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {blogs.map((blog) => (
                <div 
                  key={blog.id}
                  className="p-5 bg-[#FEFAE0] dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 shadow-sm flex flex-col justify-between hover:border-[#D4A373] transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-[#75695A] dark:text-[#A8A29E] mb-2">
                      <span className="px-2 py-0.5 bg-[#CCD5AE]/60 text-[#40382F] font-bold">
                        {blog.category || 'General'}
                      </span>
                      <span>
                        {new Date(blog.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-[#40382F] dark:text-[#FEFAE0] mb-1.5 line-clamp-2">
                      {blog.title}
                    </h4>

                    <p className="text-xs text-[#75695A] dark:text-[#A8A29E] line-clamp-3 mb-4 leading-relaxed">
                      {blog.excerpt || 'Read full article...'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[rgba(64,56,47,0.1)] dark:border-[#40382F]/20 text-[11px] text-[#75695A]">
                    <div className="flex items-center space-x-3">
                      <span>{blog.likes_count || 0} likes</span>
                      <span>•</span>
                      <span>{blog.comments_count || 0} comments</span>
                    </div>

                    {onOpenBlog && (
                      <button
                        onClick={() => onOpenBlog(blog.id)}
                        className="font-bold text-[#D4A373] hover:text-[#C59361] flex items-center space-x-1"
                      >
                        <span>Read</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 bg-[#FAEDCD]/30 dark:bg-[#1E2218] border border-[rgba(64,56,47,0.15)] text-center">
              <FileText className="w-8 h-8 text-[#75695A] mx-auto mb-2 opacity-50" />
              <p className="text-xs font-semibold text-[#75695A] dark:text-[#A8A29E]">
                This student has not published any study blogs yet.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: RECENT STUDY ACTIVITY */}
      {activeTab === 'activity' && (
        <div className="space-y-4 animate-fadeIn">
          {recentActivity && recentActivity.length > 0 ? (
            <div className="divide-y divide-[rgba(64,56,47,0.1)] dark:divide-[#40382F]/30 bg-[#FEFAE0] dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 shadow-sm">
              {recentActivity.map((session) => (
                <div key={session.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 bg-[#FAEDCD] dark:bg-[#25291F] text-[#D4A373] flex items-center justify-center border border-[rgba(64,56,47,0.15)]">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#40382F] dark:text-[#FEFAE0]">
                        {session.room_name || 'Study Hall'}
                      </h4>
                      <p className="text-[10px] text-[#75695A] dark:text-[#A8A29E]">
                        {new Date(session.started_at).toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-black text-[#D4A373]">
                      {Math.max(1, Math.round(session.duration_seconds / 60))} mins
                    </span>
                    <span className="block text-[10px] text-emerald-600 font-semibold">
                      Verified
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 bg-[#FAEDCD]/30 dark:bg-[#1E2218] border border-[rgba(64,56,47,0.15)] text-center">
              <Clock className="w-8 h-8 text-[#75695A] mx-auto mb-2 opacity-50" />
              <p className="text-xs font-semibold text-[#75695A] dark:text-[#A8A29E]">
                No recorded study sessions yet.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
