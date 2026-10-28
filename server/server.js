const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const multer = require('multer');
const { AccessToken } = require('livekit-server-sdk');
const db = require('./db');
const { connectMongoDB, getIsConnected, models } = require('./mongodb');

// ==========================================
// MongoDB Synchronization Helpers
// ==========================================
async function syncUserToMongo(user) {
  if (!getIsConnected() || !user) return;
  try {
    await models.User.findOneAndUpdate(
      { id: user.id },
      {
        id: user.id,
        username: user.username,
        email: user.email,
        password_hash: user.password_hash || '',
        display_name: user.display_name,
        avatar_seed: user.avatar_seed || 'Felix',
        daily_goal_minutes: user.daily_goal_minutes || 120,
        total_focus_minutes: user.total_focus_minutes || 0,
        total_live_seconds: user.total_live_seconds || 0,
        is_live: Boolean(user.is_live),
        current_room_id: user.current_room_id || null,
        current_streak: user.current_streak || 0,
        longest_streak: user.longest_streak || 0,
        bio: user.bio || '',
        role: user.role || 'user'
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.warn('[MongoDB] Sync User warning:', err.message);
  }
}

async function syncBlogToMongo(blogId) {
  if (!getIsConnected() || !blogId) return;
  try {
    const blog = db.prepare(`
      SELECT b.*, u.username as author_username, u.display_name as author_name 
      FROM blogs b JOIN users u ON b.author_id = u.id 
      WHERE b.id = ?
    `).get(blogId);
    if (!blog) return;

    const comments = db.prepare(`
      SELECT c.*, u.display_name as author_name, u.username as author_username
      FROM blog_comments c JOIN users u ON c.user_id = u.id
      WHERE c.blog_id = ?
    `).all(blogId);

    const likes = db.prepare('SELECT user_id FROM blog_likes WHERE blog_id = ?').all(blogId).map(l => l.user_id);

    await models.Blog.findOneAndUpdate(
      { id: blog.id },
      {
        id: blog.id,
        title: blog.title,
        content: blog.content,
        author_id: blog.author_id,
        author_name: blog.author_name,
        author_username: blog.author_username,
        category: blog.category,
        image_url: blog.image_url,
        likes_count: blog.likes_count,
        comments_count: blog.comments_count,
        likes: likes,
        comments: comments
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.warn('[MongoDB] Sync Blog warning:', err.message);
  }
}

async function syncRoomToMongo(room) {
  if (!getIsConnected() || !room) return;
  try {
    await models.Room.findOneAndUpdate(
      { id: room.id },
      {
        id: room.id,
        name: room.name,
        description: room.description || '',
        category: room.category,
        pomodoro_work_mins: room.pomodoro_work_mins,
        pomodoro_break_mins: room.pomodoro_break_mins,
        bg_theme: room.bg_theme || 'cosmic',
        is_private: Boolean(room.is_private),
        passcode: room.passcode || null,
        created_by: room.created_by || null
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.warn('[MongoDB] Sync Room warning:', err.message);
  }
}

async function syncMessageToMongo(msg, roomId) {
  if (!getIsConnected() || !msg) return;
  try {
    await models.Message.create({
      id: msg.id,
      room_id: roomId,
      user_id: msg.user?.id || 'anonymous',
      display_name: msg.user?.display_name || 'Scholar',
      content: msg.text,
      timestamp: new Date(msg.timestamp || Date.now())
    });
  } catch (err) {
    console.warn('[MongoDB] Sync Message warning:', err.message);
  }
}

async function initialMongoSync() {
  if (!getIsConnected()) return;
  try {
    console.log('🔄 Performing initial sync of SQLite data to MongoDB Atlas...');
    const users = db.prepare('SELECT * FROM users').all();
    for (const u of users) {
      await syncUserToMongo(u);
    }
    const rooms = db.prepare('SELECT * FROM rooms').all();
    for (const r of rooms) {
      await syncRoomToMongo(r);
    }
    const blogs = db.prepare('SELECT id FROM blogs').all();
    for (const b of blogs) {
      await syncBlogToMongo(b.id);
    }
    console.log(`✅ Successfully synced ${users.length} users, ${rooms.length} rooms, and ${blogs.length} blogs to MongoDB Atlas!`);
  } catch (err) {
    console.warn('Initial MongoDB sync warning:', err.message);
  }
}

const app = express();
const server = http.createServer(app);

// Security hardening
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const JWT_SECRET = process.env.JWT_SECRET || 'studystream_dev_secret_key_2026_super_secure';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.warn('⚠️ WARNING: Using fallback JWT_SECRET in production. Set JWT_SECRET in environment variables!');
}

const allowedOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

// ==========================================
// File Uploads Configuration (Multer)
// ==========================================
const uploadsDir = path.join(__dirname, 'uploads', 'blogs');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, 'blog-' + crypto.randomUUID() + safeExt);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// Atomic Transaction Helper
// ==========================================
function runInTransaction(fn) {
  try {
    db.exec('BEGIN IMMEDIATE;');
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    try { db.exec('ROLLBACK;'); } catch (e) {}
    throw err;
  }
}

// ==========================================
// Live Session & Presence State (In-Memory)
// ==========================================
const activeRooms = new Map();

// Map<userId, { sessionId, userId, roomId, startedAtMs, lastHeartbeatMs, lastCreditedAtMs, sockets: Set<string> }>
const userActiveSessions = new Map();
// Map<socketId, userId>
const socketToUserSession = new Map();

// Leaderboard live broadcast debouncer
let lastLeaderboardBroadcast = 0;
function broadcastLeaderboardUpdate(force = false) {
  const now = Date.now();
  if (force || now - lastLeaderboardBroadcast > 2500) {
    lastLeaderboardBroadcast = now;
    if (typeof io !== 'undefined' && io) {
      io.emit('leaderboard-updated', { timestamp: now });
    }
  }
}

/**
 * Accurately credit verified live study time using authoritative server timestamps.
 * Multi-tab safe: Credits time once per user session, regardless of which tab sends heartbeat.
 */
function creditLiveSessionTime(session, nowMs = Date.now()) {
  if (!session) return 0;
  const deltaSeconds = Math.max(0, Math.floor((nowMs - session.lastCreditedAtMs) / 1000));
  // Security guardrail: maximum 120s can be credited in one step to prevent clock manipulation
  const safeDelta = Math.min(deltaSeconds, 120);

  if (safeDelta > 0) {
    session.lastCreditedAtMs = nowMs;
    try {
      db.prepare(`
        UPDATE live_sessions 
        SET last_heartbeat = CURRENT_TIMESTAMP, duration_seconds = duration_seconds + ? 
        WHERE id = ? AND is_active = 1
      `).run(safeDelta, session.sessionId);

      db.prepare(`
        UPDATE users 
        SET total_live_seconds = total_live_seconds + ? 
        WHERE id = ?
      `).run(safeDelta, session.userId);

      broadcastLeaderboardUpdate(false);
    } catch (err) {
      console.error('[Session] Error crediting live time:', err.message);
    }
  }
  return safeDelta;
}

/**
 * Idempotently finalize a user's live study session.
 * Credits any remaining uncredited time, marks ended_at, and broadcasts live status & leaderboard updates.
 */
function finalizeLiveSession(userId, nowMs = Date.now()) {
  const session = userActiveSessions.get(userId);
  if (!session) return null;

  // Credit any uncredited delta up to finalization timestamp
  creditLiveSessionTime(session, nowMs);

  try {
    // Atomically close the session record
    db.prepare(`
      UPDATE live_sessions 
      SET ended_at = CURRENT_TIMESTAMP, is_active = 0 
      WHERE id = ? AND is_active = 1
    `).run(session.sessionId);

    // Update user active status
    db.prepare('UPDATE users SET is_live = 0, current_room_id = NULL WHERE id = ?').run(session.userId);

    // Compute total verified session duration for streak calculation
    const finalSession = db.prepare('SELECT duration_seconds FROM live_sessions WHERE id = ?').get(session.sessionId);
    const totalSecs = finalSession ? finalSession.duration_seconds : 0;

    if (totalSecs >= 60) {
      const todayStr = new Date().toISOString().split('T')[0];
      const userRec = db.prepare('SELECT last_active_date, current_streak, longest_streak FROM users WHERE id = ?').get(session.userId);
      if (userRec) {
        let nextStreak = userRec.current_streak || 1;
        if (userRec.last_active_date) {
          const diffDays = Math.floor(Math.abs(new Date() - new Date(userRec.last_active_date)) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) nextStreak += 1;
          else if (diffDays > 1) nextStreak = 1;
        }
        const nextLongest = Math.max(userRec.longest_streak || 0, nextStreak);
        db.prepare('UPDATE users SET current_streak = ?, longest_streak = ?, last_active_date = ? WHERE id = ?').run(nextStreak, nextLongest, todayStr, session.userId);
      }
    }
  } catch (err) {
    console.error('[Session] Error finalizing live session:', err.message);
  }

  // Clean up socket mappings
  for (const sId of session.sockets) {
    socketToUserSession.delete(sId);
  }
  userActiveSessions.delete(userId);

  if (typeof io !== 'undefined' && io) {
    io.emit('user-live-status-changed', {
      userId: session.userId,
      isLive: false
    });
    broadcastLeaderboardUpdate(true);
  }

  return session;
}

// ==========================================
// Global Visitor Presence State (De-duplicated by visitorId)
// ==========================================
const activeVisitors = new Map(); // visitorId -> { visitorId, socketIds: Set, user, isAuthenticated, view, roomId, lastSeen }
const socketToVisitor = new Map(); // socketId -> visitorId

function getPresenceStats() {
  let authenticatedCount = 0;
  let anonymousCount = 0;
  const roomCounts = {};

  try {
    const dbRooms = db.prepare('SELECT id FROM rooms').all();
    for (const r of dbRooms) {
      roomCounts[r.id] = 0;
    }
  } catch (e) {}

  for (const visitor of activeVisitors.values()) {
    if (visitor.isAuthenticated) {
      authenticatedCount++;
    } else {
      anonymousCount++;
    }
    if (visitor.roomId) {
      roomCounts[visitor.roomId] = (roomCounts[visitor.roomId] || 0) + 1;
    }
  }

  // Also include any active socket participants in rooms
  for (const [rId, rState] of activeRooms.entries()) {
    if (rState && rState.participants) {
      roomCounts[rId] = Math.max(roomCounts[rId] || 0, rState.participants.size);
    }
  }

  return {
    totalActive: activeVisitors.size,
    authenticatedCount,
    anonymousCount,
    roomCounts,
    timestamp: Date.now()
  };
}

function broadcastPresenceStats() {
  if (typeof io !== 'undefined' && io) {
    io.emit('presence-stats', getPresenceStats());
  }
}

function getOrCreateRoomState(roomId) {
  if (!activeRooms.has(roomId)) {
    activeRooms.set(roomId, {
      participants: new Map(), // socketId -> participant info
      messages: [], // last 60 messages
    });
  }
  return activeRooms.get(roomId);
}

// Clean up stale abandoned sessions safely every 30s
function cleanupStaleSessions() {
  try {
    const staleCutoffMs = Date.now() - 90 * 1000;
    const staleCutoff = new Date(staleCutoffMs).toISOString();

    // 1. Finalize in-memory sessions that stopped heartbeating
    for (const [userId, session] of Array.from(userActiveSessions.entries())) {
      if (session.lastHeartbeatMs < staleCutoffMs) {
        console.log(`[Session] Auto-finalizing stale in-memory session ${session.sessionId} for user ${userId}`);
        finalizeLiveSession(userId, session.lastHeartbeatMs);
      }
    }

    // 2. Finalize any dangling sessions in the database (e.g. from prior server crashes)
    const staleDbSessions = db.prepare(`
      SELECT id, user_id, started_at, last_heartbeat 
      FROM live_sessions 
      WHERE is_active = 1 AND last_heartbeat < ?
    `).all(staleCutoff);

    for (const session of staleDbSessions) {
      db.prepare(`
        UPDATE live_sessions 
        SET ended_at = last_heartbeat, is_active = 0 
        WHERE id = ?
      `).run(session.id);

      db.prepare(`
        UPDATE users 
        SET is_live = 0, current_room_id = NULL 
        WHERE id = ?
      `).run(session.user_id);
    }

    if (staleDbSessions.length > 0) {
      broadcastLeaderboardUpdate(true);
    }
  } catch (err) {
    console.error('Error during stale sessions cleanup:', err.message);
  }
}
setInterval(cleanupStaleSessions, 30000);
cleanupStaleSessions();

// ==========================================
// Authentication Middleware & Helpers
// ==========================================
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role || 'user' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
}

function optionalAuthenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (!err && decoded) {
      req.user = decoded;
    }
    next();
  });
}

