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

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB in size');
      return;
    }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#40382F]/70 font-['Inter',sans-serif]">
      <div className="relative w-full max-w-3xl bg-[#FEFAE0] dark:bg-[#25291F] border border-[rgba(64,56,47,0.25)] dark:border-[#555C48] rounded-none shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[rgba(64,56,47,0.2)] dark:border-[#555C48] flex items-center justify-between bg-[#FAEDCD] dark:bg-[#343B2B]">
          <div className="flex items-center space-x-2">
            <Edit3 className="w-4 h-4 text-[#D4A373]" />
            <h2 className="text-base font-bold uppercase tracking-wider text-[#40382F] dark:text-[#FEFAE0]">
              {editingBlog ? 'Edit Community Blog' : 'Publish Community Blog'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-none text-[#75695A] dark:text-[#CCD5AE] hover:text-[#40382F] dark:hover:text-[#FEFAE0] hover:bg-[#E9EDC9] dark:hover:bg-[#454D37] border border-transparent hover:border-[rgba(64,56,47,0.2)] dark:hover:border-[#555C48] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-100 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-none flex items-center space-x-2 text-xs text-rose-800 dark:text-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Tabs: Write vs Preview */}
        <div className="px-6 pt-3 border-b border-[rgba(64,56,47,0.2)] dark:border-[#555C48] flex items-center space-x-4 bg-[#FAEDCD]/40 dark:bg-[#25291F]">
          <button
            type="button"
            onClick={() => setActiveTab('write')}
            className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'write'
                ? 'border-[#D4A373] text-[#40382F] dark:text-[#FEFAE0]'
                : 'border-transparent text-[#75695A] dark:text-[#CCD5AE] hover:text-[#40382F] dark:hover:text-[#FEFAE0]'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editor</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'preview'
                ? 'border-[#D4A373] text-[#40382F] dark:text-[#FEFAE0]'
                : 'border-transparent text-[#75695A] dark:text-[#CCD5AE] hover:text-[#40382F] dark:hover:text-[#FEFAE0]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Live Preview</span>
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {activeTab === 'write' ? (
            <>
              {/* Title & Category Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#40382F] dark:text-[#FEFAE0] mb-1">
                    Blog Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. How I Studied 100 Live Hours and Ranked #1"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#FAEDCD] dark:bg-[#343B2B] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none px-3.5 py-2.5 text-xs text-[#40382F] dark:text-[#FEFAE0] placeholder-[#9E9080] dark:placeholder-[#CCD5AE]/60 focus:outline-none focus:border-[#D4A373]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#40382F] dark:text-[#FEFAE0] mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#FAEDCD] dark:bg-[#343B2B] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none px-3 py-2.5 text-xs text-[#40382F] dark:text-[#FEFAE0] focus:outline-none focus:border-[#D4A373]"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c} className="bg-[#FAEDCD] dark:bg-[#343B2B] text-[#40382F] dark:text-[#FEFAE0]">{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cover Image Upload */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#40382F] dark:text-[#FEFAE0] mb-1">
                  Cover Image (Optional - JPG, PNG, WebP &le; 5MB)
                </label>
                
                {imagePreview ? (
                  <div className="relative border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none overflow-hidden group max-h-52 bg-[#FAEDCD] dark:bg-[#343B2B] flex items-center justify-center">
                    <img
                      src={imagePreview}
                      alt="Cover preview"
                      className="w-full max-h-52 object-cover"
                    />
                    <div className="absolute inset-0 bg-[#40382F]/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3.5 py-1.5 rounded-none bg-[#FEFAE0] dark:bg-[#25291F] text-[#40382F] dark:text-[#FEFAE0] text-xs font-bold uppercase tracking-wider border border-[rgba(64,56,47,0.2)]"
                      >
                        Change Image
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="px-3.5 py-1.5 rounded-none bg-rose-600 text-white text-xs font-bold uppercase tracking-wider"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-dashed border-[#40382F]/30 dark:border-[#555C48] hover:border-[#D4A373] rounded-none p-5 text-center cursor-pointer transition-colors bg-[#FAEDCD]/50 dark:bg-[#343B2B]/50"
                  >
                    <Upload className="w-5 h-5 mx-auto text-[#75695A] dark:text-[#CCD5AE] mb-1" />
                    <span className="text-xs text-[#D4A373] font-bold uppercase tracking-wider">Click to upload cover image</span>
                    <p className="text-[10px] text-[#75695A] dark:text-[#CCD5AE] font-mono mt-0.5">JPEG, PNG, WebP up to 5MB</p>
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

              {/* Formatting Toolbar & Content Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#40382F] dark:text-[#FEFAE0]">
                    Content *
                  </label>
                  <div className="flex items-center space-x-1 bg-[#FAEDCD] dark:bg-[#343B2B] p-0.5 rounded-none border border-[rgba(64,56,47,0.2)] dark:border-[#555C48]">
                    <button
                      type="button"
                      onClick={() => insertFormatting('### ')}
                      className="p-1 rounded-none text-[#75695A] dark:text-[#CCD5AE] hover:text-[#40382F] dark:hover:text-[#FEFAE0] hover:bg-[#E9EDC9] dark:hover:bg-[#454D37]"
                      title="Heading"
                    >
                      <Heading className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('**', '**')}
                      className="p-1 rounded-none text-[#75695A] dark:text-[#CCD5AE] hover:text-[#40382F] dark:hover:text-[#FEFAE0] hover:bg-[#E9EDC9] dark:hover:bg-[#454D37]"
                      title="Bold"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('*', '*')}
                      className="p-1 rounded-none text-[#75695A] dark:text-[#CCD5AE] hover:text-[#40382F] dark:hover:text-[#FEFAE0] hover:bg-[#E9EDC9] dark:hover:bg-[#454D37]"
                      title="Italic"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('- ')}
                      className="p-1 rounded-none text-[#75695A] dark:text-[#CCD5AE] hover:text-[#40382F] dark:hover:text-[#FEFAE0] hover:bg-[#E9EDC9] dark:hover:bg-[#454D37]"
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
                  className="w-full bg-[#FAEDCD] dark:bg-[#343B2B] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none p-3 text-xs text-[#40382F] dark:text-[#FEFAE0] placeholder-[#9E9080] dark:placeholder-[#CCD5AE]/60 focus:outline-none focus:border-[#D4A373] font-mono leading-relaxed"
                />
              </div>
            </>
          ) : (
            /* Live Preview Tab */
            <div className="space-y-4 py-2">
              {imagePreview && (
                <div className="w-full max-h-60 overflow-hidden rounded-none border border-[rgba(64,56,47,0.2)] dark:border-[#555C48]">
                  <img src={imagePreview} alt="Preview" className="w-full object-cover max-h-60" />
                </div>
              )}
              <div className="inline-block px-2.5 py-0.5 rounded-none bg-[#E9EDC9] dark:bg-[#343B2B] text-[#40382F] dark:text-[#FEFAE0] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] text-[10px] font-bold uppercase tracking-wider">
                {category}
              </div>
              <h1 className="text-xl font-black text-[#40382F] dark:text-[#FEFAE0] tracking-tight">
                {title || 'Untitled Blog Post'}
              </h1>
              <div className="text-xs text-[#40382F] dark:text-[#FEFAE0] space-y-2 whitespace-pre-line leading-relaxed">
                {content || 'No content written yet...'}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[rgba(64,56,47,0.2)] dark:border-[#555C48] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-none text-xs font-bold uppercase tracking-wider text-[#75695A] dark:text-[#CCD5AE] hover:text-[#40382F] dark:hover:text-[#FEFAE0] hover:bg-[#FAEDCD] dark:hover:bg-[#343B2B] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-none bg-[#D4A373] hover:bg-[#C59361] dark:bg-[#A66F3F] dark:hover:bg-[#D4A373] text-[#40382F] dark:text-[#FEFAE0] text-xs font-bold uppercase tracking-wider border border-[rgba(64,56,47,0.25)] dark:border-[#555C48] transition-colors disabled:opacity-50"
            >
              {submitting ? 'Publishing...' : editingBlog ? 'Update Blog' : 'Publish Blog'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
