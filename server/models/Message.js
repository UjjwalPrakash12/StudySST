const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  room_id: { type: String, required: true, index: true },
  user_id: { type: String, required: true },
  display_name: { type: String, required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
