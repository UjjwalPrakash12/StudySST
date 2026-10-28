const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();
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
    if (err.message && err.message.includes('querySrv EBADRESP') && uri.startsWith('mongodb+srv://')) {
      console.log('ℹ️ Detected local DNS SRV packet issue. Resolving replica set nodes directly...');
      try {
        const { execSync } = require('child_process');
        const srvHost = uri.split('@')[1]?.split('/')[0]?.split('?')[0];
        if (srvHost) {
          const srvOutput = execSync(`dig +short SRV _mongodb._tcp.${srvHost} @8.8.8.8`, { encoding: 'utf-8', timeout: 5000 });
          const hosts = srvOutput.trim().split('\n').filter(Boolean).map(line => {
            const parts = line.trim().split(/\s+/);
            return parts.length >= 4 ? `${parts[3].replace(/\.$/, '')}:${parts[2]}` : null;
          }).filter(Boolean);

          if (hosts.length > 0) {
            const directUri = uri.replace('mongodb+srv://', 'mongodb://')
                                 .replace(/@[^/]+/, `@${hosts.join(',')}`)
                                 + (uri.includes('?') ? '&ssl=true&authSource=admin' : '?ssl=true&authSource=admin');
            await mongoose.connect(directUri, {
              serverSelectionTimeoutMS: 10000,
              connectTimeoutMS: 10000,
              socketTimeoutMS: 45000,
              maxPoolSize: 10,
            });
            isConnected = true;
            console.log('=================================================');
            console.log('  🍃 MongoDB Atlas Connected Successfully (via replica set)!');
            console.log(`  Database Host: ${mongoose.connection.host}`);
            console.log('  Collections: users, blogs, rooms, studysessions, tasks, live_sessions, direct_messages');
            console.log('=================================================');
            return true;
          }
        }
      } catch (fallbackErr) {
        console.warn('Direct replica set resolution warning:', fallbackErr.message);
      }
    }
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
