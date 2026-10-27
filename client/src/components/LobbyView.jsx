import React, { useState, useEffect } from 'react';
import { 
  Users, Sparkles, Plus, Search, BookOpen, Coffee, Cpu, Stethoscope, 
  Palette, Play, Shield, Timer, Flame, CheckCircle2 
} from 'lucide-react';
import { api } from '../utils/api';

const CATEGORY_MAP = {
  'All Rooms': null,
  'Silent Study': BookOpen,
  'Lofi & Casual': Coffee,
  'Engineering & STEM': Cpu,
  'Medical & Science': Stethoscope,
  'Creativity & Arts': Palette,
};

export default function LobbyView({ onJoinRoom, onOpenCreateRoom, onOpenAuth, isAuthenticated }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Rooms');

  const fetchRooms = async () => {
    try {
      const res = await api.getRooms();
      setRooms(res.rooms || []);
    } catch (err) {
      console.error('Failed to load rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 10000); // Poll room presence every 10s
    return () => clearInterval(interval);
  }, []);

  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.name.toLowerCase().includes(search.toLowerCase()) ||
                          (room.description && room.description.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = selectedCategory === 'All Rooms' || room.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const totalOnline = rooms.reduce((acc, r) => acc + (r.onlineCount || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Hero Section */}
      <div className="relative rounded overflow-hidden p-8 sm:p-12 mb-10 border border-white/10 bg-gradient-to-br from-[#141724] via-[#10131d] to-[#0c0e14]">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded bg-indigo-600/20 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 -mb-20 w-80 h-80 rounded bg-pink-600/15 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-sm bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>24/7 Global Live Virtual Study Community</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Stop studying alone. <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
              Grind with peers in real-time.
            </span>
          </h1>

          <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
            Join thousands of students and engineers staying accountable with live video study rooms, 
            synchronized Pomodoro intervals, ambient audio synthesizers, and streak tracking.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              onClick={() => {
                if (filteredRooms.length > 0) onJoinRoom(filteredRooms[0]);
              }}
              className="px-6 py-3 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-xl shadow-indigo-600/30 flex items-center space-x-2 transition-all hover:scale-[1.02]"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Hop into Quick Focus Room</span>
            </button>

            <button
              onClick={onOpenCreateRoom}
              className="px-5 py-3 rounded bg-white/5 hover:bg-white/10 text-white font-semibold text-sm border border-white/10 flex items-center space-x-2 transition-all"
            >
              <Plus className="w-4 h-4 text-indigo-400" />
              <span>Create Custom Study Hall</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="flex items-center space-x-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></div>
              <div>
                <p className="text-slate-400">Live Active Peers</p>
                <p className="font-bold text-white text-sm">{Math.max(totalOnline, 1)} Studying Now</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <Timer className="w-4 h-4 text-indigo-400" />
              <div>
                <p className="text-slate-400">Synced Timer</p>
                <p className="font-bold text-white text-sm">25m / 50m Intervals</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <Flame className="w-4 h-4 text-amber-400" />
              <div>
                <p className="text-slate-400">Daily Streaks</p>
                <p className="font-bold text-white text-sm">Persistent Tracking</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <Shield className="w-4 h-4 text-purple-400" />
              <div>
                <p className="text-slate-400">WebRTC Mesh</p>
                <p className="font-bold text-white text-sm">Peer-to-Peer Encrypted</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        
        {/* Categories */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {Object.keys(CATEGORY_MAP).map(cat => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/5'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search rooms or subjects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#141721] border border-white/10 rounded pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Room Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
          <p className="mt-3 text-xs text-slate-400 font-medium">Connecting to StudyStream rooms...</p>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="p-12 text-center rounded bg-white/5 border border-white/10">
          <p className="text-slate-400 text-sm">No study halls match your filter.</p>
          <button
            onClick={onOpenCreateRoom}
            className="mt-4 px-4 py-2 rounded bg-indigo-600 text-white text-xs font-semibold"
          >
            Create this Study Hall
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRooms.map(room => {
            return (
              <div
                key={room.id}
                className="group relative bg-[#141721] hover:bg-[#181b27] border border-white/10 hover:border-indigo-500/40 rounded p-6 transition-all duration-200 flex flex-col justify-between hover:shadow-xl hover:shadow-indigo-950/40"
              >
                <div>
                  {/* Top Badge Strip */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-sm bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {room.category}
                    </span>
                    <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>{room.onlineCount || 0} online</span>
                    </div>
                  </div>

                  {/* Room Name */}
                  <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {room.name}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {room.description || 'Join this study hall to focus alongside peers.'}
                  </p>

                  {/* Interval Details */}
                  <div className="mt-4 flex items-center space-x-3 text-[11px] text-slate-300">
                    <div className="flex items-center space-x-1">
                      <Timer className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{room.pomodoro_work_mins}m Focus / {room.pomodoro_break_mins}m Rest</span>
                    </div>
                  </div>
                </div>

                {/* Action CTA */}
                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">WebRTC Video & Chat</span>
                  <button
                    onClick={() => onJoinRoom(room)}
                    className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 flex items-center space-x-1.5 transition-all group-hover:scale-105"
                  >
                    <span>Join Room</span>
                    <Play className="w-3 h-3 fill-white" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
