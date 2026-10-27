import React, { useState, useEffect } from 'react';
import { 
  X, Heart, MessageSquare, Trash2, Edit3, Calendar, 
  Send, User, ShieldCheck, Share2, Check
} from 'lucide-react';
import { api } from '../utils/api';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#40382F]/50 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-[#FEFAE0] border border-[rgba(64,56,47,0.14)] rounded-[16px] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-[rgba(64,56,47,0.14)] flex items-center justify-between bg-[#FAEDCD]">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-[6px] bg-[#CCD5AE] text-[#40382F] border border-[rgba(64,56,47,0.1)]">
              {blog?.category || 'Community Blog'}
            </span>
            <span className="text-[#75695A] text-xs">•</span>
            <span className="text-xs text-[#75695A] font-medium">Discussion & Insights</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleShare}
              className="p-1.5 rounded-[8px] text-[#75695A] hover:text-[#40382F] hover:bg-[#E9EDC9] transition-colors"
              title="Copy share link"
            >
              {copiedLink ? <Check className="w-4 h-4 text-[#D4A373]" /> : <Share2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-[8px] text-[#75695A] hover:text-[#40382F] hover:bg-[#E9EDC9] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#D4A373] border-t-transparent"></div>
              <p className="mt-3 text-xs text-[#75695A]">Loading blog post...</p>
            </div>
          ) : error || !blog ? (
            <div className="py-20 text-center text-[#75695A] text-sm">
              {error || 'Blog post not found.'}
            </div>
          ) : (
            <>
              {/* Author & Meta Row */}
              <div className="flex items-center justify-between pb-4 border-b border-[rgba(64,56,47,0.1)]">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-[10px] bg-[#D4A373] text-[#FEFAE0] font-bold flex items-center justify-center text-sm shadow-sm">
                    {blog.author_name ? blog.author_name.charAt(0) : 'U'}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-[#40382F]">{blog.author_name}</span>
                      <span className="text-xs text-[#75695A]">@{blog.author_username}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-[11px] text-[#75695A] mt-0.5">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-[#75695A]" />
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
                        className="px-3 py-1.5 rounded-[8px] bg-[#E9EDC9] hover:bg-[#CCD5AE] text-[#40382F] text-xs font-semibold flex items-center space-x-1 border border-[rgba(64,56,47,0.1)] transition-colors shadow-sm"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#40382F]" />
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
                      className="px-3 py-1.5 rounded-[8px] bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center space-x-1 border border-rose-200 transition-colors shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#40382F] tracking-tight leading-tight">
                {blog.title}
              </h1>

              {/* Cover Image if available */}
              {blog.image_url && (
                <div className="w-full max-h-96 rounded-[12px] overflow-hidden border border-[rgba(64,56,47,0.14)] bg-[#FAEDCD]">
                  <img
                    src={blog.image_url}
                    alt={blog.title}
                    className="w-full object-cover max-h-96"
                  />
                </div>
              )}

              {/* Content Body with clean whitespace & typography */}
              <div className="text-[#40382F] text-sm leading-relaxed whitespace-pre-line space-y-4 font-normal">
                {blog.content}
              </div>

              {/* Like & Interaction Bar */}
              <div className="pt-4 border-t border-[rgba(64,56,47,0.1)] flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleToggleLike}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-[10px] text-xs font-bold border transition-all ${
                      blog.user_has_liked
                        ? 'bg-[#E9EDC9] border-[#D4A373] text-[#D4A373]'
                        : 'bg-[#FAEDCD] border-[rgba(64,56,47,0.14)] text-[#40382F] hover:bg-[#E9EDC9]'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${blog.user_has_liked ? 'fill-[#D4A373] text-[#D4A373]' : ''}`} />
                    <span>{blog.likes_count || 0} Likes</span>
                  </button>

                  <div className="flex items-center space-x-1.5 text-xs text-[#75695A] font-semibold">
                    <MessageSquare className="w-4 h-4 text-[#75695A]" />
                    <span>{blog.comments_count || 0} Comments</span>
                  </div>
                </div>

                <span className="text-[11px] text-[#75695A] font-medium">
                  StudyStream Verified Post
                </span>
              </div>

              {/* Comments Section */}
              <div className="pt-4 border-t border-[rgba(64,56,47,0.1)] space-y-4">
                <h3 className="text-sm font-bold text-[#40382F] flex items-center space-x-2">
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
                    className="flex-1 bg-[#FAEDCD] border border-[rgba(64,56,47,0.14)] rounded-[10px] px-3.5 py-2.5 text-xs text-[#40382F] placeholder-[#9E9080] focus:outline-none focus:border-[#D4A373] focus:ring-1 focus:ring-[#D4A373] disabled:opacity-60 shadow-sm"
                  />
                  <button
                    type="submit"
                    disabled={!isAuthenticated || submittingComment || !commentText.trim()}
                    className="px-5 py-2 rounded-[10px] bg-[#D4A373] hover:bg-[#C59361] disabled:opacity-50 text-[#40382F] text-xs font-bold flex items-center space-x-1.5 transition-all shrink-0 shadow-sm"
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
                          className="p-3.5 bg-[#FAEDCD] border border-[rgba(64,56,47,0.12)] rounded-[12px] flex items-start justify-between gap-3 group shadow-sm"
                        >
                          <div className="flex items-start space-x-2.5">
                            <div className="w-7 h-7 rounded-[6px] bg-[#CCD5AE] text-[#40382F] font-bold flex items-center justify-center text-[10px] border border-[rgba(64,56,47,0.1)] shrink-0">
                              {comment.author_name ? comment.author_name.charAt(0) : 'U'}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-bold text-[#40382F]">
                                  {comment.author_name}
                                </span>
                                <span className="text-[10px] text-[#75695A]">
                                  {new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-xs text-[#40382F] mt-1 leading-relaxed font-normal">
                                {comment.content}
                              </p>
                            </div>
                          </div>

                          {canDelete && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="p-1 rounded-[6px] text-[#75695A] hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete comment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-6 text-center text-xs text-[#75695A]">
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
