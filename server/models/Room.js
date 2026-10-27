const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  category: { type: String, default: 'Engineering & STEM' },
  pomodoro_work_mins: { type: Number, default: 25 },
  pomodoro_break_mins: { type: Number, default: 5 },
  bg_theme: { type: String, default: 'cosmic' },
  is_private: { type: Boolean, default: false },
  passcode: { type: String, default: null },
  created_by: { type: String, default: null }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.models.Room || mongoose.model('Room', roomSchema);
