const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  id: { type: String, required: true },
  user_id: { type: String, required: true },
  author_name: { type: String, required: true },
  author_username: { type: String, default: '' },
  content: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

const blogSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true },
  author_id: { type: String, required: true },
  author_name: { type: String, required: true },
  author_username: { type: String, default: '' },
  category: { type: String, default: 'Study Techniques' },
  image_url: { type: String, default: null },
  likes_count: { type: Number, default: 0 },
  comments_count: { type: Number, default: 0 },
  likes: [{ type: String }],
  comments: [commentSchema]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.models.Blog || mongoose.model('Blog', blogSchema);
