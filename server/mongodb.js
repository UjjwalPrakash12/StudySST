const mongoose = require('mongoose');
const User = require('./models/User');
const Room = require('./models/Room');
const Blog = require('./models/Blog');
const StudySession = require('./models/StudySession');
const Message = require('./models/Message');
const Task = require('./models/Task');
const DirectMessage = require('./models/DirectMessage');
const LiveSession = require('./models/LiveSession');

let isConnected = false;

// Setup Mongoose connection event listeners
mongoose.connection.on('connected', () => {
  isConnected = true;
  console.log('🍃 MongoDB Atlas connection established.');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB Atlas connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('⚠️ MongoDB Atlas disconnected.');
});

async function connectMongoDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('ℹ️  MONGODB_URI not set. Running with built-in SQLite engine.');
    console.log('👉 To enable permanent cloud persistence: Add MONGODB_URI in your environment or host dashboard.');
    return false;
  }

  try {
    console.log('⏳ Connecting to MongoDB Atlas...');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    });
    isConnected = true;
    console.log('=================================================');
    console.log('  🍃 MongoDB Atlas Connected Successfully!');
    console.log(`  Database Host: ${mongoose.connection.host}`);
    console.log('  Collections: users, blogs, rooms, studysessions, tasks, live_sessions, direct_messages');
    console.log('=================================================');
    return true;
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB Atlas:', err.message);
    console.log('⚠️ Falling back to built-in storage so the server stays operational.');
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
    Message,
    Task,
    DirectMessage,
    LiveSession
  }
};
