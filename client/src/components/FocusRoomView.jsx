import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { 
  Mic, MicOff, Video, VideoOff, ScreenShare, 
  MessageSquare, CheckSquare, Volume2, VolumeX, LogOut, Send, Smile, 
  Sparkles, Coffee, Flame, ThumbsUp, Zap, HelpCircle, Edit3, X, Sliders,
  Radio, Clock, ShieldCheck, Award
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

  // Unlimited Live Hours Session tracking (No forced timeouts or limits)
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState(0);
  const [serverVerifiedSeconds, setServerVerifiedSeconds] = useState(0);
  const [sessionStartTime] = useState(Date.now());
  const [isLiveActive, setIsLiveActive] = useState(true);

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
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  // Authoritative hardware track termination
  const stopAllMediaTracks = () => {
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
      } catch (err) {
        console.warn('Error stopping local tracks:', err);
      }
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      try {
        screenStreamRef.current.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
      } catch (err) {
        console.warn('Error stopping screen share tracks:', err);
      }
      screenStreamRef.current = null;
    }
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      try {
        const stream = localVideoRef.current.srcObject;
        if (stream && stream.getTracks) {
          stream.getTracks().forEach(t => {
            t.stop();
            t.enabled = false;
          });
        }
        localVideoRef.current.srcObject = null;
      } catch (err) {
        console.warn('Error clearing video srcObject:', err);
      }
    }
    setLocalStream(null);
    setScreenSharing(false);
  };

  // Leave room handler that guarantees complete track termination & socket disconnect
  const handleLeaveRoom = () => {
    stopAllMediaTracks();
    soundSynthesizer.stopAll();
    if (socketRef.current) {
      try {
        socketRef.current.emit('leave-room', { roomId: room.id });
        socketRef.current.disconnect();
      } catch (e) {}
    }
    peers.forEach(pc => {
      try { pc.close(); } catch (e) {}
    });
    setPeers(new Map());
    onLeaveRoom();
  };

  // Initialize Media Stream (with graceful camera fallback and cleanup)
  useEffect(() => {
    let mounted = true;

    async function setupMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 360 } },
          audio: false, // Do not acquire microphone hardware until user clicks unmute
        });

        if (mounted) {
          localStreamRef.current = stream;
          setLocalStream(stream);
          setVideoActive(true);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        } else {
          stream.getTracks().forEach(t => t.stop());
        }
      } catch (err) {
        console.warn('Real webcam not accessible or denied:', err.message);
        setVideoActive(false);
      }
    }

    setupMedia();

    // Browser unload / tab close / navigating away safety
    const handleBeforeUnload = () => {
      stopAllMediaTracks();
      if (socketRef.current) {
        try {
          socketRef.current.emit('leave-room', { roomId: room.id });
          socketRef.current.disconnect();
        } catch (e) {}
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      mounted = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      stopAllMediaTracks();
    };
  }, [room.id]);

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

    socket.on('room-joined', ({ participants: existingParticipants, messages: initialMessages }) => {
      setParticipants(existingParticipants || []);
      if (initialMessages) {
        setMessages(initialMessages);
      }
      // Start verified live session tracking
      socket.emit('session-live-started', { roomId: room.id });
    });

    socket.on('heartbeat-ack', ({ verifiedLiveSeconds, totalUserLiveSeconds }) => {
      setServerVerifiedSeconds(verifiedLiveSeconds || 0);
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

    // Ticking stopwatch for live stream
    const ticker = setInterval(() => {
      setLiveElapsedSeconds(prev => {
        const next = prev + 1;
        // Celebrate milestones every 30 minutes of deep study
        if (next > 0 && next % 1800 === 0) {
          soundSynthesizer.playChime();
          confetti({
            particleCount: 70,
            spread: 60,
            origin: { y: 0.6 }
          });
        }
        return next;
      });
    }, 1000);

    // Heartbeat ping every 25 seconds for authoritative server verification
    const heartbeatTimer = setInterval(() => {
      if (socket.connected) {
        socket.emit('session-heartbeat', { roomId: room.id });
      }
    }, 25000);

    return () => {
      clearInterval(ticker);
      clearInterval(heartbeatTimer);
      socket.emit('leave-room', { roomId: room.id });
      socket.disconnect();
      soundSynthesizer.stopAll();
      refreshUser();
    };
  }, [room.id]);

  // Local Media Controls (Complete Hardware Release on Stop)
  const toggleMic = async () => {
    if (micActive) {
      // Physically stop audio capture hardware so OS indicator turns completely OFF
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => {
          track.stop();
          track.enabled = false;
          localStreamRef.current.removeTrack(track);
        });
      }
      setMicActive(false);
      socketRef.current?.emit('update-media-state', {
        roomId: room.id,
        mediaState: { mic: false }
      });
    } else {
      // Re-acquire hardware microphone track
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const newTrack = audioStream.getAudioTracks()[0];
        if (newTrack) {
          let stream = localStreamRef.current;
          if (!stream) {
            stream = new MediaStream();
            localStreamRef.current = stream;
          }
          // Remove old stopped audio tracks
          stream.getAudioTracks().forEach(t => stream.removeTrack(t));
          stream.addTrack(newTrack);
          setLocalStream(stream);
          setMicActive(true);
          socketRef.current?.emit('update-media-state', {
            roomId: room.id,
            mediaState: { mic: true }
          });
        }
      } catch (err) {
        console.warn('Microphone permission denied or device unavailable:', err);
        setMicActive(false);
      }
    }
  };

  const toggleVideo = async () => {
    if (videoActive) {
      // Physically stop webcam capture hardware so OS indicator and camera LED turn completely OFF
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(track => {
          track.stop();
          track.enabled = false;
          localStreamRef.current.removeTrack(track);
        });
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      setVideoActive(false);
      socketRef.current?.emit('update-media-state', {
        roomId: room.id,
        mediaState: { video: false }
      });
    } else {
      // Re-acquire hardware webcam track
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 360 } }
        });
        const newTrack = videoStream.getVideoTracks()[0];
        if (newTrack) {
          let stream = localStreamRef.current;
          if (!stream) {
            stream = new MediaStream();
            localStreamRef.current = stream;
          }
          // Remove old stopped video tracks
          stream.getVideoTracks().forEach(t => stream.removeTrack(t));
          stream.addTrack(newTrack);
          setLocalStream(stream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          setVideoActive(true);
          socketRef.current?.emit('update-media-state', {
            roomId: room.id,
            mediaState: { video: true }
          });
        }
      } catch (err) {
        console.warn('Webcam permission denied or device unavailable:', err);
        setVideoActive(false);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!screenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        setScreenSharing(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenStream.getVideoTracks()[0].onended = () => {
          try {
            screenStream.getTracks().forEach(t => { t.stop(); t.enabled = false; });
          } catch (e) {}
          screenStreamRef.current = null;
          setScreenSharing(false);
          if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
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
      if (screenStreamRef.current) {
        try {
          screenStreamRef.current.getTracks().forEach(t => { t.stop(); t.enabled = false; });
        } catch (e) {}
        screenStreamRef.current = null;
      }
      setScreenSharing(false);
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      socketRef.current?.emit('update-media-state', {
        roomId: room.id,
        mediaState: { screenShare: false }
      });
    }
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

  // Format hh:mm:ss or mm:ss
  const formatLiveElapsed = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isAmbientActive = ambientVolumes.rain > 0 || ambientVolumes.cafe > 0 || ambientVolumes.binaural > 0 || ambientVolumes.fire > 0;
  const completedTasksCount = tasks.filter(t => t.completed).length;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-between bg-[#FEFAE0] overflow-hidden select-none">
      
      {/* Floating Reactions Layer */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {floatingReactions.map(r => (
          <div
            key={r.id}
            style={{ left: `${r.leftPercent}%` }}
            className="absolute bottom-24 flex flex-col items-center animate-float-up pointer-events-none"
          >
            <span className="text-4xl drop-shadow-md">{r.emoji}</span>
            <span className="text-[10px] font-bold text-[#40382F] bg-[#FAEDCD] px-2.5 py-0.5 rounded-[6px] border border-[rgba(64,56,47,0.14)] mt-1 shadow-sm">
              {r.senderName}
            </span>
          </div>
        ))}
      </div>

      {/* Top Header Bar */}
      <div className="w-full bg-[#FAEDCD] border-b border-[rgba(64,56,47,0.14)] px-4 sm:px-6 py-2.5 flex items-center justify-between z-30 shadow-sm">
        
        {/* Left: Room Title, Category, Online count */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleLeaveRoom}
            className="p-1.5 rounded-[8px] text-[#75695A] hover:text-[#40382F] hover:bg-[#E9EDC9] transition-all"
            title="Leave room"
          >
            <LogOut className="w-4 h-4 rotate-180" />
          </button>
          
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm sm:text-base font-bold text-[#40382F] tracking-tight">{room.name}</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-[6px] bg-[#CCD5AE] text-[#40382F] border border-[rgba(64,56,47,0.1)]">
                {room.category}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-[#75695A]">
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-[#D4A373] animate-pulse"></span>
                <span>{participants.length} Active in Hall</span>
              </span>
              <span>•</span>
              <button 
                onClick={() => setShowStatusModal(true)}
                className="hover:text-[#D4A373] flex items-center space-x-1 text-[#40382F] font-medium transition-colors"
              >
                <span>Goal: {statusText}</span>
                <Edit3 className="w-3 h-3 text-[#75695A]" />
              </button>
            </div>
          </div>
        </div>

        {/* Center: Authoritative Unlimited Live Hours Stopwatch */}
        <div className="flex items-center space-x-3 bg-[#FEFAE0] border border-[rgba(64,56,47,0.14)] px-4 py-1.5 rounded-[10px] shadow-sm">
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D4A373] animate-ping absolute"></span>
            <span className="w-2 h-2 rounded-full bg-[#D4A373]"></span>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-sm sm:text-base font-bold text-[#40382F] tracking-wider">
                {formatLiveElapsed(liveElapsedSeconds)}
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-[6px] bg-[#CCD5AE] text-[#40382F] border border-[rgba(64,56,47,0.12)] uppercase tracking-wider">
                LIVE
              </span>
            </div>
            <div className="text-[9px] text-[#75695A] flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3 text-[#D4A373] inline" />
              <span>Unlimited Session</span>
              <span>•</span>
              <span className="text-[#40382F] font-bold">Ranking Active</span>
            </div>
          </div>
        </div>

        {/* Right Drawer Toggles */}
        <div className="flex items-center space-x-2">
          {/* Ambient Sound Button */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'audio' ? null : 'audio')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold border transition-all ${
              activeDrawer === 'audio' || isAmbientActive
                ? 'bg-[#CCD5AE] border-[rgba(64,56,47,0.2)] text-[#40382F] shadow-sm font-bold'
                : 'bg-[#FEFAE0] border-[rgba(64,56,47,0.12)] text-[#75695A] hover:bg-[#E9EDC9]'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5 text-[#40382F]" />
            <span className="hidden sm:inline">Sound Ambience</span>
            {isAmbientActive && (
              <span className="w-2 h-2 rounded-full bg-[#D4A373] animate-ping"></span>
            )}
          </button>

          {/* Tasks Button */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'tasks' ? null : 'tasks')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold border transition-all ${
              activeDrawer === 'tasks'
                ? 'bg-[#CCD5AE] border-[rgba(64,56,47,0.2)] text-[#40382F] shadow-sm font-bold'
                : 'bg-[#FEFAE0] border-[rgba(64,56,47,0.12)] text-[#75695A] hover:bg-[#E9EDC9]'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-[#40382F]" />
            <span className="hidden sm:inline">Tasks</span>
            {tasks.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-[6px] bg-[#E9EDC9] text-[10px] text-[#40382F] font-bold">
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
            className={`relative flex items-center space-x-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold border transition-all ${
              activeDrawer === 'chat'
                ? 'bg-[#CCD5AE] border-[rgba(64,56,47,0.2)] text-[#40382F] shadow-sm font-bold'
                : 'bg-[#FEFAE0] border-[rgba(64,56,47,0.12)] text-[#75695A] hover:bg-[#E9EDC9]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#40382F]" />
            <span className="hidden sm:inline">Chat</span>
            {unreadChatCount > 0 && activeDrawer !== 'chat' && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-[#D4A373] text-[10px] text-[#40382F] font-bold leading-none animate-bounce shadow">
                {unreadChatCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Room Body: Responsive Video Grid & Side Drawers */}
      <div className="relative flex-1 flex overflow-hidden">
        
        {/* Video Tiles Grid */}
        <div className="flex-1 p-5 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl mx-auto h-full auto-rows-fr">
            
            {/* 1. Local User Tile */}
            <div className="relative bg-[#FAEDCD] rounded-[16px] border-2 border-[#D4A373] overflow-hidden shadow-sm aspect-video flex items-center justify-center group">
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
                  <div className="relative w-16 h-16 rounded-[14px] bg-[#D4A373] flex items-center justify-center text-[#FEFAE0] font-bold text-2xl shadow-sm mb-3">
                    {user ? user.display_name.charAt(0).toUpperCase() : 'Y'}
                    <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#CCD5AE] border-2 border-[#FAEDCD]"></span>
                  </div>
                  <span className="text-xs font-bold text-[#40382F]">{user ? user.display_name : 'You (Host)'}</span>
                  <span className="text-[10px] text-[#75695A] mt-0.5">Camera Muted • Focused</span>
                </div>
              )}

              {/* Top status overlay */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                <span className="px-2.5 py-1 rounded-[8px] bg-[#FEFAE0]/90 backdrop-blur-md text-[10px] font-bold text-[#40382F] border border-[rgba(64,56,47,0.1)] shadow-sm">
                  You {screenSharing ? '(Screen Sharing)' : ''}
                </span>

                <div className="flex items-center space-x-1">
                  {!micActive && (
                    <span className="p-1.5 rounded-[6px] bg-rose-100 border border-rose-200 text-rose-800 shadow-sm">
                      <MicOff className="w-3 h-3" />
                    </span>
                  )}
                  {!videoActive && (
                    <span className="p-1.5 rounded-[6px] bg-[#E9EDC9] border border-[rgba(64,56,47,0.1)] text-[#75695A] shadow-sm">
                      <VideoOff className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom Subject Goal Pill */}
              <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
                <div className="px-2.5 py-1 rounded-[8px] bg-[#FEFAE0]/90 backdrop-blur-md border border-[rgba(64,56,47,0.1)] text-[11px] text-[#40382F] truncate flex items-center space-x-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4A373]"></span>
                  <span className="truncate font-medium">{statusText}</span>
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
                  className="relative bg-[#FAEDCD] rounded-[16px] border border-[rgba(64,56,47,0.14)] overflow-hidden shadow-sm aspect-video flex items-center justify-center group"
                >
                  {/* Avatar Tile */}
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <div className="relative w-16 h-16 rounded-[14px] bg-[#CCD5AE] flex items-center justify-center text-[#40382F] font-bold text-2xl shadow-sm mb-3">
                      {peer.user?.display_name ? peer.user.display_name.charAt(0).toUpperCase() : 'S'}
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#D4A373] border-2 border-[#FAEDCD]"></span>
                    </div>
                    <span className="text-xs font-bold text-[#40382F]">{peer.user?.display_name || 'Study Peer'}</span>
                    <span className="text-[10px] text-[#75695A] mt-0.5">● Deep Focus Grind</span>
                  </div>

                  {/* Top status overlay */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                    <span className="px-2.5 py-1 rounded-[8px] bg-[#FEFAE0]/90 backdrop-blur-md text-[10px] font-bold text-[#40382F] border border-[rgba(64,56,47,0.1)] shadow-sm">
                      {peer.user?.display_name || 'Peer'}
                    </span>

                    <div className="flex items-center space-x-1">
                      {!isPeerMic && (
                        <span className="p-1.5 rounded-[6px] bg-rose-100 border border-rose-200 text-rose-800 shadow-sm">
                          <MicOff className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Subject Goal Pill */}
                  <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
                    <div className="px-2.5 py-1 rounded-[8px] bg-[#FEFAE0]/90 backdrop-blur-md border border-[rgba(64,56,47,0.1)] text-[11px] text-[#40382F] truncate flex items-center space-x-1.5 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#CCD5AE]"></span>
                      <span className="truncate font-medium">{peer.statusText || 'Focusing...'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Drawer: Ambient Sound Synthesizer */}
        {activeDrawer === 'audio' && (
          <div className="w-80 border-l border-[rgba(64,56,47,0.14)] bg-[#FEFAE0] p-5 flex flex-col justify-between z-30 animate-fadeIn shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[rgba(64,56,47,0.14)]">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-[#D4A373]" />
                  <h3 className="text-sm font-bold text-[#40382F]">Ambient Sound Mixer</h3>
                </div>
                <button
                  onClick={() => setActiveDrawer(null)}
                  className="p-1 rounded-[6px] text-[#75695A] hover:text-[#40382F] hover:bg-[#FAEDCD]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[11px] text-[#75695A] mb-5 font-normal">
                Synthesized live via WebAudio API. Blend realistic rain, cafe hum, or 10Hz binaural alpha wave for maximum concentration.
              </p>

              {/* Rain Slider */}
              <div className="space-y-4">
                <div className="p-2.5 bg-[#FAEDCD] rounded-[10px] border border-[rgba(64,56,47,0.1)]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#40382F] mb-1.5">
                    <span className="flex items-center space-x-1.5">
                      <span>🌧️ Rain & Distant Thunder</span>
                    </span>
                    <span className="text-[#75695A]">{Math.round(ambientVolumes.rain * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={ambientVolumes.rain}
                    onChange={(e) => handleVolumeChange('rain', e.target.value)}
                    className="w-full accent-[#D4A373] cursor-pointer"
                  />
                </div>

                {/* Cafe Hum Slider */}
                <div className="p-2.5 bg-[#FAEDCD] rounded-[10px] border border-[rgba(64,56,47,0.1)]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#40382F] mb-1.5">
                    <span className="flex items-center space-x-1.5">
                      <span>☕ Cozy Cafe & Chatter</span>
                    </span>
                    <span className="text-[#75695A]">{Math.round(ambientVolumes.cafe * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={ambientVolumes.cafe}
                    onChange={(e) => handleVolumeChange('cafe', e.target.value)}
                    className="w-full accent-[#D4A373] cursor-pointer"
                  />
                </div>

                {/* Binaural 10Hz Alpha Focus Slider */}
                <div className="p-2.5 bg-[#FAEDCD] rounded-[10px] border border-[rgba(64,56,47,0.1)]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#40382F] mb-1.5">
                    <span className="flex items-center space-x-1.5">
                      <span>🧠 10Hz Alpha Binaural Wave</span>
                    </span>
                    <span className="text-[#75695A]">{Math.round(ambientVolumes.binaural * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={ambientVolumes.binaural}
                    onChange={(e) => handleVolumeChange('binaural', e.target.value)}
                    className="w-full accent-[#D4A373] cursor-pointer"
                  />
                </div>

                {/* Fireplace Slider */}
                <div className="p-2.5 bg-[#FAEDCD] rounded-[10px] border border-[rgba(64,56,47,0.1)]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#40382F] mb-1.5">
                    <span className="flex items-center space-x-1.5">
                      <span>🔥 Fireplace Crackle</span>
                    </span>
                    <span className="text-[#75695A]">{Math.round(ambientVolumes.fire * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={ambientVolumes.fire}
                    onChange={(e) => handleVolumeChange('fire', e.target.value)}
                    className="w-full accent-[#D4A373] cursor-pointer"
                  />
                </div>

                {/* Master Volume */}
                <div className="pt-4 border-t border-[rgba(64,56,47,0.1)]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#40382F] mb-1.5">
                    <span>Master Sound Volume</span>
                    <span className="text-[#D4A373] font-black">{Math.round(ambientVolumes.master * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={ambientVolumes.master}
                    onChange={(e) => handleVolumeChange('master', e.target.value)}
                    className="w-full accent-[#D4A373] cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[rgba(64,56,47,0.1)] flex items-center justify-between">
              <button
                onClick={() => {
                  soundSynthesizer.stopAll();
                  setAmbientVolumes({ rain: 0, cafe: 0, binaural: 0, fire: 0, master: ambientVolumes.master });
                }}
                className="text-xs text-rose-700 hover:text-rose-800 font-bold"
              >
                Mute All Sounds
              </button>
              <button
                onClick={() => {
                  soundSynthesizer.playChime();
                }}
                className="text-xs text-[#D4A373] hover:text-[#B88252] font-bold flex items-center space-x-1"
              >
                <span>🔔 Test Bell Chime</span>
              </button>
            </div>
          </div>
        )}

        {/* Drawer: Session Tasks */}
        {activeDrawer === 'tasks' && (
          <div className="w-80 border-l border-[rgba(64,56,47,0.14)] bg-[#FEFAE0] p-5 flex flex-col justify-between z-30 animate-fadeIn shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[rgba(64,56,47,0.14)]">
                <div className="flex items-center space-x-2">
                  <CheckSquare className="w-4 h-4 text-[#D4A373]" />
                  <h3 className="text-sm font-bold text-[#40382F]">Session Goals & Tasks</h3>
                </div>
                <button
                  onClick={() => setActiveDrawer(null)}
                  className="p-1 rounded-[6px] text-[#75695A] hover:text-[#40382F] hover:bg-[#FAEDCD]"
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
                    className="flex-1 bg-[#FAEDCD] border border-[rgba(64,56,47,0.14)] rounded-[10px] px-3 py-2 text-xs text-[#40382F] placeholder-[#9E9080] focus:outline-none focus:border-[#D4A373] focus:ring-1 focus:ring-[#D4A373] shadow-sm"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-[10px] bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] text-xs font-bold shadow-sm"
                  >
                    Add
                  </button>
                </div>
              </form>

              {/* Task list */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {tasks.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#75695A] bg-[#FAEDCD] rounded-[10px]">
                    No tasks yet. Set 1–3 goals for this study sprint!
                  </div>
                ) : (
                  tasks.map(task => (
                    <div
                      key={task.id}
                      className={`flex items-start justify-between p-2.5 rounded-[10px] border transition-all ${
                        task.completed 
                          ? 'bg-[#E9EDC9]/60 border-[#CCD5AE] text-[#75695A] line-through' 
                          : 'bg-[#FAEDCD] border-[rgba(64,56,47,0.1)] text-[#40382F] shadow-sm'
                      }`}
                    >
                      <label className="flex items-start space-x-2.5 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={Boolean(task.completed)}
                          onChange={() => handleToggleTask(task.id)}
                          className="mt-0.5 rounded-[4px] accent-[#D4A373] cursor-pointer"
                        />
                        <span className="text-xs break-words font-medium">{task.title}</span>
                      </label>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-[#75695A] hover:text-rose-600 text-xs ml-2 font-bold"
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
              <div className="pt-4 border-t border-[rgba(64,56,47,0.1)] text-xs text-[#75695A] flex items-center justify-between font-semibold">
                <span>{completedTasksCount} of {tasks.length} completed</span>
                <span className="text-[#40382F] font-bold">
                  {Math.round((completedTasksCount / tasks.length) * 100)}% Done
                </span>
              </div>
            )}
          </div>
        )}

        {/* Drawer: Room Chat */}
        {activeDrawer === 'chat' && (
          <div className="w-80 border-l border-[rgba(64,56,47,0.14)] bg-[#FEFAE0] p-4 flex flex-col justify-between z-30 animate-fadeIn shadow-xl">
            {/* Chat Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(64,56,47,0.14)]">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-[#D4A373]" />
                <h3 className="text-sm font-bold text-[#40382F]">Study Hall Chat</h3>
              </div>
              <button
                onClick={() => setActiveDrawer(null)}
                className="p-1 rounded-[6px] text-[#75695A] hover:text-[#40382F] hover:bg-[#FAEDCD]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages Scroll Area */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto py-3 space-y-3">
              {messages.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#75695A] bg-[#FAEDCD] rounded-[10px]">
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
                      <span className="text-[10px] text-[#75695A] mb-0.5 px-1 font-medium">
                        {isMe ? 'You' : msg.user?.display_name || 'Peer'}
                      </span>
                      <div
                        className={`px-3 py-2 rounded-[10px] text-xs max-w-[85%] break-words font-medium shadow-sm ${
                          isMe 
                            ? 'bg-[#CCD5AE] text-[#40382F] border border-[rgba(64,56,47,0.1)]' 
                            : 'bg-[#FAEDCD] text-[#40382F] border border-[rgba(64,56,47,0.1)]'
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
            <form onSubmit={handleSendMessage} className="pt-2 border-t border-[rgba(64,56,47,0.1)]">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Send a quiet encouragement..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 bg-[#FAEDCD] border border-[rgba(64,56,47,0.14)] rounded-[10px] px-3 py-2 text-xs text-[#40382F] placeholder-[#9E9080] focus:outline-none focus:border-[#D4A373] focus:ring-1 focus:ring-[#D4A373] shadow-sm"
                />
                <button
                  type="submit"
                  className="p-2 rounded-[10px] bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] transition-all shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Bottom Floating Control Dock */}
      <div className="w-full bg-[#FAEDCD] border-t border-[rgba(64,56,47,0.14)] px-4 py-3 flex items-center justify-between z-30 shadow-sm">
        
        {/* Left: Quick Live Reactions Bar */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          <span className="text-[11px] font-bold text-[#75695A] hidden md:inline">React:</span>
          {REACTION_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => handleSendReaction(emoji)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-[8px] bg-[#FEFAE0] hover:bg-[#E9EDC9] border border-[rgba(64,56,47,0.12)] text-sm sm:text-base hover:scale-110 transition-transform shadow-sm"
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
            className={`p-3 rounded-[10px] flex items-center justify-center transition-all shadow-sm ${
              micActive
                ? 'bg-[#D4A373] text-[#40382F] shadow-md'
                : 'bg-rose-100 text-rose-800 border border-rose-200 hover:bg-rose-200'
            }`}
            title={micActive ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {micActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          {/* Camera */}
          <button
            onClick={toggleVideo}
            className={`p-3 rounded-[10px] flex items-center justify-center transition-all shadow-sm ${
              videoActive
                ? 'bg-[#D4A373] text-[#40382F] shadow-md'
                : 'bg-[#FEFAE0] text-[#75695A] border border-[rgba(64,56,47,0.14)] hover:bg-[#E9EDC9]'
            }`}
            title={videoActive ? 'Turn Video Off' : 'Turn Video On'}
          >
            {videoActive ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`p-3 rounded-[10px] flex items-center justify-center transition-all shadow-sm ${
              screenSharing
                ? 'bg-[#CCD5AE] text-[#40382F] border border-[rgba(64,56,47,0.2)]'
                : 'bg-[#FEFAE0] text-[#75695A] border border-[rgba(64,56,47,0.14)] hover:bg-[#E9EDC9]'
            }`}
            title={screenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
          >
            <ScreenShare className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Leave Room */}
        <div>
          <button
            onClick={handleLeaveRoom}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-[10px] bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 text-xs font-bold transition-all hover:scale-[1.02]"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Leave Room</span>
          </button>
        </div>
      </div>

      {/* Modal: Edit Subject Goal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#40382F]/50 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm bg-[#FEFAE0] border border-[rgba(64,56,47,0.14)] rounded-[16px] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[#40382F] mb-2">What are you working on?</h3>
            <p className="text-xs text-[#75695A] mb-4 font-normal">
              Your focus label is visible to other students in the study hall to keep you accountable.
            </p>
            <form onSubmit={handleSaveStatus} className="space-y-4">
              <input
                type="text"
                required
                placeholder="e.g. Solving Graph DP Problems"
                value={statusText}
                onChange={(e) => setStatusText(e.target.value)}
                className="w-full bg-[#FAEDCD] border border-[rgba(64,56,47,0.14)] rounded-[10px] px-4 py-2.5 text-xs text-[#40382F] placeholder-[#9E9080] focus:outline-none focus:border-[#D4A373] focus:ring-1 focus:ring-[#D4A373] shadow-sm"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 rounded-[10px] text-xs font-semibold text-[#75695A] hover:text-[#40382F] hover:bg-[#FAEDCD]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[10px] bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] text-xs font-bold shadow-sm"
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
