import React, { useState, useEffect } from 'react';
import { 
  X, Heart, MessageSquare, Trash2, Edit3, Calendar, 
  Send, User, ShieldCheck, Share2, Check
} from 'lucide-react';
import { api, getFullImageUrl } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function BlogDetailModal({ 
  blogId, 
  isOpen, 
  onClose, 
  onEditBlog, 
  onDeleteBlog,
  onOpenAuth 
}) {
  const { user, isAuthenticated } = useAuth();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [error, setError] = useState('');

  const loadBlogDetails = async () => {
    if (!blogId) return;
    setLoading(true);
    try {
      const res = await api.getBlog(blogId);
      setBlog(res.blog);
    } catch (err) {
      console.error('Failed to load blog:', err);
      setError(err.message || 'Failed to load blog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && blogId) {
      loadBlogDetails();
    } else {
      setBlog(null);
      setCommentText('');
    }
  }, [isOpen, blogId]);

  if (!isOpen) return null;

  const handleToggleLike = async () => {
    if (!isAuthenticated) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    try {
      const res = await api.toggleBlogLike(blog.id);
      setBlog(prev => ({
        ...prev,
        likes_count: res.likes_count,
        user_has_liked: res.liked
      }));
    } catch (err) {
      console.error('Like toggle error:', err);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    try {
      const res = await api.addBlogComment(blog.id, commentText.trim());
      setBlog(prev => ({
        ...prev,
        comments_count: (prev.comments_count || 0) + 1,
        comments: [res.comment, ...(prev.comments || [])]
      }));
      setCommentText('');
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await api.deleteBlogComment(blog.id, commentId);
      setBlog(prev => ({
        ...prev,
        comments_count: Math.max(0, (prev.comments_count || 1) - 1),
        comments: (prev.comments || []).filter(c => c.id !== commentId)
      }));
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const isAuthor = user && blog && user.id === blog.author_id;
  const isAdmin = user && user.role === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#40382F]/70 font-['Inter',sans-serif]">
      <div className="relative w-full max-w-3xl bg-[#FEFAE0] dark:bg-[#25291F] border border-[rgba(64,56,47,0.25)] dark:border-[#555C48] rounded-none shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-[rgba(64,56,47,0.2)] dark:border-[#555C48] flex items-center justify-between bg-[#FAEDCD] dark:bg-[#343B2B]">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-none bg-[#CCD5AE] dark:bg-[#454D37] text-[#40382F] dark:text-[#FEFAE0] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] uppercase tracking-wider">
              {blog?.category || 'Community Blog'}
            </span>
            <span className="text-[#75695A] dark:text-[#CCD5AE] text-xs">•</span>
            <span className="text-xs text-[#75695A] dark:text-[#CCD5AE] font-semibold uppercase tracking-wider">Discussion & Insights</span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={handleShare}
              className="p-1.5 rounded-none text-[#75695A] dark:text-[#CCD5AE] hover:text-[#40382F] dark:hover:text-[#FEFAE0] hover:bg-[#E9EDC9] dark:hover:bg-[#454D37] border border-transparent hover:border-[rgba(64,56,47,0.2)] dark:hover:border-[#555C48] transition-colors"
              title="Copy share link"
            >
              {copiedLink ? <Check className="w-4 h-4 text-[#D4A373]" /> : <Share2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-none text-[#75695A] dark:text-[#CCD5AE] hover:text-[#40382F] dark:hover:text-[#FEFAE0] hover:bg-[#E9EDC9] dark:hover:bg-[#454D37] border border-transparent hover:border-[rgba(64,56,47,0.2)] dark:hover:border-[#555C48] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin rounded-none h-8 w-8 border-4 border-[#D4A373] border-t-transparent"></div>
              <p className="mt-3 text-xs text-[#75695A] dark:text-[#CCD5AE] font-mono uppercase tracking-wider">Loading blog post...</p>
            </div>
          ) : error || !blog ? (
            <div className="py-20 text-center text-[#75695A] dark:text-[#CCD5AE] text-sm">
              {error || 'Blog post not found.'}
            </div>
          ) : (
            <>
              {/* Author & Meta Row */}
              <div className="flex items-center justify-between pb-4 border-b border-[rgba(64,56,47,0.2)] dark:border-[#555C48]">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-none bg-[#D4A373] dark:bg-[#A66F3F] text-[#FEFAE0] font-bold flex items-center justify-center text-sm border border-[rgba(64,56,47,0.2)] dark:border-[#555C48]">
                    {blog.author_name ? blog.author_name.charAt(0) : 'U'}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-[#40382F] dark:text-[#FEFAE0]">{blog.author_name}</span>
                      <span className="text-xs text-[#75695A] dark:text-[#CCD5AE]">@{blog.author_username}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-[11px] text-[#75695A] dark:text-[#CCD5AE] mt-0.5">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-[#75695A] dark:text-[#CCD5AE]" />
                        <span>{new Date(blog.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Edit / Delete actions for Author / Admin */}
                {(isAuthor || isAdmin) && (
                  <div className="flex items-center space-x-2">
                    {isAuthor && (
                      <button
                        onClick={() => {
                          onEditBlog(blog);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-none bg-[#E9EDC9] dark:bg-[#343B2B] hover:bg-[#CCD5AE] dark:hover:bg-[#454D37] text-[#40382F] dark:text-[#FEFAE0] text-xs font-bold uppercase tracking-wider flex items-center space-x-1 border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#40382F] dark:text-[#FEFAE0]" />
                        <span>Edit</span>
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        if (window.confirm('Are you sure you want to delete this blog?')) {
                          await onDeleteBlog(blog.id);
                          onClose();
                        }
                      }}
                      className="px-3 py-1.5 rounded-none bg-rose-100 dark:bg-rose-950/40 hover:bg-rose-200 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-300 text-xs font-bold uppercase tracking-wider flex items-center space-x-1 border border-rose-300 dark:border-rose-800 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl sm:text-3xl font-black text-[#40382F] dark:text-[#FEFAE0] tracking-tight leading-tight">
                {blog.title}
              </h1>

              {/* Cover Image if available */}
              {blog.image_url && (
                <div className="w-full max-h-96 rounded-none overflow-hidden border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] bg-[#FAEDCD] dark:bg-[#25291F]">
                  <img
                    src={getFullImageUrl(blog.image_url)}
                    alt={blog.title}
                    className="w-full object-cover max-h-96"
                  />
                </div>
              )}

              {/* Content Body with clean whitespace & typography */}
              <div className="text-[#40382F] dark:text-[#FEFAE0] text-sm leading-relaxed whitespace-pre-line space-y-4 font-normal">
                {blog.content}
              </div>

              {/* Like & Interaction Bar */}
              <div className="pt-4 border-t border-[rgba(64,56,47,0.2)] dark:border-[#555C48] flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleToggleLike}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-none text-xs font-bold uppercase tracking-wider border transition-colors ${
                      blog.user_has_liked
                        ? 'bg-[#E9EDC9] dark:bg-[#343B2B] border-[#D4A373] text-[#D4A373]'
                        : 'bg-[#FAEDCD] dark:bg-[#343B2B] border-[rgba(64,56,47,0.2)] dark:border-[#555C48] text-[#40382F] dark:text-[#FEFAE0] hover:bg-[#E9EDC9] dark:hover:bg-[#454D37]'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${blog.user_has_liked ? 'fill-[#D4A373] text-[#D4A373]' : ''}`} />
                    <span>{blog.likes_count || 0} Likes</span>
                  </button>

                  <div className="flex items-center space-x-1.5 text-xs text-[#75695A] dark:text-[#CCD5AE] font-semibold">
                    <MessageSquare className="w-4 h-4 text-[#75695A] dark:text-[#CCD5AE]" />
                    <span>{blog.comments_count || 0} Comments</span>
                  </div>
                </div>

                <span className="text-[11px] text-[#75695A] dark:text-[#CCD5AE] font-mono uppercase tracking-wider">
                  StudyStream Verified Post
                </span>
              </div>

              {/* Comments Section */}
              <div className="pt-4 border-t border-[rgba(64,56,47,0.2)] dark:border-[#555C48] space-y-4">
                <h3 className="text-sm font-bold text-[#40382F] dark:text-[#FEFAE0] flex items-center space-x-2 uppercase tracking-wider">
                  <MessageSquare className="w-4 h-4 text-[#D4A373]" />
                  <span>Discussion ({blog.comments?.length || 0})</span>
                </h3>

                {/* Add Comment Input */}
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder={isAuthenticated ? "Write a thoughtful comment..." : "Sign in to join the discussion"}
                    value={commentText}
                    disabled={!isAuthenticated || submittingComment}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="flex-1 bg-[#FAEDCD] dark:bg-[#343B2B] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none px-3.5 py-2 text-xs text-[#40382F] dark:text-[#FEFAE0] placeholder-[#9E9080] dark:placeholder-[#CCD5AE]/60 focus:outline-none focus:border-[#D4A373] disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={!isAuthenticated || submittingComment || !commentText.trim()}
                    className="px-5 py-2 rounded-none bg-[#D4A373] hover:bg-[#C59361] dark:bg-[#A66F3F] dark:hover:bg-[#D4A373] disabled:opacity-50 text-[#40382F] dark:text-[#FEFAE0] text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 border border-[rgba(64,56,47,0.25)] dark:border-[#555C48] transition-colors shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Comment</span>
                  </button>
                </form>

                {/* Comments List */}
                <div className="space-y-3 pt-2">
                  {blog.comments && blog.comments.length > 0 ? (
                    blog.comments.map(comment => {
                      const isCommentAuthor = user && user.id === comment.user_id;
                      const canDelete = isCommentAuthor || isAuthor || isAdmin;

                      return (
                        <div
                          key={comment.id}
                          className="p-3.5 bg-[#FAEDCD] dark:bg-[#343B2B] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] rounded-none flex items-start justify-between gap-3 group"
                        >
                          <div className="flex items-start space-x-2.5">
                            <div className="w-7 h-7 rounded-none bg-[#CCD5AE] dark:bg-[#454D37] text-[#40382F] dark:text-[#FEFAE0] font-bold flex items-center justify-center text-[10px] border border-[rgba(64,56,47,0.2)] dark:border-[#555C48] shrink-0">
                              {comment.author_name ? comment.author_name.charAt(0) : 'U'}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-bold text-[#40382F] dark:text-[#FEFAE0]">
                                  {comment.author_name}
                                </span>
                                <span className="text-[10px] text-[#75695A] dark:text-[#CCD5AE] font-mono">
                                  {new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-xs text-[#40382F] dark:text-[#FEFAE0] mt-1 leading-relaxed font-normal">
                                {comment.content}
                              </p>
                            </div>
                          </div>

                          {canDelete && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="p-1 rounded-none text-[#75695A] dark:text-[#CCD5AE] hover:text-rose-600 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete comment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-6 text-center text-xs text-[#75695A] dark:text-[#CCD5AE] font-mono">
                      No comments yet. Start the conversation!
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
