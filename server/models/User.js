const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  username: { type: String, unique: true, required: true, lowercase: true, trim: true },
  email: { type: String, unique: true, required: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  display_name: { type: String, required: true },
  avatar_seed: { type: String, default: 'Felix' },
  daily_goal_minutes: { type: Number, default: 120 },
  total_focus_minutes: { type: Number, default: 0 },
  total_live_seconds: { type: Number, default: 0 },
  is_live: { type: Boolean, default: false },
  current_room_id: { type: String, default: null },
  current_streak: { type: Number, default: 0 },
  longest_streak: { type: Number, default: 0 },
  last_active_date: { type: String, default: null },
  bio: { type: String, default: 'Ready to focus and achieve big goals!' },
  role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' },
  is_suspended: { type: Boolean, default: false },
  google_id: { type: String, default: null }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
