import React, { useState, useEffect } from 'react';
import { 
  Users, Sparkles, Search, BookOpen, Coffee, Cpu, Stethoscope, 
  Palette, Play, Shield, Timer, Flame, CheckCircle2, Radio,
  Plus, Lock, Unlock, Key, X, Eye, EyeOff, AlertCircle
} from 'lucide-react';
import { api } from '../utils/api';
import { usePresence } from '../context/PresenceContext';

const CATEGORY_MAP = {
  'All Rooms': null,
  'Silent Study': BookOpen,
  'Lofi & Casual': Coffee,
  'Engineering & STEM': Cpu,
  'Medical & Science': Stethoscope,
  'Creativity & Arts': Palette,
};

const CATEGORIES = [
  'Silent Study',
  'Lofi & Casual',
  'Engineering & STEM',
  'Medical & Science',
  'Creativity & Arts'
];

export default function LobbyView({ onJoinRoom, onOpenAuth, isAuthenticated }) {
  const { totalActive, authenticatedCount, anonymousCount, roomCounts, socket } = usePresence();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Rooms');

  // Create Room modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    category: 'Silent Study',
    description: '',
    visibility: 'public',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // Password Prompt modal state
  const [passwordPromptRoom, setPasswordPromptRoom] = useState(null);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [showPromptPassword, setShowPromptPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);

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

  // Real-time socket updates for new rooms
  useEffect(() => {
    if (!socket) return;
    const handleRoomsUpdated = () => {
      fetchRooms();
    };
    socket.on('rooms-updated', handleRoomsUpdated);
    return () => {
      socket.off('rooms-updated', handleRoomsUpdated);
    };
  }, [socket]);

  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.name.toLowerCase().includes(search.toLowerCase()) ||
                          (room.description && room.description.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = selectedCategory === 'All Rooms' || room.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const totalOnline = totalActive;

  const handleOpenCreateModal = () => {
    if (!isAuthenticated) {
      onOpenAuth?.();
      return;
    }
    if (rooms.length >= 50) {
      alert('StudySST has reached its limit of 50 rooms. Please join an existing room.');
      return;
    }
    setCreateForm({
      name: '',
      category: 'Silent Study',
      description: '',
      visibility: 'public',
      password: '',
    });
    setCreateError('');
    setShowPassword(false);
    setIsCreateModalOpen(true);
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (rooms.length >= 50) {
      setCreateError('StudySST has reached its limit of 50 rooms. Please join an existing room.');
      return;
    }
    const trimmedName = createForm.name.trim();
    if (!trimmedName || trimmedName.length < 3 || trimmedName.length > 60) {
      setCreateError('Room name must be between 3 and 60 characters.');
      return;
    }
    if (createForm.visibility === 'password') {
      const trimmedPass = createForm.password.trim();
      if (!trimmedPass || trimmedPass.length < 4 || trimmedPass.length > 64) {
        setCreateError('Password must be between 4 and 64 characters for protected rooms.');
        return;
      }
    }

    setCreating(true);
    setCreateError('');
    try {
      const res = await api.createRoom({
        name: trimmedName,
        category: createForm.category,
        description: createForm.description.trim(),
        visibility: createForm.visibility,
        password: createForm.visibility === 'password' ? createForm.password.trim() : undefined,
      });

      setIsCreateModalOpen(false);
      await fetchRooms();

      if (res.room) {
        if (res.room.is_private && createForm.password) {
          try {
            const authRes = await api.verifyRoomPassword(res.room.id, createForm.password.trim());
            onJoinRoom({ ...res.room, roomToken: authRes.roomToken });
            return;
          } catch (e) {}
        }
        onJoinRoom(res.room);
      }
    } catch (err) {
      setCreateError(err.message || 'Failed to create room.');
    } finally {
      setCreating(false);
    }
  };

  const handleRoomClick = (room) => {
    if (room.is_private) {
      if (!isAuthenticated) {
        onOpenAuth?.();
        return;
      }
      setPasswordPromptRoom(room);
      setEnteredPassword('');
      setPasswordError('');
      setShowPromptPassword(false);
    } else {
      onJoinRoom(room);
    }
  };

  const handleVerifyPasswordAndJoin = async (e) => {
    e.preventDefault();
    if (!enteredPassword.trim()) {
      setPasswordError('Please enter the room password.');
      return;
    }

    setVerifyingPassword(true);
    setPasswordError('');
    try {
      const res = await api.verifyRoomPassword(passwordPromptRoom.id, enteredPassword.trim());
      if (res.roomToken) {
        const roomWithToken = { ...passwordPromptRoom, roomToken: res.roomToken };
        setPasswordPromptRoom(null);
        onJoinRoom(roomWithToken);
      } else {
        setPasswordError('Incorrect room password.');
      }
    } catch (err) {
      setPasswordError(err.message || 'Incorrect room password.');
    } finally {
      setVerifyingPassword(false);
    }
  };

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
                if (filteredRooms.length > 0) handleRoomClick(filteredRooms[0]);
              }}
              className="px-6 py-3 rounded-none bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] font-bold text-sm border border-[#40382F]/20 flex items-center space-x-2 transition-all"
            >
              <Play className="w-4 h-4 fill-[#40382F]" />
              <span>Hop into Quick Focus Room</span>
            </button>

            <button
              onClick={handleOpenCreateModal}
              disabled={rooms.length >= 50}
              className={`px-6 py-3 rounded-none font-bold text-sm border flex items-center space-x-2 transition-all ${
                rooms.length >= 50
                  ? 'bg-[#E9EDC9]/50 text-[#75695A] border-[rgba(64,56,47,0.2)] cursor-not-allowed opacity-80'
                  : 'bg-[#FEFAE0] hover:bg-[#E9EDC9] text-[#40382F] border-[rgba(64,56,47,0.3)]'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Create Room</span>
              <span className="text-xs font-normal text-[#75695A]">({rooms.length}/50)</span>
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
              <Radio className="w-4 h-4 text-[#D4A373]" />
              <div>
                <p className="text-[#75695A] text-[11px]">Total Study Halls</p>
                <p className="font-bold text-[#40382F] text-sm">{rooms.length} / 50 Active</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 50-Room Limit Alert Banner */}
      {rooms.length >= 50 && (
        <div className="mb-6 p-4 rounded-none bg-[#FAEDCD] border-2 border-[#D4A373] flex items-center space-x-3 text-xs text-[#40382F]">
          <AlertCircle className="w-5 h-5 text-[#D4A373] flex-shrink-0" />
          <div className="leading-relaxed">
            <span className="font-bold">StudySST has reached its limit of 50 rooms.</span> Please join an existing room.
          </div>
        </div>
      )}

      {/* Filter, Search, and Create Bar */}
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

        {/* Search & Create Actions */}
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#75695A]" />
            <input
              type="text"
              placeholder="Search rooms or subjects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)] rounded-none pl-10 pr-4 py-2.5 text-xs text-[#40382F] placeholder-[#9E9080] focus:outline-none focus:border-[#D4A373] transition-all"
            />
          </div>

          <button
            onClick={handleOpenCreateModal}
            disabled={rooms.length >= 50}
            title={rooms.length >= 50 ? 'StudySST has reached its limit of 50 rooms. Please join an existing room.' : 'Create a new study room'}
            className={`px-4 py-2.5 rounded-none text-xs font-bold border flex items-center space-x-1.5 whitespace-nowrap transition-all ${
              rooms.length >= 50
                ? 'bg-[#E9EDC9]/50 text-[#75695A] border-[rgba(64,56,47,0.2)] cursor-not-allowed opacity-80'
                : 'bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] border-[#40382F]/20'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Create Room</span>
          </button>
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
            onClick={() => { setSearch(''); setSelectedCategory('All Rooms'); }}
            className="mt-4 px-4 py-2 rounded-none bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] text-xs font-bold border border-[#40382F]/20"
          >
            Clear Filters
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
                    <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-none bg-[#CCD5AE] text-[#40382F] border border-[rgba(64,56,47,0.2)]">
                        {room.category}
                      </span>
                      {room.is_private ? (
                        <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-none bg-[#FAEDCD] text-[#75695A] border border-[#D4A373]/40">
                          <Lock className="w-3 h-3 text-[#D4A373]" />
                          <span>Protected</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-none bg-[#E9EDC9] text-[#75695A] border border-[rgba(64,56,47,0.2)]">
                          <Unlock className="w-3 h-3 text-[#75695A]" />
                          <span>Public</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-none bg-[#E9EDC9] border border-[rgba(64,56,47,0.2)] text-[#40382F] text-[11px] font-semibold">
                      <span className="w-1.5 h-1.5 bg-[#D4A373] animate-pulse"></span>
                      <span>{(roomCounts && roomCounts[room.id] !== undefined ? roomCounts[room.id] : (room.onlineCount || 0))} online</span>
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
                    onClick={() => handleRoomClick(room)}
                    className="px-4 py-2 rounded-none bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] text-xs font-bold border border-[#40382F]/20 flex items-center space-x-1.5 transition-all"
                  >
                    <span>{room.is_private ? 'Unlock & Join' : 'Join Room'}</span>
                    {room.is_private ? <Lock className="w-3 h-3 text-[#40382F]" /> : <Play className="w-3 h-3 fill-[#40382F]" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE ROOM MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-lg bg-[#FEFAE0] border border-[rgba(64,56,47,0.2)] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[rgba(64,56,47,0.2)]">
              <div>
                <h3 className="text-lg font-bold text-[#40382F]">Create Study Hall</h3>
                <p className="text-xs text-[#75695A]">Set up a custom virtual room for your study group</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 hover:bg-[#FAEDCD] text-[#75695A] hover:text-[#40382F] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#40382F] mb-1">
                  Room Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={60}
                  placeholder="e.g. Deep Focus & Thesis Writing"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)] px-3 py-2 text-xs text-[#40382F] placeholder-[#9E9080] focus:outline-none focus:border-[#D4A373]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#40382F] mb-1">
                  Category
                </label>
                <select
                  value={createForm.category}
                  onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                  className="w-full bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)] px-3 py-2 text-xs text-[#40382F] focus:outline-none focus:border-[#D4A373]"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#40382F] mb-1">
                  Description <span className="text-[10px] text-[#75695A]">(Optional, max 250 chars)</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={250}
                  placeholder="What is this study hall dedicated to?..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)] px-3 py-2 text-xs text-[#40382F] placeholder-[#9E9080] focus:outline-none focus:border-[#D4A373] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#40382F] mb-1.5">
                  Access & Visibility
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-start p-3 border cursor-pointer transition-all ${
                      createForm.visibility === 'public'
                        ? 'bg-[#E9EDC9] border-[#D4A373]'
                        : 'bg-[#FAEDCD] border-[rgba(64,56,47,0.2)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={createForm.visibility === 'public'}
                      onChange={() => setCreateForm({ ...createForm, visibility: 'public' })}
                      className="mt-0.5 mr-2 text-[#D4A373] focus:ring-0"
                    />
                    <div>
                      <div className="flex items-center space-x-1 text-xs font-bold text-[#40382F]">
                        <Unlock className="w-3.5 h-3.5 text-[#75695A]" />
                        <span>Public</span>
                      </div>
                      <p className="text-[10px] text-[#75695A] mt-0.5">Open to all community scholars</p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start p-3 border cursor-pointer transition-all ${
                      createForm.visibility === 'password'
                        ? 'bg-[#E9EDC9] border-[#D4A373]'
                        : 'bg-[#FAEDCD] border-[rgba(64,56,47,0.2)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value="password"
                      checked={createForm.visibility === 'password'}
                      onChange={() => setCreateForm({ ...createForm, visibility: 'password' })}
                      className="mt-0.5 mr-2 text-[#D4A373] focus:ring-0"
                    />
                    <div>
                      <div className="flex items-center space-x-1 text-xs font-bold text-[#40382F]">
                        <Lock className="w-3.5 h-3.5 text-[#D4A373]" />
                        <span>Protected</span>
                      </div>
                      <p className="text-[10px] text-[#75695A] mt-0.5">Requires room password</p>
                    </div>
                  </label>
                </div>
              </div>

              {createForm.visibility === 'password' && (
                <div className="p-3 bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)]">
                  <label className="block text-xs font-semibold text-[#40382F] mb-1">
                    Room Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={4}
                      maxLength={64}
                      placeholder="Enter a secret password (4-64 characters)"
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                      className="w-full bg-[#FEFAE0] border border-[rgba(64,56,47,0.2)] pl-3 pr-9 py-2 text-xs text-[#40382F] placeholder-[#9E9080] focus:outline-none focus:border-[#D4A373]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#75695A] hover:text-[#40382F]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-[#75695A] mt-1">
                    Only scholars with this password can enter this study hall. Passwords are securely hashed.
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-[rgba(64,56,47,0.2)] flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-[rgba(64,56,47,0.2)] text-xs text-[#75695A] hover:bg-[#FAEDCD] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] font-bold text-xs border border-[#40382F]/20 flex items-center space-x-1.5 transition-all disabled:opacity-50"
                >
                  {creating ? (
                    <span>Creating...</span>
                  ) : (
                    <>
                      <span>Create & Enter</span>
                      <Play className="w-3.5 h-3.5 fill-[#40382F]" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PASSWORD PROMPT MODAL */}
      {passwordPromptRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-md bg-[#FEFAE0] border border-[rgba(64,56,47,0.2)] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[rgba(64,56,47,0.2)]">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-[#FAEDCD] border border-[#D4A373]/40">
                  <Lock className="w-4 h-4 text-[#D4A373]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#40382F]">Password Required</h3>
                  <p className="text-xs text-[#75695A]">{passwordPromptRoom.name}</p>
                </div>
              </div>
              <button
                onClick={() => setPasswordPromptRoom(null)}
                className="p-1 hover:bg-[#FAEDCD] text-[#75695A] hover:text-[#40382F] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordError && (
              <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyPasswordAndJoin} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#40382F] mb-1">
                  Enter Room Password
                </label>
                <div className="relative">
                  <input
                    type={showPromptPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Enter password..."
                    value={enteredPassword}
                    onChange={(e) => setEnteredPassword(e.target.value)}
                    className="w-full bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)] pl-3 pr-9 py-2 text-xs text-[#40382F] placeholder-[#9E9080] focus:outline-none focus:border-[#D4A373]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPromptPassword(!showPromptPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#75695A] hover:text-[#40382F]"
                  >
                    {showPromptPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-[rgba(64,56,47,0.2)] flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setPasswordPromptRoom(null)}
                  className="px-4 py-2 border border-[rgba(64,56,47,0.2)] text-xs text-[#75695A] hover:bg-[#FAEDCD] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingPassword}
                  className="px-5 py-2 bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] font-bold text-xs border border-[#40382F]/20 flex items-center space-x-1.5 transition-all disabled:opacity-50"
                >
                  {verifyingPassword ? (
                    <span>Verifying...</span>
                  ) : (
                    <>
                      <span>Unlock & Enter</span>
                      <Play className="w-3.5 h-3.5 fill-[#40382F]" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
