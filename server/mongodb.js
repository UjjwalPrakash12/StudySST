const mongoose = require('mongoose');
const User = require('./models/User');
const Room = require('./models/Room');
const Blog = require('./models/Blog');
const StudySession = require('./models/StudySession');
const Message = require('./models/Message');

let isConnected = false;

async function connectMongoDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('ℹ️  MONGODB_URI not set. Running with built-in SQLite engine.');
    console.log('👉 To enable MongoDB Atlas: Add MONGODB_URI in your .env or Render dashboard.');
    return false;
  }

  try {
    console.log('⏳ Connecting to MongoDB Atlas...');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    isConnected = true;
    console.log('=================================================');
    console.log('  🍃 MongoDB Atlas Connected Successfully!');
    console.log(`  Database Host: ${mongoose.connection.host}`);
    console.log('  Collections: users, blogs, rooms, studysessions, messages');
    console.log('=================================================');
    return true;
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB Atlas:', err.message);
    console.log('⚠️ Falling back to built-in storage so the server stays running.');
    return false;
  }
}

module.exports = {
  connectMongoDB,
  getIsConnected: () => isConnected,
  models: {
    User,
    Room,
    Blog,
    StudySession,
    Message
  }
};