// ==========================================
// API Routes: Authentication
// ==========================================
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(cleanUsername, cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const userId = 'user-' + crypto.randomUUID();
    const display = displayName ? displayName.trim() : username;
    const avatarSeed = cleanUsername;
    const todayStr = new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, display_name, avatar_seed, last_active_date, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'user')
    `).run(userId, cleanUsername, cleanEmail, passwordHash, display, avatarSeed, todayStr);

    const newUser = db.prepare('SELECT id, username, email, display_name, avatar_seed, daily_goal_minutes, total_focus_minutes, total_live_seconds, is_live, current_room_id, current_streak, longest_streak, bio, role, created_at FROM users WHERE id = ?').get(userId);
    const token = generateToken(newUser);
    syncUserToMongo(newUser);

    res.status(201).json({
      message: 'Account registered successfully',
      token,
      user: newUser
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: 'Username/email and password required' });
    }

    const cleanLogin = login.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(cleanLogin, cleanLogin);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { password_hash, ...safeUser } = user;
    const token = generateToken(safeUser);

    res.json({
      message: 'Login successful',
      token,
      user: safeUser
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { email, displayName, photoUrl, uid, idToken } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required for Google authentication' });
    }

    // Check if user already exists with this email or google_id
    let user = db.prepare('SELECT * FROM users WHERE email = ? OR google_id = ?').get(email, uid || '');

    if (!user) {
      // Create new user for first-time Google signup
      const userId = 'user-' + crypto.randomUUID();
      const baseUsername = (email.split('@')[0] || 'scholar').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 15);
      
      // Ensure unique username
      let usernameCandidate = baseUsername || 'scholar';
      const existingUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(usernameCandidate);
      if (existingUsername) {
        usernameCandidate = `${baseUsername}_${Math.random().toString(36).slice(2, 6)}`;
      }

      const randomPassword = crypto.randomUUID();
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(randomPassword, salt);
      const userDisplayName = displayName || usernameCandidate;
      const avatarSeed = photoUrl || usernameCandidate;

      db.prepare(`
        INSERT INTO users (
          id, username, email, password_hash, display_name, avatar_seed,
          daily_goal_minutes, total_focus_minutes, total_live_seconds, current_streak, longest_streak, bio, role, google_id
        )
        VALUES (?, ?, ?, ?, ?, ?, 120, 0, 0, 0, 0, 'Ready to focus and achieve big goals!', 'user', ?)
      `).run(
        userId, usernameCandidate, email, passwordHash, userDisplayName, avatarSeed, uid || null
      );

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    } else if (uid && !user.google_id) {
      // Link google_id if not linked yet
      db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(uid, user.id);
    }

    const { password_hash, ...safeUser } = user;
    const token = generateToken(safeUser);
    syncUserToMongo(user);

    res.json({
      message: 'Google authentication successful',
      token,
      user: safeUser
    });
  } catch (error) {
    console.error('Google Auth error:', error);
    res.status(500).json({ error: 'Internal server error during Google sign in' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, email, display_name, avatar_seed, daily_goal_minutes, total_focus_minutes, total_live_seconds, is_live, current_room_id, current_streak, longest_streak, bio, role, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching profile' });
  }
});

app.put('/api/auth/profile', authenticateToken, (req, res) => {
  try {
    const { displayName, dailyGoalMinutes, bio, avatarSeed } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newDisplayName = displayName !== undefined ? displayName.trim() : user.display_name;
    const newGoal = dailyGoalMinutes !== undefined ? Number(dailyGoalMinutes) : user.daily_goal_minutes;
    const newBio = bio !== undefined ? bio.trim() : user.bio;
    const newAvatar = avatarSeed !== undefined ? avatarSeed.trim() : user.avatar_seed;

    db.prepare(`
      UPDATE users 
      SET display_name = ?, daily_goal_minutes = ?, bio = ?, avatar_seed = ?
      WHERE id = ?
    `).run(newDisplayName, newGoal, newBio, newAvatar, req.user.id);

    const updatedUser = db.prepare('SELECT id, username, email, display_name, avatar_seed, daily_goal_minutes, total_focus_minutes, total_live_seconds, is_live, current_room_id, current_streak, longest_streak, bio, role, created_at FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ==========================================
// FEATURE 1: Community Blogs Endpoints
// ==========================================
app.get('/api/blogs', optionalAuthenticateToken, (req, res) => {
  try {
    const { sort = 'latest', category, search, page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    let whereClauses = ["b.status = 'published'"];
    let params = [];

    if (category && category !== 'All') {
      whereClauses.push('b.category = ?');
      params.push(category);
    }

    if (search && search.trim()) {
      whereClauses.push('(b.title LIKE ? OR b.content LIKE ? OR u.display_name LIKE ? OR u.username LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    let orderSQL = 'ORDER BY b.created_at DESC';
    if (sort === 'most_liked') {
      orderSQL = 'ORDER BY b.likes_count DESC, b.created_at DESC';
    } else if (sort === 'most_discussed') {
      orderSQL = 'ORDER BY b.comments_count DESC, b.created_at DESC';
    }

    // Count total blogs
    const countQuery = `SELECT COUNT(*) as total FROM blogs b JOIN users u ON b.author_id = u.id ${whereSQL}`;
    const totalCount = db.prepare(countQuery).get(...params).total;

    // Fetch blogs with author details
    const currentUserId = req.user ? req.user.id : null;
    let queryParams = [];
    let likedSelect = '0 as user_has_liked';
    if (currentUserId) {
      likedSelect = '(SELECT COUNT(*) FROM blog_likes bl WHERE bl.blog_id = b.id AND bl.user_id = ?) > 0 as user_has_liked';
      queryParams.push(currentUserId);
    }

    const blogsQuery = `
      SELECT 
        b.id, b.title, b.content, b.category, b.image_url, b.likes_count, b.comments_count, b.created_at, b.updated_at,
        u.id as author_id, u.username as author_username, u.display_name as author_name, u.avatar_seed as author_avatar, u.is_live as author_is_live,
        ${likedSelect}
      FROM blogs b
      JOIN users u ON b.author_id = u.id
      ${whereSQL}
      ${orderSQL}
      LIMIT ? OFFSET ?
    `;

    const blogs = db.prepare(blogsQuery).all(...queryParams, ...params, limitNum, offset);

    res.json({
      blogs: blogs.map(b => ({
        ...b,
        user_has_liked: Boolean(b.user_has_liked)
      })),
      total: totalCount,
      page: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error('Fetch blogs error:', error);
    res.status(500).json({ error: 'Failed to fetch community blogs' });
  }
});

app.get('/api/blogs/:id', optionalAuthenticateToken, (req, res) => {
  try {
    const currentUserId = req.user ? req.user.id : null;
    let likedSelect = '0 as user_has_liked';
    let queryParams = [];
    if (currentUserId) {
      likedSelect = '(SELECT COUNT(*) FROM blog_likes bl WHERE bl.blog_id = b.id AND bl.user_id = ?) > 0 as user_has_liked';
      queryParams.push(currentUserId);
    }
    queryParams.push(req.params.id);

    const blog = db.prepare(`
      SELECT 
        b.*,
        u.id as author_id, u.username as author_username, u.display_name as author_name, u.avatar_seed as author_avatar, u.bio as author_bio, u.is_live as author_is_live,
        ${likedSelect}
      FROM blogs b
      JOIN users u ON b.author_id = u.id
      WHERE b.id = ?
    `).get(...queryParams);

    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    // Fetch comments
    const comments = db.prepare(`
      SELECT 
        c.id, c.comment, c.comment as content, c.created_at,
        u.id as user_id, u.username, u.display_name, u.display_name as author_name, u.avatar_seed
      FROM blog_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.blog_id = ?
      ORDER BY c.created_at DESC
    `).all(blog.id);

    res.json({
      blog: {
        ...blog,
        user_has_liked: Boolean(blog.user_has_liked),
        comments,
      }
    });
  } catch (error) {
    console.error('Get blog detail error:', error);
    res.status(500).json({ error: 'Failed to load blog' });
  }
});

app.post('/api/blogs', authenticateToken, upload.single('image'), (req, res) => {
  try {
    const { title, content, category } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Blog title is required' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Blog content is required' });
    }

    const blogId = 'blog-' + crypto.randomUUID();
    let imageUrl = null;

    if (req.file) {
      imageUrl = '/uploads/blogs/' + req.file.filename;
    }

    db.prepare(`
      INSERT INTO blogs (id, author_id, title, content, category, image_url, likes_count, comments_count, status)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'published')
    `).run(
      blogId,
      req.user.id,
      title.trim(),
      content.trim(),
      category ? category.trim() : 'General',
      imageUrl
    );

    const createdBlog = db.prepare(`
      SELECT b.*, u.username as author_username, u.display_name as author_name, u.avatar_seed as author_avatar
      FROM blogs b JOIN users u ON b.author_id = u.id WHERE b.id = ?
    `).get(blogId);

    syncBlogToMongo(blogId);

    res.status(201).json({ blog: { ...createdBlog, user_has_liked: false } });
  } catch (error) {
    console.error('Create blog error:', error);
    res.status(500).json({ error: error.message || 'Failed to publish blog' });
  }
});

app.put('/api/blogs/:id', authenticateToken, upload.single('image'), (req, res) => {
  try {
    const blog = db.prepare('SELECT * FROM blogs WHERE id = ?').get(req.params.id);
    if (!blog) return res.status(404).json({ error: 'Blog not found' });

    // Authorization check
    if (blog.author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to edit this blog' });
    }

    const { title, content, category, removeImage } = req.body;
    let newImageUrl = blog.image_url;

    if (req.file) {
      newImageUrl = '/uploads/blogs/' + req.file.filename;
    } else if (removeImage === 'true') {
      newImageUrl = null;
    }

    db.prepare(`
      UPDATE blogs 
      SET title = ?, content = ?, category = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title ? title.trim() : blog.title,
      content ? content.trim() : blog.content,
      category ? category.trim() : blog.category,
      newImageUrl,
      blog.id
    );

    const updated = db.prepare('SELECT * FROM blogs WHERE id = ?').get(blog.id);
    syncBlogToMongo(blog.id);
    res.json({ blog: updated });
  } catch (error) {
    console.error('Update blog error:', error);
    res.status(500).json({ error: 'Failed to update blog' });
  }
});

