const mongoose = require('mongoose');

const liveSessionSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  user_id: { type: String, required: true, index: true },
  room_id: { type: String, required: true },
  socket_id: { type: String, default: null },
  started_at: { type: Date, default: Date.now },
  ended_at: { type: Date, default: null },
  duration_seconds: { type: Number, default: 0 },
  last_heartbeat: { type: Date, default: Date.now },
  is_active: { type: Boolean, default: true }
});

module.exports = mongoose.models.LiveSession || mongoose.model('LiveSession', liveSessionSchema);
