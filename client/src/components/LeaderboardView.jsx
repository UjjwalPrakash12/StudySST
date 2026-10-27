import React, { useState, useEffect } from 'react';
import { Trophy, Flame, Clock, Award, Medal, Crown } from 'lucide-react';
import { api } from '../utils/api';

export default function LeaderboardView() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        const res = await api.getLeaderboard();
        setLeaderboard(res.leaderboard || []);
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLeaderboard();
  }, []);

  const top3 = leaderboard.slice(0, 3);
  const remaining = leaderboard.slice(3);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Header */}
      <div className="text-center max-w-xl mx-auto mb-10">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-sm bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-3">
          <Trophy className="w-3.5 h-3.5" />
          <span>Global Focus Rankings</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">StudyStream Leaderboard</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-2">
          Honoring the most disciplined students, engineers, and researchers worldwide.
        </p>
      </div>

      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
          <p className="mt-3 text-xs text-slate-400">Loading rankings...</p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium Cards */}
          {top3.length >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 items-end">
              
              {/* #2 Silver */}
              <div className="bg-[#141721] border border-white/10 rounded p-6 text-center order-2 md:order-1 flex flex-col items-center shadow-lg">
                <div className="relative mb-3">
                  <div className="w-16 h-16 rounded bg-gradient-to-tr from-slate-400 to-slate-200 text-[#0c0e14] font-extrabold text-xl flex items-center justify-center ring-2 ring-slate-400/30">
                    {top3[1].display_name.charAt(0)}
                  </div>
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-sm bg-slate-300 text-[#0c0e14] font-bold text-xs shadow">
                    #2
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">{top3[1].display_name}</h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{top3[1].bio || 'Dedicated scholar'}</p>
                <div className="mt-4 pt-3 border-t border-white/10 w-full flex items-center justify-center space-x-4 text-xs">
                  <span className="font-mono font-bold text-indigo-400">
                    {(top3[1].total_focus_minutes / 60).toFixed(1)} hrs
                  </span>
                  <span className="flex items-center text-amber-400 font-semibold">
                    <Flame className="w-3.5 h-3.5 fill-amber-400 mr-1" />
                    {top3[1].current_streak}d
                  </span>
                </div>
              </div>

              {/* #1 Gold (Taller, Glowing) */}
              <div className="bg-gradient-to-b from-[#1b1f30] to-[#141721] border-2 border-amber-500/50 rounded p-7 text-center order-1 md:order-2 flex flex-col items-center shadow-2xl shadow-amber-500/10 md:-translate-y-3">
                <div className="relative mb-3">
                  <Crown className="w-6 h-6 text-amber-400 fill-amber-400 absolute -top-5 left-1/2 -translate-x-1/2 animate-bounce" />
                  <div className="w-20 h-20 rounded bg-gradient-to-tr from-amber-400 to-yellow-200 text-[#0c0e14] font-black text-2xl flex items-center justify-center ring-2 ring-amber-400/40">
                    {top3[0].display_name.charAt(0)}
                  </div>
                  <span className="absolute -bottom-1 -right-1 px-2.5 py-0.5 rounded-sm bg-amber-400 text-[#0c0e14] font-extrabold text-xs shadow-md">
                    #1
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-white">{top3[0].display_name}</h3>
                <p className="text-xs text-amber-200/80 mt-0.5 truncate max-w-xs">{top3[0].bio || 'Study Champion'}</p>
                <div className="mt-5 pt-3 border-t border-white/10 w-full flex items-center justify-center space-x-4 text-xs">
                  <span className="font-mono font-bold text-amber-300 text-sm">
                    {(top3[0].total_focus_minutes / 60).toFixed(1)} hrs
                  </span>
                  <span className="flex items-center text-amber-400 font-semibold text-sm">
                    <Flame className="w-4 h-4 fill-amber-400 mr-1" />
                    {top3[0].current_streak}d streak
                  </span>
                </div>
              </div>

              {/* #3 Bronze */}
              <div className="bg-[#141721] border border-white/10 rounded p-6 text-center order-3 flex flex-col items-center shadow-lg">
                <div className="relative mb-3">
                  <div className="w-16 h-16 rounded bg-gradient-to-tr from-amber-700 to-amber-500 text-white font-extrabold text-xl flex items-center justify-center ring-2 ring-amber-700/30">
                    {top3[2].display_name.charAt(0)}
                  </div>
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-sm bg-amber-700 text-white font-bold text-xs shadow">
                    #3
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">{top3[2].display_name}</h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{top3[2].bio || 'Focus Enthusiast'}</p>
                <div className="mt-4 pt-3 border-t border-white/10 w-full flex items-center justify-center space-x-4 text-xs">
                  <span className="font-mono font-bold text-indigo-400">
                    {(top3[2].total_focus_minutes / 60).toFixed(1)} hrs
                  </span>
                  <span className="flex items-center text-amber-400 font-semibold">
                    <Flame className="w-3.5 h-3.5 fill-amber-400 mr-1" />
                    {top3[2].current_streak}d
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard Table */}
          <div className="bg-[#141721] border border-white/10 rounded p-6 shadow-lg">
            <h3 className="text-sm font-bold text-white mb-4">Complete Rankings</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="pb-3 font-semibold pl-2">Rank</th>
                    <th className="pb-3 font-semibold">Student / Scholar</th>
                    <th className="pb-3 font-semibold">Bio</th>
                    <th className="pb-3 font-semibold">Current Streak</th>
                    <th className="pb-3 font-semibold text-right pr-2">Total Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {leaderboard.map((u, idx) => {
                    const hours = (u.total_focus_minutes / 60).toFixed(1);
                    return (
                      <tr key={u.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 pl-2 font-mono font-bold text-slate-400">
                          #{idx + 1}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-7 h-7 rounded-sm bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center text-[11px] border border-indigo-500/30">
                              {u.display_name.charAt(0)}
                            </div>
                            <span className="font-semibold text-white">{u.display_name}</span>
                          </div>
                        </td>
                        <td className="py-3 text-slate-400 max-w-xs truncate">
                          {u.bio || '—'}
                        </td>
                        <td className="py-3">
                          <span className="inline-flex items-center text-amber-400 font-semibold text-xs">
                            <Flame className="w-3.5 h-3.5 fill-amber-400 mr-1" />
                            {u.current_streak} days
                          </span>
                        </td>
                        <td className="py-3 text-right pr-2 font-mono font-bold text-indigo-400">
                          {hours} hrs
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
