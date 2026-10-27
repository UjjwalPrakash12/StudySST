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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-lg bg-[#141721] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-indigo-950/50"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Create New Study Hall</h2>
            <p className="text-xs text-slate-400">Launch a dedicated focus room with synchronized Pomodoro</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Study Hall Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Distributed Systems & Algorithms Sprint"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#1c202e] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Description / Intended Focus</label>
            <input
              type="text"
              placeholder="e.g. Cameras on, solving Leetcode graph problems & mock interviews"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#1c202e] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const isSelected = category === cat.label;
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setCategory(cat.label)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium border text-left transition-all ${
                      isSelected
                        ? 'bg-indigo-600/25 border-indigo-500 text-white shadow-sm shadow-indigo-500/30'
                        : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Focus Duration (Mins)</label>
              <select
                value={workMins}
                onChange={(e) => setWorkMins(Number(e.target.value))}
                className="w-full bg-[#1c202e] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value={20}>20 Minutes</option>
                <option value={25}>25 Minutes (Classic)</option>
                <option value={45}>45 Minutes (Deep Work)</option>
                <option value={50}>50 Minutes (Ultra Sprint)</option>
                <option value={60}>60 Minutes (Intense)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Break Duration (Mins)</label>
              <select
                value={breakMins}
                onChange={(e) => setBreakMins(Number(e.target.value))}
                className="w-full bg-[#1c202e] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value={3}>3 Minutes</option>
                <option value={5}>5 Minutes (Classic)</option>
                <option value={10}>10 Minutes</option>
                <option value={15}>15 Minutes</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center space-x-1.5 transition-all disabled:opacity-50"
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
