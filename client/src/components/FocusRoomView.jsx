import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { 
  Mic, MicOff, Video, VideoOff, ScreenShare, Play, Pause, RotateCcw, 
  MessageSquare, CheckSquare, Volume2, VolumeX, LogOut, Send, Smile, 
  Sparkles, Coffee, Flame, ThumbsUp, Zap, HelpCircle, Edit3, X, Sliders
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { soundSynthesizer } from '../utils/soundSynthesizer';

const REACTION_EMOJIS = ['👏', '🔥', '💯', '☕', '⚡', '📚'];

export default function FocusRoomView({ room, onLeaveRoom }) {
  const { user, isAuthenticated, refreshUser } = useAuth();
  
  // Media & WebRTC state
  const [localStream, setLocalStream] = useState(null);
  const [micActive, setMicActive] = useState(false);
  const [videoActive, setVideoActive] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [peers, setPeers] = useState(new Map()); // socketId -> RTCPeerConnection
  const [remoteStreams, setRemoteStreams] = useState(new Map()); // socketId -> MediaStream

  // Synced Pomodoro Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState('work'); // 'work' | 'break'
  const [remainingSeconds, setRemainingSeconds] = useState(room.pomodoro_work_mins * 60);
  const [totalSeconds, setTotalSeconds] = useState(room.pomodoro_work_mins * 60);

  // Status & Tasks
  const [statusText, setStatusText] = useState('Deep Work Session');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [newTaskInput, setNewTaskInput] = useState('');

  // Chat & Floating Reactions
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [floatingReactions, setFloatingReactions] = useState([]);

  // UI Drawers
  const [activeDrawer, setActiveDrawer] = useState(null); // 'chat' | 'tasks' | 'audio' | null
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Audio Synthesizer volumes
  const [ambientVolumes, setAmbientVolumes] = useState({
    rain: 0,
    cafe: 0,
    binaural: 0,
    fire: 0,
    master: 0.7,
  });

  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const chatScrollRef = useRef(null);

  // Initialize Media Stream (with graceful camera fallback)
  useEffect(() => {
    let mounted = true;

    async function setupMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 360 } },
          audio: true,
        });

        if (mounted) {
          // Mute audio by default for silent library experience
          stream.getAudioTracks().forEach(track => { track.enabled = false; });
          setLocalStream(stream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        }
      } catch (err) {
        console.warn('Real webcam/mic not accessible or denied. Using virtual animated video avatar:', err.message);
        setVideoActive(true);
      }
    }

    setupMedia();

    return () => {
      mounted = false;
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Sync video element when stream is ready
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, videoActive]);

  // Load Tasks from SQLite DB
  const loadTasks = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.getTasks(room.id);
      setTasks(res.tasks || []);
    } catch (e) {
      console.warn('Failed to load tasks:', e);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [isAuthenticated, room.id]);

  // Setup Socket.IO connection & signaling
  useEffect(() => {
    const socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    const currentUserData = user || {
      id: 'guest-' + Math.random().toString(36).slice(2, 7),
      display_name: 'Guest ' + Math.floor(Math.random() * 1000),
      avatar_seed: 'Guest'
    };

    socket.emit('join-room', {
      roomId: room.id,
      user: currentUserData,
      mediaState: { mic: micActive, video: videoActive, screenShare: screenSharing },
      statusText
    });

    socket.on('room-joined', ({ participants: existingParticipants, timer, messages: initialMessages }) => {
      setParticipants(existingParticipants || []);
      if (timer) {
        setTimerRunning(timer.isRunning);
        setTimerMode(timer.mode);
        setRemainingSeconds(timer.remainingSeconds);
        setTotalSeconds(timer.totalSeconds);
      }
      if (initialMessages) {
        setMessages(initialMessages);
      }
    });

    socket.on('user-joined', ({ participant }) => {
      setParticipants(prev => {
        const filtered = prev.filter(p => p.socketId !== participant.socketId);
        return [...filtered, participant];
      });
    });

    socket.on('user-left', ({ socketId }) => {
      setParticipants(prev => prev.filter(p => p.socketId !== socketId));
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    });

    socket.on('peer-media-changed', ({ socketId, mediaState }) => {
      setParticipants(prev => prev.map(p => {
        if (p.socketId === socketId) {
          return { ...p, mediaState: { ...p.mediaState, ...mediaState } };
        }
        return p;
      }));
    });

    socket.on('peer-status-changed', ({ socketId, statusText: newStatus }) => {
      setParticipants(prev => prev.map(p => {
        if (p.socketId === socketId) {
          return { ...p, statusText: newStatus };
        }
        return p;
      }));
    });

    // Timer Sync Events
    socket.on('timer-sync', (timerState) => {
      setTimerRunning(timerState.isRunning);
      setTimerMode(timerState.mode);
      setRemainingSeconds(timerState.remainingSeconds);
      setTotalSeconds(timerState.totalSeconds);
    });

    socket.on('timer-tick', ({ remainingSeconds: rem, totalSeconds: tot }) => {
      setRemainingSeconds(rem);
      if (tot) setTotalSeconds(tot);
    });

    socket.on('timer-completed', async ({ completedMode, nextMode }) => {
      // Harmonic bell chime
      soundSynthesizer.playChime();

      // Confetti celebration
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });

      // Auto-record focus session to DB
      if (completedMode === 'work' && isAuthenticated) {
        try {
          const finishedMinutes = Math.round(room.pomodoro_work_mins || 25);
          await api.recordSession({
            durationMinutes: finishedMinutes,
            mode: 'work',
            subject: statusText || 'StudyStream Focus Session',
            roomId: room.id,
          });
          refreshUser();
        } catch (e) {
          console.error('Session record error:', e);
        }
      }
    });

    // Chat Events
    socket.on('new-message', (msg) => {
      setMessages(prev => [...prev, msg]);
      if (activeDrawer !== 'chat') {
        setUnreadChatCount(prev => prev + 1);
      }
    });

    // Live Floating Reaction
    socket.on('reaction-received', (reaction) => {
      const rx = {
        ...reaction,
        leftPercent: 20 + Math.random() * 60,
      };
      setFloatingReactions(prev => [...prev, rx]);
      setTimeout(() => {
        setFloatingReactions(prev => prev.filter(item => item.id !== rx.id));
      }, 2500);
    });

    return () => {
      socket.emit('leave-room', { roomId: room.id });
      socket.disconnect();
      soundSynthesizer.stopAll();
    };
  }, [room.id]);

  // Local Media Controls
  const toggleMic = () => {
    const nextState = !micActive;
    setMicActive(nextState);
    if (localStream) {
      localStream.getAudioTracks().forEach(track => { track.enabled = nextState; });
    }
    socketRef.current?.emit('update-media-state', {
      roomId: room.id,
      mediaState: { mic: nextState }
    });
  };

  const toggleVideo = () => {
    const nextState = !videoActive;
    setVideoActive(nextState);
    if (localStream) {
      localStream.getVideoTracks().forEach(track => { track.enabled = nextState; });
    }
    socketRef.current?.emit('update-media-state', {
      roomId: room.id,
      mediaState: { video: nextState }
    });
  };

  const toggleScreenShare = async () => {
    if (!screenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenSharing(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenStream.getVideoTracks()[0].onended = () => {
          setScreenSharing(false);
          if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
          }
          socketRef.current?.emit('update-media-state', {
            roomId: room.id,
            mediaState: { screenShare: false }
          });
        };

        socketRef.current?.emit('update-media-state', {
          roomId: room.id,
          mediaState: { screenShare: true }
        });
      } catch (e) {
        console.warn('Screen share cancelled:', e);
      }
    } else {
      setScreenSharing(false);
      if (localVideoRef.current && localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      socketRef.current?.emit('update-media-state', {
        roomId: room.id,
        mediaState: { screenShare: false }
      });
    }
  };

  // Timer controls
  const handleTimerAction = (action) => {
    socketRef.current?.emit('timer-action', {
      roomId: room.id,
      action
    });
  };

  // Status text updater
  const handleSaveStatus = (e) => {
    e.preventDefault();
    setShowStatusModal(false);
    socketRef.current?.emit('update-status', {
      roomId: room.id,
      statusText
    });
  };

  // Send Chat message
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    socketRef.current?.emit('send-message', {
      roomId: room.id,
      text: chatInput,
      user: user || { display_name: 'You' }
    });
    setChatInput('');
  };

  // Send Floating Reaction
  const handleSendReaction = (emoji) => {
    socketRef.current?.emit('send-reaction', {
      roomId: room.id,
      emoji,
      senderName: user ? user.display_name : 'Peer'
    });
  };

  // Task actions
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskInput.trim() || !isAuthenticated) return;
    try {
      const res = await api.createTask(newTaskInput, room.id);
      setTasks(prev => [res.task, ...prev]);
      setNewTaskInput('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleTask = async (id) => {
    try {
      const res = await api.toggleTask(id);
      setTasks(prev => prev.map(t => t.id === id ? res.task : t));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTask = async (id) => {
    try {
      await api.deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  // Ambient sound synthesizer handler
  const handleVolumeChange = (channel, value) => {
    const val = parseFloat(value);
    setAmbientVolumes(prev => ({ ...prev, [channel]: val }));
    if (channel === 'master') {
      soundSynthesizer.setMasterVolume(val);
    } else {
      soundSynthesizer.setChannelVolume(channel, val);
    }
  };

  // Format mm:ss
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const timerProgress = totalSeconds > 0 ? (remainingSeconds / totalSeconds) * 100 : 0;
  const isAmbientActive = ambientVolumes.rain > 0 || ambientVolumes.cafe > 0 || ambientVolumes.binaural > 0 || ambientVolumes.fire > 0;
  const completedTasksCount = tasks.filter(t => t.completed).length;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-between bg-[#0c0e14] overflow-hidden select-none">
      
      {/* Floating Reactions Layer */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {floatingReactions.map(r => (
          <div
            key={r.id}
            style={{ left: `${r.leftPercent}%` }}
            className="absolute bottom-24 flex flex-col items-center animate-float-up pointer-events-none"
          >
            <span className="text-4xl drop-shadow-lg">{r.emoji}</span>
            <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded-full border border-white/20 mt-1">
              {r.senderName}
            </span>
          </div>
        ))}
      </div>

      {/* Top Header Bar */}
      <div className="w-full bg-[#141721]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-2.5 flex items-center justify-between z-30">
        
        {/* Left: Room Title, Category, Online count */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onLeaveRoom}
            className="p-1.5 rounded-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            title="Leave room"
          >
            <LogOut className="w-4 h-4 rotate-180" />
          </button>
          
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">{room.name}</h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-sm bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                {room.category}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-slate-400">
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{participants.length} Active in Hall</span>
              </span>
              <span>•</span>
              <button 
                onClick={() => setShowStatusModal(true)}
                className="hover:text-indigo-300 flex items-center space-x-1 text-slate-300 transition-colors"
              >
                <span>Goal: {statusText}</span>
                <Edit3 className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Center: Synchronized Pomodoro Widget */}
        <div className="flex items-center space-x-3 bg-[#1c202e] border border-white/10 px-3.5 py-1.5 rounded shadow-inner">
          {/* Circular mini progress indicator */}
          <div className="relative flex items-center justify-center w-7 h-7">
            <svg className="w-7 h-7 -rotate-90">
              <circle cx="14" cy="14" r="11" stroke="#2a2f42" strokeWidth="2.5" fill="none" />
              <circle
                cx="14"
                cy="14"
                r="11"
                stroke={timerMode === 'work' ? '#6366f1' : '#10b981'}
                strokeWidth="2.5"
                fill="none"
                strokeDasharray="69.1"
                strokeDashoffset={69.1 - (69.1 * timerProgress) / 100}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-sm sm:text-base font-bold text-white tracking-wider">
                {formatTime(remainingSeconds)}
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${
                timerMode === 'work' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {timerMode === 'work' ? 'FOCUS' : 'BREAK'}
              </span>
            </div>
          </div>

          {/* Timer controls */}
          <div className="flex items-center space-x-1 pl-2 border-l border-white/10">
            {timerRunning ? (
              <button
                onClick={() => handleTimerAction('pause')}
                className="p-1.5 rounded-sm text-slate-300 hover:text-amber-400 hover:bg-white/5 transition-all"
                title="Pause Synced Timer"
              >
                <Pause className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => handleTimerAction('start')}
                className="p-1.5 rounded-sm text-indigo-400 hover:text-indigo-300 hover:bg-white/5 transition-all"
                title="Start Synced Timer"
              >
                <Play className="w-3.5 h-3.5 fill-indigo-400" />
              </button>
            )}

            <button
              onClick={() => handleTimerAction('reset')}
              className="p-1.5 rounded-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              title="Reset Timer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Drawer Toggles */}
        <div className="flex items-center space-x-2">
          {/* Ambient Sound Button */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'audio' ? null : 'audio')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
              activeDrawer === 'audio' || isAmbientActive
                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 shadow-sm shadow-indigo-500/20'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sound Ambience</span>
            {isAmbientActive && (
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
            )}
          </button>

          {/* Tasks Button */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'tasks' ? null : 'tasks')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
              activeDrawer === 'tasks'
                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 shadow-sm shadow-indigo-500/20'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tasks</span>
            {tasks.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-sm bg-white/10 text-[10px] text-indigo-300">
                {completedTasksCount}/{tasks.length}
              </span>
            )}
          </button>

          {/* Chat Button */}
          <button
            onClick={() => {
              setActiveDrawer(activeDrawer === 'chat' ? null : 'chat');
              setUnreadChatCount(0);
            }}
            className={`relative flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
              activeDrawer === 'chat'
                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 shadow-sm shadow-indigo-500/20'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Chat</span>
            {unreadChatCount > 0 && activeDrawer !== 'chat' && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-sm bg-pink-500 text-[10px] text-white font-bold leading-none animate-bounce">
                {unreadChatCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Room Body: Responsive Video Grid & Side Drawers */}
      <div className="relative flex-1 flex overflow-hidden">
        
        {/* Video Tiles Grid */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl mx-auto h-full auto-rows-fr">
            
            {/* 1. Local User Tile */}
            <div className="relative bg-[#141721] rounded border-2 border-indigo-500/30 overflow-hidden shadow-xl aspect-video flex items-center justify-center group">
              {/* Actual Video Preview or Simulated Avatar */}
              {localStream && videoActive ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${screenSharing ? '' : '-scale-x-100'}`}
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <div className="relative w-16 h-16 rounded bg-gradient-to-tr from-indigo-600 to-pink-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-indigo-600/30 mb-3 ring-2 ring-white/10">
                    {user ? user.display_name.charAt(0).toUpperCase() : 'Y'}
                    <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border border-[#141721]"></span>
                  </div>
                  <span className="text-xs font-semibold text-white">{user ? user.display_name : 'You (Host)'}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Camera Muted • Focused</span>
                </div>
              )}

              {/* Top status overlay */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                <span className="px-2 py-0.5 rounded-sm bg-black/60 backdrop-blur-md text-[10px] font-semibold text-white border border-white/10">
                  You {screenSharing ? '(Screen Sharing)' : ''}
                </span>

                <div className="flex items-center space-x-1">
                  {!micActive && (
                    <span className="p-1 rounded-sm bg-rose-500/80 text-white">
                      <MicOff className="w-3 h-3" />
                    </span>
                  )}
                  {!videoActive && (
                    <span className="p-1 rounded-sm bg-slate-800 text-slate-400">
                      <VideoOff className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom Subject Goal Pill */}
              <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
                <div className="px-2.5 py-1 rounded-sm bg-black/70 backdrop-blur-md border border-white/10 text-[11px] text-slate-200 truncate flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  <span className="truncate">{statusText}</span>
                </div>
              </div>
            </div>

            {/* 2. Other Room Participants */}
            {participants.map((peer) => {
              if (peer.socketId === socketRef.current?.id) return null;
              const isPeerVideo = peer.mediaState?.video;
              const isPeerMic = peer.mediaState?.mic;

              return (
                <div
                  key={peer.socketId}
                  className="relative bg-[#141721] rounded border border-white/10 overflow-hidden shadow-xl aspect-video flex items-center justify-center group"
                >
                  {/* Avatar Tile */}
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <div className="relative w-16 h-16 rounded bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-purple-600/30 mb-3 ring-2 ring-white/10">
                      {peer.user?.display_name ? peer.user.display_name.charAt(0).toUpperCase() : 'S'}
                      <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border border-[#141721]"></span>
                    </div>
                    <span className="text-xs font-semibold text-white">{peer.user?.display_name || 'Study Peer'}</span>
                    <span className="text-[10px] text-indigo-400 mt-0.5">● Deep Focus Grind</span>
                  </div>

                  {/* Top status overlay */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                    <span className="px-2 py-0.5 rounded-sm bg-black/60 backdrop-blur-md text-[10px] font-semibold text-white border border-white/10">
                      {peer.user?.display_name || 'Peer'}
                    </span>

                    <div className="flex items-center space-x-1">
                      {!isPeerMic && (
                        <span className="p-1 rounded-sm bg-rose-500/80 text-white">
                          <MicOff className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Subject Goal Pill */}
                  <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
                    <div className="px-2.5 py-1 rounded-sm bg-black/70 backdrop-blur-md border border-white/10 text-[11px] text-slate-200 truncate flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                      <span className="truncate">{peer.statusText || 'Focusing...'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Drawer: Ambient Sound Synthesizer */}
        {activeDrawer === 'audio' && (
          <div className="w-80 border-l border-white/10 bg-[#141721]/95 backdrop-blur-md p-5 flex flex-col justify-between z-30 animate-fadeIn">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Ambient Sound Mixer</h3>
                </div>
                <button
                  onClick={() => setActiveDrawer(null)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[11px] text-slate-400 mb-5">
                Synthesized live via WebAudio API. Blend realistic rain, cafe hum, or 10Hz binaural alpha wave for maximum concentration.
              </p>

              {/* Rain Slider */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-1.5">
                    <span className="flex items-center space-x-1.5">
                      <span>🌧️ Rain & Distant Thunder</span>
                    </span>
                    <span className="text-slate-400">{Math.round(ambientVolumes.rain * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={ambientVolumes.rain}
                    onChange={(e) => handleVolumeChange('rain', e.target.value)}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                {/* Cafe Hum Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-1.5">
                    <span className="flex items-center space-x-1.5">
                      <span>☕ Cozy Cafe & Chatter</span>
                    </span>
                    <span className="text-slate-400">{Math.round(ambientVolumes.cafe * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={ambientVolumes.cafe}
                    onChange={(e) => handleVolumeChange('cafe', e.target.value)}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                {/* Binaural 10Hz Alpha Focus Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-1.5">
                    <span className="flex items-center space-x-1.5">
                      <span>🧠 10Hz Alpha Binaural Wave</span>
                    </span>
                    <span className="text-slate-400">{Math.round(ambientVolumes.binaural * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={ambientVolumes.binaural}
                    onChange={(e) => handleVolumeChange('binaural', e.target.value)}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                {/* Fireplace Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-1.5">
                    <span className="flex items-center space-x-1.5">
                      <span>🔥 Fireplace Crackle</span>
                    </span>
                    <span className="text-slate-400">{Math.round(ambientVolumes.fire * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={ambientVolumes.fire}
                    onChange={(e) => handleVolumeChange('fire', e.target.value)}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                {/* Master Volume */}
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-1.5">
                    <span>Master Sound Volume</span>
                    <span className="text-indigo-400 font-bold">{Math.round(ambientVolumes.master * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={ambientVolumes.master}
                    onChange={(e) => handleVolumeChange('master', e.target.value)}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <button
                onClick={() => {
                  soundSynthesizer.stopAll();
                  setAmbientVolumes({ rain: 0, cafe: 0, binaural: 0, fire: 0, master: ambientVolumes.master });
                }}
                className="text-xs text-rose-400 hover:text-rose-300 font-medium"
              >
                Mute All Sounds
              </button>
              <button
                onClick={() => {
                  soundSynthesizer.playChime();
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center space-x-1"
              >
                <span>🔔 Test Bell Chime</span>
              </button>
            </div>
          </div>
        )}

        {/* Drawer: Session Tasks */}
        {activeDrawer === 'tasks' && (
          <div className="w-80 border-l border-white/10 bg-[#141721]/95 backdrop-blur-md p-5 flex flex-col justify-between z-30 animate-fadeIn">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <div className="flex items-center space-x-2">
                  <CheckSquare className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Session Goals & Tasks</h3>
                </div>
                <button
                  onClick={() => setActiveDrawer(null)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Add Task Input */}
              <form onSubmit={handleAddTask} className="mb-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Add a focus milestone..."
                    value={newTaskInput}
                    onChange={(e) => setNewTaskInput(e.target.value)}
                    className="flex-1 bg-[#1c202e] border border-white/10 rounded-sm px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-sm bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                  >
                    Add
                  </button>
                </div>
              </form>

              {/* Task list */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {tasks.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No tasks yet. Set 1–3 goals for this study sprint!
                  </div>
                ) : (
                  tasks.map(task => (
                    <div
                      key={task.id}
                      className={`flex items-start justify-between p-2.5 rounded-sm border transition-all ${
                        task.completed 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-slate-400 line-through' 
                          : 'bg-[#1c202e] border-white/5 text-slate-200'
                      }`}
                    >
                      <label className="flex items-start space-x-2.5 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={Boolean(task.completed)}
                          onChange={() => handleToggleTask(task.id)}
                          className="mt-0.5 rounded-sm accent-indigo-500 cursor-pointer"
                        />
                        <span className="text-xs break-words">{task.title}</span>
                      </label>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-slate-500 hover:text-rose-400 text-xs ml-2"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Task completion footer */}
            {tasks.length > 0 && (
              <div className="pt-4 border-t border-white/10 text-xs text-slate-400 flex items-center justify-between">
                <span>{completedTasksCount} of {tasks.length} completed</span>
                <span className="font-semibold text-emerald-400">
                  {Math.round((completedTasksCount / tasks.length) * 100)}% Done
                </span>
              </div>
            )}
          </div>
        )}

        {/* Drawer: Room Chat */}
        {activeDrawer === 'chat' && (
          <div className="w-80 border-l border-white/10 bg-[#141721]/95 backdrop-blur-md p-4 flex flex-col justify-between z-30 animate-fadeIn">
            {/* Chat Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Study Hall Chat</h3>
              </div>
              <button
                onClick={() => setActiveDrawer(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages Scroll Area */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto py-3 space-y-3">
              {messages.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Quiet study room. Say hi or encourage peers!
                </div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.user?.id === user?.id || msg.socketId === socketRef.current?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[10px] text-slate-400 mb-0.5 px-1">
                        {isMe ? 'You' : msg.user?.display_name || 'Peer'}
                      </span>
                      <div
                        className={`px-3 py-2 rounded-sm text-xs max-w-[85%] break-words ${
                          isMe 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-[#1c202e] text-slate-200 border border-white/5'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="pt-2 border-t border-white/10">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Send a quiet encouragement..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 bg-[#1c202e] border border-white/10 rounded-sm px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="p-2 rounded-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Bottom Floating Control Dock */}
      <div className="w-full bg-[#141721]/95 backdrop-blur-md border-t border-white/10 px-4 py-3 flex items-center justify-between z-30">
        
        {/* Left: Quick Live Reactions Bar */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          <span className="text-[11px] font-semibold text-slate-400 hidden md:inline">React:</span>
          {REACTION_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => handleSendReaction(emoji)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-sm bg-white/5 hover:bg-white/15 border border-white/10 text-sm sm:text-base hover:scale-110 transition-transform"
              title={`Send ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Center: Essential AV Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Mic */}
          <button
            onClick={toggleMic}
            className={`p-3 rounded flex items-center justify-center transition-all shadow-md ${
              micActive
                ? 'bg-indigo-600 text-white shadow-indigo-600/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'
            }`}
            title={micActive ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {micActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          {/* Camera */}
          <button
            onClick={toggleVideo}
            className={`p-3 rounded flex items-center justify-center transition-all shadow-md ${
              videoActive
                ? 'bg-indigo-600 text-white shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-400 border border-white/10 hover:bg-slate-700'
            }`}
            title={videoActive ? 'Turn Video Off' : 'Turn Video On'}
          >
            {videoActive ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`p-3 rounded flex items-center justify-center transition-all shadow-md ${
              screenSharing
                ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
            }`}
            title={screenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
          >
            <ScreenShare className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Leave Room */}
        <div>
          <button
            onClick={onLeaveRoom}
            className="flex items-center space-x-2 px-4 py-2.5 rounded bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-400 text-xs font-semibold transition-all hover:scale-[1.02]"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Leave Room</span>
          </button>
        </div>
      </div>

      {/* Modal: Edit Subject Goal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm bg-[#141721] border border-white/10 rounded p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">What are you working on?</h3>
            <p className="text-xs text-slate-400 mb-4">
              Your focus label is visible to other students in the study hall to keep you accountable.
            </p>
            <form onSubmit={handleSaveStatus} className="space-y-4">
              <input
                type="text"
                required
                placeholder="e.g. Solving Graph DP Problems"
                value={statusText}
                onChange={(e) => setStatusText(e.target.value)}
                className="w-full bg-[#1c202e] border border-white/10 rounded-sm px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 rounded-sm text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-sm bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                >
                  Update Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
