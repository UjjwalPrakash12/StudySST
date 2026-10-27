import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Bold, Italic, Heading, List, Eye, Edit3, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';

const CATEGORIES = [
  'Study Techniques',
  'Deep Work',
  'Engineering',
  'Productivity',
  'Mindset',
  'Exam Prep',
  'General Discussion'
];

export default function BlogEditorModal({ isOpen, onClose, onBlogCreated, editingBlog = null }) {
  const [title, setTitle] = useState(editingBlog ? editingBlog.title : '');
  const [category, setCategory] = useState(editingBlog ? editingBlog.category : 'Study Techniques');
  const [content, setContent] = useState(editingBlog ? editingBlog.content : '');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(editingBlog && editingBlog.image_url ? editingBlog.image_url : null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [activeTab, setActiveTab] = useState('write'); // 'write' | 'preview'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  if (!isOpen) return null;

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB in size');
      return;
    }

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setError('Supported formats: JPEG, PNG, WebP, GIF');
      return;
    }

    setError('');
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveExistingImage(false);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveExistingImage(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const insertFormatting = (prefix, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = prefix + (selected || 'text') + suffix;

    const nextContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(nextContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + replacement.length - suffix.length);
    }, 10);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a blog title');
      return;
    }
    if (!content.trim()) {
      setError('Please write some content for your blog');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('content', content.trim());
      formData.append('category', category);
      if (imageFile) {
        formData.append('image', imageFile);
      }
      if (removeExistingImage) {
        formData.append('removeImage', 'true');
      }

      let res;
      if (editingBlog) {
        res = await api.updateBlog(editingBlog.id, formData);
      } else {
        res = await api.createBlog(formData);
      }

      onBlogCreated(res.blog);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save blog');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-[#141721] border border-white/10 rounded-sm shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-[#191d2b]">
          <div className="flex items-center space-x-2">
            <Edit3 className="w-4 h-4 text-indigo-400" />
            <h2 className="text-base font-bold text-white">
              {editingBlog ? 'Edit Community Blog' : 'Publish Community Blog'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-sm flex items-center space-x-2 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Tabs: Write vs Preview */}
        <div className="px-5 pt-3 border-b border-white/10 flex items-center space-x-4">
          <button
            type="button"
            onClick={() => setActiveTab('write')}
            className={`pb-2.5 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition-all ${
              activeTab === 'write'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editor</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`pb-2.5 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition-all ${
              activeTab === 'preview'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Live Preview</span>
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {activeTab === 'write' ? (
            <>
              {/* Title & Category Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Blog Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. How I Studied 100 Live Hours and Ranked #1"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#1c202e] border border-white/10 rounded-sm px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#1c202e] border border-white/10 rounded-sm px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cover Image Upload */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Cover Image (Optional - JPG, PNG, WebP &le; 5MB)
                </label>
                
                {imagePreview ? (
                  <div className="relative border border-white/10 rounded-sm overflow-hidden group max-h-52 bg-black/40 flex items-center justify-center">
                    <img
                      src={imagePreview}
                      alt="Cover preview"
                      className="w-full max-h-52 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-sm bg-white/20 hover:bg-white/30 text-white text-xs font-semibold backdrop-blur-sm"
                      >
                        Change Image
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="px-3 py-1.5 rounded-sm bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold backdrop-blur-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/15 hover:border-indigo-500/50 rounded-sm p-4 text-center cursor-pointer transition-colors bg-[#191d2b]/50"
                  >
                    <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                    <span className="text-xs text-indigo-400 font-semibold">Click to upload cover image</span>
                    <p className="text-[10px] text-slate-500 mt-0.5">JPEG, PNG, WebP up to 5MB</p>
                  </div>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>

              {/* Markdown Helper Toolbar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Content *
                  </label>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => insertFormatting('### ')}
                      className="p-1 rounded-sm text-slate-400 hover:text-white hover:bg-white/10"
                      title="Heading"
                    >
                      <Heading className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('**', '**')}
                      className="p-1 rounded-sm text-slate-400 hover:text-white hover:bg-white/10"
                      title="Bold"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('*', '*')}
                      className="p-1 rounded-sm text-slate-400 hover:text-white hover:bg-white/10"
                      title="Italic"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('- ')}
                      className="p-1 rounded-sm text-slate-400 hover:text-white hover:bg-white/10"
                      title="Bullet List"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <textarea
                  ref={textareaRef}
                  required
                  rows={9}
                  placeholder="Share your techniques, insights, reflections, or resources..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-[#1c202e] border border-white/10 rounded-sm p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
                />
              </div>
            </>
          ) : (
            /* Live Preview Tab */
            <div className="space-y-4 py-2">
              {imagePreview && (
                <div className="w-full max-h-60 overflow-hidden rounded-sm border border-white/10">
                  <img src={imagePreview} alt="Preview" className="w-full object-cover max-h-60" />
                </div>
              )}
              <div className="inline-block px-2 py-0.5 rounded-sm bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 text-[10px] font-semibold">
                {category}
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                {title || 'Untitled Blog Post'}
              </h1>
              <div className="prose prose-invert max-w-none text-xs text-slate-300 space-y-2 whitespace-pre-line leading-relaxed">
                {content || 'No content written yet...'}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-sm text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-sm bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all disabled:opacity-50 shadow-md shadow-indigo-600/20"
            >
              {submitting ? 'Publishing...' : editingBlog ? 'Update Blog' : 'Publish Blog'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
