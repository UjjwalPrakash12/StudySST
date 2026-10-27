import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Edit3, Search, Heart, MessageSquare, Plus, 
  Calendar, User, ArrowRight, Filter, TrendingUp, Sparkles, AlertCircle
} from 'lucide-react';
import { api, getFullImageUrl } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import BlogEditorModal from './BlogEditorModal';
import BlogDetailModal from './BlogDetailModal';

const CATEGORIES = [
  'All',
  'Study Techniques',
  'Deep Work',
  'Engineering',
  'Productivity',
  'Mindset',
  'Exam Prep'
];

export default function BlogCommunityView({ onOpenAuth }) {
  const { user, isAuthenticated } = useAuth();
  
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('latest'); // 'latest' | 'likes' | 'comments'

  // Modals
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState(null);
  const [selectedBlogId, setSelectedBlogId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchBlogs = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.getBlogs({
        search: searchQuery.trim(),
        category: selectedCategory === 'All' ? '' : selectedCategory,
        sort: sortBy,
        page,
        limit: 9
      });
      setBlogs(res.blogs || []);
      setTotalCount(res.total || 0);
      setCurrentPage(res.page || 1);
      setTotalPages(res.pages || 1);
    } catch (err) {
      console.error('Failed to fetch blogs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogs(1);
  }, [selectedCategory, sortBy]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchBlogs(1);
  };

  const handleOpenEditor = (blogToEdit = null) => {
    if (!isAuthenticated) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    setEditingBlog(blogToEdit);
    setEditorOpen(true);
  };

  const handleOpenDetail = (blogId) => {
    setSelectedBlogId(blogId);
    setDetailOpen(true);
  };

  const handleBlogCreated = () => {
    fetchBlogs(1);
  };

  const handleDeleteBlog = async (id) => {
    try {
      await api.deleteBlog(id);
      setBlogs(prev => prev.filter(b => b.id !== id));
      setTotalCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to delete blog:', err);
    }
  };

  const handleToggleLike = async (e, blogId) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    try {
      const res = await api.toggleBlogLike(blogId);
      setBlogs(prev => prev.map(b => {
        if (b.id === blogId) {
          return {
            ...b,
            likes_count: res.likes_count,
            user_has_liked: res.liked
          };
        }
        return b;
      }));
    } catch (err) {
      console.error('Like toggle error:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Header & Write CTA */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 pb-6 border-b border-[rgba(64,56,47,0.14)]">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-[10px] bg-[#E9EDC9] border border-[rgba(64,56,47,0.12)] text-[#40382F] text-xs font-semibold mb-3 shadow-sm">
            <BookOpen className="w-3.5 h-3.5 text-[#D4A373]" />
            <span>Community Knowledge Hub</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#40382F] tracking-tight">Study & Engineering Blogs</h1>
          <p className="text-xs sm:text-sm text-[#75695A] mt-1 max-w-xl font-normal">
            Read techniques, deep-work habits, exam roadmaps, and reflections shared by members of the StudyStream live community.
          </p>
        </div>

        <button
          onClick={() => handleOpenEditor()}
          className="flex items-center justify-center space-x-2 px-5 py-2.5 rounded-[10px] bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] text-xs font-bold transition-all shadow-sm shrink-0 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 text-[#40382F]" />
          <span>Write a Blog</span>
        </button>
      </div>

      {/* Discovery Filters Bar */}
      <div className="space-y-4 mb-8">
        
        {/* Search & Sort Row */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#75695A]" />
            <input
              type="text"
              placeholder="Search blogs by title, topic, or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FAEDCD] border border-[rgba(64,56,47,0.14)] rounded-[10px] pl-10 pr-4 py-2 text-xs text-[#40382F] placeholder-[#9E9080] focus:outline-none focus:border-[#D4A373] focus:ring-1 focus:ring-[#D4A373] shadow-sm transition-all"
            />
          </form>

          {/* Sort Tabs */}
          <div className="flex items-center space-x-1 p-1 bg-[#FAEDCD] border border-[rgba(64,56,47,0.14)] rounded-[10px] self-stretch sm:self-auto justify-center shadow-sm">
            {[
              { id: 'latest', label: 'Latest' },
              { id: 'likes', label: 'Most Liked' },
              { id: 'comments', label: 'Most Discussed' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSortBy(tab.id)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-[8px] transition-all ${
                  sortBy === tab.id
                    ? 'bg-[#CCD5AE] text-[#40382F] shadow-sm border border-[rgba(64,56,47,0.1)]'
                    : 'text-[#75695A] hover:text-[#40382F]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-[10px] text-xs font-semibold whitespace-nowrap border transition-all ${
                selectedCategory === cat
                  ? 'bg-[#D4A373] text-[#40382F] border-[#D4A373] shadow-sm font-bold'
                  : 'bg-[#FAEDCD] border-[rgba(64,56,47,0.14)] text-[#75695A] hover:bg-[#E9EDC9] hover:text-[#40382F]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Blog Cards Grid */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#D4A373] border-t-transparent"></div>
          <p className="mt-3 text-xs text-[#75695A] font-medium">Loading community blogs...</p>
        </div>
      ) : blogs.length === 0 ? (
        <div className="py-20 text-center bg-[#FAEDCD] border border-[rgba(64,56,47,0.14)] rounded-[16px] p-8 shadow-sm">
          <BookOpen className="w-10 h-10 mx-auto text-[#75695A] mb-3" />
          <h3 className="text-base font-bold text-[#40382F] mb-1">No blogs found</h3>
          <p className="text-xs text-[#75695A] max-w-sm mx-auto mb-4">
            {searchQuery || selectedCategory !== 'All' 
              ? 'Try resetting your search query or choosing another category.'
              : 'Be the first scholar to share study advice, insights, or project progress with the community!'}
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              if (blogs.length === 0 && !searchQuery && selectedCategory === 'All') {
                handleOpenEditor();
              }
            }}
            className="px-4 py-2 rounded-[10px] bg-[#D4A373] hover:bg-[#C59361] text-[#40382F] text-xs font-bold shadow-sm"
          >
            {searchQuery || selectedCategory !== 'All' ? 'Reset Filters' : 'Write First Blog'}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogs.map(blog => {
              return (
                <div
                  key={blog.id}
                  onClick={() => handleOpenDetail(blog.id)}
                  className="bg-[#FEFAE0] hover:bg-[#FAEDCD]/50 border border-[rgba(64,56,47,0.14)] hover:border-[#D4A373]/60 rounded-[16px] overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div>
                    {/* Optional Cover Image */}
                    {blog.image_url ? (
                      <div className="w-full h-44 overflow-hidden border-b border-[rgba(64,56,47,0.1)] bg-[#FAEDCD]">
                        <img
                          src={getFullImageUrl(blog.image_url)}
                          alt={blog.title}
                          className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-3 bg-[#CCD5AE]/60 border-b border-[rgba(64,56,47,0.1)]"></div>
                    )}

                    <div className="p-5">
                      {/* Meta: Author & Category */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-[6px] bg-[#CCD5AE] text-[#40382F] font-bold flex items-center justify-center text-[10px] border border-[rgba(64,56,47,0.1)]">
                            {blog.author_name ? blog.author_name.charAt(0) : 'U'}
                          </div>
                          <span className="text-xs font-semibold text-[#40382F] truncate max-w-[120px]">
                            {blog.author_name}
                          </span>
                        </div>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-[6px] bg-[#E9EDC9] text-[#40382F] border border-[rgba(64,56,47,0.1)]">
                          {blog.category}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-bold text-[#40382F] group-hover:text-[#D4A373] transition-colors line-clamp-2 mb-2 leading-snug">
                        {blog.title}
                      </h3>

                      {/* Content Preview */}
                      <p className="text-xs text-[#75695A] line-clamp-3 leading-relaxed mb-4 font-normal">
                        {blog.content}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer: Likes, Comments, Read More */}
                  <div className="px-5 py-3 border-t border-[rgba(64,56,47,0.1)] bg-[#FAEDCD]/60 flex items-center justify-between text-xs text-[#75695A]">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={(e) => handleToggleLike(e, blog.id)}
                        className={`flex items-center space-x-1.5 transition-colors font-semibold ${
                          blog.user_has_liked ? 'text-[#D4A373]' : 'hover:text-[#40382F]'
                        }`}
                        title="Like this blog"
                      >
                        <Heart className={`w-3.5 h-3.5 ${blog.user_has_liked ? 'fill-[#D4A373] text-[#D4A373]' : ''}`} />
                        <span>{blog.likes_count || 0}</span>
                      </button>

                      <div className="flex items-center space-x-1.5 font-semibold">
                        <MessageSquare className="w-3.5 h-3.5 text-[#75695A]" />
                        <span>{blog.comments_count || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 text-[#D4A373] group-hover:text-[#B88252] font-bold text-[11px]">
                      <span>Read More</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center space-x-2">
              <button
                onClick={() => fetchBlogs(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3.5 py-1.5 rounded-[10px] bg-[#FAEDCD] border border-[rgba(64,56,47,0.14)] text-xs font-semibold text-[#40382F] disabled:opacity-40 hover:bg-[#E9EDC9] transition-colors shadow-sm"
              >
                Previous
              </button>
              <span className="text-xs text-[#75695A] px-2 font-mono">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => fetchBlogs(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3.5 py-1.5 rounded-[10px] bg-[#FAEDCD] border border-[rgba(64,56,47,0.14)] text-xs font-semibold text-[#40382F] disabled:opacity-40 hover:bg-[#E9EDC9] transition-colors shadow-sm"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Editor Modal */}
      <BlogEditorModal
        isOpen={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingBlog(null);
        }}
        onBlogCreated={handleBlogCreated}
        editingBlog={editingBlog}
      />

      {/* Detail Modal */}
      <BlogDetailModal
        blogId={selectedBlogId}
        isOpen={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedBlogId(null);
        }}
        onEditBlog={(blog) => handleOpenEditor(blog)}
        onDeleteBlog={handleDeleteBlog}
        onOpenAuth={onOpenAuth}
      />
    </div>
  );
}
