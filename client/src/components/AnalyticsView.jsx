import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Flame, Clock, CheckCircle2, Calendar, BookOpen, Plus, 
  Sparkles, Award, ArrowUpRight, TrendingUp 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

export default function AnalyticsView({ onOpenAuth }) {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  
  // Manual session logging state
  const [logMins, setLogMins] = useState(25);
  const [logSubject, setLogSubject] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);

  const fetchData = async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      const [overviewData, historyData] = await Promise.all([
        api.getAnalyticsOverview(),
        api.getSessionHistory()
      ]);
      setAnalytics(overviewData);
      setSessions(historyData.sessions || []);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAuthenticated]);

  const handleManualLog = async (e) => {
    e.preventDefault();
    if (!logSubject.trim()) return;

    setSubmittingLog(true);
    try {
      await api.recordSession({
        durationMinutes: logMins,
        mode: 'work',
        subject: logSubject.trim(),
        notes: 'Manually logged offline study block'
      });
      setShowLogModal(false);
      setLogSubject('');
      await refreshUser();
      await fetchData();
    } catch (e) {
      console.error('Failed to log manual session:', e);
    } finally {
      setSubmittingLog(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center font-['Inter',sans-serif]">
        <div className="w-16 h-16 rounded-none bg-[#FAEDCD] dark:bg-[#343B2B] text-[#D4A373] flex items-center justify-center mx-auto mb-4 border border-[rgba(64,56,47,0.2)] dark:border-[#555C48]">
          <BarChart3 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tight text-[#40382F] dark:text-[#FEFAE0]">Focus Analytics & Streak Tracking</h2>
        <p className="text-sm text-[#75695A] dark:text-[#CCD5AE] mt-2 max-w-md mx-auto font-normal">
          Sign in or launch the 1-Click Demo account to view your daily focus heatmaps, streak milestones, and session logs.
        </p>
        <button
          onClick={onOpenAuth}
          className="mt-6 px-6 py-3 rounded-none bg-[#D4A373] hover:bg-[#C59361] dark:bg-[#A66F3F] dark:hover:bg-[#D4A373] text-[#40382F] dark:text-[#FEFAE0] text-xs font-bold uppercase tracking-wider border border-[rgba(64,56,47,0.25)] dark:border-[#555C48] transition-colors"
        >
          Sign In / Quick Demo
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-24 text-center font-['Inter',sans-serif]">
        <div className="inline-block animate-spin rounded-none h-8 w-8 border-4 border-[#D4A373] border-t-transparent"></div>
        <p className="mt-3 text-xs text-[#75695A] dark:text-[#CCD5AE] font-mono uppercase tracking-wider">Loading your focus analytics...</p>
      </div>
    );
  }

  const todayMinutes = analytics?.todayMinutes || 0;
  const dailyGoalMinutes = analytics?.dailyGoalMinutes || 120;
  const goalPercentage = Math.min(100, Math.round((todayMinutes / dailyGoalMinutes) * 100));
  const totalHours = ((analytics?.totalFocusMinutes || 0) / 60).toFixed(1);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-['Inter',sans-serif]">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#40382F] dark:text-[#FEFAE0]">
            Focus Analytics & Streaks
          </h1>
          <p className="text-xs sm:text-sm text-[#75695A] dark:text-[#CCD5AE] mt-1 font-normal">
            Tracking your deep work consistency, daily intervals, and subject distribution.
          </p>
        </div>

        <button
          onClick={() => setShowLogModal(true)}
          className="px-4 py-2.5 rounded-none bg-[#D4A373] hover:bg-[#C59361] dark:bg-[#A66F3F] dark:hover:bg-[#D4A373] text-[#40382F] dark:text-[#FEFAE0] text-xs font-bold uppercase tracking-wider border border-[rgba(64,56,47,0.25)] dark:border-[#555C48] flex items-center space-x-1.5 self-start sm:self-auto transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Log Offline Session</span>
        </button>
      </div>

      {/* 4 Quick Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        
        {/* Streak Card */}
        <div className="bg-[#FAEDCD] dark:bg-[#343B2B] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#75695A] dark:text-[#CCD5AE]">Current Streak</span>
            <div className="p-2 rounded-none bg-[#FEFAE0] dark:bg-[#25291F] text-[#D4A373] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48]">
              <Flame className="w-4 h-4 fill-[#D4A373]" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-[#40382F] dark:text-[#FEFAE0]">{analytics?.currentStreak || 0}</span>
            <span className="text-xs font-medium text-[#75695A] dark:text-[#CCD5AE]">consecutive days</span>
          </div>
          <p className="text-[11px] text-[#75695A] dark:text-[#CCD5AE] mt-2 font-mono">
            Personal Record: {analytics?.longestStreak || 0} days
          </p>
        </div>

        {/* Total Hours */}
        <div className="bg-[#FAEDCD] dark:bg-[#343B2B] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#75695A] dark:text-[#CCD5AE]">Total Hours Focused</span>
            <div className="p-2 rounded-none bg-[#FEFAE0] dark:bg-[#25291F] text-[#D4A373] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-[#40382F] dark:text-[#FEFAE0]">{totalHours}</span>
            <span className="text-xs font-medium text-[#75695A] dark:text-[#CCD5AE]">hours</span>
          </div>
          <p className="text-[11px] text-[#75695A] dark:text-[#CCD5AE] mt-2 font-mono">
            {analytics?.totalFocusMinutes || 0} total minutes logged
          </p>
        </div>

        {/* Today's Goal Progress */}
        <div className="bg-[#FAEDCD] dark:bg-[#343B2B] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#75695A] dark:text-[#CCD5AE]">Today's Focus Goal</span>
            <div className="p-2 rounded-none bg-[#FEFAE0] dark:bg-[#25291F] text-[#D4A373] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48]">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-[#40382F] dark:text-[#FEFAE0]">{todayMinutes}</span>
            <span className="text-xs font-medium text-[#75695A] dark:text-[#CCD5AE]">/ {dailyGoalMinutes} mins</span>
          </div>
          <div className="w-full bg-[#FEFAE0] dark:bg-[#25291F] rounded-none h-2 mt-3 overflow-hidden border border-[rgba(64,56,47,0.2)] dark:border-[#555C48]">
            <div 
              className="bg-[#D4A373] dark:bg-[#A66F3F] h-2 rounded-none transition-all duration-500" 
              style={{ width: `${goalPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Tasks Completed */}
        <div className="bg-[#FAEDCD] dark:bg-[#343B2B] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#75695A] dark:text-[#CCD5AE]">Tasks Completed</span>
            <div className="p-2 rounded-none bg-[#FEFAE0] dark:bg-[#25291F] text-[#D4A373] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-[#40382F] dark:text-[#FEFAE0]">{analytics?.tasks?.completed || 0}</span>
            <span className="text-xs font-medium text-[#75695A] dark:text-[#CCD5AE]">of {analytics?.tasks?.total || 0}</span>
          </div>
          <p className="text-[11px] text-[#75695A] dark:text-[#CCD5AE] mt-2 font-mono">
            Accountability milestones reached
          </p>
        </div>
      </div>

      {/* Grid: 7-Day Chart & Subject Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* 7-Day Bar Chart */}
        <div className="lg:col-span-2 bg-[#FEFAE0] dark:bg-[#25291F] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#40382F] dark:text-[#FEFAE0]">Recent Daily Focus Activity</h3>
              <p className="text-[11px] text-[#75695A] dark:text-[#CCD5AE] mt-0.5 font-normal">Minutes focused per day over past week</p>
            </div>
            <TrendingUp className="w-4 h-4 text-[#D4A373]" />
          </div>

          <div className="h-48 flex items-end justify-between gap-2 pt-6 px-2">
            {analytics?.past7Days && analytics.past7Days.length > 0 ? (
              analytics.past7Days.map((item, idx) => {
                const maxVal = Math.max(...analytics.past7Days.map(d => d.minutes), 120);
                const heightPercent = Math.max(12, Math.round((item.minutes / maxVal) * 100));
                const dayLabel = new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' });

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                    <span className="text-[10px] font-mono font-bold text-[#D4A373] opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.minutes}m
                    </span>
                    <div className="w-full max-w-[40px] bg-[#FAEDCD] dark:bg-[#343B2B] rounded-none h-36 flex items-end overflow-hidden border border-[rgba(64,56,47,0.2)] dark:border-[#555C48]">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-full bg-[#D4A373] hover:bg-[#C59361] dark:bg-[#A66F3F] dark:hover:bg-[#D4A373] rounded-none transition-all duration-300"
                      ></div>
                    </div>
                    <span className="text-[11px] text-[#75695A] dark:text-[#CCD5AE] font-mono uppercase">{dayLabel}</span>
                  </div>
                );
              })
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-[#75695A] dark:text-[#CCD5AE] font-mono">
                Complete your first session to see your weekly chart!
              </div>
            )}
          </div>
        </div>

        {/* Subjects Breakdown */}
        <div className="bg-[#FEFAE0] dark:bg-[#25291F] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#40382F] dark:text-[#FEFAE0]">Subject Breakdown</h3>
              <p className="text-[11px] text-[#75695A] dark:text-[#CCD5AE] mt-0.5 font-normal">Top subjects by focus time</p>
            </div>
            <BookOpen className="w-4 h-4 text-[#D4A373]" />
          </div>

          <div className="space-y-4">
            {analytics?.subjectDistribution && analytics.subjectDistribution.length > 0 ? (
              analytics.subjectDistribution.map((sub, idx) => {
                const totalSubMins = analytics.totalFocusMinutes || 1;
                const percent = Math.min(100, Math.round((sub.minutes / totalSubMins) * 100));

                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-[#40382F] dark:text-[#FEFAE0] truncate pr-2">{sub.subject}</span>
                      <span className="text-[#75695A] dark:text-[#CCD5AE] font-mono font-medium">{sub.minutes} mins ({percent}%)</span>
                    </div>
                    <div className="w-full bg-[#FAEDCD] dark:bg-[#343B2B] rounded-none h-2 overflow-hidden border border-[rgba(64,56,47,0.2)] dark:border-[#555C48]">
                      <div
                        className="bg-[#D4A373] dark:bg-[#A66F3F] h-2 rounded-none"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-[#75695A] dark:text-[#CCD5AE] text-center py-8 font-mono">
                No subjects recorded yet. Set your goal when entering a focus room!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Past Sessions Log Table */}
      <div className="bg-[#FEFAE0] dark:bg-[#25291F] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none p-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#40382F] dark:text-[#FEFAE0] mb-4">Focus Session History</h3>
        
        {sessions.length === 0 ? (
          <p className="text-xs text-[#75695A] dark:text-[#CCD5AE] text-center py-6 font-mono">No study sessions logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[rgba(64,56,47,0.2)] dark:border-[#555C48] text-[#75695A] dark:text-[#CCD5AE] uppercase tracking-wider text-[11px]">
                  <th className="pb-3 font-bold pl-2">Subject / Goal</th>
                  <th className="pb-3 font-bold">Study Hall</th>
                  <th className="pb-3 font-bold">Duration</th>
                  <th className="pb-3 font-bold">Mode</th>
                  <th className="pb-3 font-bold text-right pr-2">Completed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(64,56,47,0.12)] dark:divide-[#343B2B]">
                {sessions.map(s => (
                  <tr key={s.id} className="hover:bg-[#FAEDCD]/50 dark:hover:bg-[#343B2B]/40 transition-colors">
                    <td className="py-3 pl-2 font-bold text-[#40382F] dark:text-[#FEFAE0]">{s.subject}</td>
                    <td className="py-3 text-[#75695A] dark:text-[#CCD5AE]">{s.room_name || 'Personal Focus'}</td>
                    <td className="py-3 font-mono font-bold text-[#D4A373]">{s.duration_minutes} mins</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-none bg-[#E9EDC9] dark:bg-[#343B2B] text-[#40382F] dark:text-[#FEFAE0] text-[10px] font-bold uppercase border border-[rgba(64,56,47,0.2)] dark:border-[#555C48]">
                        {s.mode}
                      </span>
                    </td>
                    <td className="py-3 text-right pr-2 text-[#75695A] dark:text-[#CCD5AE] font-mono">
                      {new Date(s.completed_at).toLocaleDateString()} {new Date(s.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Session Log Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#40382F]/70 font-['Inter',sans-serif]">
          <div className="relative w-full max-w-sm bg-[#FEFAE0] dark:bg-[#25291F] border border-[rgba(64,56,47,0.25)] dark:border-[#555C48] rounded-none p-6 shadow-2xl">
            <h3 className="text-base font-black uppercase tracking-tight text-[#40382F] dark:text-[#FEFAE0] mb-2">Log Offline Study Session</h3>
            <p className="text-xs text-[#75695A] dark:text-[#CCD5AE] mb-4 font-normal">
              Studied away from the computer? Log your reading or textbook hours to maintain your streak!
            </p>

            <form onSubmit={handleManualLog} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#40382F] dark:text-[#FEFAE0] mb-1.5">Subject / Topic</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Database Consistency Models"
                  value={logSubject}
                  onChange={(e) => setLogSubject(e.target.value)}
                  className="w-full bg-[#FAEDCD] dark:bg-[#343B2B] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none px-4 py-2.5 text-xs text-[#40382F] dark:text-[#FEFAE0] placeholder-[#9E9080] dark:placeholder-[#CCD5AE]/60 focus:outline-none focus:border-[#D4A373]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#40382F] dark:text-[#FEFAE0] mb-1.5">Duration (Minutes)</label>
                <select
                  value={logMins}
                  onChange={(e) => setLogMins(Number(e.target.value))}
                  className="w-full bg-[#FAEDCD] dark:bg-[#343B2B] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none px-3 py-2.5 text-xs text-[#40382F] dark:text-[#FEFAE0] focus:outline-none focus:border-[#D4A373]"
                >
                  <option value={25} className="bg-[#FAEDCD] dark:bg-[#343B2B]">25 Minutes (1 Pomodoro)</option>
                  <option value={50} className="bg-[#FAEDCD] dark:bg-[#343B2B]">50 Minutes (2 Pomodoros)</option>
                  <option value={60} className="bg-[#FAEDCD] dark:bg-[#343B2B]">60 Minutes (1 Hour)</option>
                  <option value={90} className="bg-[#FAEDCD] dark:bg-[#343B2B]">90 Minutes (1.5 Hours)</option>
                  <option value={120} className="bg-[#FAEDCD] dark:bg-[#343B2B]">120 Minutes (2 Hours)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[rgba(64,56,47,0.2)] dark:border-[#555C48]">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 rounded-none text-xs font-bold uppercase tracking-wider text-[#75695A] dark:text-[#CCD5AE] hover:text-[#40382F] dark:hover:text-[#FEFAE0] hover:bg-[#FAEDCD] dark:hover:bg-[#343B2B] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLog}
                  className="px-4 py-2 rounded-none bg-[#D4A373] hover:bg-[#C59361] dark:bg-[#A66F3F] dark:hover:bg-[#D4A373] text-[#40382F] dark:text-[#FEFAE0] text-xs font-bold uppercase tracking-wider border border-[rgba(64,56,47,0.25)] dark:border-[#555C48] transition-colors"
                >
                  {submittingLog ? 'Saving...' : 'Save & Update Streak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
