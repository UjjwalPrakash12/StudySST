import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LobbyView from './components/LobbyView';
import FocusRoomView from './components/FocusRoomView';
import AnalyticsView from './components/AnalyticsView';
import LeaderboardView from './components/LeaderboardView';
import BlogCommunityView from './components/BlogCommunityView';
import AuthModal from './components/AuthModal';
import CreateRoomModal from './components/CreateRoomModal';
import { Sparkles, Heart, Shield, Code, Play } from 'lucide-react';

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [currentView, setCurrentView] = useState('lobby'); // 'lobby' | 'room' | 'blogs' | 'analytics' | 'leaderboard'
  const [activeRoom, setActiveRoom] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);

  const handleJoinRoom = (room) => {
    setActiveRoom(room);
    setCurrentView('room');
  };

  const handleLeaveRoom = () => {
    setActiveRoom(null);
    setCurrentView('lobby');
  };

  const handleRoomCreated = (newRoom) => {
    setActiveRoom(newRoom);
    setCurrentView('room');
  };

  return (
    <div className="app-main-wrapper min-h-screen bg-[#FEFAE0] dark:bg-[#25291F] text-[#40382F] dark:text-[#FEFAE0] flex flex-col font-['Inter',sans-serif] transition-colors duration-200">
      {/* Navbar (displayed everywhere except during focused immersion in FocusRoomView) */}
      {currentView !== 'room' && (
        <Navbar
          currentView={currentView}
          setCurrentView={setCurrentView}
          onOpenAuth={() => setIsAuthOpen(true)}
        />
      )}

      {/* Main View Area */}
      <main className="flex-1">
        {currentView === 'lobby' && (
          <LobbyView
            onJoinRoom={handleJoinRoom}
            onOpenCreateRoom={() => {
              if (!isAuthenticated) {
                setIsAuthOpen(true);
              } else {
                setIsCreateRoomOpen(true);
              }
            }}
            onOpenAuth={() => setIsAuthOpen(true)}
            isAuthenticated={isAuthenticated}
          />
        )}

        {currentView === 'blogs' && (
          <BlogCommunityView
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}

        {currentView === 'room' && activeRoom && (
          <FocusRoomView
            room={activeRoom}
            onLeaveRoom={handleLeaveRoom}
          />
        )}

        {currentView === 'analytics' && (
          <AnalyticsView
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}

        {currentView === 'leaderboard' && (
          <LeaderboardView />
        )}
      </main>

      {/* Footer (when not inside room) */}
      {currentView !== 'room' && (
        <footer className="border-t border-[rgba(64,56,47,0.14)] bg-[#FAEDCD] py-8 text-center text-xs text-[#75695A]">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-[#40382F]">StudyStream Live</span>
              <span>— End-Term Software Engineering Project</span>
            </div>
            
            <div className="flex items-center space-x-3 text-[#75695A]">
              <span>WebRTC Peer Mesh</span>
              <span>•</span>
              <span>Unlimited Live Streaming</span>
              <span>•</span>
              <span>WebAudio Synthesizer</span>
              <span>•</span>
              <span>Community Knowledge Hub</span>
            </div>

            <div className="text-[11px] text-[#75695A]">
              Warm aesthetic focus community for scholars worldwide
            </div>
          </div>
        </footer>
      )}

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <CreateRoomModal
        isOpen={isCreateRoomOpen}
        onClose={() => setIsCreateRoomOpen(false)}
        onRoomCreated={handleRoomCreated}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