app.delete('/api/blogs/:id', authenticateToken, (req, res) => {
  try {
    const blog = db.prepare('SELECT * FROM blogs WHERE id = ?').get(req.params.id);
    if (!blog) return res.status(404).json({ error: 'Blog not found' });

    if (blog.author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this blog' });
    }

    // Delete image file if exists
    if (blog.image_url && blog.image_url.startsWith('/uploads/blogs/')) {
      const filePath = path.join(__dirname, blog.image_url);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    }

    db.prepare('DELETE FROM blogs WHERE id = ?').run(blog.id);
    if (getIsConnected()) {
      models.Blog.deleteOne({ id: blog.id }).catch(() => {});
    }
    res.json({ success: true, message: 'Blog deleted successfully' });
  } catch (error) {
    console.error('Delete blog error:', error);
    res.status(500).json({ error: 'Failed to delete blog' });
  }
});

app.post('/api/blogs/:id/like', authenticateToken, (req, res) => {
  try {
    const blog = db.prepare('SELECT id, likes_count FROM blogs WHERE id = ?').get(req.params.id);
    if (!blog) return res.status(404).json({ error: 'Blog not found' });

    let userLiked = false;
    let finalCount = 0;

    runInTransaction(() => {
      const existingLike = db.prepare('SELECT id FROM blog_likes WHERE blog_id = ? AND user_id = ?').get(blog.id, req.user.id);

      if (existingLike) {
        db.prepare('DELETE FROM blog_likes WHERE id = ?').run(existingLike.id);
        userLiked = false;
      } else {
        const likeId = 'like-' + crypto.randomUUID();
        db.prepare('INSERT INTO blog_likes (id, blog_id, user_id) VALUES (?, ?, ?)').run(likeId, blog.id, req.user.id);
        userLiked = true;
      }

      // Recompute authoritative count directly from blog_likes to prevent any drift
      finalCount = db.prepare('SELECT COUNT(*) as count FROM blog_likes WHERE blog_id = ?').get(blog.id).count;
      db.prepare('UPDATE blogs SET likes_count = ? WHERE id = ?').run(finalCount, blog.id);
    });

    syncBlogToMongo(blog.id);

    // Broadcast real-time like update to all connected clients
    if (typeof io !== 'undefined' && io) {
      io.emit('blog-like-updated', {
        blogId: blog.id,
        likesCount: finalCount,
        likes_count: finalCount,
        userId: req.user.id,
        liked: userLiked
      });
    }

    return res.json({
      liked: userLiked,
      likes_count: finalCount,
      likesCount: finalCount
    });
  } catch (error) {
    console.error('Like toggle error:', error);
    res.status(500).json({ error: 'Failed to process like action' });
  }
});

