import React, { useState, useEffect } from 'react';
import { Trophy, Flame, Clock, Award, Medal, Crown, Radio, Sparkles, Filter, ShieldCheck, User } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

function formatLiveHours(seconds) {
  const s = seconds || 0;
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export default function LeaderboardView() {
  const { user: currentUser } = useAuth();
  const [period, setPeriod] = useState('all_time'); // 'all_time' | 'weekly' | 'monthly'
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUserRank, setCurrentUserRank] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async (selectedPeriod) => {
    setLoading(true);
    try {
      const res = await api.getLeaderboard(selectedPeriod);
      setLeaderboard(res.leaderboard || []);
      setCurrentUserRank(res.currentUserRank || null);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(period);
  }, [period]);

  const top3 = leaderboard.slice(0, 3);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Header */}
      <div className="text-center max-w-xl mx-auto mb-8">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-sm bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-semibold mb-3">
          <Trophy className="w-3.5 h-3.5" />
          <span>Global Live Hours Hall of Fame</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">StudyStream Leaderboard</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-2">
          Rankings calculated automatically from verified live stream study hours. Unlimited sessions, anti-cheat protected.
        </p>

        {/* Period Selector Tabs */}
        <div className="inline-flex mt-6 p-1 bg-[#141721] border border-white/10 rounded-sm">
          {[
            { id: 'all_time', label: 'All-Time' },
            { id: 'monthly', label: 'This Month' },
            { id: 'weekly', label: 'This Week' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setPeriod(tab.id)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-sm transition-all ${
                period === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
          <p className="mt-3 text-xs text-slate-400">Aggregating verified live hours...</p>
        </div>
      ) : (
        <>
          {/* Current User Rank Highlight Banner */}
          {currentUserRank && (
            <div className="mb-8 p-4 bg-gradient-to-r from-indigo-950/40 via-[#141721] to-indigo-950/40 border border-indigo-500/30 rounded-sm flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-sm bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center font-bold text-indigo-300 text-sm">
                  #{currentUserRank.rank}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">Your Ranking</span>
                    <span className="text-white font-bold text-sm">{currentUserRank.user?.display_name || currentUser?.display_name}</span>
                    {currentUserRank.user?.is_live && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1"></span>
                        LIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Stay live in any study hall to climb the ranks. Every minute counts.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-xs text-slate-400">Verified Live Time</div>
                  <div className="font-mono text-base font-bold text-emerald-400">
                    {formatLiveHours(currentUserRank.user?.total_live_seconds)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top 3 Podium Cards */}
          {top3.length >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 items-end">
              
              {/* #2 Silver */}
              <div className="bg-[#141721] border border-white/10 rounded-sm p-6 text-center order-2 md:order-1 flex flex-col items-center shadow-lg hover:border-slate-400/40 transition-all">
                <div className="relative mb-3">
                  <div className="w-16 h-16 rounded-sm bg-gradient-to-tr from-slate-400 to-slate-200 text-[#0c0e14] font-extrabold text-xl flex items-center justify-center ring-2 ring-slate-400/30">
                    {top3[1].display_name.charAt(0)}
                  </div>
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-sm bg-slate-300 text-[#0c0e14] font-bold text-xs shadow">
                    #2
                  </span>
                  {top3[1].is_live ? (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-sm bg-emerald-500 text-black text-[9px] font-bold">
                      LIVE
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center space-x-1.5 justify-center">
                  <h3 className="text-base font-bold text-white">{top3[1].display_name}</h3>
                  {top3[1].is_live && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>}
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{top3[1].bio || 'Dedicated scholar'}</p>
                
                <div className="mt-4 pt-3 border-t border-white/10 w-full flex items-center justify-around text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400">Live Hours</div>
                    <span className="font-mono font-bold text-indigo-400 text-sm">
                      {formatLiveHours(top3[1].total_live_seconds)}
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Streak</div>
                    <span className="flex items-center text-amber-400 font-semibold text-sm">
                      <Flame className="w-3.5 h-3.5 fill-amber-400 mr-1" />
                      {top3[1].current_streak}d
                    </span>
                  </div>
                </div>
              </div>

              {/* #1 Gold (Taller, Glowing) */}
              <div className="bg-gradient-to-b from-[#1b1f30] to-[#141721] border-2 border-amber-500/60 rounded-sm p-7 text-center order-1 md:order-2 flex flex-col items-center shadow-2xl shadow-amber-500/10 md:-translate-y-3">
                <div className="relative mb-3">
                  <Crown className="w-6 h-6 text-amber-400 fill-amber-400 absolute -top-5 left-1/2 -translate-x-1/2 animate-bounce" />
                  <div className="w-20 h-20 rounded-sm bg-gradient-to-tr from-amber-400 to-yellow-200 text-[#0c0e14] font-black text-2xl flex items-center justify-center ring-2 ring-amber-400/50">
                    {top3[0].display_name.charAt(0)}
                  </div>
                  <span className="absolute -bottom-1 -right-1 px-2.5 py-0.5 rounded-sm bg-amber-400 text-[#0c0e14] font-extrabold text-xs shadow-md">
                    #1
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 justify-center">
                  <h3 className="text-lg font-extrabold text-white">{top3[0].display_name}</h3>
                  {top3[0].is_live && (
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded-sm bg-emerald-500 text-black text-[9px] font-extrabold">
                      LIVE NOW
                    </span>
                  )}
                </div>
                <p className="text-xs text-amber-200/80 mt-0.5 truncate max-w-xs">{top3[0].bio || 'Top Live Scholar'}</p>
                
                <div className="mt-5 pt-3 border-t border-white/10 w-full flex items-center justify-around text-xs">
                  <div>
                    <div className="text-[10px] text-amber-300/70">Verified Live Time</div>
                    <span className="font-mono font-bold text-amber-300 text-base">
                      {formatLiveHours(top3[0].total_live_seconds)}
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] text-amber-300/70">Streak</div>
                    <span className="flex items-center text-amber-400 font-semibold text-base">
                      <Flame className="w-4 h-4 fill-amber-400 mr-1" />
                      {top3[0].current_streak}d
                    </span>
                  </div>
                </div>
              </div>

              {/* #3 Bronze */}
              <div className="bg-[#141721] border border-white/10 rounded-sm p-6 text-center order-3 flex flex-col items-center shadow-lg hover:border-amber-700/40 transition-all">
                <div className="relative mb-3">
                  <div className="w-16 h-16 rounded-sm bg-gradient-to-tr from-amber-700 to-amber-500 text-white font-extrabold text-xl flex items-center justify-center ring-2 ring-amber-700/30">
                    {top3[2].display_name.charAt(0)}
                  </div>
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-sm bg-amber-700 text-white font-bold text-xs shadow">
                    #3
                  </span>
                  {top3[2].is_live ? (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-sm bg-emerald-500 text-black text-[9px] font-bold">
                      LIVE
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center space-x-1.5 justify-center">
                  <h3 className="text-base font-bold text-white">{top3[2].display_name}</h3>
                  {top3[2].is_live && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>}
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{top3[2].bio || 'Focus Enthusiast'}</p>
                
                <div className="mt-4 pt-3 border-t border-white/10 w-full flex items-center justify-around text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400">Live Hours</div>
                    <span className="font-mono font-bold text-indigo-400 text-sm">
                      {formatLiveHours(top3[2].total_live_seconds)}
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Streak</div>
                    <span className="flex items-center text-amber-400 font-semibold text-sm">
                      <Flame className="w-3.5 h-3.5 fill-amber-400 mr-1" />
                      {top3[2].current_streak}d
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Full Leaderboard Table */}
          <div className="bg-[#141721] border border-white/10 rounded-sm p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Full Live Hours Standing</h3>
              <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verified by StudyStream Engine</span>
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="pb-3 font-semibold pl-2">Rank</th>
                    <th className="pb-3 font-semibold">Scholar</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Streak</th>
                    <th className="pb-3 font-semibold text-right pr-2">Live Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {leaderboard.map((u, idx) => {
                    const isSelf = currentUser && currentUser.id === u.id;
                    return (
                      <tr
                        key={u.id}
                        className={`transition-colors ${
                          isSelf 
                            ? 'bg-indigo-950/40 hover:bg-indigo-950/60 font-semibold' 
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <td className="py-3 pl-2 font-mono font-bold text-slate-400">
                          {idx === 0 && <span className="text-amber-400">🥇 #1</span>}
                          {idx === 1 && <span className="text-slate-300">🥈 #2</span>}
                          {idx === 2 && <span className="text-amber-600">🥉 #3</span>}
                          {idx > 2 && `#${idx + 1}`}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-7 h-7 rounded-sm bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center text-[11px] border border-indigo-500/30">
                              {u.display_name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center space-x-1.5">
                                <span className={`text-white ${isSelf ? 'text-indigo-300' : ''}`}>
                                  {u.display_name}
                                </span>
                                {isSelf && (
                                  <span className="text-[9px] px-1 py-0.2 rounded-sm bg-indigo-500/30 text-indigo-300 border border-indigo-500/40">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate max-w-xs">{u.bio || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          {u.is_live ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-sm bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              <span>LIVE NOW</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Offline</span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className="inline-flex items-center text-amber-400 font-semibold text-xs">
                            <Flame className="w-3.5 h-3.5 fill-amber-400 mr-1" />
                            {u.current_streak}d
                          </span>
                        </td>
                        <td className="py-3 text-right pr-2 font-mono font-bold text-emerald-400">
                          {formatLiveHours(u.total_live_seconds)}
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
