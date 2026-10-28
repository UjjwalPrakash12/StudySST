import React, { useState, useEffect, useRef } from 'react';
import { api, getFullImageUrl } from '../utils/api';
import { 
  X, Camera, User, BookOpen, GraduationCap, MapPin, Target, 
  Sparkles, Shield, AlertCircle, CheckCircle2, Loader2, Save,
  Eye, EyeOff, Globe, Award
} from 'lucide-react';

export default function EditProfileModal({ isOpen, onClose, currentUser, onProfileUpdated }) {
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'academic' | 'privacy'
  
  // Form fields
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarSeed, setAvatarSeed] = useState('Felix');
  const [college, setCollege] = useState('');
  const [course, setCourse] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
  const [location, setLocation] = useState('');
  
  // Academic & Goals
  const [academicInterests, setAcademicInterests] = useState('');
  const [subjects, setSubjects] = useState('');
  const [learningGoals, setLearningGoals] = useState('');
  const [skills, setSkills] = useState('');
  const [languages, setLanguages] = useState('');
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(120);

  // Privacy toggles
  const [showCollege, setShowCollege] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [showGoals, setShowGoals] = useState(true);
  const [showLocation, setShowLocation] = useState(true);

  // Avatar upload
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  // Status
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Initial values snapshot for dirty check
  const initialValuesRef = useRef({});

  useEffect(() => {
    if (currentUser && isOpen) {
      const initial = {
        displayName: currentUser.display_name || '',
        bio: currentUser.bio || '',
        avatarSeed: currentUser.avatar_seed || 'Felix',
        college: currentUser.college || '',
        course: currentUser.course || '',
        yearOfStudy: currentUser.year_of_study || '',
        location: currentUser.location || '',
        academicInterests: currentUser.academic_interests || '',
        subjects: currentUser.subjects || '',
        learningGoals: currentUser.learning_goals || '',
        skills: currentUser.skills || '',
        languages: currentUser.languages || '',
        dailyGoalMinutes: currentUser.daily_goal_minutes || 120,
        showCollege: currentUser.show_college !== undefined ? Boolean(currentUser.show_college) : true,
        showStats: currentUser.show_stats !== undefined ? Boolean(currentUser.show_stats) : true,
        showGoals: currentUser.show_goals !== undefined ? Boolean(currentUser.show_goals) : true,
        showLocation: currentUser.show_location !== undefined ? Boolean(currentUser.show_location) : true,
      };

      initialValuesRef.current = initial;
      setDisplayName(initial.displayName);
      setBio(initial.bio);
      setAvatarSeed(initial.avatarSeed);
      setCollege(initial.college);
      setCourse(initial.course);
      setYearOfStudy(initial.yearOfStudy);
      setLocation(initial.location);
      setAcademicInterests(initial.academicInterests);
      setSubjects(initial.subjects);
      setLearningGoals(initial.learningGoals);
      setSkills(initial.skills);
      setLanguages(initial.languages);
      setDailyGoalMinutes(initial.dailyGoalMinutes);
      setShowCollege(initial.showCollege);
      setShowStats(initial.showStats);
      setShowGoals(initial.showGoals);
      setShowLocation(initial.showLocation);

      setAvatarPreview(currentUser.avatar_url ? getFullImageUrl(currentUser.avatar_url) : null);
      setError('');
      setSuccessMessage('');
      setAvatarError('');
      setIsDirty(false);
    }
  }, [currentUser, isOpen]);

  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError('');

    // Client-side validation: formats and max 4MB
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setAvatarError('Only JPEG, PNG, or WebP images are allowed.');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setAvatarError('Profile picture must be under 4 MB.');
      return;
    }

    // Local preview immediately
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload directly to server
    setUploadingAvatar(true);
    try {
      const res = await api.uploadAvatar(file);
      if (res && res.avatarUrl) {
        setAvatarPreview(getFullImageUrl(res.avatarUrl));
        if (onProfileUpdated && res.user) {
          onProfileUpdated(res.user);
        }
        setSuccessMessage('Profile photo updated successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      setAvatarError(err.message || 'Failed to upload photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      const confirmDiscard = window.confirm('You have unsaved changes. Are you sure you want to exit without saving?');
      if (!confirmDiscard) return;
    }
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!displayName.trim()) {
      setError('Display name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatarSeed,
        college: college.trim(),
        course: course.trim(),
        yearOfStudy: yearOfStudy.trim(),
        location: location.trim(),
        academicInterests: academicInterests.trim(),
        subjects: subjects.trim(),
        learningGoals: learningGoals.trim(),
        skills: skills.trim(),
        languages: languages.trim(),
        dailyGoalMinutes: Number(dailyGoalMinutes) || 120,
        showCollege,
        showStats,
        showGoals,
        showLocation,
      };

      const res = await api.updateStudentProfile(payload);
      if (res && res.user) {
        if (onProfileUpdated) {
          onProfileUpdated(res.user);
        }
        setIsDirty(false);
        setSuccessMessage('Profile saved successfully!');
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (err) {
      console.error('Save profile error:', err);
      setError(err.message || 'Failed to save profile changes');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-2xl bg-[#FEFAE0] dark:bg-[#25291F] border border-[rgba(64,56,47,0.25)] dark:border-[#40382F]/60 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#FAEDCD] dark:bg-[#1E2218] border-b border-[rgba(64,56,47,0.14)] dark:border-[#40382F]/40 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-[#D4A373] text-[#FEFAE0] flex items-center justify-center border border-[#40382F]/20 font-bold text-xs">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#40382F] dark:text-[#FEFAE0]">
                Edit Student Profile
              </h2>
              <p className="text-[11px] text-[#75695A] dark:text-[#A8A29E]">
                Personalize your academic identity, goals, and privacy settings
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1 text-[#75695A] hover:text-[#40382F] dark:text-[#A8A29E] dark:hover:text-[#FEFAE0] hover:bg-[#E9EDC9]/50 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[rgba(64,56,47,0.14)] dark:border-[#40382F]/30 bg-[#FAEDCD]/60 dark:bg-[#1E2218]/60 px-6">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === 'general'
                ? 'border-[#D4A373] text-[#40382F] dark:text-[#FEFAE0] bg-[#FEFAE0]/80 dark:bg-[#25291F]'
                : 'border-transparent text-[#75695A] hover:text-[#40382F] dark:text-[#A8A29E]'
            }`}
          >
            <User className="w-3.5 h-3.5 text-[#D4A373]" />
            <span>General Info</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('academic')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === 'academic'
                ? 'border-[#D4A373] text-[#40382F] dark:text-[#FEFAE0] bg-[#FEFAE0]/80 dark:bg-[#25291F]'
                : 'border-transparent text-[#75695A] hover:text-[#40382F] dark:text-[#A8A29E]'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-[#D4A373]" />
            <span>Academic & Goals</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === 'privacy'
                ? 'border-[#D4A373] text-[#40382F] dark:text-[#FEFAE0] bg-[#FEFAE0]/80 dark:bg-[#25291F]'
                : 'border-transparent text-[#75695A] hover:text-[#40382F] dark:text-[#A8A29E]'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-[#D4A373]" />
            <span>Privacy Controls</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-100/90 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-100/90 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: GENERAL INFO */}
          {activeTab === 'general' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Profile Avatar Upload Section */}
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-[#FAEDCD]/60 dark:bg-[#1E2218]/40 border border-[rgba(64,56,47,0.14)] dark:border-[#40382F]/30">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-none overflow-hidden bg-[#D4A373] text-[#FEFAE0] font-black text-2xl flex items-center justify-center border-2 border-[#40382F]/20 shadow-inner">
                    {avatarPreview ? (
                      <img 
                        src={avatarPreview} 
                        alt={displayName || 'Avatar'} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <span>{(displayName || 'S').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[10px] font-bold transition-opacity cursor-pointer"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Camera className="w-5 h-5 mb-0.5" />
                        <span>Change</span>
                      </>
                    )}
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarFileChange}
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                  />
                </div>

                <div className="flex-1 text-center sm:text-left space-y-1">
                  <div className="flex items-center justify-center sm:justify-start space-x-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="px-3 py-1.5 bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] font-bold text-xs border border-[#40382F]/20 transition-all flex items-center space-x-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{uploadingAvatar ? 'Uploading...' : 'Upload Photo'}</span>
                    </button>
                    <span className="text-[10px] text-[#75695A] dark:text-[#A8A29E]">
                      JPG, PNG, WebP up to 4MB
                    </span>
                  </div>
                  {avatarError && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold">{avatarError}</p>
                  )}
                  <p className="text-[11px] text-[#75695A] dark:text-[#A8A29E]">
                    Your profile photo will be shown across StudySST, study rooms, chats, blogs, and leaderboards.
                  </p>
                </div>
              </div>

              {/* Display Name & Bio */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#40382F] dark:text-[#FEFAE0] mb-1">
                    Display Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    maxLength={50}
                    onChange={(e) => { setDisplayName(e.target.value); markDirty(); }}
                    className="w-full px-3 py-2 bg-white dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 text-xs text-[#40382F] dark:text-[#FEFAE0] focus:outline-none focus:border-[#D4A373]"
                    placeholder="E.g. Alex Johnson"
                    required
                  />
                  <div className="flex justify-between mt-1 text-[10px] text-[#75695A] dark:text-[#A8A29E]">
                    <span>Shown on your public profile and in focus halls</span>
                    <span>{displayName.length}/50</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#40382F] dark:text-[#FEFAE0] mb-1">
                    Short Bio
                  </label>
                  <textarea
                    rows={3}
                    value={bio}
                    maxLength={300}
                    onChange={(e) => { setBio(e.target.value); markDirty(); }}
                    className="w-full px-3 py-2 bg-white dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 text-xs text-[#40382F] dark:text-[#FEFAE0] focus:outline-none focus:border-[#D4A373] resize-none"
                    placeholder="Tell other scholars about yourself, your routine, or study philosophy..."
                  />
                  <div className="flex justify-between mt-1 text-[10px] text-[#75695A] dark:text-[#A8A29E]">
                    <span>Max 300 characters</span>
                    <span>{bio.length}/300</span>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-bold text-[#40382F] dark:text-[#FEFAE0] mb-1">
                  Location (Optional)
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-[#75695A]" />
                  <input
                    type="text"
                    value={location}
                    maxLength={100}
                    onChange={(e) => { setLocation(e.target.value); markDirty(); }}
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 text-xs text-[#40382F] dark:text-[#FEFAE0] focus:outline-none focus:border-[#D4A373]"
                    placeholder="City, Country (e.g. New Delhi, India)"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ACADEMIC & GOALS */}
          {activeTab === 'academic' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#40382F] dark:text-[#FEFAE0] mb-1">
                    College / University
                  </label>
                  <input
                    type="text"
                    value={college}
                    maxLength={100}
                    onChange={(e) => { setCollege(e.target.value); markDirty(); }}
                    className="w-full px-3 py-2 bg-white dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 text-xs text-[#40382F] dark:text-[#FEFAE0] focus:outline-none focus:border-[#D4A373]"
                    placeholder="E.g. Stanford University, IIT Delhi"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#40382F] dark:text-[#FEFAE0] mb-1">
                    Course / Degree / Major
                  </label>
                  <input
                    type="text"
                    value={course}
                    maxLength={100}
                    onChange={(e) => { setCourse(e.target.value); markDirty(); }}
                    className="w-full px-3 py-2 bg-white dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 text-xs text-[#40382F] dark:text-[#FEFAE0] focus:outline-none focus:border-[#D4A373]"
                    placeholder="E.g. B.Tech Computer Science, Medicine"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#40382F] dark:text-[#FEFAE0] mb-1">
                    Current Year of Study
                  </label>
                  <select
                    value={yearOfStudy}
                    onChange={(e) => { setYearOfStudy(e.target.value); markDirty(); }}
                    className="w-full px-3 py-2 bg-white dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 text-xs text-[#40382F] dark:text-[#FEFAE0] focus:outline-none focus:border-[#D4A373]"
                  >
                    <option value="">Select current year (optional)</option>
                    <option value="1st Year">1st Year / Freshman</option>
                    <option value="2nd Year">2nd Year / Sophomore</option>
                    <option value="3rd Year">3rd Year / Junior</option>
                    <option value="Final Year">Final Year / Senior</option>
                    <option value="Graduate / Masters">Graduate / Masters Student</option>
                    <option value="PhD / Doctorate">PhD / Doctoral Candidate</option>
                    <option value="Self-Directed Scholar">Self-Directed Scholar / Lifelong Learner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#40382F] dark:text-[#FEFAE0] mb-1">
                    Daily Study Target (Minutes)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={1440}
                    value={dailyGoalMinutes}
                    onChange={(e) => { setDailyGoalMinutes(e.target.value); markDirty(); }}
                    className="w-full px-3 py-2 bg-white dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 text-xs text-[#40382F] dark:text-[#FEFAE0] focus:outline-none focus:border-[#D4A373]"
                    placeholder="120"
                  />
                  <span className="text-[10px] text-[#75695A] dark:text-[#A8A29E] mt-1 block">
                    Equivalent to {(dailyGoalMinutes / 60).toFixed(1)} hours/day
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#40382F] dark:text-[#FEFAE0] mb-1">
                  Subjects Currently Studying
                </label>
                <input
                  type="text"
                  value={subjects}
                  maxLength={300}
                  onChange={(e) => { setSubjects(e.target.value); markDirty(); }}
                  className="w-full px-3 py-2 bg-white dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 text-xs text-[#40382F] dark:text-[#FEFAE0] focus:outline-none focus:border-[#D4A373]"
                  placeholder="Comma separated: Data Structures, Linear Algebra, Machine Learning"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#40382F] dark:text-[#FEFAE0] mb-1">
                  Academic Interests & Topics
                </label>
                <input
                  type="text"
                  value={academicInterests}
                  maxLength={300}
                  onChange={(e) => { setAcademicInterests(e.target.value); markDirty(); }}
                  className="w-full px-3 py-2 bg-white dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 text-xs text-[#40382F] dark:text-[#FEFAE0] focus:outline-none focus:border-[#D4A373]"
                  placeholder="Comma separated: Distributed Systems, Bio-Informatics, Philosophy"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#40382F] dark:text-[#FEFAE0] mb-1">
                  Current Learning Goals
                </label>
                <textarea
                  rows={2}
                  value={learningGoals}
                  maxLength={300}
                  onChange={(e) => { setLearningGoals(e.target.value); markDirty(); }}
                  className="w-full px-3 py-2 bg-white dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 text-xs text-[#40382F] dark:text-[#FEFAE0] focus:outline-none focus:border-[#D4A373] resize-none"
                  placeholder="E.g. Crack GATE 2027, build 3 full-stack projects, read 2 research papers weekly"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#40382F] dark:text-[#FEFAE0] mb-1">
                    Skills Developing
                  </label>
                  <input
                    type="text"
                    value={skills}
                    maxLength={300}
                    onChange={(e) => { setSkills(e.target.value); markDirty(); }}
                    className="w-full px-3 py-2 bg-white dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 text-xs text-[#40382F] dark:text-[#FEFAE0] focus:outline-none focus:border-[#D4A373]"
                    placeholder="Comma separated: Python, React, Deep Learning"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#40382F] dark:text-[#FEFAE0] mb-1">
                    Languages Spoken
                  </label>
                  <input
                    type="text"
                    value={languages}
                    maxLength={200}
                    onChange={(e) => { setLanguages(e.target.value); markDirty(); }}
                    className="w-full px-3 py-2 bg-white dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 text-xs text-[#40382F] dark:text-[#FEFAE0] focus:outline-none focus:border-[#D4A373]"
                    placeholder="Comma separated: English, Hindi, German"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRIVACY CONTROLS */}
          {activeTab === 'privacy' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3 bg-[#CCD5AE]/30 dark:bg-[#2A3022] border border-[#CCD5AE] dark:border-[#40382F]/40 text-xs text-[#40382F] dark:text-[#FEFAE0] flex items-center space-x-2">
                <Shield className="w-4 h-4 text-[#D4A373] flex-shrink-0" />
                <span>
                  Control what information is visible to other scholars on your public profile. Sensitive data (email, passwords) is always protected.
                </span>
              </div>

              <div className="divide-y divide-[rgba(64,56,47,0.1)] dark:divide-[#40382F]/30 bg-white dark:bg-[#1E2218] border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40">
                {/* College visibility */}
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#40382F] dark:text-[#FEFAE0]">
                      Show College, Course & Academic Details
                    </h4>
                    <p className="text-[11px] text-[#75695A] dark:text-[#A8A29E]">
                      Display your university, degree, and study year on your public profile
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showCollege}
                      onChange={(e) => { setShowCollege(e.target.checked); markDirty(); }}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none rounded-none peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-none after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D4A373]"></div>
                  </label>
                </div>

                {/* Stats & Streak visibility */}
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#40382F] dark:text-[#FEFAE0]">
                      Show Study Statistics & Achievements
                    </h4>
                    <p className="text-[11px] text-[#75695A] dark:text-[#A8A29E]">
                      Display verified live study hours, streaks, leaderboard rank, and badges
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showStats}
                      onChange={(e) => { setShowStats(e.target.checked); markDirty(); }}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none rounded-none peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-none after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D4A373]"></div>
                  </label>
                </div>

                {/* Goals visibility */}
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#40382F] dark:text-[#FEFAE0]">
                      Show Learning Goals & Daily Targets
                    </h4>
                    <p className="text-[11px] text-[#75695A] dark:text-[#A8A29E]">
                      Allow other students to view what goals you are working towards
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showGoals}
                      onChange={(e) => { setShowGoals(e.target.checked); markDirty(); }}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none rounded-none peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-none after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D4A373]"></div>
                  </label>
                </div>

                {/* Location visibility */}
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#40382F] dark:text-[#FEFAE0]">
                      Show Location
                    </h4>
                    <p className="text-[11px] text-[#75695A] dark:text-[#A8A29E]">
                      Share your city/country with the global study community
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showLocation}
                      onChange={(e) => { setShowLocation(e.target.checked); markDirty(); }}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none rounded-none peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-none after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D4A373]"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-4 border-t border-[rgba(64,56,47,0.14)] dark:border-[#40382F]/30 flex items-center justify-between">
            <div className="text-[11px] text-[#75695A] dark:text-[#A8A29E]">
              {isDirty ? (
                <span className="text-amber-700 dark:text-amber-400 font-semibold">• Unsaved changes</span>
              ) : (
                <span>All changes synced with cloud</span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                className="px-4 py-2 bg-transparent hover:bg-[#FAEDCD] dark:hover:bg-[#1E2218] text-[#75695A] dark:text-[#A8A29E] font-bold text-xs border border-[rgba(64,56,47,0.2)] dark:border-[#40382F]/40 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] font-bold text-xs border border-[#40382F]/20 transition-all flex items-center space-x-1.5 shadow-sm"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
