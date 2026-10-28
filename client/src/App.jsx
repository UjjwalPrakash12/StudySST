import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PresenceProvider, usePresence } from './context/PresenceContext';
import Navbar from './components/Navbar';
import LobbyView from './components/LobbyView';
import FocusRoomView from './components/FocusRoomView';
import AnalyticsView from './components/AnalyticsView';
import LeaderboardView from './components/LeaderboardView';
import BlogCommunityView from './components/BlogCommunityView';
import AdminView from './components/AdminView';
import AuthModal from './components/AuthModal';
import ProfileView from './components/ProfileView';
import EditProfileModal from './components/EditProfileModal';
import ProfileModal from './components/ProfileModal';
import { Sparkles, Heart, Shield, Code, Play } from 'lucide-react';

class RoomErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('Study room runtime error caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-xl mx-auto my-20 p-8 bg-[#FAEDCD] border border-[rgba(64,56,47,0.2)] text-center">
          <h2 className="text-xl font-bold text-[#40382F] mb-2">Notice: Study Hall Temporarily Unavailable</h2>
          <p className="text-xs text-[#75695A] mb-6">
            An unexpected error occurred while connecting to this study hall.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              this.props.onReset?.();
            }}
            className="px-6 py-2.5 bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] font-bold text-xs border border-[#40382F]/20 transition-all"
          >
            Return to Study Lobby
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { user, isAuthenticated, updateUserState } = useAuth();
  const { updatePresenceView } = usePresence();
  const [currentView, setCurrentView] = useState('lobby'); // 'lobby' | 'room' | 'blogs' | 'analytics' | 'leaderboard' | 'profile'
  const [activeRoom, setActiveRoom] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  
  // Student Profile modal state
  const [selectedProfileUser, setSelectedProfileUser] = useState(null); // identifier (id or username) for quick popup
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // Check URL search params for shared profile link: ?profile=username
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const profileParam = params.get('profile');
      if (profileParam) {
        setSelectedProfileUser(profileParam);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    updatePresenceView(currentView, activeRoom ? activeRoom.id : null);
  }, [currentView, activeRoom]);

  const handleJoinRoom = (room) => {
    setActiveRoom(room);
    setCurrentView('room');
  };

  const handleLeaveRoom = () => {
    setActiveRoom(null);
    setCurrentView('lobby');
  };

  const handleOpenProfile = (identifier) => {
    if (!identifier) return;
    setSelectedProfileUser(identifier);
  };

  return (
    <div className="app-main-wrapper min-h-screen bg-[#FEFAE0] dark:bg-[#25291F] text-[#40382F] dark:text-[#FEFAE0] flex flex-col font-['Inter',sans-serif] transition-colors duration-200">
      {/* Navbar (displayed everywhere except during focused immersion in FocusRoomView) */}
      {currentView !== 'room' && (
        <Navbar
          currentView={currentView}
          setCurrentView={setCurrentView}
          onOpenAuth={() => setIsAuthOpen(true)}
          onOpenEditProfile={() => setIsEditProfileOpen(true)}
        />
      )}

      {/* Main View Area */}
      <main className="flex-1">
        {currentView === 'lobby' && (
          <LobbyView
            onJoinRoom={handleJoinRoom}
            onOpenAuth={() => setIsAuthOpen(true)}
            isAuthenticated={isAuthenticated}
            onOpenProfile={handleOpenProfile}
          />
        )}

        {currentView === 'blogs' && (
          <BlogCommunityView
            onOpenAuth={() => setIsAuthOpen(true)}
            onOpenProfile={handleOpenProfile}
          />
        )}

        {currentView === 'room' && activeRoom && (
          <RoomErrorBoundary onReset={handleLeaveRoom}>
            <FocusRoomView
              room={activeRoom}
              onLeaveRoom={handleLeaveRoom}
              onOpenAuth={() => setIsAuthOpen(true)}
              onOpenProfile={handleOpenProfile}
            />
          </RoomErrorBoundary>
        )}

        {currentView === 'analytics' && (
          <AnalyticsView
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}

        {currentView === 'leaderboard' && (
          <LeaderboardView
            onOpenProfile={handleOpenProfile}
          />
        )}

        {currentView === 'profile' && (
          <ProfileView
            userId={user?.id}
            onEditProfile={() => setIsEditProfileOpen(true)}
            onBack={() => setCurrentView('lobby')}
            onOpenBlog={() => setCurrentView('blogs')}
            onJoinRoom={handleJoinRoom}
          />
        )}

        {currentView === 'admin' && (
          <AdminView
            onJoinRoom={handleJoinRoom}
          />
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

      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        currentUser={user}
        onProfileUpdated={(updatedUser) => {
          updateUserState(updatedUser);
        }}
      />

      <ProfileModal
        isOpen={Boolean(selectedProfileUser)}
        onClose={() => setSelectedProfileUser(null)}
        userId={selectedProfileUser}
        onOpenEdit={() => {
          setSelectedProfileUser(null);
          setIsEditProfileOpen(true);
        }}
        onOpenBlog={() => {
          setSelectedProfileUser(null);
          setCurrentView('blogs');
        }}
        onJoinRoom={(room) => {
          setSelectedProfileUser(null);
          handleJoinRoom(room);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PresenceProvider>
        <AppContent />
      </PresenceProvider>
    </AuthProvider>
  );
}
