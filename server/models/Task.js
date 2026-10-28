const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  user_id: { type: String, required: true, index: true },
  room_id: { type: String, default: null },
  title: { type: String, required: true },
  completed: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Task || mongoose.model('Task', taskSchema);
