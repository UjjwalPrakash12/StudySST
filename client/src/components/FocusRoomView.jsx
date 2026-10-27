import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { 
  Room as LivekitRoom, 
  RoomEvent, 
  VideoPresets, 
  Track as LivekitTrack,
  ConnectionQuality 
} from 'livekit-client';
import { 
  Mic, MicOff, Video, VideoOff, ScreenShare, 
  MessageSquare, CheckSquare, Volume2, VolumeX, LogOut, Send, 
  Sparkles, Coffee, Flame, ThumbsUp, Zap, HelpCircle, Edit3, X, Sliders,
  Radio, Clock, ShieldCheck, Award, Users, ChevronLeft, ChevronRight, Wifi, WifiOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { soundSynthesizer } from '../utils/soundSynthesizer';

const REACTION_EMOJIS = ['👏', '🔥', '💯', '☕', '⚡', '📚'];
const TILES_PER_PAGE = 8; // Optimal tile count to prevent browser overload for 10-30+ participants

const getIceServers = () => {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: import.meta.env.VITE_TURN_USERNAME || '',
      credential: import.meta.env.VITE_TURN_CREDENTIAL || '',
    });
  }

  return { iceServers: servers };
};

const AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

// Optimized video constraints for 10-30+ participants (study desk video does not need 1080p60)
const VIDEO_CONSTRAINTS = {
  width: { ideal: 480, max: 640 },
  height: { ideal: 270, max: 360 },
  frameRate: { ideal: 15, max: 20 },
};

/**
 * Dedicated Remote Video Tile with support for both LiveKit SFU tracks and WebRTC Mesh streams.
 */
