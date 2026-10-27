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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-[#141721] border border-white/10 rounded-sm shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header Bar */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-[#191d2b]">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-sm bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
              {blog?.category || 'Community Blog'}
            </span>
            <span className="text-slate-500 text-xs">•</span>
            <span className="text-xs text-slate-400">Discussion & Insights</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleShare}
              className="p-1.5 rounded-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Copy share link"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
              <p className="mt-3 text-xs text-slate-400">Loading blog post...</p>
            </div>
          ) : error || !blog ? (
            <div className="py-20 text-center text-slate-400 text-sm">
              {error || 'Blog post not found.'}
            </div>
          ) : (
            <>
              {/* Author & Meta Row */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-sm bg-gradient-to-tr from-indigo-600 to-pink-600 text-white font-bold flex items-center justify-center text-sm shadow">
                    {blog.author_name ? blog.author_name.charAt(0) : 'U'}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-white">{blog.author_name}</span>
                      <span className="text-xs text-slate-400">@{blog.author_username}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>{new Date(blog.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Edit / Delete actions for Author / Admin */}
                {(isAuthor || isAdmin) && (
                  <div className="flex items-center space-x-1">
                    {isAuthor && (
                      <button
                        onClick={() => {
                          onEditBlog(blog);
                          onClose();
                        }}
                        className="px-2.5 py-1.5 rounded-sm bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold flex items-center space-x-1 border border-white/10 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
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
                      className="px-2.5 py-1.5 rounded-sm bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold flex items-center space-x-1 border border-rose-500/30 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                {blog.title}
              </h1>

              {/* Cover Image if available */}
              {blog.image_url && (
                <div className="w-full max-h-96 rounded-sm overflow-hidden border border-white/10 bg-black/30">
                  <img
                    src={blog.image_url}
                    alt={blog.title}
                    className="w-full object-cover max-h-96"
                  />
                </div>
              )}

              {/* Content Body with clean whitespace & formatting */}
              <div className="text-slate-200 text-sm leading-relaxed whitespace-pre-line space-y-4 font-normal">
                {blog.content}
              </div>

              {/* Like & Interaction Bar */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleToggleLike}
                    className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-sm text-xs font-semibold border transition-all ${
                      blog.user_has_liked
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${blog.user_has_liked ? 'fill-rose-500 text-rose-500' : ''}`} />
                    <span>{blog.likes_count || 0} Likes</span>
                  </button>

                  <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                    <MessageSquare className="w-4 h-4 text-slate-400" />
                    <span>{blog.comments_count || 0} Comments</span>
                  </div>
                </div>

                <span className="text-[11px] text-slate-500">
                  StudyStream Verified Post
                </span>
              </div>

              {/* Comments Section */}
              <div className="pt-4 border-t border-white/10 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
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
                    className="flex-1 bg-[#1c202e] border border-white/10 rounded-sm px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={!isAuthenticated || submittingComment || !commentText.trim()}
                    className="px-4 py-2 rounded-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shrink-0"
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
                          className="p-3 bg-[#191d2b] border border-white/5 rounded-sm flex items-start justify-between gap-3 group"
                        >
                          <div className="flex items-start space-x-2.5">
                            <div className="w-7 h-7 rounded-sm bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center text-[10px] border border-indigo-500/25 shrink-0">
                              {comment.author_name ? comment.author_name.charAt(0) : 'U'}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-semibold text-white">
                                  {comment.author_name}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                {comment.content}
                              </p>
                            </div>
                          </div>

                          {canDelete && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="p-1 rounded-sm text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete comment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-500">
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
