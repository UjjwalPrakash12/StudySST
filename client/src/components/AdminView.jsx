import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Users, Radio, BookOpen, AlertCircle, Trash2, 
  UserX, UserCheck, Lock, Unlock, RefreshCw, X, Play, 
  Clock, Flame, CheckCircle2, AlertTriangle, Search
} from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function AdminView({ onJoinRoom }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('users'); // 'overview' | 'users' | 'rooms' | 'blogs'

  const [overview, setOverview] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [blogsList, setBlogsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  // Filter/Search states
  const [userSearch, setUserSearch] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [blogSearch, setBlogSearch] = useState('');

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState(null); 
  // { title: string, message: string, onConfirm: async () => void, isDestructive?: boolean }

  const isSuperAdmin = user?.isSuperAdmin || (user?.email && user.email.toLowerCase() === 'ujjwalprakash1812@gmail.com');

  const loadAdminData = async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    try {
      const [ovData, uData, rData, bData] = await Promise.all([
        api.getAdminOverview().catch(() => null),
        api.getAdminUsers().catch(() => ({ users: [] })),
        api.getAdminRooms().catch(() => ({ rooms: [] })),
        api.getAdminBlogs().catch(() => ({ blogs: [] }))
      ]);

      if (ovData) setOverview(ovData);
      if (uData?.users) setUsersList(uData.users);
      if (rData?.rooms) setRoomsList(rData.rooms);
      if (bData?.blogs) setBlogsList(bData.blogs);
    } catch (err) {
      console.error('Error loading admin dashboard:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to load administrative console.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [isSuperAdmin]);

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4500);
  };

  // User Actions
  const handleToggleSuspendUser = (targetUser) => {
    const actionName = targetUser.is_suspended ? 'reinstate' : 'suspend';
    setConfirmModal({
      title: `${targetUser.is_suspended ? 'Reinstate' : 'Suspend'} Scholar`,
      message: `Are you sure you want to ${actionName} @${targetUser.username} (${targetUser.email})? ${
        targetUser.is_suspended ? 'They will be allowed to log in and use StudySST again.' : 'They will be immediately disconnected and blocked from signing in.'
      }`,
      isDestructive: !targetUser.is_suspended,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const res = await api.suspendUser(targetUser.id);
          showFeedback('success', res.message || `User ${actionName}ed successfully.`);
          await loadAdminData();
        } catch (err) {
          showFeedback('error', err.message || 'Action failed');
        } finally {
          setActionLoading(false);
          setConfirmModal(null);
        }
      }
    });
  };

  const handleDeleteUser = (targetUser) => {
    setConfirmModal({
      title: 'Permanently Delete Scholar Account',
      message: `WARNING: Are you sure you want to completely delete @${targetUser.username} (${targetUser.email})? All their sessions, blogs, and tasks will be permanently removed. This cannot be undone.`,
      isDestructive: true,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const res = await api.deleteUser(targetUser.id);
          showFeedback('success', res.message || 'Scholar deleted successfully.');
          await loadAdminData();
        } catch (err) {
          showFeedback('error', err.message || 'Failed to delete user');
        } finally {
          setActionLoading(false);
          setConfirmModal(null);
        }
      }
    });
  };

  // Room Actions
  const handleRemoveRoomPassword = (room) => {
    setConfirmModal({
      title: 'Remove Room Password',
      message: `Make "${room.name}" public so any scholar can enter without a password?`,
      isDestructive: false,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await api.updateAdminRoom(room.id, { removePassword: true });
          showFeedback('success', `Password removed. "${room.name}" is now public.`);
          await loadAdminData();
        } catch (err) {
          showFeedback('error', err.message || 'Failed to remove password');
        } finally {
          setActionLoading(false);
          setConfirmModal(null);
        }
      }
    });
  };

  const handleDeleteRoom = (room) => {
    if (room.isPredefined) {
      alert('The five predefined public study halls are permanent and cannot be deleted.');
      return;
    }

    setConfirmModal({
      title: 'Permanently Delete Study Hall',
      message: `Are you sure you want to delete "${room.name}"? Any active scholars in this room will be notified and safely returned to the lobby.`,
      isDestructive: true,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await api.deleteAdminRoom(room.id);
          showFeedback('success', `Study hall "${room.name}" deleted.`);
          await loadAdminData();
        } catch (err) {
          showFeedback('error', err.message || 'Failed to delete room');
        } finally {
          setActionLoading(false);
          setConfirmModal(null);
        }
      }
    });
  };

  // Blog Actions
  const handleDeleteBlog = (blog) => {
    setConfirmModal({
      title: 'Delete Blog Post',
      message: `Are you sure you want to remove the blog "${blog.title}" by ${blog.author_name || blog.author_username}?`,
      isDestructive: true,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await api.deleteBlog(blog.id);
          showFeedback('success', 'Blog post removed successfully.');
          await loadAdminData();
        } catch (err) {
          showFeedback('error', err.message || 'Failed to delete blog');
        } finally {
          setActionLoading(false);
          setConfirmModal(null);
        }
      }
    });
  };

  if (!isSuperAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="p-8 bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)] rounded-none inline-block max-w-md">
          <AlertCircle className="w-12 h-12 text-[#D4A373] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#40382F]">Access Denied</h2>
          <p className="mt-2 text-xs text-[#75695A] leading-relaxed">
            This administrative console is strictly restricted to the authorized Super Admin (ujjwalprakash1812@gmail.com).
          </p>
        </div>
      </div>
    );
  }

  const filteredUsers = usersList.filter(u => 
    u.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.display_name?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredRooms = roomsList.filter(r => 
    r.name?.toLowerCase().includes(roomSearch.toLowerCase()) ||
    r.category?.toLowerCase().includes(roomSearch.toLowerCase())
  );

  const filteredBlogs = blogsList.filter(b => 
    b.title?.toLowerCase().includes(blogSearch.toLowerCase()) ||
    b.author_name?.toLowerCase().includes(blogSearch.toLowerCase()) ||
    b.category?.toLowerCase().includes(blogSearch.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-['Inter',sans-serif]">
      
      {/* Header Banner */}
      <div className="relative p-6 sm:p-8 bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)] rounded-none mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#E9EDC9] border border-[rgba(64,56,47,0.2)] text-[#40382F] text-xs font-bold mb-3">
              <ShieldCheck className="w-4 h-4 text-[#D4A373]" />
              <span>Super Admin • Verified System Owner</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#40382F] tracking-tight">
              StudySST Control Center
            </h1>
            <p className="text-xs text-[#75695A] mt-1">
              Authoritative moderation console for <span className="font-mono font-bold text-[#40382F]">ujjwalprakash1812@gmail.com</span>
            </p>
          </div>

          <button
            onClick={loadAdminData}
            disabled={loading || actionLoading}
            className="self-start md:self-auto px-4 py-2 bg-[#FEFAE0] hover:bg-[#E9EDC9] border border-[rgba(64,56,47,0.2)] text-[#40382F] text-xs font-bold flex items-center space-x-2 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh System Data</span>
          </button>
        </div>

        {/* System Metric Pills */}
        <div className="mt-6 pt-6 border-t border-[rgba(64,56,47,0.2)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-[#FEFAE0]/80 border border-[rgba(64,56,47,0.2)]">
            <p className="text-[11px] text-[#75695A]">Registered Scholars</p>
            <p className="text-lg font-bold text-[#40382F]">{overview ? overview.totalUsers : usersList.length}</p>
          </div>

          <div className="p-3 bg-[#FEFAE0]/80 border border-[rgba(64,56,47,0.2)]">
            <p className="text-[11px] text-[#75695A]">Study Halls</p>
            <p className="text-lg font-bold text-[#40382F]">{overview ? overview.totalRooms : roomsList.length} / 50 Active</p>
          </div>

          <div className="p-3 bg-[#FEFAE0]/80 border border-[rgba(64,56,47,0.2)]">
            <p className="text-[11px] text-[#75695A]">Live Scholars Now</p>
            <p className="text-lg font-bold text-[#D4A373]">{overview ? overview.activeScholarsNow : 0} Online</p>
          </div>

          <div className="p-3 bg-[#FEFAE0]/80 border border-[rgba(64,56,47,0.2)]">
            <p className="text-[11px] text-[#75695A]">Published Blogs</p>
            <p className="text-lg font-bold text-[#40382F]">{overview ? overview.totalBlogs : blogsList.length}</p>
          </div>
        </div>
      </div>

      {/* Real-time Feedback Banner */}
      {feedback && (
        <div className={`mb-6 p-4 border flex items-center space-x-3 text-xs ${
          feedback.type === 'success' 
            ? 'bg-emerald-100 border-emerald-300 text-emerald-900' 
            : 'bg-red-100 border-red-300 text-red-900'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
          )}
          <span className="font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-[rgba(64,56,47,0.2)] mb-6 space-x-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center space-x-2 px-5 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'users'
              ? 'border-[#D4A373] text-[#40382F] bg-[#FAEDCD]'
              : 'border-transparent text-[#75695A] hover:text-[#40382F] hover:bg-[#FAEDCD]/50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Scholars Moderation ({usersList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('rooms')}
          className={`flex items-center space-x-2 px-5 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'rooms'
              ? 'border-[#D4A373] text-[#40382F] bg-[#FAEDCD]'
              : 'border-transparent text-[#75695A] hover:text-[#40382F] hover:bg-[#FAEDCD]/50'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Study Halls Management ({roomsList.length}/50)</span>
        </button>

        <button
          onClick={() => setActiveTab('blogs')}
          className={`flex items-center space-x-2 px-5 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'blogs'
              ? 'border-[#D4A373] text-[#40382F] bg-[#FAEDCD]'
              : 'border-transparent text-[#75695A] hover:text-[#40382F] hover:bg-[#FAEDCD]/50'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Community Blogs ({blogsList.length})</span>
        </button>
      </div>

      {/* TAB 1: USERS */}
      {activeTab === 'users' && (
        <div>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#75695A]" />
              <input
                type="text"
                placeholder="Search scholars by username or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)] pl-9 pr-3 py-2 text-xs text-[#40382F] focus:outline-none focus:border-[#D4A373]"
              />
            </div>
            <span className="text-xs text-[#75695A]">
              Showing {filteredUsers.length} of {usersList.length} scholars
            </span>
          </div>

          <div className="overflow-x-auto border border-[rgba(64,56,47,0.2)] bg-[#FEFAE0]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAEDCD] border-b border-[rgba(64,56,47,0.2)] text-[#40382F] font-bold">
                <tr>
                  <th className="p-3">Scholar</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Focus Hours</th>
                  <th className="p-3">Streak</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(64,56,47,0.1)]">
                {filteredUsers.map(u => {
                  const isOwner = u.isSuperAdmin || (u.email && u.email.toLowerCase() === 'ujjwalprakash1812@gmail.com');
                  const hours = ((u.total_live_seconds || (u.total_focus_minutes * 60)) / 3600).toFixed(1);

                  return (
                    <tr key={u.id} className="hover:bg-[#FAEDCD]/40 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 bg-[#CCD5AE] font-bold text-xs flex items-center justify-center text-[#40382F] border border-[#40382F]/20">
                            {u.display_name?.charAt(0).toUpperCase() || 'S'}
                          </div>
                          <div>
                            <p className="font-bold text-[#40382F]">{u.display_name}</p>
                            <p className="text-[10px] text-[#75695A]">@{u.username}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-3 font-mono text-[11px] text-[#40382F]">
                        {u.email}
                      </td>

                      <td className="p-3 font-bold text-[#40382F]">
                        {hours}h live
                      </td>

                      <td className="p-3">
                        <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)] text-[#40382F] text-[10px] font-bold">
                          <Flame className="w-3 h-3 text-[#D4A373] fill-[#D4A373]" />
                          <span>{u.current_streak || 0}d</span>
                        </span>
                      </td>

                      <td className="p-3">
                        {isOwner ? (
                          <span className="px-2 py-0.5 bg-[#D4A373] text-[#40382F] font-bold text-[10px] border border-[#40382F]/20">
                            Super Admin
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-[#E9EDC9] text-[#75695A] font-semibold text-[10px] border border-[rgba(64,56,47,0.2)]">
                            Scholar
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        {u.is_suspended ? (
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 border border-red-300 text-[10px] font-bold">
                            Suspended
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                            Active
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right">
                        {isOwner ? (
                          <span className="text-[11px] text-[#75695A] italic">Owner (Protected)</span>
                        ) : (
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleToggleSuspendUser(u)}
                              disabled={actionLoading}
                              className={`px-2.5 py-1 text-[11px] font-bold border transition-all ${
                                u.is_suspended
                                  ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-300'
                                  : 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300'
                              }`}
                            >
                              {u.is_suspended ? 'Reinstate' : 'Suspend'}
                            </button>

                            <button
                              onClick={() => handleDeleteUser(u)}
                              disabled={actionLoading}
                              className="p-1 bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 transition-all"
                              title="Delete Account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ROOMS */}
      {activeTab === 'rooms' && (
        <div>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#75695A]" />
              <input
                type="text"
                placeholder="Search rooms..."
                value={roomSearch}
                onChange={(e) => setRoomSearch(e.target.value)}
                className="w-full bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)] pl-9 pr-3 py-2 text-xs text-[#40382F] focus:outline-none focus:border-[#D4A373]"
              />
            </div>
            <span className="text-xs text-[#75695A]">
              {roomsList.length} / 50 Active Study Halls
            </span>
          </div>

          <div className="overflow-x-auto border border-[rgba(64,56,47,0.2)] bg-[#FEFAE0]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAEDCD] border-b border-[rgba(64,56,47,0.2)] text-[#40382F] font-bold">
                <tr>
                  <th className="p-3">Study Hall</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Visibility</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Live Scholars</th>
                  <th className="p-3 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(64,56,47,0.1)]">
                {filteredRooms.map(room => {
                  return (
                    <tr key={room.id} className="hover:bg-[#FAEDCD]/40 transition-colors">
                      <td className="p-3 font-bold text-[#40382F]">
                        {room.name}
                      </td>

                      <td className="p-3 text-[#75695A]">
                        {room.category}
                      </td>

                      <td className="p-3">
                        {room.is_private ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-[#FAEDCD] border border-[#D4A373]/40 text-[#75695A] text-[10px] font-bold">
                            <Lock className="w-3 h-3 text-[#D4A373]" />
                            <span>Protected</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-[#E9EDC9] border border-[rgba(64,56,47,0.2)] text-[#75695A] text-[10px] font-bold">
                            <Unlock className="w-3 h-3 text-[#75695A]" />
                            <span>Public</span>
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        {room.isPredefined ? (
                          <span className="px-2 py-0.5 bg-[#CCD5AE] text-[#40382F] text-[10px] font-bold border border-[rgba(64,56,47,0.2)]">
                            Predefined (5 Public)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-[#FEFAE0] text-[#75695A] text-[10px] font-semibold border border-[rgba(64,56,47,0.2)]">
                            Custom User Hall
                          </span>
                        )}
                      </td>

                      <td className="p-3 font-semibold text-[#40382F]">
                        {room.onlineCount || 0} online
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => onJoinRoom(room)}
                            className="px-2.5 py-1 bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] font-bold text-[11px] border border-[#40382F]/20 flex items-center space-x-1 transition-all"
                            title="Enter room with Super Admin bypass"
                          >
                            <Play className="w-3 h-3 fill-[#40382F]" />
                            <span>Enter</span>
                          </button>

                          {room.is_private && (
                            <button
                              onClick={() => handleRemoveRoomPassword(room)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-[#E9EDC9] hover:bg-[#CCD5AE] text-[#40382F] font-semibold text-[11px] border border-[rgba(64,56,47,0.2)] transition-all"
                              title="Convert to public by removing password"
                            >
                              Make Public
                            </button>
                          )}

                          {!room.isPredefined ? (
                            <button
                              onClick={() => handleDeleteRoom(room)}
                              disabled={actionLoading}
                              className="p-1 bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 transition-all"
                              title="Delete Room"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-[#75695A] italic">Permanent</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BLOGS */}
      {activeTab === 'blogs' && (
        <div>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#75695A]" />
              <input
                type="text"
                placeholder="Search blogs..."
                value={blogSearch}
                onChange={(e) => setBlogSearch(e.target.value)}
                className="w-full bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)] pl-9 pr-3 py-2 text-xs text-[#40382F] focus:outline-none focus:border-[#D4A373]"
              />
            </div>
            <span className="text-xs text-[#75695A]">
              {blogsList.length} Published Community Blogs
            </span>
          </div>

          <div className="overflow-x-auto border border-[rgba(64,56,47,0.2)] bg-[#FEFAE0]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAEDCD] border-b border-[rgba(64,56,47,0.2)] text-[#40382F] font-bold">
                <tr>
                  <th className="p-3">Title</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Author</th>
                  <th className="p-3">Engagement</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(64,56,47,0.1)]">
                {filteredBlogs.map(b => {
                  return (
                    <tr key={b.id} className="hover:bg-[#FAEDCD]/40 transition-colors">
                      <td className="p-3 font-bold text-[#40382F] max-w-xs truncate">
                        {b.title}
                      </td>

                      <td className="p-3 text-[#75695A]">
                        {b.category || 'General'}
                      </td>

                      <td className="p-3">
                        <p className="font-bold text-[#40382F]">{b.author_name || b.author_username}</p>
                        <p className="text-[10px] text-[#75695A] font-mono">{b.author_email || ''}</p>
                      </td>

                      <td className="p-3 text-[#75695A]">
                        {b.likes_count || 0} likes • {b.comments_count || 0} comments
                      </td>

                      <td className="p-3 text-[#75695A] text-[11px]">
                        {new Date(b.created_at).toLocaleDateString()}
                      </td>

                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDeleteBlog(b)}
                          disabled={actionLoading}
                          className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 font-bold text-[11px] flex items-center space-x-1 ml-auto transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete Blog</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-md bg-[#FEFAE0] border border-[rgba(64,56,47,0.2)] p-6 shadow-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className={`p-2 rounded-none ${confirmModal.isDestructive ? 'bg-red-100 text-red-600' : 'bg-[#FAEDCD] text-[#D4A373]'}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#40382F]">{confirmModal.title}</h3>
                <p className="text-xs text-[#75695A]">Super Admin Authoritative Action</p>
              </div>
            </div>

            <p className="text-xs text-[#75695A] leading-relaxed mb-6">
              {confirmModal.message}
            </p>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[rgba(64,56,47,0.2)]">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={actionLoading}
                className="px-4 py-2 border border-[rgba(64,56,47,0.2)] text-xs text-[#75695A] hover:bg-[#FAEDCD] transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                disabled={actionLoading}
                className={`px-5 py-2 font-bold text-xs border flex items-center space-x-1.5 transition-all ${
                  confirmModal.isDestructive
                    ? 'bg-red-600 hover:bg-red-700 text-white border-red-700'
                    : 'bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] border-[#40382F]/20'
                }`}
              >
                {actionLoading ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