function RemoteParticipantTile({ peer, stream, livekitTrack, isSpeaking, connectionQuality }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  // LiveKit Track Attachment
  useEffect(() => {
    if (livekitTrack && videoRef.current) {
      livekitTrack.attach(videoRef.current);
      return () => {
        try { livekitTrack.detach(videoRef.current); } catch (e) {}
      };
    }
  }, [livekitTrack]);

  // WebRTC Mesh Stream Attachment
  useEffect(() => {
    if (!livekitTrack && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
    if (!livekitTrack && stream && audioRef.current) {
      audioRef.current.srcObject = stream;
    }
  }, [stream, livekitTrack]);

  const hasVideo = Boolean((livekitTrack || stream) && peer.mediaState?.video);
  const isMicMuted = !peer.mediaState?.mic;

  return (
    <div className={`relative bg-[#FAEDCD] rounded-none border overflow-hidden aspect-video flex items-center justify-center transition-all ${
      isSpeaking 
        ? 'border-2 border-emerald-500 shadow-sm ring-1 ring-emerald-500' 
        : 'border-[rgba(64,56,47,0.2)]'
    }`}>
      {/* Remote audio playback */}
      {!livekitTrack && <audio ref={audioRef} autoPlay playsInline />}

      {/* Video display or Avatar placeholder */}
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-none bg-[#CCD5AE] flex items-center justify-center text-[#40382F] font-bold text-xl sm:text-2xl border border-[#40382F]/20 mb-2 sm:mb-3">
            {peer.user?.display_name ? peer.user.display_name.charAt(0).toUpperCase() : 'S'}
            {isSpeaking && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-none animate-ping"></span>
            )}
            <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-none border border-[#FAEDCD] ${
              isSpeaking ? 'bg-emerald-500' : 'bg-[#D4A373]'
            }`}></span>
          </div>
          <span className="text-xs font-bold text-[#40382F] truncate max-w-[140px]">
            {peer.user?.display_name || 'Study Peer'}
          </span>
          <span className="text-[10px] text-[#75695A] mt-0.5">
            {isSpeaking ? 'Speaking...' : 'Camera Off • Focused'}
          </span>
        </div>
      )}

      {/* Top Status Overlay */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
        <span className="px-2 py-0.5 rounded-none bg-[#FEFAE0]/95 backdrop-blur-sm text-[10px] font-bold text-[#40382F] border border-[rgba(64,56,47,0.2)] flex items-center space-x-1.5 truncate max-w-[70%]">
          {isSpeaking && <span className="w-2 h-2 rounded-none bg-emerald-500 animate-pulse flex-shrink-0"></span>}
          <span className="truncate">{peer.user?.display_name || 'Study Peer'}</span>
        </span>

        <div className="flex items-center space-x-1">
          {isMicMuted ? (
            <span className="p-1 rounded-none bg-rose-100/90 border border-rose-200 text-rose-800" title="Microphone muted">
              <MicOff className="w-3 h-3" />
            </span>
          ) : (
            <span className={`p-1 rounded-none border ${
              isSpeaking 
                ? 'bg-emerald-100 border-emerald-300 text-emerald-800' 
                : 'bg-[#E9EDC9]/90 border-[rgba(64,56,47,0.2)] text-[#40382F]'
            }`} title="Microphone active">
              <Mic className="w-3 h-3" />
            </span>
          )}
          {!peer.mediaState?.video && (
            <span className="p-1 rounded-none bg-[#E9EDC9]/90 border border-[rgba(64,56,47,0.2)] text-[#75695A]" title="Camera off">
              <VideoOff className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>

      {/* Bottom Subject Goal Pill */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 pointer-events-none">
        <div className="px-2 py-0.5 rounded-none bg-[#FEFAE0]/95 backdrop-blur-sm border border-[rgba(64,56,47,0.2)] text-[10px] text-[#40382F] truncate flex items-center space-x-1.5">
          <span className="w-1.5 h-1.5 bg-[#CCD5AE] flex-shrink-0"></span>
          <span className="truncate font-medium">{peer.statusText || 'Focusing...'}</span>
        </div>
      </div>
    </div>
  );
}

export default function FocusRoomView({ room, onLeaveRoom }) {
  const { user, isAuthenticated, refreshUser } = useAuth();
  
  // Media state
  const [localStream, setLocalStream] = useState(null);
  const [micActive, setMicActive] = useState(false);
  const [videoActive, setVideoActive] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState(new Map()); // socketId -> MediaStream (Mesh fallback)
  const [livekitRemoteTracks, setLivekitRemoteTracks] = useState(new Map()); // participantIdentity -> RemoteTrack
  const [speakingPeers, setSpeakingPeers] = useState({}); // id -> boolean
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);
  const [roomMode, setRoomMode] = useState('silent'); // 'silent' | 'discussion'
  const [sfuActive, setSfuActive] = useState(false);
  const [networkQuality, setNetworkQuality] = useState('good'); // 'excellent' | 'good' | 'poor'
  const [reconnecting, setReconnecting] = useState(false);

  // Pagination for 10-30+ participant scaling
  const [currentPage, setCurrentPage] = useState(0);

  // Live stopwatch tracking
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState(0);
  const [serverVerifiedSeconds, setServerVerifiedSeconds] = useState(0);

  // Status & Tasks
  const [statusText, setStatusText] = useState('Deep Work Session');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [newTaskInput, setNewTaskInput] = useState('');

  // Chat & Floating Reactions
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [floatingReactions, setFloatingReactions] = useState([]);

  // UI Drawers: 'chat' | 'tasks' | 'audio' | 'scholars' | null
  const [activeDrawer, setActiveDrawer] = useState(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [scholarsSearch, setScholarsSearch] = useState('');

  // Audio Synthesizer volumes
  const [ambientVolumes, setAmbientVolumes] = useState({
    rain: 0,
    cafe: 0,
    binaural: 0,
    fire: 0,
    master: 0.7,
  });

  // Refs
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const chatScrollRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map()); // socketId -> RTCPeerConnection
  const livekitRoomRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micActiveRef = useRef(false);
  const spacebarPressedRef = useRef(false);
  const wasMutedBeforePttRef = useRef(false);
  const isSpeakingLocalRef = useRef(false);

  useEffect(() => {
    micActiveRef.current = micActive;
  }, [micActive]);

  // Voice Activity Detection (VAD) via Web Audio API AnalyserNode
  const setupVoiceActivityDetection = (audioTrack) => {
    try {
      if (analyserRef.current) {
        clearInterval(analyserRef.current);
        analyserRef.current = null;
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (e) {}
        audioContextRef.current = null;
      }

      if (!audioTrack) return;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      const mediaStream = new MediaStream([audioTrack]);
      const source = audioCtx.createMediaStreamSource(mediaStream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let speakingDecay = 0;

      analyserRef.current = setInterval(() => {
        if (!analyserRef.current || !micActiveRef.current) {
          if (isSpeakingLocalRef.current) {
            isSpeakingLocalRef.current = false;
            setIsSpeakingLocal(false);
            socketRef.current?.emit('speaking-change', { roomId: room.id, isSpeaking: false });
          }
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        if (average > 16) {
          speakingDecay = 4;
          if (!isSpeakingLocalRef.current) {
            isSpeakingLocalRef.current = true;
            setIsSpeakingLocal(true);
            socketRef.current?.emit('speaking-change', { roomId: room.id, isSpeaking: true });
          }
        } else {
          if (speakingDecay > 0) {
            speakingDecay--;
          } else if (isSpeakingLocalRef.current) {
            isSpeakingLocalRef.current = false;
            setIsSpeakingLocal(false);
            socketRef.current?.emit('speaking-change', { roomId: room.id, isSpeaking: false });
          }
        }
      }, 100);
    } catch (err) {
      console.warn('VAD init error:', err);
    }
  };

  // WebRTC Mesh Peer Connection Factory (used when SFU is not active or as mesh fallback)
  const createPeerConnection = (targetSocketId) => {
    if (peerConnectionsRef.current.has(targetSocketId)) {
      return peerConnectionsRef.current.get(targetSocketId);
    }

    const pc = new RTCPeerConnection(getIceServers());
    peerConnectionsRef.current.set(targetSocketId, pc);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        try {
          pc.addTrack(track, localStreamRef.current);
        } catch (e) {
          console.warn('Error adding track to peer connection:', e);
        }
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc-ice-candidate', {
          targetSocketId,
          candidate: event.candidate,
          senderSocketId: socketRef.current.id,
        });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.set(targetSocketId, remoteStream);
          return next;
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.delete(targetSocketId);
          return next;
        });
      }
    };

    return pc;
  };

  // Authoritative hardware track termination
  const stopAllMediaTracks = () => {
    if (analyserRef.current) {
      clearInterval(analyserRef.current);
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }
    if (livekitRoomRef.current) {
      try { livekitRoomRef.current.disconnect(); } catch (e) {}
      livekitRoomRef.current = null;
    }
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
    peerConnectionsRef.current.forEach(pc => {
      try { pc.close(); } catch (e) {}
    });
    peerConnectionsRef.current.clear();
    setLocalStream(null);
    setScreenSharing(false);
  };

  const handleLeaveRoom = () => {
    stopAllMediaTracks();
    soundSynthesizer.stopAll();
    if (socketRef.current) {
      try {
        socketRef.current.emit('leave-room', { roomId: room.id });
        socketRef.current.disconnect();
      } catch (e) {}
    }
    onLeaveRoom();
  };

  // Push-to-Talk via Spacebar (active in both silent and discussion modes)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.code === 'Space' && !e.repeat && !spacebarPressedRef.current) {
        spacebarPressedRef.current = true;
        if (!micActiveRef.current) {
          wasMutedBeforePttRef.current = true;
          unmuteMic();
        }
      }
    };

    const handleKeyUp = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.code === 'Space') {
        spacebarPressedRef.current = false;
        if (wasMutedBeforePttRef.current) {
          muteMic();
          wasMutedBeforePttRef.current = false;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Initialize media (360p 15fps camera on by default, microphone muted by default)
  useEffect(() => {
    let mounted = true;

    async function setupMedia() {
      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: VIDEO_CONSTRAINTS,
            audio: AUDIO_CONSTRAINTS,
          });
          stream.getAudioTracks().forEach(track => {
            track.enabled = false;
          });
        } catch (mediaErr) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: VIDEO_CONSTRAINTS,
            audio: false,
          });
        }

        if (mounted) {
          localStreamRef.current = stream;
          setLocalStream(stream);
          setVideoActive(true);
          setMicActive(false);

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        } else {
          stream.getTracks().forEach(t => t.stop());
        }
      } catch (err) {
        console.warn('Real webcam not accessible or denied:', err.message);
        if (mounted) {
          setVideoActive(false);
          setMicActive(false);
        }
      }
    }

    setupMedia();

    // Check LiveKit SFU support
    async function initSFU() {
      try {
        const res = await api.getLiveKitToken(room.id, user?.display_name, user?.id);
        if (res.sfuEnabled && res.token && res.url) {
          const lkRoom = new LivekitRoom({
            adaptiveStream: true,
            dynacast: true,
            videoCaptureDefaults: {
              resolution: VideoPresets.h360.resolution,
            },
            publishDefaults: {
              simulcast: true,
              videoEncoding: {
                maxBitrate: 350_000,
                maxFramerate: 20,
              },
              audioPreset: {
                maxBitrate: 32_000,
              },
            },
          });
          livekitRoomRef.current = lkRoom;

          lkRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            if (track.kind === LivekitTrack.Kind.Video) {
              setLivekitRemoteTracks(prev => {
                const next = new Map(prev);
                next.set(participant.identity, track);
                return next;
              });
            }
          });

          lkRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
            setLivekitRemoteTracks(prev => {
              const next = new Map(prev);
              next.delete(participant.identity);
              return next;
            });
          });

          lkRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
            const speakingMap = {};
            speakers.forEach(s => {
              speakingMap[s.identity] = true;
            });
            setSpeakingPeers(speakingMap);
          });

          lkRoom.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
            if (participant === lkRoom.localParticipant) {
              if (quality === ConnectionQuality.Excellent) setNetworkQuality('excellent');
              else if (quality === ConnectionQuality.Good) setNetworkQuality('good');
              else setNetworkQuality('poor');
            }
          });

          lkRoom.on(RoomEvent.Reconnecting, () => setReconnecting(true));
          lkRoom.on(RoomEvent.Reconnected, () => setReconnecting(false));

          await lkRoom.connect(res.url, res.token);
          setSfuActive(true);
          console.log('[LiveKit SFU] Successfully connected with Dynacast and Simulcast enabled!');
        }
      } catch (sfuErr) {
        console.warn('[LiveKit SFU] Running in adaptive WebRTC mesh fallback mode:', sfuErr.message);
        setSfuActive(false);
      }
    }

    initSFU();

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

  // Load Tasks
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
    const socketEndpoint = import.meta.env.VITE_API_URL || window.location.origin;
    const socket = io(socketEndpoint, {
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
      mediaState: { mic: false, video: videoActive, screenShare: screenSharing },
      statusText
    });

    socket.on('room-joined', async ({ participants: existingParticipants, messages: initialMessages }) => {
      setParticipants(existingParticipants || []);
      if (initialMessages) {
        setMessages(initialMessages);
      }
      socket.emit('session-live-started', { roomId: room.id });

      // In Mesh mode, initiate offers to existing participants
      if (!sfuActive && Array.isArray(existingParticipants)) {
        for (const peer of existingParticipants) {
          if (peer.socketId !== socket.id) {
            try {
              const pc = createPeerConnection(peer.socketId);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socket.emit('webrtc-offer', {
                targetSocketId: peer.socketId,
                offer,
                senderSocketId: socket.id
              });
            } catch (err) {
              console.warn('Error creating WebRTC offer:', err);
            }
          }
        }
      }
    });

    socket.on('webrtc-offer', async ({ senderSocketId, from, offer }) => {
      const originSocketId = senderSocketId || from;
      if (!originSocketId) return;
      try {
        const pc = createPeerConnection(originSocketId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', {
          targetSocketId: originSocketId,
          answer,
          senderSocketId: socket.id
        });
      } catch (err) {
        console.warn('Error handling WebRTC offer:', err);
      }
    });

    socket.on('webrtc-answer', async ({ senderSocketId, from, answer }) => {
      const originSocketId = senderSocketId || from;
      if (!originSocketId) return;
      try {
        const pc = peerConnectionsRef.current.get(originSocketId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      } catch (err) {
        console.warn('Error setting remote description from answer:', err);
      }
    });

    socket.on('webrtc-ice-candidate', async ({ senderSocketId, from, candidate }) => {
      const originSocketId = senderSocketId || from;
      if (!originSocketId) return;
      try {
        const pc = peerConnectionsRef.current.get(originSocketId);
        if (pc && candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.warn('Error adding ICE candidate:', err);
      }
    });

    socket.on('user-joined', ({ participant }) => {
      setParticipants(prev => {
        const filtered = prev.filter(p => p.socketId !== participant.socketId);
        return [...filtered, participant];
      });
    });

    socket.on('user-left', ({ socketId }) => {
      const pc = peerConnectionsRef.current.get(socketId);
      if (pc) {
        try { pc.close(); } catch (e) {}
        peerConnectionsRef.current.delete(socketId);
      }
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
      setParticipants(prev => prev.filter(p => p.socketId !== socketId));
      setSpeakingPeers(prev => {
        const next = { ...prev };
        delete next[socketId];
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

    socket.on('peer-speaking-changed', ({ socketId, isSpeaking }) => {
      setSpeakingPeers(prev => ({
        ...prev,
        [socketId]: isSpeaking
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

    socket.on('new-message', (msg) => {
      setMessages(prev => [...prev, msg]);
      if (activeDrawer !== 'chat') {
        setUnreadChatCount(prev => prev + 1);
      }
    });

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

    socket.on('heartbeat-ack', ({ verifiedLiveSeconds }) => {
      setServerVerifiedSeconds(verifiedLiveSeconds || 0);
    });

    const ticker = setInterval(() => {
      setLiveElapsedSeconds(prev => {
        const next = prev + 1;
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
  }, [room.id, sfuActive]);

  // Unmute microphone with noise cancellation
  const unmuteMic = async () => {
    let stream = localStreamRef.current;
    let audioTrack = stream ? stream.getAudioTracks()[0] : null;

    if (audioTrack && audioTrack.readyState === 'live') {
      audioTrack.enabled = true;
      setMicActive(true);
      setupVoiceActivityDetection(audioTrack);
      socketRef.current?.emit('update-media-state', {
        roomId: room.id,
        mediaState: { mic: true }
      });
    } else {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
        const newTrack = audioStream.getAudioTracks()[0];
        if (newTrack) {
          if (!stream) {
            stream = new MediaStream();
            localStreamRef.current = stream;
          }
          stream.getAudioTracks().forEach(t => {
            t.stop();
            stream.removeTrack(t);
          });
          stream.addTrack(newTrack);
          newTrack.enabled = true;
          setLocalStream(stream);
          setMicActive(true);

          peerConnectionsRef.current.forEach(pc => {
            const senders = pc.getSenders();
            const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
            if (audioSender) {
              audioSender.replaceTrack(newTrack);
            } else {
              try { pc.addTrack(newTrack, stream); } catch (e) {}
            }
          });

          setupVoiceActivityDetection(newTrack);

          socketRef.current?.emit('update-media-state', {
            roomId: room.id,
            mediaState: { mic: true }
          });
        }
      } catch (err) {
        console.warn('Microphone permission denied:', err);
        setMicActive(false);
      }
    }
  };

  const muteMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
    }
    setMicActive(false);
    setIsSpeakingLocal(false);
    isSpeakingLocalRef.current = false;
    socketRef.current?.emit('speaking-change', { roomId: room.id, isSpeaking: false });
    socketRef.current?.emit('update-media-state', {
      roomId: room.id,
      mediaState: { mic: false }
    });
  };

  const toggleMic = () => {
    if (micActive) {
      muteMic();
    } else {
      unmuteMic();
    }
  };

  const toggleVideo = async () => {
    let stream = localStreamRef.current;
    let videoTrack = stream ? stream.getVideoTracks()[0] : null;

    if (videoActive) {
      if (videoTrack) {
        videoTrack.enabled = false;
      }
      setVideoActive(false);
      socketRef.current?.emit('update-media-state', {
        roomId: room.id,
        mediaState: { video: false }
      });
    } else {
      if (videoTrack && videoTrack.readyState === 'live') {
        videoTrack.enabled = true;
        setVideoActive(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        socketRef.current?.emit('update-media-state', {
          roomId: room.id,
          mediaState: { video: true }
        });
      } else {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: VIDEO_CONSTRAINTS
          });
          const newTrack = videoStream.getVideoTracks()[0];
          if (newTrack) {
            if (!stream) {
              stream = new MediaStream();
              localStreamRef.current = stream;
            }
            stream.getVideoTracks().forEach(t => {
              t.stop();
              stream.removeTrack(t);
            });
            stream.addTrack(newTrack);
            newTrack.enabled = true;
            setLocalStream(stream);
            setVideoActive(true);

            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }

            peerConnectionsRef.current.forEach(pc => {
              const senders = pc.getSenders();
              const videoSender = senders.find(s => s.track && s.track.kind === 'video');
              if (videoSender) {
                videoSender.replaceTrack(newTrack);
              } else {
                try { pc.addTrack(newTrack, stream); } catch (e) {}
              }
            });

            socketRef.current?.emit('update-media-state', {
              roomId: room.id,
              mediaState: { video: true }
            });
          }
        } catch (err) {
          console.warn('Webcam permission denied:', err);
          setVideoActive(false);
        }
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!screenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        setScreenSharing(true);
        const screenTrack = screenStream.getVideoTracks()[0];

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        peerConnectionsRef.current.forEach(pc => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(screenTrack);
          }
        });

        screenTrack.onended = () => {
          stopScreenSharing();
        };

        socketRef.current?.emit('update-media-state', {
          roomId: room.id,
          mediaState: { screenShare: true }
        });
      } catch (e) {
        console.warn('Screen share cancelled:', e);
      }
    } else {
      stopScreenSharing();
    }
  };

  const stopScreenSharing = () => {
    if (screenStreamRef.current) {
      try {
        screenStreamRef.current.getTracks().forEach(t => { t.stop(); t.enabled = false; });
      } catch (e) {}
      screenStreamRef.current = null;
    }
    setScreenSharing(false);

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    if (cameraTrack && videoActive) {
      peerConnectionsRef.current.forEach(pc => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(cameraTrack);
        }
      });
    }

    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    socketRef.current?.emit('update-media-state', {
      roomId: room.id,
      mediaState: { screenShare: false }
    });
  };

  const handleSaveStatus = (e) => {
    e.preventDefault();
    setShowStatusModal(false);
    socketRef.current?.emit('update-status', {
      roomId: room.id,
      statusText
    });
  };

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

  const handleSendReaction = (emoji) => {
    socketRef.current?.emit('send-reaction', {
      roomId: room.id,
      emoji,
      senderName: user ? user.display_name : 'Peer'
    });
  };

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

  const handleVolumeChange = (channel, value) => {
    const val = parseFloat(value);
    setAmbientVolumes(prev => ({ ...prev, [channel]: val }));
    if (channel === 'master') {
      soundSynthesizer.setMasterVolume(val);
    } else {
      soundSynthesizer.setChannelVolume(channel, val);
    }
  };

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

  // Separate remote peers and prioritize active speakers and cameras for Page 1
  const remotePeers = participants.filter(p => p.socketId !== socketRef.current?.id);
  const sortedRemotePeers = [...remotePeers].sort((a, b) => {
    const aSpeaking = speakingPeers[a.socketId] || speakingPeers[a.user?.id];
    const bSpeaking = speakingPeers[b.socketId] || speakingPeers[b.user?.id];
    if (aSpeaking && !bSpeaking) return -1;
    if (!aSpeaking && bSpeaking) return 1;
    const aVideo = a.mediaState?.video;
    const bVideo = b.mediaState?.video;
    if (aVideo && !bVideo) return -1;
    if (!aVideo && bVideo) return 1;
    return 0;
  });

  // Calculate paginated slices for large room video performance
  // On Page 0: Local user takes 1 slot, so we take (TILES_PER_PAGE - 1) remote peers
  // On subsequent pages: TILES_PER_PAGE remote peers
  const totalPages = Math.max(1, Math.ceil((1 + sortedRemotePeers.length) / TILES_PER_PAGE));
  const currentRemoteSlice = currentPage === 0
    ? sortedRemotePeers.slice(0, TILES_PER_PAGE - 1)
    : sortedRemotePeers.slice((currentPage * TILES_PER_PAGE) - 1, ((currentPage + 1) * TILES_PER_PAGE) - 1);

  // Search filtered scholars for Scholars drawer
  const filteredScholars = participants.filter(p => {
    if (!scholarsSearch.trim()) return true;
    const name = p.user?.display_name || '';
    const goal = p.statusText || '';
    return name.toLowerCase().includes(scholarsSearch.toLowerCase()) || 
           goal.toLowerCase().includes(scholarsSearch.toLowerCase());
  });

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-between bg-[#FEFAE0] overflow-hidden select-none">
      
      {/* Reconnecting banner if network drops */}
      {reconnecting && (
        <div className="bg-amber-500 text-white text-xs font-bold py-1 px-4 text-center z-50 flex items-center justify-center space-x-2">
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          <span>Network connection interrupted. Reconnecting with adaptive buffering...</span>
        </div>
      )}

      {/* Floating Reactions Layer */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {floatingReactions.map(r => (
          <div
            key={r.id}
            style={{ left: `${r.leftPercent}%` }}
            className="absolute bottom-24 flex flex-col items-center animate-float-up pointer-events-none"
          >
            <span className="text-4xl drop-shadow-md">{r.emoji}</span>
            <span className="text-[10px] font-bold text-[#40382F] bg-[#FAEDCD] px-2.5 py-0.5 rounded-none border border-[rgba(64,56,47,0.2)] mt-1">
              {r.senderName}
            </span>
          </div>
        ))}
      </div>

      {/* Top Header Bar */}
      <div className="w-full bg-[#FAEDCD] border-b border-[rgba(64,56,47,0.2)] px-4 sm:px-6 py-2.5 flex items-center justify-between z-30">
        
        {/* Left: Room Title, Category, Online count */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleLeaveRoom}
            className="p-1.5 rounded-none text-[#75695A] hover:text-[#40382F] hover:bg-[#E9EDC9] border border-transparent hover:border-[rgba(64,56,47,0.2)] transition-all"
            title="Leave room"
          >
            <LogOut className="w-4 h-4 rotate-180" />
          </button>
          
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm sm:text-base font-bold text-[#40382F] tracking-tight">{room.name}</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-none bg-[#CCD5AE] text-[#40382F] border border-[rgba(64,56,47,0.2)]">
                {room.category}
              </span>
              {sfuActive ? (
                <span className="hidden lg:inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-none bg-emerald-100 text-emerald-800 border border-emerald-300">
                  SFU Simulcast
                </span>
              ) : (
                <span className="hidden lg:inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-none bg-[#E9EDC9] text-[#40382F] border border-[rgba(64,56,47,0.2)]">
                  Adaptive Mesh
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-[#75695A]">
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-[#D4A373] animate-pulse"></span>
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

        {/* Center: Live Stopwatch & Room Audio Mode Selector */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Room Audio Mode Pill */}
          <div className="hidden md:flex items-center bg-[#FEFAE0] border border-[rgba(64,56,47,0.2)] p-0.5 rounded-none text-[11px]">
            <button
              onClick={() => setRoomMode('silent')}
              className={`px-2.5 py-1 rounded-none font-semibold transition-all flex items-center space-x-1 ${
                roomMode === 'silent'
                  ? 'bg-[#CCD5AE] text-[#40382F] font-bold shadow-none'
                  : 'text-[#75695A] hover:text-[#40382F]'
              }`}
              title="Silent Study Mode: Mute by default for quiet focus"
            >
              <VolumeX className="w-3 h-3" />
              <span>Silent Study</span>
            </button>
            <button
              onClick={() => setRoomMode('discussion')}
              className={`px-2.5 py-1 rounded-none font-semibold transition-all flex items-center space-x-1 ${
                roomMode === 'discussion'
                  ? 'bg-[#D4A373] text-[#40382F] font-bold shadow-none'
                  : 'text-[#75695A] hover:text-[#40382F]'
              }`}
              title="Discussion Mode: Open voice chat for active collaboration"
            >
              <Volume2 className="w-3 h-3" />
              <span>Discussion</span>
            </button>
          </div>

          {/* Stopwatch */}
          <div className="flex items-center space-x-3 bg-[#FEFAE0] border border-[rgba(64,56,47,0.2)] px-3 sm:px-4 py-1.5 rounded-none">
            <div className="relative flex items-center justify-center">
              <span className="w-2.5 h-2.5 bg-[#D4A373] animate-ping absolute"></span>
              <span className="w-2.5 h-2.5 bg-[#D4A373]"></span>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-sm sm:text-base font-bold text-[#40382F] tracking-wider">
                  {formatLiveElapsed(liveElapsedSeconds)}
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-none bg-[#CCD5AE] text-[#40382F] border border-[rgba(64,56,47,0.2)] uppercase tracking-wider">
                  LIVE
                </span>
              </div>
              <div className="text-[9px] text-[#75695A] flex items-center space-x-1">
                <Wifi className="w-3 h-3 text-emerald-600 inline" />
                <span>30+ Scale Engine</span>
                <span>•</span>
                <span className="text-[#40382F] font-bold">100% Reliable</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Drawer Toggles */}
        <div className="flex items-center space-x-2">
          {/* All Connected Scholars Drawer Toggle */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'scholars' ? null : 'scholars')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-none text-xs font-semibold border transition-all ${
              activeDrawer === 'scholars'
                ? 'bg-[#CCD5AE] border-[rgba(64,56,47,0.2)] text-[#40382F] font-bold'
                : 'bg-[#FEFAE0] border-[rgba(64,56,47,0.2)] text-[#75695A] hover:bg-[#E9EDC9]'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-[#40382F]" />
            <span className="hidden sm:inline">Scholars</span>
            <span className="px-1.5 py-0.2 rounded-none bg-[#D4A373] text-[10px] text-[#40382F] font-bold border border-[#40382F]/20">
              {participants.length}
            </span>
          </button>

          {/* Ambient Sound Button */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'audio' ? null : 'audio')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-none text-xs font-semibold border transition-all ${
              activeDrawer === 'audio' || isAmbientActive
                ? 'bg-[#CCD5AE] border-[rgba(64,56,47,0.2)] text-[#40382F] font-bold'
                : 'bg-[#FEFAE0] border-[rgba(64,56,47,0.2)] text-[#75695A] hover:bg-[#E9EDC9]'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5 text-[#40382F]" />
            <span className="hidden sm:inline">Ambience</span>
            {isAmbientActive && (
              <span className="w-2 h-2 bg-[#D4A373] animate-ping"></span>
            )}
          </button>

          {/* Tasks Button */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'tasks' ? null : 'tasks')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-none text-xs font-semibold border transition-all ${
              activeDrawer === 'tasks'
                ? 'bg-[#CCD5AE] border-[rgba(64,56,47,0.2)] text-[#40382F] font-bold'
                : 'bg-[#FEFAE0] border-[rgba(64,56,47,0.2)] text-[#75695A] hover:bg-[#E9EDC9]'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-[#40382F]" />
            <span className="hidden sm:inline">Tasks</span>
            {tasks.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-none bg-[#E9EDC9] text-[10px] text-[#40382F] font-bold border border-[rgba(64,56,47,0.2)]">
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
            className={`relative flex items-center space-x-1.5 px-3 py-1.5 rounded-none text-xs font-semibold border transition-all ${
              activeDrawer === 'chat'
                ? 'bg-[#CCD5AE] border-[rgba(64,56,47,0.2)] text-[#40382F] font-bold'
                : 'bg-[#FEFAE0] border-[rgba(64,56,47,0.2)] text-[#75695A] hover:bg-[#E9EDC9]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#40382F]" />
            <span className="hidden sm:inline">Chat</span>
            {unreadChatCount > 0 && activeDrawer !== 'chat' && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-none bg-[#D4A373] text-[10px] text-[#40382F] font-bold leading-none border border-[#40382F]/20">
                {unreadChatCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Room Body: Responsive Video Grid & Side Drawers */}
      <div className="relative flex-1 flex overflow-hidden">
        
        {/* Video Tiles Grid & Pagination Controls */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto flex flex-col justify-between">
          
          {/* Pagination Strip (Active when participants > 8) */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mb-3 px-1 max-w-7xl mx-auto w-full">
              <span className="text-xs font-semibold text-[#75695A]">
                Showing Page <span className="font-bold text-[#40382F]">{currentPage + 1}</span> of <span className="font-bold text-[#40382F]">{totalPages}</span> ({participants.length} connected scholars)
              </span>

              <div className="flex items-center space-x-2">
                <button
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  className="p-1.5 rounded-none bg-[#FEFAE0] border border-[rgba(64,56,47,0.2)] text-[#40382F] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#E9EDC9] transition-all"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                  className="p-1.5 rounded-none bg-[#FEFAE0] border border-[rgba(64,56,47,0.2)] text-[#40382F] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#E9EDC9] transition-all"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Grid Layout (auto-fit 1-4 columns based on viewport) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 max-w-7xl mx-auto w-full auto-rows-fr">
            
            {/* 1. Local User Tile (Pinned on Page 0) */}
            {currentPage === 0 && (
              <div className={`relative bg-[#FAEDCD] rounded-none border-2 overflow-hidden aspect-video flex items-center justify-center group transition-all ${
                isSpeakingLocal 
                  ? 'border-emerald-500 ring-1 ring-emerald-500' 
                  : 'border-[#D4A373]'
              }`}>
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
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-none bg-[#D4A373] flex items-center justify-center text-[#FEFAE0] font-bold text-xl sm:text-2xl border border-[#40382F]/20 mb-2 sm:mb-3">
                      {user ? user.display_name.charAt(0).toUpperCase() : 'Y'}
                      {isSpeakingLocal && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-none animate-ping"></span>
                      )}
                      <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-none border border-[#FAEDCD] ${
                        isSpeakingLocal ? 'bg-emerald-500' : 'bg-[#CCD5AE]'
                      }`}></span>
                    </div>
                    <span className="text-xs font-bold text-[#40382F]">{user ? user.display_name : 'You (Host)'}</span>
                    <span className="text-[10px] text-[#75695A] mt-0.5">
                      {isSpeakingLocal ? 'Speaking...' : 'Camera Muted • Focused'}
                    </span>
                  </div>
                )}

                {/* Top status overlay */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                  <span className="px-2 py-0.5 rounded-none bg-[#FEFAE0]/95 backdrop-blur-sm text-[10px] font-bold text-[#40382F] border border-[rgba(64,56,47,0.2)] flex items-center space-x-1.5">
                    {isSpeakingLocal && <span className="w-2 h-2 rounded-none bg-emerald-500 animate-pulse"></span>}
                    <span>You {screenSharing ? '(Screen Sharing)' : ''}</span>
                  </span>

                  <div className="flex items-center space-x-1">
                    {!micActive ? (
                      <span className="p-1 rounded-none bg-rose-100/90 border border-rose-200 text-rose-800" title="Microphone muted">
                        <MicOff className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className={`p-1 rounded-none border ${
                        isSpeakingLocal 
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-800' 
                          : 'bg-[#E9EDC9]/90 border-[rgba(64,56,47,0.2)] text-[#40382F]'
                      }`} title="Microphone active">
                        <Mic className="w-3 h-3" />
                      </span>
                    )}
                    {!videoActive && (
                      <span className="p-1 rounded-none bg-[#E9EDC9]/90 border border-[rgba(64,56,47,0.2)] text-[#75695A]" title="Camera disabled">
                        <VideoOff className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Subject Goal Pill */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 pointer-events-none">
                  <div className="px-2 py-0.5 rounded-none bg-[#FEFAE0]/95 backdrop-blur-sm border border-[rgba(64,56,47,0.2)] text-[10px] text-[#40382F] truncate flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 bg-[#D4A373]"></span>
                    <span className="truncate font-medium">{statusText}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Remote Participants for Current Page */}
            {currentRemoteSlice.map((peer) => {
              const stream = remoteStreams.get(peer.socketId);
              const livekitTrack = livekitRemoteTracks.get(peer.user?.id || peer.socketId);
              const isSpeaking = Boolean(speakingPeers[peer.socketId] || speakingPeers[peer.user?.id]);

              return (
                <RemoteParticipantTile
                  key={peer.socketId || peer.user?.id}
                  peer={peer}
                  stream={stream}
                  livekitTrack={livekitTrack}
                  isSpeaking={isSpeaking}
                  connectionQuality={networkQuality}
                />
              );
            })}
          </div>

          <div className="h-4"></div>
        </div>

        {/* Drawer: All Connected Scholars (Supports 30+ List View) */}
        {activeDrawer === 'scholars' && (
          <div className="w-80 border-l border-[rgba(64,56,47,0.2)] bg-[#FEFAE0] p-4 flex flex-col justify-between z-30 animate-fadeIn">
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(64,56,47,0.2)]">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-[#D4A373]" />
                  <h3 className="text-sm font-bold text-[#40382F]">Connected Scholars ({participants.length})</h3>
                </div>
                <button
                  onClick={() => setActiveDrawer(null)}
                  className="p-1 rounded-none text-[#75695A] hover:text-[#40382F] hover:bg-[#FAEDCD]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search filter */}
              <div className="my-3">
                <input
                  type="text"
                  placeholder="Filter 30+ scholars..."
                  value={scholarsSearch}
                  onChange={(e) => setScholarsSearch(e.target.value)}
                  className="w-full bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)] rounded-none px-3 py-1.5 text-xs text-[#40382F] placeholder-[#9E9080] focus:outline-none focus:border-[#D4A373]"
                />
              </div>

              {/* All participants scroll list */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredScholars.map(p => {
                  const isMe = p.socketId === socketRef.current?.id || p.user?.id === user?.id;
                  const isSpeaking = isMe ? isSpeakingLocal : Boolean(speakingPeers[p.socketId] || speakingPeers[p.user?.id]);
                  const hasVideo = isMe ? videoActive : p.mediaState?.video;
                  const hasMic = isMe ? micActive : p.mediaState?.mic;

                  return (
                    <div
                      key={p.socketId || p.user?.id}
                      className={`p-2.5 rounded-none border flex items-center justify-between transition-all ${
                        isSpeaking
                          ? 'bg-[#E9EDC9] border-emerald-500'
                          : 'bg-[#FAEDCD] border-[rgba(64,56,47,0.2)]'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 truncate flex-1 min-w-0">
                        <div className="relative w-8 h-8 rounded-none bg-[#CCD5AE] flex items-center justify-center text-[#40382F] font-bold text-xs border border-[#40382F]/20 flex-shrink-0">
                          {p.user?.display_name ? p.user.display_name.charAt(0).toUpperCase() : 'S'}
                          {isSpeaking && (
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-none animate-ping"></span>
                          )}
                        </div>
                        <div className="truncate flex-1">
                          <p className="text-xs font-bold text-[#40382F] truncate">
                            {p.user?.display_name || 'Scholar'} {isMe && '(You)'}
                          </p>
                          <p className="text-[10px] text-[#75695A] truncate">
                            {p.statusText || 'Focusing...'}
                          </p>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center space-x-1.5 ml-2 flex-shrink-0">
                        {hasMic ? (
                          <span className={`p-1 rounded-none border text-[10px] ${isSpeaking ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-[#E9EDC9] text-[#40382F] border-[rgba(64,56,47,0.2)]'}`}>
                            <Mic className="w-3 h-3" />
                          </span>
                        ) : (
                          <span className="p-1 rounded-none bg-rose-100 border border-rose-200 text-rose-800 text-[10px]">
                            <MicOff className="w-3 h-3" />
                          </span>
                        )}
                        {hasVideo ? (
                          <span className="p-1 rounded-none bg-[#D4A373] text-[#40382F] border border-[#40382F]/20 text-[10px]">
                            <Video className="w-3 h-3" />
                          </span>
                        ) : (
                          <span className="p-1 rounded-none bg-[#FEFAE0] border border-[rgba(64,56,47,0.2)] text-[#75695A] text-[10px]">
                            <VideoOff className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-[rgba(64,56,47,0.2)] text-[11px] text-[#75695A] flex items-center justify-between font-semibold">
              <span>{participants.length} total participants</span>
              <span className="text-emerald-700 font-bold flex items-center space-x-1">
                <Wifi className="w-3 h-3" />
                <span>Connected</span>
              </span>
            </div>
          </div>
        )}

        {/* Drawer: Ambient Sound Synthesizer */}
        {activeDrawer === 'audio' && (
          <div className="w-80 border-l border-[rgba(64,56,47,0.2)] bg-[#FEFAE0] p-5 flex flex-col justify-between z-30 animate-fadeIn">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[rgba(64,56,47,0.2)]">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-[#D4A373]" />
                  <h3 className="text-sm font-bold text-[#40382F]">Ambient Sound Mixer</h3>
                </div>
                <button
                  onClick={() => setActiveDrawer(null)}
                  className="p-1 rounded-none text-[#75695A] hover:text-[#40382F] hover:bg-[#FAEDCD]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[11px] text-[#75695A] mb-5 font-normal">
                Synthesized live via WebAudio API. Blend realistic rain, cafe hum, or 10Hz binaural alpha wave for maximum concentration.
              </p>

              {/* Rain Slider */}
              <div className="space-y-4">
                <div className="p-2.5 bg-[#FAEDCD] rounded-none border border-[rgba(64,56,47,0.2)]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#40382F] mb-1.5">
                    <span>🌧️ Rain & Distant Thunder</span>
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
                <div className="p-2.5 bg-[#FAEDCD] rounded-none border border-[rgba(64,56,47,0.2)]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#40382F] mb-1.5">
                    <span>☕ Cozy Cafe & Chatter</span>
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
                <div className="p-2.5 bg-[#FAEDCD] rounded-none border border-[rgba(64,56,47,0.2)]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#40382F] mb-1.5">
                    <span>🧠 10Hz Alpha Binaural Wave</span>
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
                <div className="p-2.5 bg-[#FAEDCD] rounded-none border border-[rgba(64,56,47,0.2)]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#40382F] mb-1.5">
                    <span>🔥 Fireplace Crackle</span>
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
                <div className="pt-4 border-t border-[rgba(64,56,47,0.2)]">
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

            <div className="pt-4 border-t border-[rgba(64,56,47,0.2)] flex items-center justify-between">
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
          <div className="w-80 border-l border-[rgba(64,56,47,0.2)] bg-[#FEFAE0] p-5 flex flex-col justify-between z-30 animate-fadeIn">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[rgba(64,56,47,0.2)]">
                <div className="flex items-center space-x-2">
                  <CheckSquare className="w-4 h-4 text-[#D4A373]" />
                  <h3 className="text-sm font-bold text-[#40382F]">Session Goals & Tasks</h3>
                </div>
                <button
                  onClick={() => setActiveDrawer(null)}
                  className="p-1 rounded-none text-[#75695A] hover:text-[#40382F] hover:bg-[#FAEDCD]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddTask} className="mb-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Add a focus milestone..."
                    value={newTaskInput}
                    onChange={(e) => setNewTaskInput(e.target.value)}
                    className="flex-1 bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)] rounded-none px-3 py-2 text-xs text-[#40382F] placeholder-[#9E9080] focus:outline-none focus:border-[#D4A373]"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-none bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] text-xs font-bold border border-[#40382F]/20"
                  >
                    Add
                  </button>
                </div>
              </form>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {tasks.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#75695A] bg-[#FAEDCD] rounded-none border border-[rgba(64,56,47,0.2)]">
                    No tasks yet. Set 1–3 goals for this study sprint!
                  </div>
                ) : (
                  tasks.map(task => (
                    <div
                      key={task.id}
                      className={`flex items-start justify-between p-2.5 rounded-none border transition-all ${
                        task.completed 
                          ? 'bg-[#E9EDC9]/60 border-[#CCD5AE] text-[#75695A] line-through' 
                          : 'bg-[#FAEDCD] border-[rgba(64,56,47,0.2)] text-[#40382F]'
                      }`}
                    >
                      <label className="flex items-start space-x-2.5 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={Boolean(task.completed)}
                          onChange={() => handleToggleTask(task.id)}
                          className="mt-0.5 rounded-none accent-[#D4A373] cursor-pointer"
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

            {tasks.length > 0 && (
              <div className="pt-4 border-t border-[rgba(64,56,47,0.2)] text-xs text-[#75695A] flex items-center justify-between font-semibold">
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
          <div className="w-80 border-l border-[rgba(64,56,47,0.2)] bg-[#FEFAE0] p-4 flex flex-col justify-between z-30 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(64,56,47,0.2)]">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-[#D4A373]" />
                <h3 className="text-sm font-bold text-[#40382F]">Study Hall Chat</h3>
              </div>
              <button
                onClick={() => setActiveDrawer(null)}
                className="p-1 rounded-none text-[#75695A] hover:text-[#40382F] hover:bg-[#FAEDCD]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div ref={chatScrollRef} className="flex-1 overflow-y-auto py-3 space-y-3">
              {messages.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#75695A] bg-[#FAEDCD] rounded-none border border-[rgba(64,56,47,0.2)]">
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
                        className={`px-3 py-2 rounded-none text-xs max-w-[85%] break-words font-medium ${
                          isMe 
                            ? 'bg-[#CCD5AE] text-[#40382F] border border-[rgba(64,56,47,0.2)]' 
                            : 'bg-[#FAEDCD] text-[#40382F] border border-[rgba(64,56,47,0.2)]'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendMessage} className="pt-2 border-t border-[rgba(64,56,47,0.2)]">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Send a quiet encouragement..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)] rounded-none px-3 py-2 text-xs text-[#40382F] placeholder-[#9E9080] focus:outline-none focus:border-[#D4A373]"
                />
                <button
                  type="submit"
                  className="p-2 rounded-none bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] border border-[#40382F]/20 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Bottom Floating Control Dock */}
      <div className="w-full bg-[#FAEDCD] border-t border-[rgba(64,56,47,0.2)] px-4 py-3 flex items-center justify-between z-30">
        
        {/* Left: Quick Live Reactions Bar */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          <span className="text-[11px] font-bold text-[#75695A] hidden md:inline">React:</span>
          {REACTION_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => handleSendReaction(emoji)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-none bg-[#FEFAE0] hover:bg-[#E9EDC9] border border-[rgba(64,56,47,0.2)] text-sm sm:text-base transition-transform"
              title={`Send ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Center: Essential AV Controls & Push-to-Talk Indicator */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Mic */}
          <div className="relative flex flex-col items-center">
            <button
              onClick={toggleMic}
              className={`p-3 rounded-none flex items-center justify-center transition-all border ${
                micActive
                  ? 'bg-[#D4A373] text-[#40382F] border-[#40382F]/20 shadow-none'
                  : 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
              }`}
              title={micActive ? 'Mute Microphone' : 'Unmute Microphone (or hold Spacebar to talk)'}
            >
              {micActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <span className="text-[9px] text-[#75695A] font-semibold mt-1 hidden sm:block">
              {micActive ? 'Mic Active' : 'Space: Talk'}
            </span>
          </div>

          {/* Camera */}
          <div className="relative flex flex-col items-center">
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-none flex items-center justify-center transition-all border ${
                videoActive
                  ? 'bg-[#D4A373] text-[#40382F] border-[#40382F]/20'
                  : 'bg-[#FEFAE0] text-[#75695A] border-[rgba(64,56,47,0.2)] hover:bg-[#E9EDC9]'
              }`}
              title={videoActive ? 'Turn Video Off' : 'Turn Video On'}
            >
              {videoActive ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <span className="text-[9px] text-[#75695A] font-semibold mt-1 hidden sm:block">
              {videoActive ? 'Camera On' : 'Camera Off'}
            </span>
          </div>

          {/* Screen Share */}
          <div className="relative flex flex-col items-center">
            <button
              onClick={toggleScreenShare}
              className={`p-3 rounded-none flex items-center justify-center transition-all border ${
                screenSharing
                  ? 'bg-[#CCD5AE] text-[#40382F] border-[rgba(64,56,47,0.2)]'
                  : 'bg-[#FEFAE0] text-[#75695A] border-[rgba(64,56,47,0.2)] hover:bg-[#E9EDC9]'
              }`}
              title={screenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
            >
              <ScreenShare className="w-5 h-5" />
            </button>
            <span className="text-[9px] text-[#75695A] font-semibold mt-1 hidden sm:block">
              {screenSharing ? 'Sharing' : 'Screen'}
            </span>
          </div>
        </div>

        {/* Right: Leave Room */}
        <div>
          <button
            onClick={handleLeaveRoom}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-none bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 text-xs font-bold transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Leave Room</span>
          </button>
        </div>
      </div>

      {/* Modal: Edit Subject Goal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#40382F]/50 animate-fadeIn">
          <div className="relative w-full max-w-sm bg-[#FEFAE0] border border-[rgba(64,56,47,0.2)] rounded-none p-6">
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
                className="w-full bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)] rounded-none px-4 py-2.5 text-xs text-[#40382F] placeholder-[#9E9080] focus:outline-none focus:border-[#D4A373]"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 rounded-none text-xs font-semibold text-[#75695A] hover:text-[#40382F] hover:bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-none bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] text-xs font-bold border border-[#40382F]/20"
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
