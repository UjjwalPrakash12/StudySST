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
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-[10px] bg-[#E9EDC9] border border-[rgba(64,56,47,0.12)] text-[#40382F] text-xs font-semibold mb-3 shadow-sm">
          <Trophy className="w-3.5 h-3.5 text-[#D4A373]" />
          <span>Global Live Hours Hall of Fame</span>
        </div>
        <h1 className="text-3xl font-extrabold text-[#40382F] tracking-tight">StudyStream Leaderboard</h1>
        <p className="text-xs sm:text-sm text-[#75695A] mt-2 font-normal">
          Rankings calculated automatically from verified live stream study hours. Unlimited sessions, anti-cheat protected.
        </p>

        {/* Period Selector Tabs */}
        <div className="inline-flex mt-6 p-1 bg-[#FAEDCD] border border-[rgba(64,56,47,0.14)] rounded-[10px] shadow-sm">
          {[
            { id: 'all_time', label: 'All-Time' },
            { id: 'monthly', label: 'This Month' },
            { id: 'weekly', label: 'This Week' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setPeriod(tab.id)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-[8px] transition-all ${
                period === tab.id
                  ? 'bg-[#CCD5AE] text-[#40382F] shadow-sm font-bold border border-[rgba(64,56,47,0.1)]'
                  : 'text-[#75695A] hover:text-[#40382F]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#D4A373] border-t-transparent"></div>
          <p className="mt-3 text-xs text-[#75695A] font-medium">Aggregating verified live hours...</p>
        </div>
      ) : (
        <>
          {/* Current User Rank Highlight Banner */}
          {currentUserRank && (
            <div className="mb-8 p-5 bg-[#FAEDCD] border border-[rgba(64,56,47,0.14)] rounded-[16px] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-[10px] bg-[#D4A373] text-[#FEFAE0] flex items-center justify-center font-bold text-sm shadow-sm">
                  #{currentUserRank.rank}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-[#75695A] font-bold uppercase tracking-wider">Your Ranking</span>
                    <span className="text-[#40382F] font-bold text-sm">{currentUserRank.user?.display_name || currentUser?.display_name}</span>
                    {currentUserRank.user?.is_live && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] bg-[#CCD5AE] text-[#40382F] text-[10px] font-bold border border-[rgba(64,56,47,0.12)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D4A373] animate-pulse mr-1"></span>
                        LIVE NOW
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#75695A] mt-0.5 font-normal">
                    Stay live in any study hall to climb the ranks. Every minute counts.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-xs text-[#75695A] font-medium">Verified Live Time</div>
                  <div className="font-mono text-base font-extrabold text-[#D4A373]">
                    {formatLiveHours(currentUserRank.user?.total_live_seconds)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top 3 Podium Cards */}
          {top3.length >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 items-end">
              
              {/* #2 Silver (Soft blush-green surface) */}
              <div className="bg-[#E9EDC9] border border-[rgba(64,56,47,0.14)] rounded-[16px] p-6 text-center order-2 md:order-1 flex flex-col items-center shadow-sm hover:shadow-md transition-all">
                <div className="relative mb-3">
                  <div className="w-16 h-16 rounded-[12px] bg-[#CCD5AE] text-[#40382F] font-extrabold text-xl flex items-center justify-center shadow-sm border border-[rgba(64,56,47,0.1)]">
                    {top3[1].display_name.charAt(0)}
                  </div>
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-[6px] bg-[#FAEDCD] text-[#40382F] font-bold text-xs shadow-sm border border-[rgba(64,56,47,0.12)]">
                    #2
                  </span>
                  {top3[1].is_live ? (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-[6px] bg-[#CCD5AE] text-[#40382F] text-[9px] font-bold border border-[rgba(64,56,47,0.1)]">
                      LIVE
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center space-x-1.5 justify-center">
                  <h3 className="text-base font-bold text-[#40382F]">{top3[1].display_name}</h3>
                </div>
                <p className="text-xs text-[#75695A] mt-0.5 truncate max-w-xs font-normal">{top3[1].bio || 'Dedicated scholar'}</p>
                
                <div className="mt-4 pt-3 border-t border-[rgba(64,56,47,0.1)] w-full flex items-center justify-around text-xs">
                  <div>
                    <div className="text-[10px] text-[#75695A]">Live Hours</div>
                    <span className="font-mono font-bold text-[#40382F] text-sm">
                      {formatLiveHours(top3[1].total_live_seconds)}
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#75695A]">Streak</div>
                    <span className="flex items-center text-[#40382F] font-semibold text-sm">
                      <Flame className="w-3.5 h-3.5 text-[#D4A373] fill-[#D4A373] mr-1" />
                      {top3[1].current_streak}d
                    </span>
                  </div>
                </div>
              </div>

              {/* #1 Champion: Refined Terracotta & Sage combination */}
              <div className="bg-[#FEFAE0] border-2 border-[#D4A373] rounded-[16px] p-7 text-center order-1 md:order-2 flex flex-col items-center shadow-md md:-translate-y-3 relative">
                <div className="relative mb-3">
                  <Crown className="w-6 h-6 text-[#D4A373] fill-[#D4A373] absolute -top-5 left-1/2 -translate-x-1/2 animate-bounce" />
                  <div className="w-20 h-20 rounded-[14px] bg-[#D4A373] text-[#FEFAE0] font-black text-2xl flex items-center justify-center shadow-md">
                    {top3[0].display_name.charAt(0)}
                  </div>
                  <span className="absolute -bottom-1 -right-1 px-2.5 py-0.5 rounded-[6px] bg-[#CCD5AE] text-[#40382F] font-black text-xs shadow-sm border border-[rgba(64,56,47,0.12)]">
                    #1
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 justify-center">
                  <h3 className="text-lg font-extrabold text-[#40382F]">{top3[0].display_name}</h3>
                  {top3[0].is_live && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] bg-[#CCD5AE] text-[#40382F] text-[9px] font-extrabold border border-[rgba(64,56,47,0.1)]">
                      LIVE NOW
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#75695A] mt-0.5 truncate max-w-xs font-normal">{top3[0].bio || 'Top Live Scholar'}</p>
                
                <div className="mt-5 pt-3 border-t border-[rgba(64,56,47,0.12)] w-full flex items-center justify-around text-xs">
                  <div>
                    <div className="text-[10px] text-[#75695A]">Verified Live Time</div>
                    <span className="font-mono font-black text-[#D4A373] text-base">
                      {formatLiveHours(top3[0].total_live_seconds)}
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#75695A]">Streak</div>
                    <span className="flex items-center text-[#40382F] font-bold text-base">
                      <Flame className="w-4 h-4 text-[#D4A373] fill-[#D4A373] mr-1" />
                      {top3[0].current_streak}d
                    </span>
                  </div>
                </div>
              </div>

              {/* #3 Bronze (Pale Sand surface) */}
              <div className="bg-[#FAEDCD] border border-[rgba(64,56,47,0.14)] rounded-[16px] p-6 text-center order-3 flex flex-col items-center shadow-sm hover:shadow-md transition-all">
                <div className="relative mb-3">
                  <div className="w-16 h-16 rounded-[12px] bg-[#E9EDC9] text-[#40382F] font-extrabold text-xl flex items-center justify-center shadow-sm border border-[rgba(64,56,47,0.1)]">
                    {top3[2].display_name.charAt(0)}
                  </div>
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-[6px] bg-[#CCD5AE] text-[#40382F] font-bold text-xs shadow-sm border border-[rgba(64,56,47,0.12)]">
                    #3
                  </span>
                  {top3[2].is_live ? (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-[6px] bg-[#CCD5AE] text-[#40382F] text-[9px] font-bold border border-[rgba(64,56,47,0.1)]">
                      LIVE
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center space-x-1.5 justify-center">
                  <h3 className="text-base font-bold text-[#40382F]">{top3[2].display_name}</h3>
                </div>
                <p className="text-xs text-[#75695A] mt-0.5 truncate max-w-xs font-normal">{top3[2].bio || 'Focus Enthusiast'}</p>
                
                <div className="mt-4 pt-3 border-t border-[rgba(64,56,47,0.1)] w-full flex items-center justify-around text-xs">
                  <div>
                    <div className="text-[10px] text-[#75695A]">Live Hours</div>
                    <span className="font-mono font-bold text-[#40382F] text-sm">
                      {formatLiveHours(top3[2].total_live_seconds)}
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#75695A]">Streak</div>
                    <span className="flex items-center text-[#40382F] font-semibold text-sm">
                      <Flame className="w-3.5 h-3.5 text-[#D4A373] fill-[#D4A373] mr-1" />
                      {top3[2].current_streak}d
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Full Leaderboard Table */}
          <div className="bg-[#FEFAE0] border border-[rgba(64,56,47,0.14)] rounded-[16px] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#40382F]">Full Live Hours Standing</h3>
              <span className="text-[11px] text-[#75695A] flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#D4A373]" />
                <span>Verified by StudyStream Engine</span>
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[rgba(64,56,47,0.14)] text-[#75695A]">
                    <th className="pb-3 font-semibold pl-3">Rank</th>
                    <th className="pb-3 font-semibold">Scholar</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Streak</th>
                    <th className="pb-3 font-semibold text-right pr-3">Live Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(64,56,47,0.08)]">
                  {leaderboard.map((u, idx) => {
                    const isSelf = currentUser && currentUser.id === u.id;
                    return (
                      <tr
                        key={u.id}
                        className={`transition-colors ${
                          isSelf 
                            ? 'bg-[#E9EDC9]/70 font-semibold' 
                            : 'hover:bg-[#FAEDCD]/50'
                        }`}
                      >
                        <td className="py-3.5 pl-3 font-mono font-bold text-[#75695A]">
                          {idx === 0 && <span className="text-[#D4A373]">🥇 #1</span>}
                          {idx === 1 && <span className="text-[#40382F]">🥈 #2</span>}
                          {idx === 2 && <span className="text-[#B88252]">🥉 #3</span>}
                          {idx > 2 && `#${idx + 1}`}
                        </td>
                        <td className="py-3.5">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-7 h-7 rounded-[6px] bg-[#CCD5AE] text-[#40382F] font-bold flex items-center justify-center text-[11px] border border-[rgba(64,56,47,0.1)]">
                              {u.display_name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center space-x-1.5">
                                <span className={`text-[#40382F] ${isSelf ? 'font-bold' : ''}`}>
                                  {u.display_name}
                                </span>
                                {isSelf && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded-[4px] bg-[#D4A373] text-[#40382F] font-bold">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-[#75695A] truncate max-w-xs">{u.bio || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5">
                          {u.is_live ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-[6px] bg-[#CCD5AE] text-[#40382F] text-[10px] font-bold border border-[rgba(64,56,47,0.1)]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#D4A373] animate-pulse"></span>
                              <span>LIVE NOW</span>
                            </span>
                          ) : (
                            <span className="text-[#75695A] text-[11px]">Offline</span>
                          )}
                        </td>
                        <td className="py-3.5">
                          <span className="inline-flex items-center text-[#40382F] font-semibold text-xs">
                            <Flame className="w-3.5 h-3.5 text-[#D4A373] fill-[#D4A373] mr-1" />
                            {u.current_streak}d
                          </span>
                        </td>
                        <td className="py-3.5 text-right pr-3 font-mono font-bold text-[#D4A373]">
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
