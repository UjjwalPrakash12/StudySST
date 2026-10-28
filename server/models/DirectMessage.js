const mongoose = require('mongoose');

const directMessageSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  room_id: { type: String, required: true, index: true },
  sender_id: { type: String, required: true, index: true },
  recipient_id: { type: String, required: true, index: true },
  message: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.models.DirectMessage || mongoose.model('DirectMessage', directMessageSchema);
