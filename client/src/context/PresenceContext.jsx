import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const PresenceContext = createContext(null);

function getVisitorId() {
  try {
    let id = localStorage.getItem('studystream_visitor_id');
    if (!id) {
      id = 'visitor-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem('studystream_visitor_id', id);
    }
    return id;
  } catch (e) {
    return 'visitor-temp-' + Math.random().toString(36).slice(2, 10);
  }
}

export function PresenceProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [presenceStats, setPresenceStats] = useState({
    totalActive: 1,
    authenticatedCount: isAuthenticated ? 1 : 0,
    anonymousCount: isAuthenticated ? 0 : 1,
    roomCounts: {},
    timestamp: Date.now()
  });

  const [currentView, setCurrentView] = useState('lobby');
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const socketRef = useRef(null);
  const visitorIdRef = useRef(getVisitorId());

  // 1. Initial HTTP fetch of presence statistics
  useEffect(() => {
    const backendUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    fetch(`${backendUrl}/api/presence/stats`)
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.totalActive === 'number') {
          setPresenceStats(data);
        }
      })
      .catch(err => {
        console.warn('Could not fetch initial presence stats:', err.message);
      });
  }, []);

  // 2. Real-time global socket connection for presence tracking
  useEffect(() => {
    const socketEndpoint = import.meta.env.VITE_API_URL || window.location.origin;
    const socket = io(socketEndpoint, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      // Register this visitor connection
      socket.emit('presence-register', {
        visitorId: visitorIdRef.current,
        user: user ? { id: user.id, display_name: user.display_name, username: user.username } : null,
        isAuthenticated: Boolean(user),
        view: currentView,
        roomId: currentRoomId
      });
    });

    socket.on('presence-stats', (stats) => {
      if (stats && typeof stats.totalActive === 'number') {
        setPresenceStats(stats);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // 3. Update server whenever user, auth state, current view, or room changes
  useEffect(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('presence-update', {
        user: user ? { id: user.id, display_name: user.display_name, username: user.username } : null,
        isAuthenticated: Boolean(user),
        view: currentView,
        roomId: currentRoomId
      });
    }
  }, [user, isAuthenticated, currentView, currentRoomId]);

  const updatePresenceView = (view, roomId = null) => {
    setCurrentView(view);
    setCurrentRoomId(roomId);
  };

  const value = {
    totalActive: Math.max(1, presenceStats.totalActive || 1),
    authenticatedCount: presenceStats.authenticatedCount || 0,
    anonymousCount: presenceStats.anonymousCount || 0,
    roomCounts: presenceStats.roomCounts || {},
    updatePresenceView,
    visitorId: visitorIdRef.current,
    presenceSocket: socketRef.current
  };

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
}
