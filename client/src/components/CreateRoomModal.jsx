import React, { useState } from 'react';
import { X, Plus, Sparkles, BookOpen, Coffee, Cpu, Stethoscope, Palette } from 'lucide-react';
import { api } from '../utils/api';

const CATEGORIES = [
  { label: 'Silent Study', icon: BookOpen },
  { label: 'Lofi & Casual', icon: Coffee },
  { label: 'Engineering & STEM', icon: Cpu },
  { label: 'Medical & Science', icon: Stethoscope },
  { label: 'Creativity & Arts', icon: Palette },
];

export default function CreateRoomModal({ isOpen, onClose, onRoomCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Engineering & STEM');
  const [workMins, setWorkMins] = useState(25);
  const [breakMins, setBreakMins] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Room name is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await api.createRoom({
        name,
        description,
        category,
        pomodoroWorkMins: workMins,
        pomodoroBreakMins: breakMins,
      });
      onRoomCreated(res.room);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create room');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#40382F]/70 font-['Inter',sans-serif]">
      <div 
        className="relative w-full max-w-lg bg-[#FEFAE0] dark:bg-[#25291F] border border-[rgba(64,56,47,0.25)] dark:border-[#555C48] rounded-none p-6 sm:p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#75695A] dark:text-[#CCD5AE] hover:text-[#40382F] dark:hover:text-[#FEFAE0] rounded-none hover:bg-[#FAEDCD] dark:hover:bg-[#343B2B] border border-transparent hover:border-[rgba(64,56,47,0.2)] dark:hover:border-[#555C48] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-none bg-[#E9EDC9] dark:bg-[#343B2B] text-[#40382F] dark:text-[#FEFAE0] flex items-center justify-center border border-[rgba(64,56,47,0.2)] dark:border-[#555C48]">
            <Sparkles className="w-5 h-5 text-[#D4A373]" />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#40382F] dark:text-[#FEFAE0]">Create New Study Hall</h2>
            <p className="text-xs text-[#75695A] dark:text-[#CCD5AE]">Launch a dedicated focus room with synchronized Pomodoro</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-none bg-rose-100 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#40382F] dark:text-[#FEFAE0] mb-1.5">Study Hall Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Distributed Systems & Algorithms Sprint"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#FAEDCD] dark:bg-[#343B2B] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none px-4 py-2.5 text-xs text-[#40382F] dark:text-[#FEFAE0] placeholder-[#9E9080] dark:placeholder-[#CCD5AE]/60 focus:outline-none focus:border-[#D4A373]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#40382F] dark:text-[#FEFAE0] mb-1.5">Description / Intended Focus</label>
            <input
              type="text"
              placeholder="e.g. Cameras on, solving Leetcode graph problems & mock interviews"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#FAEDCD] dark:bg-[#343B2B] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none px-4 py-2.5 text-xs text-[#40382F] dark:text-[#FEFAE0] placeholder-[#9E9080] dark:placeholder-[#CCD5AE]/60 focus:outline-none focus:border-[#D4A373]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#40382F] dark:text-[#FEFAE0] mb-2">Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const isSelected = category === cat.label;
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setCategory(cat.label)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-none text-xs font-bold uppercase tracking-wider border text-left transition-colors ${
                      isSelected
                        ? 'bg-[#CCD5AE] dark:bg-[#454D37] border-[#40382F] dark:border-[#FEFAE0] text-[#40382F] dark:text-[#FEFAE0]'
                        : 'bg-[#FAEDCD] dark:bg-[#343B2B] border-[rgba(64,56,47,0.2)] dark:border-[#555C48] text-[#75695A] dark:text-[#CCD5AE] hover:bg-[#E9EDC9] dark:hover:bg-[#454D37] hover:text-[#40382F] dark:hover:text-[#FEFAE0]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 text-[#D4A373] flex-shrink-0" />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#40382F] dark:text-[#FEFAE0] mb-1.5">Focus Duration (Mins)</label>
              <select
                value={workMins}
                onChange={(e) => setWorkMins(Number(e.target.value))}
                className="w-full bg-[#FAEDCD] dark:bg-[#343B2B] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none px-3 py-2 text-xs text-[#40382F] dark:text-[#FEFAE0] focus:outline-none focus:border-[#D4A373]"
              >
                <option value={20} className="bg-[#FAEDCD] dark:bg-[#343B2B]">20 Minutes</option>
                <option value={25} className="bg-[#FAEDCD] dark:bg-[#343B2B]">25 Minutes (Classic)</option>
                <option value={45} className="bg-[#FAEDCD] dark:bg-[#343B2B]">45 Minutes (Deep Work)</option>
                <option value={50} className="bg-[#FAEDCD] dark:bg-[#343B2B]">50 Minutes (Ultra Sprint)</option>
                <option value={60} className="bg-[#FAEDCD] dark:bg-[#343B2B]">60 Minutes (Intense)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#40382F] dark:text-[#FEFAE0] mb-1.5">Break Duration (Mins)</label>
              <select
                value={breakMins}
                onChange={(e) => setBreakMins(Number(e.target.value))}
                className="w-full bg-[#FAEDCD] dark:bg-[#343B2B] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none px-3 py-2 text-xs text-[#40382F] dark:text-[#FEFAE0] focus:outline-none focus:border-[#D4A373]"
              >
                <option value={3} className="bg-[#FAEDCD] dark:bg-[#343B2B]">3 Minutes</option>
                <option value={5} className="bg-[#FAEDCD] dark:bg-[#343B2B]">5 Minutes (Classic)</option>
                <option value={10} className="bg-[#FAEDCD] dark:bg-[#343B2B]">10 Minutes</option>
                <option value={15} className="bg-[#FAEDCD] dark:bg-[#343B2B]">15 Minutes</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-[rgba(64,56,47,0.2)] dark:border-[#555C48] flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-none text-xs font-bold uppercase tracking-wider text-[#75695A] dark:text-[#CCD5AE] hover:text-[#40382F] dark:hover:text-[#FEFAE0] hover:bg-[#FAEDCD] dark:hover:bg-[#343B2B] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-none bg-[#D4A373] hover:bg-[#c99563] dark:bg-[#A66F3F] dark:hover:bg-[#D4A373] text-[#40382F] dark:text-[#FEFAE0] text-xs font-bold uppercase tracking-wider border border-[rgba(64,56,47,0.25)] dark:border-[#555C48] flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{submitting ? 'Creating...' : 'Create Study Hall'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