app.post('/api/blogs/:id/comments', authenticateToken, (req, res) => {
  try {
    const rawComment = (req.body.comment || req.body.content || '').trim();
    if (!rawComment) {
      return res.status(400).json({ error: 'Comment text cannot be empty' });
    }
    if (rawComment.length > 2000) {
      return res.status(400).json({ error: 'Comment cannot exceed 2000 characters' });
    }

    const blog = db.prepare('SELECT id FROM blogs WHERE id = ?').get(req.params.id);
    if (!blog) return res.status(404).json({ error: 'Blog not found' });

    const commentId = 'comm-' + crypto.randomUUID();
    let finalCount = 0;
    let createdComment = null;

    runInTransaction(() => {
      db.prepare('INSERT INTO blog_comments (id, blog_id, user_id, comment) VALUES (?, ?, ?, ?)').run(
        commentId,
        blog.id,
        req.user.id,
        rawComment
      );

      finalCount = db.prepare('SELECT COUNT(*) as count FROM blog_comments WHERE blog_id = ?').get(blog.id).count;
      db.prepare('UPDATE blogs SET comments_count = ? WHERE id = ?').run(finalCount, blog.id);

      createdComment = db.prepare(`
        SELECT 
          c.id, c.comment, c.comment as content, c.created_at,
          u.id as user_id, u.username, u.display_name, u.display_name as author_name, u.avatar_seed
        FROM blog_comments c JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
      `).get(commentId);
    });

    syncBlogToMongo(blog.id);

    // Broadcast real-time comment to all connected clients
    if (typeof io !== 'undefined' && io) {
      io.emit('blog-comment-added', {
        blogId: blog.id,
        comment: createdComment,
        commentsCount: finalCount,
        comments_count: finalCount
      });
    }

    res.status(201).json({
      comment: createdComment,
      comments_count: finalCount,
      commentsCount: finalCount
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

app.delete('/api/blogs/:blogId/comments/:commentId', authenticateToken, (req, res) => {
  try {
    const comment = db.prepare('SELECT * FROM blog_comments WHERE id = ? AND blog_id = ?').get(req.params.commentId, req.params.blogId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const blog = db.prepare('SELECT author_id FROM blogs WHERE id = ?').get(req.params.blogId);

    // Can delete if author of comment, owner of the blog, or admin
    if (comment.user_id !== req.user.id && (blog && blog.author_id !== req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this comment' });
    }

    let finalCount = 0;
    runInTransaction(() => {
      db.prepare('DELETE FROM blog_comments WHERE id = ?').run(comment.id);
      finalCount = db.prepare('SELECT COUNT(*) as count FROM blog_comments WHERE blog_id = ?').get(req.params.blogId).count;
      db.prepare('UPDATE blogs SET comments_count = ? WHERE id = ?').run(finalCount, req.params.blogId);
    });

    syncBlogToMongo(req.params.blogId);

    // Broadcast real-time comment deletion to all connected clients
    if (typeof io !== 'undefined' && io) {
      io.emit('blog-comment-deleted', {
        blogId: req.params.blogId,
        commentId: comment.id,
        commentsCount: finalCount,
        comments_count: finalCount
      });
    }

    res.json({
      success: true,
      message: 'Comment deleted',
      comments_count: finalCount,
      commentsCount: finalCount
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// ==========================================
// API Routes: Presence & Active Users
// ==========================================
app.get('/api/presence/stats', (req, res) => {
  res.json(getPresenceStats());
});

// ==========================================
// API Routes: High-Scale SFU Media (LiveKit)
// ==========================================
app.get('/api/livekit/token', optionalAuthenticateToken, async (req, res) => {
  try {
    const livekitUrl = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!livekitUrl || !apiKey || !apiSecret) {
      return res.json({
        sfuEnabled: false,
        message: 'LiveKit SFU not configured in environment. Running in bandwidth-optimized WebRTC mode.'
      });
    }

    const { roomId, username } = req.query;
    if (!roomId) {
      return res.status(400).json({ error: 'roomId parameter is required' });
    }

    const participantIdentity = req.user 
      ? req.user.id 
      : (req.query.userId || 'guest-' + crypto.randomUUID().slice(0, 8));
    const participantName = req.user 
      ? (req.user.display_name || req.user.username) 
      : (username || 'Scholar ' + Math.floor(Math.random() * 1000));

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: participantName,
      ttl: '8h',
    });

    at.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    res.json({
      sfuEnabled: true,
      token,
      url: livekitUrl,
      identity: participantIdentity,
      name: participantName
    });
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    res.status(500).json({ error: 'Failed to generate LiveKit media token' });
  }
});

// ==========================================
// API Routes: Study Rooms
// ==========================================
function getAccurateRoomOnlineCount(roomId) {
  const roomState = activeRooms.get(roomId);
  if (!roomState) return 0;
  if (io && io.sockets && io.sockets.sockets) {
    for (const socketId of Array.from(roomState.participants.keys())) {
      if (!io.sockets.sockets.has(socketId)) {
        roomState.participants.delete(socketId);
      }
    }
  }
  return roomState.participants.size;
}

app.get('/api/rooms', (req, res) => {
  try {
    const rooms = db.prepare('SELECT * FROM rooms ORDER BY created_at ASC').all();

    const enrichedRooms = rooms.map(room => ({
      ...room,
      onlineCount: getAccurateRoomOnlineCount(room.id),
    }));

    res.json({ rooms: enrichedRooms });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

app.get('/api/rooms/:id', (req, res) => {
  try {
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({ room: { ...room, onlineCount: getAccurateRoomOnlineCount(room.id) } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

app.post('/api/rooms', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can create study rooms' });
    }
    const { name, description, category, bgTheme, isPrivate, passcode } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'Room name and category are required' });
    }

    const roomId = 'room-' + crypto.randomUUID().slice(0, 8);

    db.prepare(`
      INSERT INTO rooms (id, name, description, category, pomodoro_work_mins, pomodoro_break_mins, bg_theme, is_private, passcode, created_by)
      VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
    `).run(
      roomId,
      name.trim(),
      description ? description.trim() : '',
      category.trim(),
      bgTheme || 'cosmic',
      isPrivate ? 1 : 0,
      passcode ? passcode.trim() : null,
      req.user.id
    );

    const createdRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    syncRoomToMongo(createdRoom);
    res.status(201).json({ room: { ...createdRoom, onlineCount: 0 } });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// ==========================================
// FEATURE 3: Unlimited Live Hours Leaderboard
// ==========================================
app.get('/api/leaderboard', optionalAuthenticateToken, (req, res) => {
  try {
    const { period = 'all_time' } = req.query;
    let leaderboard = [];

    if (period === 'weekly') {
      leaderboard = db.prepare(`
        SELECT 
          u.id, u.username, u.display_name, u.avatar_seed, u.bio, u.is_live, u.current_room_id,
          COALESCE(SUM(s.duration_seconds), 0) as total_live_seconds
        FROM users u
        LEFT JOIN live_sessions s ON u.id = s.user_id AND s.started_at >= datetime('now', '-7 days')
        GROUP BY u.id
        ORDER BY total_live_seconds DESC, u.created_at ASC, u.username ASC
        LIMIT 50
      `).all();
    } else if (period === 'monthly') {
      leaderboard = db.prepare(`
        SELECT 
          u.id, u.username, u.display_name, u.avatar_seed, u.bio, u.is_live, u.current_room_id,
          COALESCE(SUM(s.duration_seconds), 0) as total_live_seconds
        FROM users u
        LEFT JOIN live_sessions s ON u.id = s.user_id AND s.started_at >= datetime('now', '-30 days')
        GROUP BY u.id
        ORDER BY total_live_seconds DESC, u.created_at ASC, u.username ASC
        LIMIT 50
      `).all();
    } else {
      // Default: All-time cumulative verified live seconds
      leaderboard = db.prepare(`
        SELECT 
          id, username, display_name, avatar_seed, bio, is_live, current_room_id, total_live_seconds, current_streak
        FROM users
        ORDER BY total_live_seconds DESC, created_at ASC, username ASC
        LIMIT 50
      `).all();
    }

    // Attach current user's rank even if outside top list
    let currentUserRank = null;
    if (req.user) {
      const userIndex = leaderboard.findIndex(u => u.id === req.user.id);
      if (userIndex !== -1) {
        currentUserRank = {
          rank: userIndex + 1,
          ...leaderboard[userIndex],
        };
      } else {
        const currentUserData = db.prepare('SELECT id, username, display_name, avatar_seed, bio, is_live, current_room_id, total_live_seconds FROM users WHERE id = ?').get(req.user.id);
        if (currentUserData) {
          const higherCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE total_live_seconds > ?').get(currentUserData.total_live_seconds).count;
          currentUserRank = {
            rank: higherCount + 1,
            ...currentUserData,
          };
        }
      }
    }

    res.json({
      leaderboard,
      currentUserRank,
      period,
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Analytics Overview
app.get('/api/analytics/overview', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Live hours in hours & minutes
    const liveHoursTotal = (user.total_live_seconds / 3600).toFixed(1);

    // Past 7 days live sessions
    const past7Days = db.prepare(`
      SELECT date(started_at) as date, COALESCE(SUM(duration_seconds), 0) / 60 as minutes
      FROM live_sessions
      WHERE user_id = ? AND started_at >= datetime('now', '-7 days')
      GROUP BY date(started_at)
      ORDER BY date(started_at) ASC
    `).all(req.user.id);

    // Subject breakdown from historical logs
    const subjectDistribution = db.prepare(`
      SELECT subject, COALESCE(SUM(duration_minutes), 0) as minutes, COUNT(*) as count
      FROM study_sessions
      WHERE user_id = ?
      GROUP BY subject
      ORDER BY minutes DESC
      LIMIT 6
    `).all(req.user.id);

    // Task stats
    const taskStats = db.prepare(`
      SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_tasks
      FROM tasks
      WHERE user_id = ?
    `).get(req.user.id);

    res.json({
      totalLiveSeconds: user.total_live_seconds || 0,
      totalLiveHours: liveHoursTotal,
      isLive: Boolean(user.is_live),
      dailyGoalMinutes: user.daily_goal_minutes || 120,
      currentStreak: user.current_streak || 0,
      longestStreak: user.longest_streak || 0,
      past7Days,
      subjectDistribution,
      tasks: {
        total: taskStats.total_tasks || 0,
        completed: taskStats.completed_tasks || 0,
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to load analytics overview' });
  }
});

app.get('/api/sessions/history', authenticateToken, (req, res) => {
  try {
    const sessions = db.prepare(`
      SELECT s.id, s.room_id, s.started_at as completed_at, (s.duration_seconds / 60) as duration_minutes, 'live' as mode, r.name as room_name, 'Live Study Room' as subject
      FROM live_sessions s
      LEFT JOIN rooms r ON s.room_id = r.id
      WHERE s.user_id = ? AND s.duration_seconds > 0
      ORDER BY s.started_at DESC
      LIMIT 50
    `).all(req.user.id);

    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

app.post('/api/sessions/record', authenticateToken, (req, res) => {
  try {
    const { durationMinutes = 25, mode = 'work', subject = 'General Study', notes = '' } = req.body;
    const mins = Math.max(1, Math.min(720, parseInt(durationMinutes) || 25));
    const sessionId = 'session-' + crypto.randomUUID();

    db.prepare(`
      INSERT INTO study_sessions (id, user_id, duration_minutes, mode, subject, notes, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(sessionId, req.user.id, mins, mode, (subject || 'General Study').trim(), (notes || '').trim());

    // Update personal offline focus minutes without altering verified live leaderboard study hours
    db.prepare(`
      UPDATE users 
      SET total_focus_minutes = total_focus_minutes + ? 
      WHERE id = ?
    `).run(mins, req.user.id);

    res.status(201).json({ success: true, sessionId });
  } catch (err) {
    console.error('Record session error:', err);
    res.status(500).json({ error: 'Failed to record session' });
  }
});

// Tasks Endpoints
app.get('/api/tasks', authenticateToken, (req, res) => {
  try {
    const { roomId } = req.query;
    let query = 'SELECT * FROM tasks WHERE user_id = ?';
    const params = [req.user.id];

    if (roomId) {
      query += ' AND (room_id = ? OR room_id IS NULL)';
      params.push(roomId);
    }
    query += ' ORDER BY created_at DESC';

    const tasks = db.prepare(query).all(...params);
    res.json({ tasks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

app.post('/api/tasks', authenticateToken, (req, res) => {
  try {
    const { title, roomId } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const taskId = 'task-' + crypto.randomUUID();
    db.prepare(`
      INSERT INTO tasks (id, user_id, room_id, title, completed)
      VALUES (?, ?, ?, ?, 0)
    `).run(taskId, req.user.id, roomId || null, title.trim());

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    res.status(201).json({ task });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

app.patch('/api/tasks/:id/toggle', authenticateToken, (req, res) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const newCompleted = task.completed === 1 ? 0 : 1;
    db.prepare('UPDATE tasks SET completed = ? WHERE id = ?').run(newCompleted, task.id);

    res.json({ task: { ...task, completed: newCompleted } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle task' });
  }
});

app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
  try {
    db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});
// ==========================================
// FEATURE 4: 1-to-1 Private Direct Messaging
// ==========================================
app.get('/api/direct-messages/:recipientId', authenticateToken, (req, res) => {
  try {
    const { roomId } = req.query;
    const { recipientId } = req.params;

    let query = `
      SELECT 
        dm.id, dm.room_id as roomId, dm.sender_id as senderId, dm.recipient_id as recipientId,
        dm.message, dm.created_at as createdAt,
        uSender.display_name as senderName, uSender.avatar_seed as senderAvatar
      FROM direct_messages dm
      JOIN users uSender ON dm.sender_id = uSender.id
      WHERE ((dm.sender_id = ? AND dm.recipient_id = ?) OR (dm.sender_id = ? AND dm.recipient_id = ?))
    `;
    const params = [req.user.id, recipientId, recipientId, req.user.id];

    if (roomId) {
      query += ' AND dm.room_id = ?';
      params.push(roomId);
    }
    query += ' ORDER BY dm.created_at ASC LIMIT 100';

    const messages = db.prepare(query).all(...params);
    res.json({
      messages: messages.map(m => ({
        id: m.id,
        roomId: m.roomId,
        room_id: m.roomId,
        senderId: m.senderId,
        sender_id: m.senderId,
        recipientId: m.recipientId,
        recipient_id: m.recipientId,
        senderName: m.senderName,
        sender_name: m.senderName,
        senderAvatar: m.senderAvatar,
        message: m.message,
        timestamp: new Date(m.createdAt).getTime(),
        createdAt: m.createdAt,
        created_at: m.createdAt
      }))
    });
  } catch (err) {
    console.error('Fetch direct messages error:', err);
    res.status(500).json({ error: 'Failed to fetch direct messages' });
  }
});

// ==========================================
// FEATURE 5: Spotify Music Sharing Integration
// ==========================================
app.get('/api/spotify/auth-url', authenticateToken, (req, res) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/spotify/callback`;

  if (!clientId) {
    return res.json({
      configured: false,
      message: 'Spotify Client ID not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in environment.'
    });
  }

  const scope = 'user-read-currently-playing user-read-playback-state';
  const state = req.user.id;
  const authUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope,
    redirect_uri: redirectUri,
    state
  }).toString()}`;

  res.json({ configured: true, url: authUrl, authUrl });
});

app.get('/api/spotify/callback', async (req, res) => {
  try {
    const { code, state: userId, error } = req.query;
    if (error || !code) {
      return res.redirect('/?spotify=error');
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/spotify/callback`;

    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      }).toString()
    });

    const tokenData = await tokenRes.json();
    if (tokenData.access_token) {
      const expiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;
      db.prepare(`
        INSERT INTO spotify_connections (user_id, access_token, refresh_token, expires_at, is_sharing, updated_at)
        VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          access_token = excluded.access_token,
          refresh_token = COALESCE(excluded.refresh_token, spotify_connections.refresh_token),
          expires_at = excluded.expires_at,
          is_sharing = 1,
          updated_at = CURRENT_TIMESTAMP
      `).run(userId, tokenData.access_token, tokenData.refresh_token || null, expiresAt);
    }

    res.redirect('/?spotify=connected');
  } catch (err) {
    console.error('Spotify callback error:', err);
    res.redirect('/?spotify=failed');
  }
});

app.get('/api/spotify/status', authenticateToken, (req, res) => {
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const conn = db.prepare('SELECT * FROM spotify_connections WHERE user_id = ?').get(req.user.id);
    res.json({
      configured: Boolean(clientId),
      connected: Boolean(conn),
      isSharing: Boolean(conn && conn.is_sharing),
      currentTrack: conn && conn.last_track_title ? {
        title: conn.last_track_title,
        artist: conn.last_artist,
        albumArt: conn.last_album_art,
        spotifyUrl: conn.last_spotify_url,
        isPlaying: Boolean(conn.is_playing)
      } : null
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Spotify status' });
  }
});

app.post('/api/spotify/toggle-sharing', authenticateToken, (req, res) => {
  try {
    const { enabled } = req.body;
    const conn = db.prepare('SELECT is_sharing FROM spotify_connections WHERE user_id = ?').get(req.user.id);
    let nextSharing;
    if (typeof enabled === 'boolean') {
      nextSharing = enabled ? 1 : 0;
    } else {
      nextSharing = conn ? (conn.is_sharing === 1 ? 0 : 1) : 1;
    }

    if (!conn) {
      db.prepare(`
        INSERT INTO spotify_connections (user_id, is_sharing, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `).run(req.user.id, nextSharing);
    } else {
      db.prepare('UPDATE spotify_connections SET is_sharing = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(nextSharing, req.user.id);
    }
    res.json({ success: true, isSharing: Boolean(nextSharing) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle Spotify sharing' });
  }
});

app.post('/api/spotify/disconnect', authenticateToken, (req, res) => {
  try {
    db.prepare('DELETE FROM spotify_connections WHERE user_id = ?').run(req.user.id);
    res.json({ success: true, message: 'Spotify disconnected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect Spotify' });
  }
});

app.get('/api/spotify/current-track', authenticateToken, async (req, res) => {
  try {
    let conn = db.prepare('SELECT * FROM spotify_connections WHERE user_id = ?').get(req.user.id);
    if (!conn || !conn.access_token) {
      return res.json({ connected: false, isPlaying: false });
    }

    if (!conn.is_sharing) {
      return res.json({ connected: true, isSharing: false, isPlaying: false });
    }

    let accessToken = conn.access_token;
    // Refresh if within 2 minutes of expiry
    if (conn.expires_at && Date.now() > (conn.expires_at - 120000) && conn.refresh_token) {
      const clientId = process.env.SPOTIFY_CLIENT_ID;
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
      try {
        const refreshRes = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: conn.refresh_token
          }).toString()
        });
        const refreshData = await refreshRes.json();
        if (refreshData.access_token) {
          accessToken = refreshData.access_token;
          const expiresAt = Date.now() + (refreshData.expires_in || 3600) * 1000;
          db.prepare('UPDATE spotify_connections SET access_token = ?, expires_at = ? WHERE user_id = ?').run(accessToken, expiresAt, req.user.id);
        }
      } catch (refreshErr) {
        console.warn('Spotify token refresh error:', refreshErr.message);
      }
    }

    // Fetch currently playing track
    const spotifyRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (spotifyRes.status === 204 || spotifyRes.status > 300) {
      db.prepare('UPDATE spotify_connections SET is_playing = 0 WHERE user_id = ?').run(req.user.id);
      return res.json({ connected: true, isSharing: true, isPlaying: false });
    }

    const trackData = await spotifyRes.json();
    if (trackData && trackData.item) {
      const item = trackData.item;
      const title = item.name;
      const artist = item.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
      const albumArt = item.album?.images?.[0]?.url || null;
      const spotifyUrl = item.external_urls?.spotify || null;
      const isPlaying = trackData.is_playing ? 1 : 0;

      db.prepare(`
        UPDATE spotify_connections 
        SET last_track_title = ?, last_artist = ?, last_album_art = ?, last_spotify_url = ?, is_playing = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(title, artist, albumArt, spotifyUrl, isPlaying, req.user.id);

      return res.json({
        connected: true,
        isSharing: true,
        isPlaying: Boolean(isPlaying),
        title,
        artist,
        albumArt,
        spotifyUrl
      });
    }

    res.json({ connected: true, isSharing: true, isPlaying: false });
  } catch (err) {
    console.error('Fetch Spotify track error:', err.message);
    res.status(500).json({ error: 'Failed to query Spotify playback' });
  }
});

// ==========================================
// WebSockets & Real-Time Live Engine (Socket.IO)
// ==========================================
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  let currentRoomId = null;
  let currentUser = null;

  // Immediately send initial presence stats to newly connected socket
  socket.emit('presence-stats', getPresenceStats());

  // Visitor Presence Registration (Works for unauthenticated visitors & authenticated users)
  socket.on('presence-register', ({ visitorId, user, isAuthenticated, view, roomId }) => {
    if (!visitorId) return;
    socketToVisitor.set(socket.id, visitorId);

    let visitor = activeVisitors.get(visitorId);
    if (!visitor) {
      visitor = {
        visitorId,
        socketIds: new Set(),
        user: user || null,
        isAuthenticated: Boolean(isAuthenticated),
        view: view || 'lobby',
        roomId: roomId || null,
        lastSeen: Date.now()
      };
      activeVisitors.set(visitorId, visitor);
    } else {
      if (user) visitor.user = user;
      visitor.isAuthenticated = Boolean(isAuthenticated);
      if (view !== undefined) visitor.view = view;
      if (roomId !== undefined) visitor.roomId = roomId;
      visitor.lastSeen = Date.now();
    }
    visitor.socketIds.add(socket.id);
    broadcastPresenceStats();
  });

  socket.on('presence-update', ({ view, roomId, user, isAuthenticated }) => {
    const visitorId = socketToVisitor.get(socket.id);
    if (visitorId && activeVisitors.has(visitorId)) {
      const visitor = activeVisitors.get(visitorId);
      if (view !== undefined) visitor.view = view;
      if (roomId !== undefined) visitor.roomId = roomId;
      if (user !== undefined) visitor.user = user;
      if (isAuthenticated !== undefined) visitor.isAuthenticated = Boolean(isAuthenticated);
      visitor.lastSeen = Date.now();
      broadcastPresenceStats();
    }
  });

  // 1. Join Room & Start Authoritative Live Time Tracking
  socket.on('join-room', ({ roomId, user, mediaState, statusText, spotify }) => {
    // If client was already in another room, clean up previous room first
    if (currentRoomId && currentRoomId !== roomId) {
      handleLeave(socket, currentRoomId);
    }
    currentRoomId = roomId;
    currentUser = user || {
      id: 'guest-' + socket.id.slice(0, 5),
      display_name: 'Guest ' + socket.id.slice(0, 4),
      avatar_seed: socket.id
    };

    // Update presence record with current roomId
    const vId = socketToVisitor.get(socket.id);
    if (vId && activeVisitors.has(vId)) {
      const v = activeVisitors.get(vId);
      v.roomId = roomId;
      v.view = 'room';
      broadcastPresenceStats();
    }

    socket.join(roomId);
    const roomState = getOrCreateRoomState(roomId);

    // Purge disconnected dead sockets from roomState
    if (io && io.sockets && io.sockets.sockets) {
      for (const sid of Array.from(roomState.participants.keys())) {
        if (!io.sockets.sockets.has(sid)) {
          roomState.participants.delete(sid);
        }
      }
    }

    // Capacity limit protection to prevent server overload
    const MAX_ROOM_CAPACITY = parseInt(process.env.MAX_ROOM_CAPACITY, 10) || 50;
    if (roomState.participants.size >= MAX_ROOM_CAPACITY) {
      socket.emit('room-error', {
        message: `Study hall has reached maximum capacity (${MAX_ROOM_CAPACITY} scholars). Please select another hall.`
      });
      return;
    }

    const participantInfo = {
      socketId: socket.id,
      user: currentUser,
      mediaState: mediaState || { mic: false, video: true },
      statusText: statusText || 'Focusing...',
      spotify: spotify || null,
      joinedAt: Date.now(),
    };

    roomState.participants.set(socket.id, participantInfo);

    // If registered user, manage live session in DB & in-memory
    try {
      if (currentUser.id && !currentUser.id.startsWith('guest-')) {
        const existingUser = db.prepare('SELECT id FROM users WHERE id = ?').get(currentUser.id);
        if (existingUser) {
          const nowMs = Date.now();
          let session = userActiveSessions.get(currentUser.id);

          if (session) {
            if (session.roomId === roomId) {
              // User opened an additional tab or reconnected in the SAME room
              session.sockets.add(socket.id);
              socketToUserSession.set(socket.id, currentUser.id);
              session.lastHeartbeatMs = nowMs;
              console.log(`[Session] Re-attached tab to active session for ${currentUser.display_name} in room ${roomId} (Total tabs: ${session.sockets.size})`);
            } else {
              // User opened/switched to a DIFFERENT study room: cleanly finalize prior room session first!
              console.log(`[Session] Finalizing prior session in ${session.roomId} for user ${currentUser.display_name} before joining ${roomId}`);
              finalizeLiveSession(currentUser.id, nowMs);
              session = null;
            }
          }

          if (!session) {
            // Check if there is an active session in DB within 90s reconnect grace
            const recentDbSession = db.prepare(`
              SELECT id, room_id, strftime('%s', started_at) as start_epoch, strftime('%s', last_heartbeat) as hb_epoch, duration_seconds
              FROM live_sessions
              WHERE user_id = ? AND is_active = 1
              ORDER BY last_heartbeat DESC
              LIMIT 1
            `).get(currentUser.id);

            if (recentDbSession && recentDbSession.room_id === roomId && (nowMs - (recentDbSession.hb_epoch * 1000)) < 90000) {
              // Reconnect / refresh to same room: resume session!
              const startedAtMs = recentDbSession.start_epoch * 1000;
              session = {
                userId: currentUser.id,
                sessionId: recentDbSession.id,
                roomId,
                startedAtMs,
                lastHeartbeatMs: nowMs,
                lastCreditedAtMs: nowMs,
                sockets: new Set([socket.id]),
              };
              userActiveSessions.set(currentUser.id, session);
              socketToUserSession.set(socket.id, currentUser.id);
              console.log(`[Session] Resumed active study session ${session.sessionId} for ${currentUser.display_name} in room ${roomId}`);
            } else {
              // Close any dangling session in DB
              db.prepare(`
                UPDATE live_sessions 
                SET ended_at = CURRENT_TIMESTAMP, is_active = 0 
                WHERE user_id = ? AND is_active = 1
              `).run(currentUser.id);

              const sessionId = 'live-' + crypto.randomUUID();
              db.prepare(`
                INSERT INTO live_sessions (id, user_id, room_id, socket_id, started_at, last_heartbeat, duration_seconds, is_active)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1)
              `).run(sessionId, currentUser.id, roomId, socket.id);

              db.prepare('UPDATE users SET is_live = 1, current_room_id = ? WHERE id = ?').run(roomId, currentUser.id);

              session = {
                userId: currentUser.id,
                sessionId,
                roomId,
                startedAtMs: nowMs,
                lastHeartbeatMs: nowMs,
                lastCreditedAtMs: nowMs,
                sockets: new Set([socket.id]),
              };
              userActiveSessions.set(currentUser.id, session);
              socketToUserSession.set(socket.id, currentUser.id);
              console.log(`[Session] Started new live study session ${sessionId} for ${currentUser.display_name} in room ${roomId}`);
            }

            // Broadcast user is live globally
            io.emit('user-live-status-changed', {
              userId: currentUser.id,
              isLive: true,
              roomId
            });
            broadcastLeaderboardUpdate(true);
          }

          const elapsedSecs = Math.max(0, Math.floor((nowMs - session.startedAtMs) / 1000));
          socket.emit('session-live-started', {
            sessionId: session.sessionId,
            startedAt: session.startedAtMs,
            elapsedSeconds: elapsedSecs,
            isLive: true
          });
        }
      }
    } catch (sessionErr) {
      console.warn('[Session] Warning managing live session record:', sessionErr.message);
    }

    const allParticipants = Array.from(roomState.participants.values());
    const currentSession = currentUser.id ? userActiveSessions.get(currentUser.id) : null;
    socket.emit('room-joined', {
      roomId,
      participants: allParticipants,
      messages: roomState.messages,
      sessionStartedAt: currentSession ? currentSession.startedAtMs : Date.now(),
      elapsedSeconds: currentSession ? Math.max(0, Math.floor((Date.now() - currentSession.startedAtMs) / 1000)) : 0
    });

    socket.to(roomId).emit('user-joined', {
      participant: participantInfo
    });

    console.log(`[Socket] ${currentUser.display_name} joined room ${roomId} (Total: ${roomState.participants.size})`);
  });

  // 2. Periodic Live Session Heartbeat (Every 15-25s)
  socket.on('session-heartbeat', () => {
    const userId = socketToUserSession.get(socket.id);
    if (userId) {
      const session = userActiveSessions.get(userId);
      if (session) {
        const nowMs = Date.now();
        session.lastHeartbeatMs = nowMs;
        creditLiveSessionTime(session, nowMs);

        const totalElapsedSeconds = Math.max(0, Math.floor((nowMs - session.startedAtMs) / 1000));
        const userRec = db.prepare('SELECT total_live_seconds FROM users WHERE id = ?').get(session.userId);

        socket.emit('heartbeat-ack', {
          verifiedLiveSeconds: totalElapsedSeconds,
          totalUserLiveSeconds: userRec ? userRec.total_live_seconds : 0,
          isLive: true
        });
      }
    }
  });

  // 3. WebRTC Mesh Signaling Relay
  socket.on('webrtc-offer', ({ to, targetSocketId, offer, senderInfo }) => {
    const target = to || targetSocketId;
    if (!target) return;
    io.to(target).emit('webrtc-offer', {
      from: socket.id,
      senderSocketId: socket.id,
      offer,
      senderInfo: senderInfo || currentUser
    });
  });

  socket.on('webrtc-answer', ({ to, targetSocketId, answer }) => {
    const target = to || targetSocketId;
    if (!target) return;
    io.to(target).emit('webrtc-answer', {
      from: socket.id,
      senderSocketId: socket.id,
      answer
    });
  });

  socket.on('webrtc-ice-candidate', ({ to, targetSocketId, candidate }) => {
    const target = to || targetSocketId;
    if (!target) return;
    io.to(target).emit('webrtc-ice-candidate', {
      from: socket.id,
      senderSocketId: socket.id,
      candidate
    });
  });

  socket.on('speaking-change', ({ roomId, isSpeaking }) => {
    socket.to(roomId).emit('peer-speaking-changed', {
      socketId: socket.id,
      isSpeaking
    });
  });

  // Legacy signal relay for backwards-compatibility
  socket.on('signal-send', ({ to, signal, callerName, callerAvatar, mediaState }) => {
    io.to(to).emit('signal-receive', {
      from: socket.id,
      signal,
      callerName,
      callerAvatar,
      mediaState
    });
  });

  socket.on('update-media-state', ({ roomId, mediaState }) => {
    const roomState = activeRooms.get(roomId);
    if (roomState && roomState.participants.has(socket.id)) {
      const p = roomState.participants.get(socket.id);
      p.mediaState = { ...p.mediaState, ...mediaState };
      socket.to(roomId).emit('peer-media-changed', {
        socketId: socket.id,
        mediaState: p.mediaState
      });
    }
  });

  socket.on('update-status', ({ roomId, statusText }) => {
    const roomState = activeRooms.get(roomId);
    if (roomState && roomState.participants.has(socket.id)) {
      const p = roomState.participants.get(socket.id);
      p.statusText = statusText;
      io.to(roomId).emit('peer-status-changed', {
        socketId: socket.id,
        statusText
      });
    }
  });

  // Real-time Chat
  socket.on('send-message', ({ roomId, text, user }) => {
    if (!text || !text.trim()) return;

    const message = {
      id: 'msg-' + crypto.randomUUID(),
      text: text.trim(),
      user: user || currentUser,
      socketId: socket.id,
      timestamp: Date.now()
    };

    const roomState = getOrCreateRoomState(roomId);
    roomState.messages.push(message);
    if (roomState.messages.length > 60) {
      roomState.messages.shift();
    }

    io.to(roomId).emit('new-message', message);
    syncMessageToMongo(message, roomId);
  });

  // Floating live emoji reactions with rate-limiting and validation
  let lastReactionAt = 0;
  socket.on('send-reaction', ({ roomId, emoji, senderName }) => {
    const now = Date.now();
    if (now - lastReactionAt < 300) return; // Rate-limit: max 1 per 300ms
    lastReactionAt = now;

    if (typeof emoji !== 'string' || !emoji.trim() || emoji.length > 10) return;

    io.to(roomId).emit('reaction-received', {
      id: 'react-' + crypto.randomUUID(),
      emoji: emoji.trim(),
      senderName: senderName || (currentUser ? currentUser.display_name : 'Peer'),
      socketId: socket.id,
      timestamp: now
    });
  });

  // Spotify live playback status broadcast to room participants
  socket.on('spotify-status-updated', ({ roomId, spotify }) => {
    const roomState = activeRooms.get(roomId);
    if (roomState && roomState.participants.has(socket.id)) {
      const p = roomState.participants.get(socket.id);
      p.spotify = spotify;
      socket.to(roomId).emit('peer-spotify-updated', {
        socketId: socket.id,
        userId: currentUser ? currentUser.id : null,
        spotify
      });
    }
  });

  // 1-to-1 Private Direct Messaging between Room Participants
  socket.on('send-direct-message', ({ id, roomId, recipientId, recipientSocketId, text }) => {
    const rawText = (text || '').trim();
    if (!rawText || rawText.length > 2000) return;
    if (!currentUser || !currentUser.id) return;

    const dmId = id && typeof id === 'string' && id.startsWith('dm-') ? id : ('dm-' + crypto.randomUUID());
    const now = Date.now();
    const isoDate = new Date(now).toISOString();

    const dmRecord = {
      id: dmId,
      roomId,
      room_id: roomId,
      senderId: currentUser.id,
      sender_id: currentUser.id,
      recipientId,
      recipient_id: recipientId,
      senderName: currentUser.display_name || currentUser.username || 'Scholar',
      sender_name: currentUser.display_name || currentUser.username || 'Scholar',
      senderAvatar: currentUser.avatar_seed || 'User',
      message: rawText,
      timestamp: now,
      createdAt: isoDate,
      created_at: isoDate
    };

    // Save to database if sender is authenticated registered user
    if (!currentUser.id.startsWith('guest-') && recipientId && !recipientId.startsWith('guest-')) {
      try {
        db.prepare(`
          INSERT INTO direct_messages (id, room_id, sender_id, recipient_id, message)
          VALUES (?, ?, ?, ?, ?)
        `).run(dmId, roomId, currentUser.id, recipientId, rawText);
      } catch (err) {
        console.warn('[DM] Warning saving direct message:', err.message);
      }
    }

    // Deliver strictly to the recipient's socket(s) in this room
    const targetSockets = new Set();
    if (recipientSocketId) {
      targetSockets.add(recipientSocketId);
    }
    if (roomId && recipientId) {
      const roomState = activeRooms.get(roomId);
      if (roomState) {
        for (const [sId, p] of roomState.participants.entries()) {
          if (p.user?.id === recipientId || sId === recipientId) {
            targetSockets.add(sId);
          }
        }
      }
    }

    for (const sid of targetSockets) {
      io.to(sid).emit('direct-message-received', dmRecord);
    }

    // Acknowledge back to sender socket
    socket.emit('direct-message-sent', dmRecord);
  });

  // Explicit Leave Room
  socket.on('leave-room', ({ roomId }) => {
    handleLeave(socket, roomId);
  });

  socket.on('disconnect', () => {
    if (currentRoomId) {
      handleLeave(socket, currentRoomId);
    }
    const visitorId = socketToVisitor.get(socket.id);
    if (visitorId) {
      socketToVisitor.delete(socket.id);
      const visitor = activeVisitors.get(visitorId);
      if (visitor) {
        visitor.socketIds.delete(socket.id);
        if (visitor.socketIds.size === 0) {
          activeVisitors.delete(visitorId);
        }
      }
      broadcastPresenceStats();
    }
  });

  function handleLeave(s, roomId) {
    if (currentRoomId === roomId) {
      currentRoomId = null;
    }
    s.leave(roomId);
    const roomState = activeRooms.get(roomId);
    if (roomState) {
      roomState.participants.delete(s.id);
      socket.to(roomId).emit('user-left', {
        socketId: s.id,
        user: currentUser
      });
    }

    // Update presence record on leaving room
    const vId = socketToVisitor.get(s.id);
    if (vId && activeVisitors.has(vId)) {
      const v = activeVisitors.get(vId);
      if (v.roomId === roomId) {
        v.roomId = null;
        v.view = 'lobby';
      }
    }
    broadcastPresenceStats();

    // Multi-tab aware authoritative session handling
    const userId = socketToUserSession.get(s.id);
    if (userId) {
      const session = userActiveSessions.get(userId);
      if (session) {
        session.sockets.delete(s.id);
        socketToUserSession.delete(s.id);

        if (session.sockets.size === 0) {
          // Last tab closed or left: finalize session now!
          finalizeLiveSession(userId, Date.now());
          console.log(`[Session] Finalized session for user ${userId} in room ${roomId} (all tabs closed/left)`);
        } else {
          console.log(`[Session] Closed tab for user ${userId} in room ${roomId} (${session.sockets.size} tabs still active)`);
        }
      }
    }

    console.log(`[Socket] ${s.id} left room ${roomId}`);
  }
});

// MongoDB Health & Verification Endpoint (for evaluators & tests)
app.get('/api/mongodb/status', (req, res) => {
  const connected = getIsConnected();
  res.json({
    status: connected ? 'connected' : 'running_fallback',
    engine: connected ? 'MongoDB Atlas (Mongoose)' : 'Local High-Performance SQLite (Fallback)',
    configured: Boolean(process.env.MONGODB_URI),
    models: connected ? ['User', 'Blog', 'Room', 'StudySession', 'Message'] : []
  });
});

// Serve frontend production build if available
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/socket.io') && !req.path.startsWith('/uploads')) {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
}

const PORT = process.env.PORT || 5050;
server.listen(PORT, async () => {
  console.log(`=================================================`);
  console.log(`  StudyStream Live Server Running on port ${PORT}`);
  console.log(`  Community Blogs & Unlimited Live Hours: ACTIVE `);
  console.log(`=================================================`);
  
  // Connect to MongoDB Atlas if MONGODB_URI is provided
  const mongoConnected = await connectMongoDB();
  if (mongoConnected) {
    await initialMongoSync();
  }
});
