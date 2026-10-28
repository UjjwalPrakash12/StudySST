import React from 'react';
import ProfileView from './ProfileView';
import { X } from 'lucide-react';

export default function ProfileModal({ 
  isOpen, 
  onClose, 
  userId, 
  username, 
  onOpenEdit,
  onOpenBlog,
  onJoinRoom 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-5xl bg-[#FEFAE0] dark:bg-[#25291F] border border-[rgba(64,56,47,0.25)] dark:border-[#40382F]/60 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="px-6 py-3.5 bg-[#FAEDCD] dark:bg-[#1E2218] border-b border-[rgba(64,56,47,0.14)] dark:border-[#40382F]/40 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-xs uppercase tracking-wider text-[#40382F] dark:text-[#FEFAE0]">
              Student Scholar Profile
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-[#75695A] hover:text-[#40382F] dark:text-[#A8A29E] dark:hover:text-[#FEFAE0] hover:bg-[#E9EDC9]/50 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Profile Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <ProfileView
            userId={userId}
            username={username}
            onEditProfile={() => {
              onClose();
              if (onOpenEdit) onOpenEdit();
            }}
            onOpenBlog={(blogId) => {
              onClose();
              if (onOpenBlog) onOpenBlog(blogId);
            }}
            onJoinRoom={onJoinRoom}
          />
        </div>
      </div>
    </div>
  );
}
