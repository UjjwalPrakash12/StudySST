import React, { useState, useEffect } from 'react';
import { 
  Users, Sparkles, Plus, Search, BookOpen, Coffee, Cpu, Stethoscope, 
  Palette, Play, Shield, Timer, Flame, CheckCircle2, Radio 
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
      <div className="relative rounded-none p-8 sm:p-12 mb-10 border border-[rgba(64,56,47,0.2)] bg-[#FAEDCD]">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-none bg-[#E9EDC9] border border-[rgba(64,56,47,0.2)] text-[#40382F] text-xs font-semibold mb-4">
            <span className="flex h-2 w-2 bg-[#D4A373] animate-pulse"></span>
            <span>24/7 Global Unlimited Live Virtual Study Halls</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-[#40382F] tracking-tight leading-tight">
            Stop studying alone. <br />
            <span className="text-[#D4A373]">
              Stream live with scholars worldwide.
            </span>
          </h1>

          <p className="mt-4 text-sm sm:text-base text-[#75695A] leading-relaxed max-w-2xl font-normal">
            Join thousands of students and engineers staying accountable with warm live video study halls, 
            unlimited session tracking, community blogs, ambient sound synthesizers, and verified live-hour rankings.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                if (filteredRooms.length > 0) onJoinRoom(filteredRooms[0]);
              }}
              className="px-6 py-3 rounded-none bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] font-bold text-sm border border-[#40382F]/20 flex items-center space-x-2 transition-all"
            >
              <Play className="w-4 h-4 fill-[#40382F]" />
              <span>Hop into Quick Focus Room</span>
            </button>

            <button
              onClick={onOpenCreateRoom}
              className="px-5 py-3 rounded-none bg-[#CCD5AE] hover:bg-[#BCC69B] text-[#40382F] font-semibold text-sm border border-[rgba(64,56,47,0.2)] flex items-center space-x-2 transition-all"
            >
              <Plus className="w-4 h-4 text-[#40382F]" />
              <span>Create Custom Study Hall</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-8 pt-6 border-t border-[rgba(64,56,47,0.2)] grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="flex items-center space-x-2.5 bg-[#FEFAE0]/70 p-3 rounded-none border border-[rgba(64,56,47,0.2)]">
              <div className="w-2.5 h-2.5 bg-[#D4A373] animate-ping"></div>
              <div>
                <p className="text-[#75695A] text-[11px]">Live Active Peers</p>
                <p className="font-bold text-[#40382F] text-sm">{totalOnline} Studying Now</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 bg-[#FEFAE0]/70 p-3 rounded-none border border-[rgba(64,56,47,0.2)]">
              <Timer className="w-4 h-4 text-[#D4A373]" />
              <div>
                <p className="text-[#75695A] text-[11px]">Live Hours Tracking</p>
                <p className="font-bold text-[#40382F] text-sm">Unlimited & Verified</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 bg-[#FEFAE0]/70 p-3 rounded-none border border-[rgba(64,56,47,0.2)]">
              <Flame className="w-4 h-4 text-[#D4A373]" />
              <div>
                <p className="text-[#75695A] text-[11px]">Daily Streaks</p>
                <p className="font-bold text-[#40382F] text-sm">Persistent Tracking</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 bg-[#FEFAE0]/70 p-3 rounded-none border border-[rgba(64,56,47,0.2)]">
              <Shield className="w-4 h-4 text-[#75695A]" />
              <div>
                <p className="text-[#75695A] text-[11px]">WebRTC Mesh</p>
                <p className="font-bold text-[#40382F] text-sm">Peer Encrypted</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        
        {/* Categories */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {Object.keys(CATEGORY_MAP).map(cat => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-none text-xs font-semibold whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-[#D4A373] text-[#40382F] border-[#D4A373] font-bold'
                    : 'bg-[#FAEDCD] text-[#75695A] hover:bg-[#E9EDC9] hover:text-[#40382F] border-[rgba(64,56,47,0.2)]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#75695A]" />
          <input
            type="text"
            placeholder="Search rooms or subjects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)] rounded-none pl-10 pr-4 py-2.5 text-xs text-[#40382F] placeholder-[#9E9080] focus:outline-none focus:border-[#D4A373] transition-all"
          />
        </div>
      </div>

      {/* Room Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block animate-spin rounded-none h-8 w-8 border-4 border-[#D4A373] border-t-transparent"></div>
          <p className="mt-3 text-xs text-[#75695A] font-medium">Connecting to StudyStream rooms...</p>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="p-12 text-center rounded-none bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)]">
          <p className="text-[#75695A] text-sm">No study halls match your filter.</p>
          <button
            onClick={onOpenCreateRoom}
            className="mt-4 px-4 py-2 rounded-none bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] text-xs font-bold border border-[#40382F]/20"
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
                className="group relative bg-[#FEFAE0] hover:bg-[#FAEDCD]/70 border border-[rgba(64,56,47,0.2)] hover:border-[#D4A373] rounded-none p-6 transition-all duration-150 flex flex-col justify-between"
              >
                <div>
                  {/* Top Badge Strip */}
                  <div className="flex items-center justify-between mb-3.5">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-none bg-[#CCD5AE] text-[#40382F] border border-[rgba(64,56,47,0.2)]">
                      {room.category}
                    </span>
                    <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-none bg-[#E9EDC9] border border-[rgba(64,56,47,0.2)] text-[#40382F] text-[11px] font-semibold">
                      <span className="w-1.5 h-1.5 bg-[#D4A373] animate-pulse"></span>
                      <span>{room.onlineCount || 0} online</span>
                    </div>
                  </div>

                  {/* Room Name */}
                  <h3 className="text-lg font-bold text-[#40382F] group-hover:text-[#D4A373] transition-colors leading-snug">
                    {room.name}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-[#75695A] mt-2 line-clamp-2 leading-relaxed font-normal">
                    {room.description || 'Join this study hall to focus alongside peers.'}
                  </p>

                  {/* Live Stream Details */}
                  <div className="mt-4 flex items-center space-x-3 text-[11px] text-[#40382F]">
                    <div className="flex items-center space-x-1.5 text-[#D4A373] font-semibold">
                      <span className="w-1.5 h-1.5 bg-[#D4A373]"></span>
                      <span>Unlimited Live Streaming</span>
                    </div>
                  </div>
                </div>

                {/* Action CTA */}
                <div className="mt-6 pt-4 border-t border-[rgba(64,56,47,0.2)] flex items-center justify-between">
                  <span className="text-[11px] text-[#75695A] font-medium">WebRTC Video & Chat</span>
                  <button
                    onClick={() => onJoinRoom(room)}
                    className="px-4 py-2 rounded-none bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] text-xs font-bold border border-[#40382F]/20 flex items-center space-x-1.5 transition-all"
                  >
                    <span>Join Room</span>
                    <Play className="w-3 h-3 fill-[#40382F]" />
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
