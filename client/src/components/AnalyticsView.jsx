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
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
          <BarChart3 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white">Focus Analytics & Streak Tracking</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
          Sign in or launch the 1-Click Demo account to view your daily focus heatmaps, streak milestones, and session logs.
        </p>
        <button
          onClick={onOpenAuth}
          className="mt-6 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30"
        >
          Sign In / Quick Demo
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
        <p className="mt-3 text-xs text-slate-400">Loading your focus analytics...</p>
      </div>
    );
  }

  const todayMinutes = analytics?.todayMinutes || 0;
  const dailyGoalMinutes = analytics?.dailyGoalMinutes || 120;
  const goalPercentage = Math.min(100, Math.round((todayMinutes / dailyGoalMinutes) * 100));
  const totalHours = ((analytics?.totalFocusMinutes || 0) / 60).toFixed(1);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Focus Analytics & Streaks
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Tracking your deep work consistency, daily intervals, and subject distribution.
          </p>
        </div>

        <button
          onClick={() => setShowLogModal(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 flex items-center space-x-1.5 self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Log Offline Session</span>
        </button>
      </div>

      {/* 4 Quick Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        
        {/* Streak Card */}
        <div className="bg-[#141721] border border-white/10 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">Current Streak</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Flame className="w-4 h-4 fill-amber-400" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-white">{analytics?.currentStreak || 0}</span>
            <span className="text-xs font-medium text-slate-400">consecutive days</span>
          </div>
          <p className="text-[11px] text-amber-400/90 mt-2">
            Personal Record: {analytics?.longestStreak || 0} days
          </p>
        </div>

        {/* Total Hours */}
        <div className="bg-[#141721] border border-white/10 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">Total Hours Focused</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-white">{totalHours}</span>
            <span className="text-xs font-medium text-slate-400">hours</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            {analytics?.totalFocusMinutes || 0} total minutes logged
          </p>
        </div>

        {/* Today's Goal Progress */}
        <div className="bg-[#141721] border border-white/10 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">Today's Focus Goal</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-white">{todayMinutes}</span>
            <span className="text-xs font-medium text-slate-400">/ {dailyGoalMinutes} mins</span>
          </div>
          <div className="w-full bg-[#1c202e] rounded-full h-1.5 mt-3 overflow-hidden">
            <div 
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${goalPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Tasks Completed */}
        <div className="bg-[#141721] border border-white/10 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">Tasks Completed</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-white">{analytics?.tasks?.completed || 0}</span>
            <span className="text-xs font-medium text-slate-400">of {analytics?.tasks?.total || 0}</span>
          </div>
          <p className="text-[11px] text-purple-400/90 mt-2">
            Accountability milestones reached
          </p>
        </div>
      </div>

      {/* Grid: 7-Day Chart & Subject Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* 7-Day Bar Chart */}
        <div className="lg:col-span-2 bg-[#141721] border border-white/10 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold text-white">Recent Daily Focus Activity</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Minutes focused per day over past week</p>
            </div>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>

          <div className="h-48 flex items-end justify-between gap-2 pt-6 px-2">
            {analytics?.past7Days && analytics.past7Days.length > 0 ? (
              analytics.past7Days.map((item, idx) => {
                const maxVal = Math.max(...analytics.past7Days.map(d => d.minutes), 120);
                const heightPercent = Math.max(12, Math.round((item.minutes / maxVal) * 100));
                const dayLabel = new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' });

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                    <span className="text-[10px] font-mono font-semibold text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.minutes}m
                    </span>
                    <div className="w-full max-w-[40px] bg-[#1c202e] rounded-t-lg h-36 flex items-end overflow-hidden">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-full bg-gradient-to-t from-indigo-600 to-pink-500 rounded-t-lg transition-all duration-500 group-hover:brightness-110"
                      ></div>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">{dayLabel}</span>
                  </div>
                );
              })
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                Complete your first Pomodoro session to see your weekly chart!
              </div>
            )}
          </div>
        </div>

        {/* Subjects Breakdown */}
        <div className="bg-[#141721] border border-white/10 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold text-white">Subject Breakdown</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Top subjects by focus time</p>
            </div>
            <BookOpen className="w-4 h-4 text-pink-400" />
          </div>

          <div className="space-y-4">
            {analytics?.subjectDistribution && analytics.subjectDistribution.length > 0 ? (
              analytics.subjectDistribution.map((sub, idx) => {
                const totalSubMins = analytics.totalFocusMinutes || 1;
                const percent = Math.min(100, Math.round((sub.minutes / totalSubMins) * 100));

                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-slate-200 truncate pr-2">{sub.subject}</span>
                      <span className="text-slate-400 font-mono">{sub.minutes} mins ({percent}%)</span>
                    </div>
                    <div className="w-full bg-[#1c202e] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">
                No subjects recorded yet. Set your goal when entering a focus room!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Past Sessions Log Table */}
      <div className="bg-[#141721] border border-white/10 rounded-2xl p-6 shadow-lg">
        <h3 className="text-sm font-bold text-white mb-4">Focus Session History</h3>
        
        {sessions.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">No study sessions logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="pb-3 font-semibold">Subject / Goal</th>
                  <th className="pb-3 font-semibold">Study Hall</th>
                  <th className="pb-3 font-semibold">Duration</th>
                  <th className="pb-3 font-semibold">Mode</th>
                  <th className="pb-3 font-semibold text-right">Completed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sessions.map(s => (
                  <tr key={s.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 font-medium text-white">{s.subject}</td>
                    <td className="py-3 text-slate-300">{s.room_name || 'Personal Focus'}</td>
                    <td className="py-3 font-mono font-semibold text-indigo-400">{s.duration_minutes} mins</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 text-[10px] font-semibold uppercase">
                        {s.mode}
                      </span>
                    </td>
                    <td className="py-3 text-right text-slate-400">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm bg-[#141721] border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Log Offline Study Session</h3>
            <p className="text-xs text-slate-400 mb-4">
              Studied away from the computer? Log your reading or textbook hours to maintain your streak!
            </p>

            <form onSubmit={handleManualLog} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Subject / Topic</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Database Consistency Models"
                  value={logSubject}
                  onChange={(e) => setLogSubject(e.target.value)}
                  className="w-full bg-[#1c202e] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Duration (Minutes)</label>
                <select
                  value={logMins}
                  onChange={(e) => setLogMins(Number(e.target.value))}
                  className="w-full bg-[#1c202e] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value={25}>25 Minutes (1 Pomodoro)</option>
                  <option value={50}>50 Minutes (2 Pomodoros)</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                  <option value={90}>90 Minutes (1.5 Hours)</option>
                  <option value={120}>120 Minutes (2 Hours)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLog}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
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
