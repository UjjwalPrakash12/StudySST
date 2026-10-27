const mongoose = require('mongoose');

const studySessionSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  user_id: { type: String, required: true, index: true },
  room_id: { type: String, default: null },
  duration_minutes: { type: Number, required: true },
  mode: { type: String, default: 'work' },
  subject: { type: String, default: 'General Study' },
  notes: { type: String, default: '' },
  completed_at: { type: Date, default: Date.now }
});

module.exports = mongoose.models.StudySession || mongoose.model('StudySession', studySessionSchema);
