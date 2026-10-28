const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();
const express = require('express');
const http = require('http');
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
// ==========================================
// MongoDB Cloud Database Synchronization & Bidirectional Hydration
// ==========================================
async function syncUserToMongo(user) {
  if (!getIsConnected() || !user || !models.User) return;
  try {
    const fullUser = user.password_hash !== undefined ? user : db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    if (!fullUser) return;
    await models.User.findOneAndUpdate(
      { id: fullUser.id },
      {
        id: fullUser.id,
        username: fullUser.username,
        email: fullUser.email,
        password_hash: fullUser.password_hash || '',
        display_name: fullUser.display_name,
        avatar_seed: fullUser.avatar_seed || 'Felix',
        daily_goal_minutes: fullUser.daily_goal_minutes || 120,
        total_focus_minutes: fullUser.total_focus_minutes || 0,
        total_live_seconds: fullUser.total_live_seconds || 0,
        is_live: Boolean(fullUser.is_live),
        current_room_id: fullUser.current_room_id || null,
        current_streak: fullUser.current_streak || 0,
        longest_streak: fullUser.longest_streak || 0,
        last_active_date: fullUser.last_active_date || null,
        bio: fullUser.bio || '',
        role: fullUser.role || 'user',
        is_suspended: Boolean(fullUser.is_suspended),
        google_id: fullUser.google_id || null,
        college: fullUser.college || '',
        course: fullUser.course || '',
        year_of_study: fullUser.year_of_study || '',
        location: fullUser.location || '',
        academic_interests: fullUser.academic_interests || '',
        subjects: fullUser.subjects || '',
        learning_goals: fullUser.learning_goals || '',
        skills: fullUser.skills || '',
        languages: fullUser.languages || '',
        avatar_url: fullUser.avatar_url || null,
        show_college: fullUser.show_college !== undefined ? Boolean(fullUser.show_college) : true,
        show_stats: fullUser.show_stats !== undefined ? Boolean(fullUser.show_stats) : true,
        show_goals: fullUser.show_goals !== undefined ? Boolean(fullUser.show_goals) : true,
        show_location: fullUser.show_location !== undefined ? Boolean(fullUser.show_location) : true
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.warn('[MongoDB] Sync User warning:', err.message);
  }
}

async function syncBlogToMongo(blogId) {
  if (!getIsConnected() || !blogId || !models.Blog) return;
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
        author_name: blog.author_name || 'Scholar',
        author_username: blog.author_username || 'scholar',
        category: blog.category || 'General',
        image_url: blog.image_url || null,
        likes_count: blog.likes_count || likes.length,
        comments_count: blog.comments_count || comments.length,
        likes: likes,
        comments: comments.map(c => ({
          id: c.id,
          user_id: c.user_id,
          author_name: c.author_name || 'Scholar',
          author_username: c.author_username || 'scholar',
          content: c.comment || c.content || '',
          created_at: c.created_at ? new Date(c.created_at) : new Date()
        }))
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.warn('[MongoDB] Sync Blog warning:', err.message);
  }
}

async function syncRoomToMongo(room) {
  if (!getIsConnected() || !room || !models.Room) return;
  try {
    const fullRoom = room.passcode !== undefined ? room : db.prepare('SELECT * FROM rooms WHERE id = ?').get(room.id);
    if (!fullRoom) return;
    await models.Room.findOneAndUpdate(
      { id: fullRoom.id },
      {
        id: fullRoom.id,
        name: fullRoom.name,
        description: fullRoom.description || '',
        category: fullRoom.category,
        pomodoro_work_mins: fullRoom.pomodoro_work_mins || 25,
        pomodoro_break_mins: fullRoom.pomodoro_break_mins || 5,
        bg_theme: fullRoom.bg_theme || 'cosmic',
        is_private: Boolean(fullRoom.is_private),
        passcode: fullRoom.passcode || null,
        created_by: fullRoom.created_by || null,
        empty_since: fullRoom.empty_since ? new Date(fullRoom.empty_since) : null
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.warn('[MongoDB] Sync Room warning:', err.message);
  }
}

async function syncMessageToMongo(msg, roomId) {
  if (!getIsConnected() || !msg || !models.Message) return;
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

async function syncTaskToMongo(task) {
  if (!getIsConnected() || !task || !models.Task) return;
  try {
    await models.Task.findOneAndUpdate(
      { id: task.id },
      {
        id: task.id,
        user_id: task.user_id,
        room_id: task.room_id || null,
        title: task.title,
        completed: Boolean(task.completed),
        created_at: task.created_at ? new Date(task.created_at) : new Date()
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.warn('[MongoDB] Sync Task warning:', err.message);
  }
}

async function syncSessionToMongo(session) {
  if (!getIsConnected() || !session || !models.StudySession) return;
  try {
    await models.StudySession.findOneAndUpdate(
      { id: session.id },
      {
        id: session.id,
        user_id: session.user_id,
        room_id: session.room_id || null,
        duration_minutes: session.duration_minutes || 0,
        mode: session.mode || 'work',
        subject: session.subject || 'General Study',
        notes: session.notes || '',
        completed_at: session.completed_at ? new Date(session.completed_at) : new Date()
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.warn('[MongoDB] Sync Session warning:', err.message);
  }
}

async function syncDirectMessageToMongo(dm) {
  if (!getIsConnected() || !dm || !models.DirectMessage) return;
  try {
    await models.DirectMessage.findOneAndUpdate(
      { id: dm.id },
      {
        id: dm.id,
        room_id: dm.room_id,
        sender_id: dm.sender_id,
        recipient_id: dm.recipient_id,
        message: dm.message,
        created_at: dm.created_at ? new Date(dm.created_at) : new Date()
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.warn('[MongoDB] Sync DirectMessage warning:', err.message);
  }
}

async function syncLiveSessionToMongo(session) {
  if (!getIsConnected() || !session || !models.LiveSession) return;
  try {
    await models.LiveSession.findOneAndUpdate(
      { id: session.id },
      {
        id: session.id,
        user_id: session.user_id,
        room_id: session.room_id,
        socket_id: session.socket_id || null,
        started_at: session.started_at ? new Date(session.started_at) : new Date(),
        ended_at: session.ended_at ? new Date(session.ended_at) : null,
        duration_seconds: session.duration_seconds || 0,
        last_heartbeat: session.last_heartbeat ? new Date(session.last_heartbeat) : new Date(),
        is_active: Boolean(session.is_active)
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.warn('[MongoDB] Sync LiveSession warning:', err.message);
  }
}

async function enforceSuperAdminRole() {
  const superAdminEmail = 'ujjwalprakash1812@gmail.com';
  try {
    db.prepare("UPDATE users SET role = 'superadmin' WHERE LOWER(TRIM(email)) = ?").run(superAdminEmail);
    db.prepare("UPDATE users SET role = 'user' WHERE LOWER(TRIM(email)) != ? AND role IN ('admin', 'superadmin')").run(superAdminEmail);

    if (getIsConnected() && models.User) {
      await models.User.updateMany(
        { email: superAdminEmail },
        { $set: { role: 'superadmin' } }
      );
      await models.User.updateMany(
        { email: { $ne: superAdminEmail }, role: { $in: ['admin', 'superadmin'] } },
        { $set: { role: 'user' } }
      );
    }
  } catch (err) {
    console.warn('Super Admin role enforcement warning:', err.message);
  }
}

async function synchronizeCloudDatabase() {
  if (!getIsConnected()) return;
  try {
    const mongoUserCount = await models.User.countDocuments();
    const mongoRoomCount = await models.Room.countDocuments();
    const mongoBlogCount = await models.Blog.countDocuments();

    console.log(`📊 Cloud Database Status: ${mongoUserCount} users, ${mongoRoomCount} rooms, ${mongoBlogCount} blogs in MongoDB Atlas.`);

    if (mongoUserCount > 0 || mongoRoomCount > 0 || mongoBlogCount > 0) {
      // Cloud database has records -> Hydrate local SQLite so it matches MongoDB Atlas exactly
      console.log('⚡ Hydrating runtime cache from MongoDB Atlas cloud database...');

      // 1. Hydrate Users
      const users = await models.User.find({}).lean();
      for (const u of users) {
        db.prepare(`
          INSERT INTO users (
            id, username, email, password_hash, display_name, avatar_seed,
            daily_goal_minutes, total_focus_minutes, total_live_seconds,
            is_live, current_room_id, current_streak, longest_streak,
            last_active_date, bio, role, is_suspended, google_id,
            college, course, year_of_study, location, academic_interests,
            subjects, learning_goals, skills, languages, avatar_url,
            show_college, show_stats, show_goals, show_location
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            username = excluded.username,
            email = excluded.email,
            password_hash = excluded.password_hash,
            display_name = excluded.display_name,
            avatar_seed = excluded.avatar_seed,
            daily_goal_minutes = excluded.daily_goal_minutes,
            total_focus_minutes = excluded.total_focus_minutes,
            total_live_seconds = excluded.total_live_seconds,
            is_live = excluded.is_live,
            current_room_id = excluded.current_room_id,
            current_streak = excluded.current_streak,
            longest_streak = excluded.longest_streak,
            last_active_date = excluded.last_active_date,
            bio = excluded.bio,
            role = excluded.role,
            is_suspended = excluded.is_suspended,
            google_id = excluded.google_id,
            college = excluded.college,
            course = excluded.course,
            year_of_study = excluded.year_of_study,
            location = excluded.location,
            academic_interests = excluded.academic_interests,
            subjects = excluded.subjects,
            learning_goals = excluded.learning_goals,
            skills = excluded.skills,
            languages = excluded.languages,
            avatar_url = excluded.avatar_url,
            show_college = excluded.show_college,
            show_stats = excluded.show_stats,
            show_goals = excluded.show_goals,
            show_location = excluded.show_location;
        `).run(
          u.id, u.username, u.email, u.password_hash || '', u.display_name, u.avatar_seed || 'Felix',
          u.daily_goal_minutes || 120, u.total_focus_minutes || 0, u.total_live_seconds || 0,
          u.is_live ? 1 : 0, u.current_room_id || null, u.current_streak || 0, u.longest_streak || 0,
          u.last_active_date || null, u.bio || '', u.role || 'user', u.is_suspended ? 1 : 0, u.google_id || null,
          u.college || '', u.course || '', u.year_of_study || '', u.location || '', u.academic_interests || '',
          u.subjects || '', u.learning_goals || '', u.skills || '', u.languages || '', u.avatar_url || null,
          u.show_college !== undefined ? (u.show_college ? 1 : 0) : 1,
          u.show_stats !== undefined ? (u.show_stats ? 1 : 0) : 1,
          u.show_goals !== undefined ? (u.show_goals ? 1 : 0) : 1,
          u.show_location !== undefined ? (u.show_location ? 1 : 0) : 1
        );
      }

      // 2. Hydrate Rooms
      const rooms = await models.Room.find({}).lean();
      for (const r of rooms) {
        db.prepare(`
          INSERT INTO rooms (
            id, name, description, category, pomodoro_work_mins, pomodoro_break_mins,
            bg_theme, is_private, passcode, created_by, empty_since
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            description = excluded.description,
            category = excluded.category,
            pomodoro_work_mins = excluded.pomodoro_work_mins,
            pomodoro_break_mins = excluded.pomodoro_break_mins,
            bg_theme = excluded.bg_theme,
            is_private = excluded.is_private,
            passcode = COALESCE(excluded.passcode, rooms.passcode),
            created_by = excluded.created_by,
            empty_since = excluded.empty_since;
        `).run(
          r.id, r.name, r.description || '', r.category || 'Silent Study',
          r.pomodoro_work_mins || 25, r.pomodoro_break_mins || 5,
          r.bg_theme || 'cosmic', r.is_private ? 1 : 0, r.passcode || null, r.created_by || null,
          r.empty_since ? new Date(r.empty_since).toISOString() : null
        );
      }

      // 3. Hydrate Blogs, Likes, and Comments
      const blogs = await models.Blog.find({}).lean();
      for (const b of blogs) {
        db.prepare(`
          INSERT INTO blogs (
            id, author_id, title, content, category, image_url, likes_count, comments_count, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published')
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            content = excluded.content,
            category = excluded.category,
            image_url = excluded.image_url,
            likes_count = excluded.likes_count,
            comments_count = excluded.comments_count;
        `).run(
          b.id, b.author_id, b.title, b.content, b.category || 'General',
          b.image_url || null, b.likes_count || (b.likes ? b.likes.length : 0),
          b.comments_count || (b.comments ? b.comments.length : 0)
        );

        if (Array.isArray(b.likes)) {
          for (const uid of b.likes) {
            try {
              db.prepare(`
                INSERT INTO blog_likes (id, blog_id, user_id)
                VALUES (?, ?, ?)
                ON CONFLICT(blog_id, user_id) DO NOTHING;
              `).run(`like-${b.id}-${uid}`, b.id, uid);
            } catch (e) {}
          }
        }

        if (Array.isArray(b.comments)) {
          for (const c of b.comments) {
            try {
              db.prepare(`
                INSERT INTO blog_comments (id, blog_id, user_id, comment, created_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET comment = excluded.comment;
              `).run(
                c.id || `c-${crypto.randomUUID()}`,
                b.id,
                c.user_id,
                c.content || c.comment || '',
                c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString()
              );
            } catch (e) {}
          }
        }
      }

      // 4. Hydrate Tasks
      if (models.Task) {
        const tasks = await models.Task.find({}).lean();
        for (const t of tasks) {
          db.prepare(`
            INSERT INTO tasks (id, user_id, room_id, title, completed)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET completed = excluded.completed, title = excluded.title;
          `).run(t.id, t.user_id, t.room_id || null, t.title, t.completed ? 1 : 0);
        }
      }

      // 5. Hydrate Direct Messages
      if (models.DirectMessage) {
        const dms = await models.DirectMessage.find({}).limit(500).lean();
        for (const dm of dms) {
          db.prepare(`
            INSERT INTO direct_messages (id, room_id, sender_id, recipient_id, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING;
          `).run(
            dm.id, dm.room_id, dm.sender_id, dm.recipient_id, dm.message,
            dm.created_at ? new Date(dm.created_at).toISOString() : new Date().toISOString()
          );
        }
      }

      console.log(`✅ Cache hydrated successfully from MongoDB Atlas: ${users.length} users, ${rooms.length} rooms, ${blogs.length} blogs!`);
    } else {
      // MongoDB Atlas is brand new -> Migrate existing local SQLite database to MongoDB Atlas
      console.log('🚀 Migrating existing local records to MongoDB Atlas cloud database...');
      const localUsers = db.prepare('SELECT * FROM users').all();
      for (const u of localUsers) {
        await syncUserToMongo(u);
      }
      const localRooms = db.prepare('SELECT * FROM rooms').all();
      for (const r of localRooms) {
        await syncRoomToMongo(r);
      }
      const localBlogs = db.prepare('SELECT id FROM blogs').all();
      for (const b of localBlogs) {
        await syncBlogToMongo(b.id);
      }
      const localTasks = db.prepare('SELECT * FROM tasks').all();
      for (const t of localTasks) {
        await syncTaskToMongo(t);
      }
      const localDMs = db.prepare('SELECT * FROM direct_messages').all();
      for (const dm of localDMs) {
        await syncDirectMessageToMongo(dm);
      }
      console.log(`✅ Initial cloud migration complete: ${localUsers.length} users, ${localRooms.length} rooms, ${localBlogs.length} blogs migrated to MongoDB Atlas!`);
    }

    await enforceSuperAdminRole();
  } catch (err) {
    console.error('❌ Cloud database synchronization error:', err);
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

const avatarsDir = path.join(__dirname, 'uploads', 'avatars');
try { fs.mkdirSync(avatarsDir, { recursive: true }); } catch (e) {}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest = avatarsDir;
    if (Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)) {
      dest = path.join('/tmp', 'uploads', 'avatars');
    }
    try { fs.mkdirSync(dest, { recursive: true }); } catch (e) {}
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.png';
    cb(null, 'avatar-' + req.user.id + '-' + Date.now() + safeExt);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image format. Only JPEG, PNG, and WebP images are allowed.'));
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

    // Sync finalized live session and updated user statistics to MongoDB Atlas
    const fullFinalSession = db.prepare('SELECT * FROM live_sessions WHERE id = ?').get(session.sessionId);
    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId);
    syncLiveSessionToMongo(fullFinalSession);
    syncUserToMongo(updatedUser);
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
const SUPER_ADMIN_EMAIL = 'ujjwalprakash1812@gmail.com';

function isSuperAdminEmail(email) {
  return typeof email === 'string' && email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

function isSuperAdminUser(user) {
  if (!user || !user.email) return false;
  return isSuperAdminEmail(user.email);
}

function generateToken(user) {
  const isSuperAdmin = isSuperAdminEmail(user.email);
  const effectiveRole = isSuperAdmin ? 'superadmin' : 'user';
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: effectiveRole,
      isSuperAdmin: isSuperAdmin
    },
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
    // Check if user account is suspended in database
    const dbUser = db.prepare('SELECT id, email, is_suspended FROM users WHERE id = ?').get(decoded.id);
    if (dbUser && dbUser.is_suspended) {
      return res.status(403).json({ error: 'Your account has been suspended by an administrator.' });
    }
    // Strict defense-in-depth: sync effective role with email
    if (decoded && decoded.email) {
      decoded.isSuperAdmin = isSuperAdminEmail(decoded.email);
      decoded.role = decoded.isSuperAdmin ? 'superadmin' : 'user';
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
      const dbUser = db.prepare('SELECT id, email, is_suspended FROM users WHERE id = ?').get(decoded.id);
      if (!dbUser || !dbUser.is_suspended) {
        decoded.isSuperAdmin = isSuperAdminEmail(decoded.email);
        decoded.role = decoded.isSuperAdmin ? 'superadmin' : 'user';
        req.user = decoded;
      }
    }
    next();
  });
}

function requireSuperAdmin(req, res, next) {
  authenticateToken(req, res, () => {
    // Re-verify strictly against database record to prevent token tampering or client claims
    const dbUser = db.prepare('SELECT id, username, email, role, is_suspended FROM users WHERE id = ?').get(req.user.id);
    if (!dbUser || !isSuperAdminEmail(dbUser.email)) {
      return res.status(403).json({ error: 'Access denied: Super Admin privileges required' });
    }
    if (dbUser.is_suspended) {
      return res.status(403).json({ error: 'Super Admin account is currently suspended' });
    }
    req.superAdmin = dbUser;
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, cleanUsername, cleanEmail, passwordHash, display, avatarSeed, todayStr, isSuperAdminEmail(cleanEmail) ? 'superadmin' : 'user');

    const newUser = db.prepare('SELECT id, username, email, display_name, avatar_seed, daily_goal_minutes, total_focus_minutes, total_live_seconds, is_live, current_room_id, current_streak, longest_streak, bio, role, is_suspended, created_at FROM users WHERE id = ?').get(userId);
    const isSuperAdmin = isSuperAdminEmail(newUser.email);
    const token = generateToken(newUser);
    syncUserToMongo(newUser);

    res.status(201).json({
      message: 'Account registered successfully',
      token,
      user: { ...newUser, isSuperAdmin }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: 'Username/email and password required' });
    }

    const cleanLogin = login.trim().toLowerCase();
    let user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(cleanLogin, cleanLogin);

    // If not found in local cache, query authoritative MongoDB Atlas cloud database
    if (!user && getIsConnected() && models.User) {
      try {
        const mongoUser = await models.User.findOne({
          $or: [{ username: cleanLogin }, { email: cleanLogin }]
        }).lean();
        if (mongoUser) {
          db.prepare(`
            INSERT INTO users (
              id, username, email, password_hash, display_name, avatar_seed,
              daily_goal_minutes, total_focus_minutes, total_live_seconds,
              is_live, current_room_id, current_streak, longest_streak,
              last_active_date, bio, role, is_suspended, google_id,
              college, course, year_of_study, location, academic_interests,
              subjects, learning_goals, skills, languages, avatar_url,
              show_college, show_stats, show_goals, show_location
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              username = excluded.username,
              email = excluded.email,
              password_hash = excluded.password_hash,
              display_name = excluded.display_name,
              role = excluded.role,
              is_suspended = excluded.is_suspended,
              college = excluded.college,
              course = excluded.course,
              year_of_study = excluded.year_of_study,
              location = excluded.location,
              academic_interests = excluded.academic_interests,
              subjects = excluded.subjects,
              learning_goals = excluded.learning_goals,
              skills = excluded.skills,
              languages = excluded.languages,
              avatar_url = excluded.avatar_url,
              show_college = excluded.show_college,
              show_stats = excluded.show_stats,
              show_goals = excluded.show_goals,
              show_location = excluded.show_location;
          `).run(
            mongoUser.id, mongoUser.username, mongoUser.email, mongoUser.password_hash || '',
            mongoUser.display_name, mongoUser.avatar_seed || 'Felix',
            mongoUser.daily_goal_minutes || 120, mongoUser.total_focus_minutes || 0,
            mongoUser.total_live_seconds || 0, mongoUser.is_live ? 1 : 0,
            mongoUser.current_room_id || null, mongoUser.current_streak || 0,
            mongoUser.longest_streak || 0, mongoUser.last_active_date || null,
            mongoUser.bio || '', mongoUser.role || 'user', mongoUser.is_suspended ? 1 : 0,
            mongoUser.google_id || null,
            mongoUser.college || '', mongoUser.course || '', mongoUser.year_of_study || '',
            mongoUser.location || '', mongoUser.academic_interests || '', mongoUser.subjects || '',
            mongoUser.learning_goals || '', mongoUser.skills || '', mongoUser.languages || '',
            mongoUser.avatar_url || null,
            mongoUser.show_college !== undefined ? (mongoUser.show_college ? 1 : 0) : 1,
            mongoUser.show_stats !== undefined ? (mongoUser.show_stats ? 1 : 0) : 1,
            mongoUser.show_goals !== undefined ? (mongoUser.show_goals ? 1 : 0) : 1,
            mongoUser.show_location !== undefined ? (mongoUser.show_location ? 1 : 0) : 1
          );
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(mongoUser.id);
        }
      } catch (err) {
        console.warn('[MongoDB] Login fallback lookup warning:', err.message);
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.is_suspended) {
      return res.status(403).json({ error: 'Your account has been suspended by an administrator.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isSuperAdmin = isSuperAdminEmail(user.email);
    const effectiveRole = isSuperAdmin ? 'superadmin' : 'user';
    if (user.role !== effectiveRole) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(effectiveRole, user.id);
      user.role = effectiveRole;
    }

    const { password_hash, ...safeUser } = user;
    safeUser.role = effectiveRole;
    safeUser.isSuperAdmin = isSuperAdmin;
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

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists with this email or google_id
    let user = db.prepare('SELECT * FROM users WHERE email = ? OR google_id = ?').get(cleanEmail, uid || '');

    if (user && user.is_suspended) {
      return res.status(403).json({ error: 'Your account has been suspended by an administrator.' });
    }

    if (!user) {
      // Create new user for first-time Google signup
      const userId = 'user-' + crypto.randomUUID();
      const baseUsername = (cleanEmail.split('@')[0] || 'scholar').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 15);
      
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
      const effectiveRole = isSuperAdminEmail(cleanEmail) ? 'superadmin' : 'user';

      db.prepare(`
        INSERT INTO users (
          id, username, email, password_hash, display_name, avatar_seed,
          daily_goal_minutes, total_focus_minutes, total_live_seconds, current_streak, longest_streak, bio, role, google_id
        )
        VALUES (?, ?, ?, ?, ?, ?, 120, 0, 0, 0, 0, 'Ready to focus and achieve big goals!', ?, ?)
      `).run(
        userId, usernameCandidate, cleanEmail, passwordHash, userDisplayName, avatarSeed, effectiveRole, uid || null
      );

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    } else if (uid && !user.google_id) {
      // Link google_id if not linked yet
      db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(uid, user.id);
    }

    const isSuperAdmin = isSuperAdminEmail(user.email);
    const effectiveRole = isSuperAdmin ? 'superadmin' : 'user';
    if (user.role !== effectiveRole) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(effectiveRole, user.id);
      user.role = effectiveRole;
    }

    const { password_hash, ...safeUser } = user;
    safeUser.role = effectiveRole;
    safeUser.isSuperAdmin = isSuperAdmin;
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

function calculateAchievements({ totalLiveSeconds, currentStreak, longestStreak, sessionsCount, blogsCount, roomsCreatedCount }) {
  const maxStreak = Math.max(Number(currentStreak) || 0, Number(longestStreak) || 0);
  const liveSecs = Number(totalLiveSeconds) || 0;
  const sessions = Number(sessionsCount) || 0;
  const blogs = Number(blogsCount) || 0;
  const rooms = Number(roomsCreatedCount) || 0;

  return [
    {
      id: 'first_session',
      title: 'First Focus Step',
      description: 'Completed your first study session in StudySST.',
      category: 'Milestone',
      icon: 'Zap',
      unlocked: sessions >= 1,
      progress: sessions >= 1 ? 100 : 0
    },
    {
      id: 'consistent_learner',
      title: 'Consistent Learner',
      description: 'Completed 10 focus sessions or maintained a 3-day streak.',
      category: 'Dedication',
      icon: 'TrendingUp',
      unlocked: sessions >= 10 || maxStreak >= 3,
      progress: Math.min(100, Math.max(Math.round((sessions / 10) * 100), Math.round((maxStreak / 3) * 100)))
    },
    {
      id: '10_hours',
      title: 'Focus Apprentice',
      description: 'Logged 10+ hours of verified live study time.',
      category: 'Time',
      icon: 'Clock',
      unlocked: liveSecs >= 10 * 3600,
      progress: Math.min(100, Math.round((liveSecs / (10 * 3600)) * 100))
    },
    {
      id: '50_hours',
      title: 'Dedicated Scholar',
      description: 'Logged 50+ hours of verified live study time.',
      category: 'Time',
      icon: 'BookOpen',
      unlocked: liveSecs >= 50 * 3600,
      progress: Math.min(100, Math.round((liveSecs / (50 * 3600)) * 100))
    },
    {
      id: '100_hours',
      title: 'Master of Focus',
      description: 'Reached the elite milestone of 100+ verified live study hours.',
      category: 'Time',
      icon: 'Award',
      unlocked: liveSecs >= 100 * 3600,
      progress: Math.min(100, Math.round((liveSecs / (100 * 3600)) * 100))
    },
    {
      id: '7_day_streak',
      title: 'Unstoppable Momentum',
      description: 'Maintained a continuous 7-day study streak.',
      category: 'Streak',
      icon: 'Flame',
      unlocked: maxStreak >= 7,
      progress: Math.min(100, Math.round((maxStreak / 7) * 100))
    },
    {
      id: 'first_blog',
      title: 'Knowledge Sharer',
      description: 'Published your first community study blog.',
      category: 'Community',
      icon: 'FileText',
      unlocked: blogs >= 1,
      progress: blogs >= 1 ? 100 : 0
    },
    {
      id: 'room_creator',
      title: 'Study Hall Host',
      description: 'Created a custom study room for collaborative focus.',
      category: 'Community',
      icon: 'Users',
      unlocked: rooms >= 1,
      progress: rooms >= 1 ? 100 : 0
    }
  ];
}

app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT 
        id, username, email, display_name, avatar_seed, avatar_url,
        daily_goal_minutes, total_focus_minutes, total_live_seconds,
        is_live, current_room_id, current_streak, longest_streak,
        bio, role, college, course, year_of_study, location,
        academic_interests, subjects, learning_goals, skills, languages,
        show_college, show_stats, show_goals, show_location,
        is_suspended, created_at
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.is_suspended) {
      return res.status(403).json({ error: 'Your account has been suspended by an administrator.' });
    }
    const isSuperAdmin = isSuperAdminEmail(user.email);
    const effectiveRole = isSuperAdmin ? 'superadmin' : 'user';
    if (user.role !== effectiveRole) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(effectiveRole, user.id);
      user.role = effectiveRole;
    }
    res.json({ user: { ...user, role: effectiveRole, isSuperAdmin } });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching profile' });
  }
});

// Comprehensive Student Profile Endpoints
app.get('/api/users/profile/:identifier', optionalAuthenticateToken, (req, res) => {
  try {
    const { identifier } = req.params;
    if (!identifier) {
      return res.status(400).json({ error: 'User identifier is required' });
    }

    let targetUser = db.prepare(`
      SELECT 
        id, username, email, display_name, avatar_seed, avatar_url,
        daily_goal_minutes, total_focus_minutes, total_live_seconds,
        is_live, current_room_id, current_streak, longest_streak,
        bio, role, college, course, year_of_study, location,
        academic_interests, subjects, learning_goals, skills, languages,
        show_college, show_stats, show_goals, show_location,
        is_suspended, created_at
      FROM users 
      WHERE id = ? OR username = ?
    `).get(identifier, identifier);

    if (!targetUser) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    const isOwnProfile = Boolean(req.user && req.user.id === targetUser.id);
    const isSuperAdmin = Boolean(req.user && req.user.isSuperAdmin);

    // Calculate verified study statistics from authoritative database records
    const liveSessionsCount = db.prepare('SELECT COUNT(*) as count FROM live_sessions WHERE user_id = ? AND duration_seconds >= 60').get(targetUser.id).count;
    const studySessionsCount = db.prepare('SELECT COUNT(*) as count FROM study_sessions WHERE user_id = ?').get(targetUser.id).count;
    const totalSessions = liveSessionsCount + studySessionsCount;

    const blogsCount = db.prepare("SELECT COUNT(*) as count FROM blogs WHERE author_id = ? AND status = 'published'").get(targetUser.id).count;
    const roomsCreatedCount = db.prepare('SELECT COUNT(*) as count FROM rooms WHERE created_by = ?').get(targetUser.id).count;

    const higherRankCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE total_live_seconds > ?').get(targetUser.total_live_seconds || 0).count;
    const leaderboardRank = higherRankCount + 1;
    const totalStudents = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

    const badges = calculateAchievements({
      totalLiveSeconds: targetUser.total_live_seconds,
      currentStreak: targetUser.current_streak,
      longestStreak: targetUser.longest_streak,
      sessionsCount: totalSessions,
      blogsCount,
      roomsCreatedCount
    });

    // Recent published blogs
    const blogs = db.prepare(`
      SELECT id, title, category, image_url, likes_count, comments_count, created_at,
             SUBSTR(content, 1, 200) as excerpt
      FROM blogs
      WHERE author_id = ? AND status = 'published'
      ORDER BY created_at DESC
      LIMIT 10
    `).all(targetUser.id);

    // Recent study activity
    const recentActivity = db.prepare(`
      SELECT s.id, s.room_id, r.name as room_name, s.started_at, s.ended_at, s.duration_seconds
      FROM live_sessions s
      LEFT JOIN rooms r ON s.room_id = r.id
      WHERE s.user_id = ? AND s.duration_seconds >= 60
      ORDER BY s.started_at DESC
      LIMIT 10
    `).all(targetUser.id);

    const fullStats = {
      totalLiveSeconds: targetUser.total_live_seconds || 0,
      totalFocusMinutes: targetUser.total_focus_minutes || 0,
      totalHours: Number(((targetUser.total_live_seconds || 0) / 3600).toFixed(1)),
      sessionsCompleted: totalSessions,
      currentStreak: targetUser.current_streak || 0,
      longestStreak: targetUser.longest_streak || 0,
      leaderboardRank,
      totalStudents,
      blogsPublished: blogsCount,
      roomsCreated: roomsCreatedCount
    };

    // Construct profile object with privacy safeguards
    const profile = {
      id: targetUser.id,
      username: targetUser.username,
      displayName: targetUser.display_name,
      avatarSeed: targetUser.avatar_seed,
      avatarUrl: targetUser.avatar_url || null,
      bio: targetUser.bio || '',
      role: targetUser.role || 'user',
      isLive: Boolean(targetUser.is_live),
      currentRoomId: targetUser.current_room_id,
      memberSince: targetUser.created_at,
      isOwnProfile,
      privacy: {
        showCollege: Boolean(targetUser.show_college),
        showStats: Boolean(targetUser.show_stats),
        showGoals: Boolean(targetUser.show_goals),
        showLocation: Boolean(targetUser.show_location)
      }
    };

    if (isOwnProfile) {
      profile.email = targetUser.email;
    }

    // Apply privacy permissions for other viewers
    if (isOwnProfile || isSuperAdmin || targetUser.show_college) {
      profile.college = targetUser.college || '';
      profile.course = targetUser.course || '';
      profile.yearOfStudy = targetUser.year_of_study || '';
      profile.academicInterests = targetUser.academic_interests || '';
      profile.subjects = targetUser.subjects || '';
      profile.skills = targetUser.skills || '';
      profile.languages = targetUser.languages || '';
    } else {
      profile.college = '';
      profile.course = '';
      profile.yearOfStudy = '';
      profile.academicInterests = '';
      profile.subjects = '';
      profile.skills = '';
      profile.languages = '';
    }

    if (isOwnProfile || isSuperAdmin || targetUser.show_location) {
      profile.location = targetUser.location || '';
    } else {
      profile.location = '';
    }

    if (isOwnProfile || isSuperAdmin || targetUser.show_goals) {
      profile.learningGoals = targetUser.learning_goals || '';
      profile.dailyGoalMinutes = targetUser.daily_goal_minutes || 120;
    } else {
      profile.learningGoals = '';
      profile.dailyGoalMinutes = null;
    }

    if (isOwnProfile || isSuperAdmin || targetUser.show_stats) {
      profile.stats = fullStats;
      profile.badges = badges;
      profile.recentActivity = recentActivity;
    } else {
      profile.stats = null;
      profile.badges = [];
      profile.recentActivity = [];
    }

    profile.blogs = blogs;

    res.json({ profile });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to load student profile' });
  }
});

app.put('/api/users/profile', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const {
      displayName,
      bio,
      avatarSeed,
      college,
      course,
      yearOfStudy,
      location,
      academicInterests,
      subjects,
      learningGoals,
      skills,
      languages,
      dailyGoalMinutes,
      showCollege,
      showStats,
      showGoals,
      showLocation
    } = req.body;

    // Strict validation & sanitization
    const newDisplayName = displayName !== undefined ? String(displayName).trim().slice(0, 50) : user.display_name;
    const newBio = bio !== undefined ? String(bio).trim().slice(0, 300) : user.bio;
    const newAvatarSeed = avatarSeed !== undefined ? String(avatarSeed).trim().slice(0, 50) : user.avatar_seed;

    const newCollege = college !== undefined ? String(college).trim().slice(0, 100) : (user.college || '');
    const newCourse = course !== undefined ? String(course).trim().slice(0, 100) : (user.course || '');
    const newYearOfStudy = yearOfStudy !== undefined ? String(yearOfStudy).trim().slice(0, 50) : (user.year_of_study || '');
    const newLocation = location !== undefined ? String(location).trim().slice(0, 100) : (user.location || '');
    const newInterests = academicInterests !== undefined ? String(academicInterests).trim().slice(0, 300) : (user.academic_interests || '');
    const newSubjects = subjects !== undefined ? String(subjects).trim().slice(0, 300) : (user.subjects || '');
    const newGoals = learningGoals !== undefined ? String(learningGoals).trim().slice(0, 300) : (user.learning_goals || '');
    const newSkills = skills !== undefined ? String(skills).trim().slice(0, 300) : (user.skills || '');
    const newLanguages = languages !== undefined ? String(languages).trim().slice(0, 200) : (user.languages || '');

    let newDailyGoal = user.daily_goal_minutes;
    if (dailyGoalMinutes !== undefined) {
      const parsed = parseInt(dailyGoalMinutes, 10);
      if (!isNaN(parsed) && parsed >= 10 && parsed <= 1440) {
        newDailyGoal = parsed;
      }
    }

    const newShowCollege = showCollege !== undefined ? (showCollege ? 1 : 0) : (user.show_college !== undefined ? user.show_college : 1);
    const newShowStats = showStats !== undefined ? (showStats ? 1 : 0) : (user.show_stats !== undefined ? user.show_stats : 1);
    const newShowGoals = showGoals !== undefined ? (showGoals ? 1 : 0) : (user.show_goals !== undefined ? user.show_goals : 1);
    const newShowLocation = showLocation !== undefined ? (showLocation ? 1 : 0) : (user.show_location !== undefined ? user.show_location : 1);

    db.prepare(`
      UPDATE users 
      SET 
        display_name = ?,
        bio = ?,
        avatar_seed = ?,
        college = ?,
        course = ?,
        year_of_study = ?,
        location = ?,
        academic_interests = ?,
        subjects = ?,
        learning_goals = ?,
        skills = ?,
        languages = ?,
        daily_goal_minutes = ?,
        show_college = ?,
        show_stats = ?,
        show_goals = ?,
        show_location = ?
      WHERE id = ?
    `).run(
      newDisplayName,
      newBio,
      newAvatarSeed,
      newCollege,
      newCourse,
      newYearOfStudy,
      newLocation,
      newInterests,
      newSubjects,
      newGoals,
      newSkills,
      newLanguages,
      newDailyGoal,
      newShowCollege,
      newShowStats,
      newShowGoals,
      newShowLocation,
      req.user.id
    );

    const updatedUser = db.prepare(`
      SELECT 
        id, username, email, display_name, avatar_seed, avatar_url,
        daily_goal_minutes, total_focus_minutes, total_live_seconds,
        is_live, current_room_id, current_streak, longest_streak,
        bio, role, college, course, year_of_study, location,
        academic_interests, subjects, learning_goals, skills, languages,
        show_college, show_stats, show_goals, show_location,
        is_suspended, created_at
      FROM users WHERE id = ?
    `).get(req.user.id);

    const isSuperAdmin = isSuperAdminEmail(updatedUser.email);
    updatedUser.role = isSuperAdmin ? 'superadmin' : 'user';
    updatedUser.isSuperAdmin = isSuperAdmin;

    syncUserToMongo(updatedUser);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update student profile' });
  }
});

// Profile Avatar Upload Endpoint
app.post('/api/users/profile/avatar', authenticateToken, (req, res) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Avatar upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, req.user.id);

    const updatedUser = db.prepare(`
      SELECT 
        id, username, email, display_name, avatar_seed, avatar_url,
        daily_goal_minutes, total_focus_minutes, total_live_seconds,
        is_live, current_room_id, current_streak, longest_streak,
        bio, role, college, course, year_of_study, location,
        academic_interests, subjects, learning_goals, skills, languages,
        show_college, show_stats, show_goals, show_location,
        is_suspended, created_at
      FROM users WHERE id = ?
    `).get(req.user.id);

    const isSuperAdmin = isSuperAdminEmail(updatedUser.email);
    updatedUser.role = isSuperAdmin ? 'superadmin' : 'user';
    updatedUser.isSuperAdmin = isSuperAdmin;

    syncUserToMongo(updatedUser);

    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      avatarUrl,
      user: updatedUser
    });
  });
});

app.put('/api/auth/profile', authenticateToken, (req, res) => {
  try {
    const { displayName, dailyGoalMinutes, bio, avatarSeed } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newDisplayName = displayName !== undefined ? displayName.trim().slice(0, 50) : user.display_name;
    const newGoal = dailyGoalMinutes !== undefined ? Number(dailyGoalMinutes) : user.daily_goal_minutes;
    const newBio = bio !== undefined ? bio.trim().slice(0, 300) : user.bio;
    const newAvatar = avatarSeed !== undefined ? avatarSeed.trim().slice(0, 50) : user.avatar_seed;

    db.prepare(`
      UPDATE users 
      SET display_name = ?, daily_goal_minutes = ?, bio = ?, avatar_seed = ?
      WHERE id = ?
    `).run(newDisplayName, newGoal, newBio, newAvatar, req.user.id);

    const updatedUser = db.prepare(`
      SELECT 
        id, username, email, display_name, avatar_seed, avatar_url,
        daily_goal_minutes, total_focus_minutes, total_live_seconds,
        is_live, current_room_id, current_streak, longest_streak,
        bio, role, college, course, year_of_study, location,
        academic_interests, subjects, learning_goals, skills, languages,
        show_college, show_stats, show_goals, show_location,
        is_suspended, created_at
      FROM users WHERE id = ?
    `).get(req.user.id);

    const isSuperAdmin = isSuperAdminEmail(updatedUser.email);
    updatedUser.role = isSuperAdmin ? 'superadmin' : 'user';
    updatedUser.isSuperAdmin = isSuperAdmin;

    syncUserToMongo(updatedUser);
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

app.get('/api/blogs/:id', optionalAuthenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user ? req.user.id : null;
    let likedSelect = '0 as user_has_liked';
    let queryParams = [];
    if (currentUserId) {
      likedSelect = '(SELECT COUNT(*) FROM blog_likes bl WHERE bl.blog_id = b.id AND bl.user_id = ?) > 0 as user_has_liked';
      queryParams.push(currentUserId);
    }
    queryParams.push(req.params.id);

    let blog = db.prepare(`
      SELECT 
        b.*,
        u.id as author_id, u.username as author_username, u.display_name as author_name, u.avatar_seed as author_avatar, u.bio as author_bio, u.is_live as author_is_live,
        ${likedSelect}
      FROM blogs b
      JOIN users u ON b.author_id = u.id
      WHERE b.id = ?
    `).get(...queryParams);

    if (!blog && getIsConnected() && models.Blog) {
      try {
        const mongoBlog = await models.Blog.findOne({ id: req.params.id }).lean();
        if (mongoBlog) {
          db.prepare(`
            INSERT INTO blogs (id, author_id, title, content, category, image_url, likes_count, comments_count, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published')
            ON CONFLICT(id) DO UPDATE SET title = excluded.title, content = excluded.content;
          `).run(mongoBlog.id, mongoBlog.author_id, mongoBlog.title, mongoBlog.content, mongoBlog.category || 'General', mongoBlog.image_url || null, mongoBlog.likes_count || 0, mongoBlog.comments_count || 0);

          blog = db.prepare(`
            SELECT 
              b.*,
              u.id as author_id, u.username as author_username, u.display_name as author_name, u.avatar_seed as author_avatar, u.bio as author_bio, u.is_live as author_is_live,
              ${likedSelect}
            FROM blogs b
            JOIN users u ON b.author_id = u.id
            WHERE b.id = ?
          `).get(...queryParams);
        }
      } catch (e) {}
    }

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
    const isSuperAdmin = isSuperAdminEmail(req.user.email);
    if (blog.author_id !== req.user.id && !isSuperAdmin) {
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

    const isSuperAdmin = isSuperAdminEmail(req.user.email);
    if (blog.author_id !== req.user.id && !isSuperAdmin) {
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
    // Can delete if author of comment, owner of the blog, or superadmin
    const isSuperAdmin = isSuperAdminEmail(req.user.email);
    if (comment.user_id !== req.user.id && (!blog || blog.author_id !== req.user.id) && !isSuperAdmin) {
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

    // Password-protected room authorization verification
    const roomRecord = db.prepare('SELECT id, is_private, passcode FROM rooms WHERE id = ?').get(roomId);
    const isSuperAdmin = req.user && isSuperAdminEmail(req.user.email);
    if (roomRecord && Boolean(roomRecord.is_private) && !isSuperAdmin) {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required for protected rooms' });
      }
      const roomToken = req.headers['x-room-token'] || req.query.roomToken;
      let authorized = false;
      if (roomToken) {
        try {
          const decoded = jwt.verify(roomToken, JWT_SECRET);
          if (decoded && decoded.roomId === roomId && decoded.access === 'granted') {
            authorized = true;
          }
        } catch (e) {}
      }
      if (!authorized) {
        return res.status(403).json({ error: 'Incorrect room password or authorization required' });
      }
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

    const isAuth = Boolean(req.user);
    at.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: isAuth,
      canSubscribe: true,
      canPublishData: isAuth,
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
// API Routes: Study Rooms (Max 50 Rooms, Public + Password-Protected)
// ==========================================
const PREDEFINED_ROOM_IDS = new Set([
  'room-silent-library',
  'room-lofi-cafe',
  'room-stem-sprint',
  'room-med-mcat',
  'room-creative-studio'
]);

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 continuous minutes
const emptyRoomTimers = new Map();

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

async function executeRoomDeletion(roomId, reason = 'inactivity') {
  if (PREDEFINED_ROOM_IDS.has(roomId)) {
    console.warn(`[Delete Room] Attempted to delete predefined public room ${roomId}. Blocked.`);
    return false;
  }

  const room = db.prepare('SELECT id, name, created_by FROM rooms WHERE id = ?').get(roomId);
  if (!room) {
    // Idempotent: already deleted
    return true;
  }

  if (emptyRoomTimers.has(roomId)) {
    clearTimeout(emptyRoomTimers.get(roomId));
    emptyRoomTimers.delete(roomId);
  }

  // Notify and cleanly disconnect any occupants
  const roomState = activeRooms.get(roomId);
  if (roomState) {
    let reasonText = 'This study hall was automatically deleted after 15 minutes of inactivity.';
    if (reason === 'manual_admin') {
      reasonText = 'This study hall was closed and removed by the Super Admin.';
    } else if (reason === 'manual_creator') {
      reasonText = 'This study hall was closed and removed by its creator.';
    }

    if (io) {
      io.to(roomId).emit('room-closed', {
        roomId,
        reason: reasonText,
        redirectTo: '/'
      });
      io.to(roomId).emit('kicked-by-admin', {
        roomId,
        reason: reasonText
      });
    }

    for (const [sid] of roomState.participants.entries()) {
      const sock = io && io.sockets && io.sockets.sockets ? io.sockets.sockets.get(sid) : null;
      if (sock) {
        try {
          sock.leave(roomId);
        } catch (e) {}
      }
    }
    activeRooms.delete(roomId);
  }

  // Clean up associated SQLite records
  try {
    db.prepare('DELETE FROM direct_messages WHERE room_id = ?').run(roomId);
    db.prepare('DELETE FROM tasks WHERE room_id = ?').run(roomId);
    db.prepare('DELETE FROM live_sessions WHERE room_id = ?').run(roomId);
    db.prepare('DELETE FROM study_sessions WHERE room_id = ?').run(roomId);
    db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId);
  } catch (dbErr) {
    console.error(`[Delete Room] Error removing room ${roomId} from SQLite:`, dbErr.message);
  }

  // Clean up MongoDB Atlas
  if (getIsConnected() && models.Room) {
    try {
      await models.Room.deleteOne({ id: roomId });
      if (models.DirectMessage) await models.DirectMessage.deleteMany({ room_id: roomId });
      if (models.Task) await models.Task.deleteMany({ room_id: roomId });
      if (models.LiveSession) await models.LiveSession.deleteMany({ room_id: roomId });
      if (models.StudySession) await models.StudySession.deleteMany({ room_id: roomId });
    } catch (mongoErr) {
      console.warn(`[Delete Room] MongoDB cleanup error for ${roomId}:`, mongoErr.message);
    }
  }

  if (io) {
    io.emit('rooms-updated', { action: 'deleted', roomId });
    io.emit('room-deleted', { roomId, reason });
  }

  console.log(`[Delete Room] Room ${roomId} deleted successfully (reason: ${reason}).`);
  return true;
}

function scheduleRoomDeletion(roomId, delayMs = INACTIVITY_TIMEOUT_MS) {
  if (PREDEFINED_ROOM_IDS.has(roomId)) return;

  if (emptyRoomTimers.has(roomId)) {
    clearTimeout(emptyRoomTimers.get(roomId));
    emptyRoomTimers.delete(roomId);
  }

  const effectiveDelay = Math.max(0, delayMs);
  const timer = setTimeout(async () => {
    emptyRoomTimers.delete(roomId);
    await checkAndDeleteEmptyRoom(roomId);
  }, effectiveDelay);

  emptyRoomTimers.set(roomId, timer);
}

async function checkAndDeleteEmptyRoom(roomId) {
  if (PREDEFINED_ROOM_IDS.has(roomId)) return false;

  const room = db.prepare('SELECT id, empty_since FROM rooms WHERE id = ?').get(roomId);
  if (!room) return false;

  const onlineCount = getAccurateRoomOnlineCount(roomId);
  if (onlineCount > 0) {
    // Participants present or joined: cancel pending deletion
    db.prepare('UPDATE rooms SET empty_since = NULL WHERE id = ?').run(roomId);
    if (getIsConnected() && models.Room) {
      models.Room.updateOne({ id: roomId }, { $set: { empty_since: null } }).catch(() => {});
    }
    return false;
  }

  if (room.empty_since) {
    const elapsed = Date.now() - new Date(room.empty_since).getTime();
    if (elapsed < (INACTIVITY_TIMEOUT_MS - 5000)) {
      scheduleRoomDeletion(roomId, INACTIVITY_TIMEOUT_MS - elapsed);
      return false;
    }
  }

  return executeRoomDeletion(roomId, 'inactivity');
}

async function sweepEmptyRooms() {
  try {
    const customRooms = db.prepare(`
      SELECT id, empty_since FROM rooms 
      WHERE id NOT IN ('room-silent-library', 'room-lofi-cafe', 'room-stem-sprint', 'room-med-mcat', 'room-creative-studio')
    `).all();

    const now = Date.now();
    for (const r of customRooms) {
      const onlineCount = getAccurateRoomOnlineCount(r.id);
      if (onlineCount > 0) {
        if (r.empty_since) {
          db.prepare('UPDATE rooms SET empty_since = NULL WHERE id = ?').run(r.id);
          if (getIsConnected() && models.Room) {
            models.Room.updateOne({ id: r.id }, { $set: { empty_since: null } }).catch(() => {});
          }
          if (emptyRoomTimers.has(r.id)) {
            clearTimeout(emptyRoomTimers.get(r.id));
            emptyRoomTimers.delete(r.id);
          }
        }
      } else {
        if (!r.empty_since) {
          const nowIso = new Date().toISOString();
          db.prepare('UPDATE rooms SET empty_since = ? WHERE id = ?').run(nowIso, r.id);
          if (getIsConnected() && models.Room) {
            models.Room.updateOne({ id: r.id }, { $set: { empty_since: new Date(nowIso) } }).catch(() => {});
          }
          scheduleRoomDeletion(r.id, INACTIVITY_TIMEOUT_MS);
        } else {
          const elapsed = now - new Date(r.empty_since).getTime();
          if (elapsed >= INACTIVITY_TIMEOUT_MS) {
            console.log(`[Sweeper] Empty room ${r.id} reached 15m inactivity (elapsed: ${Math.round(elapsed / 1000)}s). Executing auto-delete.`);
            await executeRoomDeletion(r.id, 'inactivity');
          } else if (!emptyRoomTimers.has(r.id)) {
            const remaining = INACTIVITY_TIMEOUT_MS - elapsed;
            scheduleRoomDeletion(r.id, remaining);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Sweeper] Warning during empty room sweep:', err.message);
  }
}

app.get('/api/rooms', (req, res) => {
  try {
    // Explicitly exclude passcode/hash to never expose room credentials
    const rooms = db.prepare(`
      SELECT id, name, description, category, pomodoro_work_mins, pomodoro_break_mins, bg_theme, is_private, created_by, empty_since, created_at
      FROM rooms ORDER BY created_at ASC
    `).all();

    const enrichedRooms = rooms.map(room => {
      const onlineCount = getAccurateRoomOnlineCount(room.id);
      let scheduledDeletionAt = null;
      if (!PREDEFINED_ROOM_IDS.has(room.id) && onlineCount === 0 && room.empty_since) {
        scheduledDeletionAt = new Date(new Date(room.empty_since).getTime() + INACTIVITY_TIMEOUT_MS).toISOString();
      }
      return {
        ...room,
        is_private: Boolean(room.is_private),
        isPredefined: PREDEFINED_ROOM_IDS.has(room.id),
        onlineCount,
        empty_since: room.empty_since || null,
        scheduledDeletionAt
      };
    });

    res.json({
      rooms: enrichedRooms,
      totalCount: enrichedRooms.length,
      maxRooms: 50
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

app.get('/api/rooms/:id', async (req, res) => {
  try {
    let room = db.prepare(`
      SELECT id, name, description, category, pomodoro_work_mins, pomodoro_break_mins, bg_theme, is_private, created_by, empty_since, created_at
      FROM rooms WHERE id = ?
    `).get(req.params.id);

    if (!room && getIsConnected() && models.Room) {
      try {
        const mongoRoom = await models.Room.findOne({ id: req.params.id }).lean();
        if (mongoRoom) {
          db.prepare(`
            INSERT INTO rooms (
              id, name, description, category, pomodoro_work_mins, pomodoro_break_mins,
              bg_theme, is_private, passcode, created_by, empty_since
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              description = excluded.description,
              category = excluded.category,
              is_private = excluded.is_private,
              passcode = COALESCE(excluded.passcode, rooms.passcode),
              created_by = excluded.created_by,
              empty_since = excluded.empty_since;
          `).run(
            mongoRoom.id, mongoRoom.name, mongoRoom.description || '', mongoRoom.category || 'Silent Study',
            mongoRoom.pomodoro_work_mins || 25, mongoRoom.pomodoro_break_mins || 5,
            mongoRoom.bg_theme || 'cosmic', mongoRoom.is_private ? 1 : 0, mongoRoom.passcode || null, mongoRoom.created_by || null,
            mongoRoom.empty_since ? new Date(mongoRoom.empty_since).toISOString() : null
          );
          room = db.prepare(`
            SELECT id, name, description, category, pomodoro_work_mins, pomodoro_break_mins, bg_theme, is_private, created_by, empty_since, created_at
            FROM rooms WHERE id = ?
          `).get(req.params.id);
        }
      } catch (e) {}
    }

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const onlineCount = getAccurateRoomOnlineCount(room.id);
    let scheduledDeletionAt = null;
    if (!PREDEFINED_ROOM_IDS.has(room.id) && onlineCount === 0 && room.empty_since) {
      scheduledDeletionAt = new Date(new Date(room.empty_since).getTime() + INACTIVITY_TIMEOUT_MS).toISOString();
    }

    res.json({
      room: {
        ...room,
        is_private: Boolean(room.is_private),
        isPredefined: PREDEFINED_ROOM_IDS.has(room.id),
        onlineCount,
        empty_since: room.empty_since || null,
        scheduledDeletionAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

app.post('/api/rooms', authenticateToken, (req, res) => {
  let inTransaction = false;
  try {
    const { name, description, category, visibility, password, bgTheme } = req.body;

    const trimmedName = (name || '').trim();
    if (!trimmedName || trimmedName.length < 3 || trimmedName.length > 60) {
      return res.status(400).json({ error: 'Room name must be between 3 and 60 characters.' });
    }

    const trimmedCategory = (category || 'Silent Study').trim();
    const validCategories = [
      'Silent Study',
      'Lofi & Casual',
      'Engineering & STEM',
      'Medical & Science',
      'Creativity & Arts'
    ];
    const finalCategory = validCategories.includes(trimmedCategory) ? trimmedCategory : 'Silent Study';

    const trimmedDesc = (description || '').trim();
    if (trimmedDesc.length > 250) {
      return res.status(400).json({ error: 'Room description must not exceed 250 characters.' });
    }

    const isPrivate = visibility === 'password' || visibility === 'protected' || req.body.isPrivate === true || Boolean(password && password.trim());
    let passwordHash = null;

    if (isPrivate) {
      const rawPassword = (password || '').trim();
      if (!rawPassword || rawPassword.length < 4 || rawPassword.length > 64) {
        return res.status(400).json({ error: 'Password is required for protected rooms (between 4 and 64 characters).' });
      }
      passwordHash = bcrypt.hashSync(rawPassword, 10);
    }

    // Atomic transaction: strictly verify total room count < 50
    db.exec('BEGIN IMMEDIATE');
    inTransaction = true;

    const currentCount = db.prepare('SELECT COUNT(*) as count FROM rooms').get().count;
    if (currentCount >= 50) {
      db.exec('ROLLBACK');
      inTransaction = false;
      return res.status(400).json({
        error: 'StudySST has reached its limit of 50 rooms. Please join an existing room.'
      });
    }

    const roomId = 'room-' + crypto.randomUUID().slice(0, 10);
    const nowIso = new Date().toISOString();
    const insertStmt = db.prepare(`
      INSERT INTO rooms (id, name, description, category, pomodoro_work_mins, pomodoro_break_mins, bg_theme, is_private, passcode, created_by, empty_since)
      SELECT ?, ?, ?, ?, 25, 5, ?, ?, ?, ?, ?
      WHERE (SELECT COUNT(*) FROM rooms) < 50;
    `);

    const result = insertStmt.run(
      roomId,
      trimmedName,
      trimmedDesc,
      finalCategory,
      bgTheme || 'cosmic',
      isPrivate ? 1 : 0,
      passwordHash,
      req.user.id,
      nowIso
    );

    if (result.changes === 0) {
      db.exec('ROLLBACK');
      inTransaction = false;
      return res.status(400).json({
        error: 'StudySST has reached its limit of 50 rooms. Please join an existing room.'
      });
    }

    db.exec('COMMIT');
    inTransaction = false;

    // Fetch created room safely without passcode
    const createdRoom = db.prepare(`
      SELECT id, name, description, category, pomodoro_work_mins, pomodoro_break_mins, bg_theme, is_private, created_by, empty_since, created_at
      FROM rooms WHERE id = ?
    `).get(roomId);

    syncRoomToMongo(createdRoom);

    // Schedule 15-minute deletion countdown for the new empty room
    scheduleRoomDeletion(roomId, INACTIVITY_TIMEOUT_MS);

    const safeRoom = {
      ...createdRoom,
      is_private: Boolean(createdRoom.is_private),
      isPredefined: false,
      onlineCount: 0,
      empty_since: nowIso,
      scheduledDeletionAt: new Date(new Date(nowIso).getTime() + INACTIVITY_TIMEOUT_MS).toISOString()
    };

    io.emit('rooms-updated', {
      action: 'created',
      room: safeRoom
    });

    res.status(201).json({
      message: 'Room created successfully',
      room: safeRoom
    });
  } catch (error) {
    if (inTransaction) {
      try { db.exec('ROLLBACK'); } catch (e) {}
    }
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Verify room password and issue signed room-access token
app.post('/api/rooms/:id/verify-password', authenticateToken, (req, res) => {
  try {
    const roomId = req.params.id;
    const { password } = req.body;

    const room = db.prepare('SELECT id, is_private, passcode FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!room.is_private || isSuperAdminEmail(req.user.email)) {
      const isSuperAdmin = isSuperAdminEmail(req.user.email);
      const roomToken = jwt.sign(
        { roomId: room.id, access: 'granted', userId: req.user.id, isSuperAdmin },
        JWT_SECRET,
        { expiresIn: '12h' }
      );
      return res.json({ success: true, roomToken, isSuperAdmin });
    }

    const rawPassword = (password || '').trim();
    if (!rawPassword || !room.passcode) {
      return res.status(401).json({ error: 'Incorrect room password' });
    }

    const matches = bcrypt.compareSync(rawPassword, room.passcode);
    if (!matches) {
      return res.status(401).json({ error: 'Incorrect room password' });
    }

    const roomToken = jwt.sign(
      { roomId: room.id, access: 'granted', userId: req.user.id },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      success: true,
      message: 'Password verified',
      roomToken
    });
  } catch (error) {
    console.error('Password verification error:', error);
    res.status(500).json({ error: 'Failed to verify room password' });
  }
});

// DELETE /api/rooms/:id (Restricted to Room Creator & Super Admin)
app.delete('/api/rooms/:id', authenticateToken, async (req, res) => {
  try {
    const roomId = req.params.id;

    if (PREDEFINED_ROOM_IDS.has(roomId)) {
      return res.status(403).json({
        error: 'The five original public study rooms cannot be deleted.'
      });
    }

    const room = db.prepare('SELECT id, name, created_by FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const isSuperAdmin = isSuperAdminEmail(req.user.email);
    const isCreator = room.created_by && room.created_by === req.user.id;

    if (!isCreator && !isSuperAdmin) {
      return res.status(403).json({
        error: 'Forbidden: Only the room creator or the Super Admin can delete this room.'
      });
    }

    const reason = isSuperAdmin && !isCreator ? 'manual_admin' : 'manual_creator';
    await executeRoomDeletion(roomId, reason);

    res.json({
      success: true,
      message: `Room "${room.name}" deleted successfully.`,
      roomId
    });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// ==========================================
// SUPER ADMIN MANAGEMENT API ROUTES
// Protected strictly by requireSuperAdmin
// ==========================================

app.get('/api/admin/overview', requireSuperAdmin, (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const suspendedUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_suspended = 1').get().count;
    const totalRooms = db.prepare('SELECT COUNT(*) as count FROM rooms').get().count;
    const totalBlogs = db.prepare('SELECT COUNT(*) as count FROM blogs').get().count;
    const stats = getPresenceStats();

    res.json({
      totalUsers,
      suspendedUsers,
      totalRooms,
      maxRooms: 50,
      totalBlogs,
      activeScholarsNow: stats.totalActive,
      serverTime: new Date().toISOString(),
      superAdminEmail: SUPER_ADMIN_EMAIL
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Failed to load administrative overview' });
  }
});

app.get('/api/admin/users', requireSuperAdmin, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, email, display_name, avatar_seed, role, daily_goal_minutes,
             total_focus_minutes, total_live_seconds, is_live, current_room_id,
             current_streak, longest_streak, is_suspended, created_at
      FROM users
      ORDER BY created_at DESC
    `).all();

    const safeUsers = users.map(u => ({
      ...u,
      isSuperAdmin: isSuperAdminEmail(u.email),
      is_suspended: Boolean(u.is_suspended)
    }));

    res.json({ users: safeUsers });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to fetch user list' });
  }
});

app.patch('/api/admin/users/:id/suspend', requireSuperAdmin, (req, res) => {
  try {
    const targetId = req.params.id;
    const target = db.prepare('SELECT id, email, is_suspended FROM users WHERE id = ?').get(targetId);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (isSuperAdminEmail(target.email)) {
      return res.status(400).json({ error: 'Super Admin account cannot be suspended' });
    }

    const newSuspended = target.is_suspended ? 0 : 1;
    db.prepare('UPDATE users SET is_suspended = ? WHERE id = ?').run(newSuspended, target.id);

    // If suspended, disconnect all active sockets for this user
    if (newSuspended && io && io.sockets && io.sockets.sockets) {
      for (const [sid, sock] of io.sockets.sockets.entries()) {
        const uId = socketToUserSession.get(sid);
        if (uId === target.id) {
          sock.emit('account-suspended', { reason: 'Your account has been suspended by the Super Admin.' });
          sock.disconnect(true);
        }
      }
    }

    res.json({
      success: true,
      userId: target.id,
      is_suspended: Boolean(newSuspended),
      message: newSuspended ? 'User suspended successfully' : 'User reinstated successfully'
    });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({ error: 'Failed to update user suspension status' });
  }
});

app.delete('/api/admin/users/:id', requireSuperAdmin, (req, res) => {
  try {
    const targetId = req.params.id;
    const target = db.prepare('SELECT id, email FROM users WHERE id = ?').get(targetId);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (isSuperAdminEmail(target.email)) {
      return res.status(400).json({ error: 'Super Admin account cannot be deleted' });
    }

    // Disconnect any active sockets for this user
    if (io && io.sockets && io.sockets.sockets) {
      for (const [sid, sock] of io.sockets.sockets.entries()) {
        const uId = socketToUserSession.get(sid);
        if (uId === target.id) {
          sock.emit('account-deleted', { reason: 'Your account was removed by the Super Admin.' });
          sock.disconnect(true);
        }
      }
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
    if (getIsConnected() && models.User) {
      models.User.deleteOne({ id: target.id }).catch(() => {});
    }
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.get('/api/admin/rooms', requireSuperAdmin, (req, res) => {
  try {
    const rooms = db.prepare(`
      SELECT id, name, description, category, pomodoro_work_mins, pomodoro_break_mins, bg_theme, is_private, created_by, created_at
      FROM rooms
      ORDER BY created_at ASC
    `).all();

    const enriched = rooms.map(room => {
      const roomState = activeRooms.get(room.id);
      return {
        ...room,
        isPredefined: PREDEFINED_ROOM_IDS.has(room.id),
        is_private: Boolean(room.is_private),
        onlineCount: roomState ? roomState.participants.size : 0,
        participants: roomState ? Array.from(roomState.participants.values()).map(p => ({
          socketId: p.socketId,
          userId: p.user?.id,
          displayName: p.user?.display_name || p.user?.username || 'Scholar',
          isGuest: Boolean(p.user?.isGuest)
        })) : []
      };
    });

    res.json({ rooms: enriched, totalRooms: enriched.length, maxRooms: 50 });
  } catch (error) {
    console.error('Admin rooms error:', error);
    res.status(500).json({ error: 'Failed to load rooms' });
  }
});

app.patch('/api/admin/rooms/:id', requireSuperAdmin, (req, res) => {
  try {
    const roomId = req.params.id;
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const { name, description, category, removePassword, newPassword } = req.body;

    let updatedName = name ? name.trim() : room.name;
    let updatedDesc = description !== undefined ? description.trim() : room.description;
    let updatedCat = category ? category.trim() : room.category;
    let updatedPrivate = room.is_private;
    let updatedPasscode = room.passcode;

    if (removePassword) {
      updatedPrivate = 0;
      updatedPasscode = null;
    } else if (newPassword && newPassword.trim()) {
      if (PREDEFINED_ROOM_IDS.has(roomId)) {
        return res.status(400).json({ error: 'Predefined rooms must remain public.' });
      }
      updatedPrivate = 1;
      updatedPasscode = bcrypt.hashSync(newPassword.trim(), 10);
    }

    db.prepare(`
      UPDATE rooms
      SET name = ?, description = ?, category = ?, is_private = ?, passcode = ?
      WHERE id = ?
    `).run(updatedName, updatedDesc, updatedCat, updatedPrivate, updatedPasscode, roomId);

    const safeUpdated = db.prepare(`
      SELECT id, name, description, category, pomodoro_work_mins, pomodoro_break_mins, bg_theme, is_private, created_by, created_at
      FROM rooms WHERE id = ?
    `).get(roomId);

    syncRoomToMongo(safeUpdated);

    io.emit('rooms-updated', {
      action: 'updated',
      room: { ...safeUpdated, is_private: Boolean(safeUpdated.is_private), isPredefined: PREDEFINED_ROOM_IDS.has(roomId) }
    });

    res.json({
      success: true,
      message: 'Room updated successfully',
      room: { ...safeUpdated, is_private: Boolean(safeUpdated.is_private), isPredefined: PREDEFINED_ROOM_IDS.has(roomId) }
    });
  } catch (error) {
    console.error('Admin update room error:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

app.delete('/api/admin/rooms/:id', requireSuperAdmin, async (req, res) => {
  try {
    const roomId = req.params.id;
    if (PREDEFINED_ROOM_IDS.has(roomId)) {
      return res.status(400).json({ error: 'Cannot delete predefined public study halls.' });
    }

    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    await executeRoomDeletion(roomId, 'manual_admin');
    res.json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Admin delete room error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

app.post('/api/admin/rooms/:id/kick/:userId', requireSuperAdmin, (req, res) => {
  try {
    const { id: roomId, userId: targetUserId } = req.params;
    const { reason } = req.body || {};

    const roomState = activeRooms.get(roomId);
    if (!roomState) {
      return res.status(404).json({ error: 'Room is not currently active' });
    }

    let kicked = false;
    for (const [sid, p] of roomState.participants.entries()) {
      if (p.user?.id === targetUserId || sid === targetUserId) {
        const sock = io.sockets.sockets.get(sid);
        if (sock) {
          sock.emit('kicked-by-admin', {
            roomId,
            reason: reason || 'You were removed from this room by the Super Admin.'
          });
          handleLeave(sock, roomId);
          kicked = true;
        }
      }
    }

    if (!kicked) {
      return res.status(404).json({ error: 'Participant not found in room' });
    }

    res.json({ success: true, message: 'Participant kicked from room' });
  } catch (error) {
    console.error('Admin kick error:', error);
    res.status(500).json({ error: 'Failed to kick participant' });
  }
});

app.get('/api/admin/blogs', requireSuperAdmin, (req, res) => {
  try {
    const blogs = db.prepare(`
      SELECT b.*, u.username as author_username, u.display_name as author_name, u.email as author_email
      FROM blogs b
      JOIN users u ON b.author_id = u.id
      ORDER BY b.created_at DESC
    `).all();

    res.json({ blogs });
  } catch (error) {
    console.error('Admin blogs error:', error);
    res.status(500).json({ error: 'Failed to load blogs for moderation' });
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

    const sessionRec = db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(sessionId);
    const userRec = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    syncSessionToMongo(sessionRec);
    syncUserToMongo(userRec);

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
    syncTaskToMongo(task);
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
    const updatedTask = { ...task, completed: newCompleted };
    syncTaskToMongo(updatedTask);

    res.json({ task: updatedTask });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle task' });
  }
});

app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
  try {
    db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (getIsConnected() && models.Task) {
      models.Task.deleteOne({ id: req.params.id }).catch(() => {});
    }
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
        COALESCE(uSender.display_name, 'Scholar') as senderName, COALESCE(uSender.avatar_seed, 'User') as senderAvatar
      FROM direct_messages dm
      LEFT JOIN users uSender ON dm.sender_id = uSender.id
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
  let isAuthenticatedUser = false;

  // Verify auth token from socket handshake auth or query
  const authToken = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (authToken) {
    try {
      const decoded = jwt.verify(authToken, JWT_SECRET);
      if (decoded && decoded.id) {
        currentUser = {
          id: decoded.id,
          username: decoded.username,
          email: decoded.email,
          display_name: decoded.displayName || decoded.display_name || decoded.username,
          avatar_seed: decoded.avatarSeed || decoded.avatar_seed || decoded.username
        };
        isAuthenticatedUser = true;
      }
    } catch (e) {}
  }
  socket.isAuthenticatedUser = isAuthenticatedUser;

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
  socket.on('join-room', ({ roomId, user, mediaState, statusText, spotify, roomToken, roomPassword }) => {
    // If client was already in another room, clean up previous room first
    if (currentRoomId && currentRoomId !== roomId) {
      handleLeave(socket, currentRoomId);
    }

    // Check if token was provided in auth, payload, or user object
    const candidateAuthToken = socket.handshake?.auth?.token || (user && (user.token || user.authToken));
    if (!isAuthenticatedUser && candidateAuthToken) {
      try {
        const decoded = jwt.verify(candidateAuthToken, JWT_SECRET);
        if (decoded && decoded.id) {
          currentUser = {
            id: decoded.id,
            username: decoded.username,
            email: decoded.email,
            display_name: decoded.displayName || decoded.display_name || decoded.username,
            avatar_seed: decoded.avatarSeed || decoded.avatar_seed || decoded.username
          };
          isAuthenticatedUser = true;
          socket.isAuthenticatedUser = true;
        }
      } catch (e) {}
    }

    // Also support registered user object by ID lookup
    if (!isAuthenticatedUser && user && user.id && !user.id.startsWith('guest-')) {
      const dbUser = db.prepare('SELECT id, username, email, display_name, avatar_seed FROM users WHERE id = ?').get(user.id);
      if (dbUser) {
        currentUser = dbUser;
        isAuthenticatedUser = true;
        socket.isAuthenticatedUser = true;
      }
    }

    if (isAuthenticatedUser && currentUser) {
      if (user && user.display_name) {
        currentUser.display_name = user.display_name;
      }
    } else {
      currentUser = {
        id: 'guest-' + socket.id.slice(0, 5),
        display_name: 'Guest ' + socket.id.slice(0, 4),
        avatar_seed: socket.id,
        isGuest: true
      };
      // GUESTS MUST NEVER HAVE MIC OR VIDEO ACTIVE
      mediaState = { mic: false, video: false };
    }

    // Check if room is private / password protected
    try {
      const roomRecord = db.prepare('SELECT id, is_private, passcode FROM rooms WHERE id = ?').get(roomId);
      const isSuperAdmin = isAuthenticatedUser && currentUser && isSuperAdminEmail(currentUser.email);
      if (roomRecord && Boolean(roomRecord.is_private) && !isSuperAdmin) {
        if (!isAuthenticatedUser || currentUser.isGuest) {
          socket.emit('room-access-denied', {
            roomId,
            reason: 'Authentication required. Guests cannot enter password-protected rooms.'
          });
          return;
        }

        let authorized = false;
        const candidateToken = roomToken || (user && user.roomToken);
        if (candidateToken) {
          try {
            const decoded = jwt.verify(candidateToken, JWT_SECRET);
            if (decoded && decoded.roomId === roomId && decoded.access === 'granted') {
              authorized = true;
            }
          } catch (e) {}
        }

        const candidatePassword = roomPassword || (user && user.roomPassword);
        if (!authorized && candidatePassword && roomRecord.passcode) {
          if (bcrypt.compareSync(candidatePassword, roomRecord.passcode)) {
            authorized = true;
          }
        }

        if (!authorized) {
          socket.emit('room-access-denied', {
            roomId,
            reason: 'Incorrect room password or authorization required.'
          });
          return;
        }
      }
    } catch (err) {
      console.error('Error checking room permissions on join-room:', err);
    }

    currentRoomId = roomId;

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

    // Cancel empty-room auto-deletion countdown if active
    if (!PREDEFINED_ROOM_IDS.has(roomId)) {
      if (emptyRoomTimers.has(roomId)) {
        clearTimeout(emptyRoomTimers.get(roomId));
        emptyRoomTimers.delete(roomId);
      }
      try {
        db.prepare('UPDATE rooms SET empty_since = NULL WHERE id = ?').run(roomId);
        if (getIsConnected() && models.Room) {
          models.Room.updateOne({ id: roomId }, { $set: { empty_since: null } }).catch(() => {});
        }
      } catch (e) {}
      io.emit('room-inactivity-canceled', { roomId });
    }

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
    if (!isAuthenticatedUser && (mediaState?.video || mediaState?.mic)) {
      socket.emit('media-denied', { error: 'Authentication required to use camera or microphone' });
      return;
    }
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
    if (!isAuthenticatedUser) {
      socket.emit('chat-denied', { error: 'Authentication required to participate in chat' });
      return;
    }
    if (!text || !text.trim()) return;

    const message = {
      id: 'msg-' + crypto.randomUUID(),
      text: text.trim(),
      user: currentUser,
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
    if (!isAuthenticatedUser) {
      socket.emit('direct-message-denied', { error: 'Authentication required to send direct messages' });
      return;
    }
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
      senderSocketId: socket.id,
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
        syncDirectMessageToMongo({ id: dmId, room_id: roomId, sender_id: currentUser.id, recipient_id: recipientId, message: rawText, created_at: isoDate });
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
      const targetSocket = io.sockets?.sockets?.get(sid);
      if (targetSocket && targetSocket.isAuthenticatedUser === false) {
        continue; // Unauthenticated guests cannot receive DMs
      }
      io.to(sid).emit('direct-message-received', dmRecord);
    }

    // Acknowledge back to sender socket
    socket.emit('direct-message-sent', dmRecord);
  });

  // Super Admin: Moderation - Kick participant from room
  socket.on('admin-kick-participant', ({ roomId, targetUserId, targetSocketId, reason }) => {
    const adminEmail = currentUser?.email || (currentUser?.id ? db.prepare('SELECT email FROM users WHERE id = ?').get(currentUser.id)?.email : null);
    if (!isAuthenticatedUser || !adminEmail || !isSuperAdminEmail(adminEmail)) {
      socket.emit('admin-action-denied', { error: 'Super Admin privileges required' });
      return;
    }
    const roomState = activeRooms.get(roomId);
    if (!roomState) return;

    let targetSocket = null;
    if (targetSocketId && io.sockets.sockets.has(targetSocketId)) {
      targetSocket = io.sockets.sockets.get(targetSocketId);
    } else if (targetUserId) {
      for (const [sid, p] of roomState.participants.entries()) {
        if (p.user?.id === targetUserId || sid === targetUserId) {
          targetSocket = io.sockets.sockets.get(sid);
          break;
        }
      }
    }

    if (targetSocket) {
      targetSocket.emit('kicked-by-admin', {
        roomId,
        reason: reason || 'You have been removed from this room by the Super Admin.'
      });
      handleLeave(targetSocket, roomId);
      socket.emit('admin-action-success', { message: 'Participant kicked successfully' });
    }
  });

  // Super Admin: Moderation - Delete chat message in room
  socket.on('admin-delete-chat', ({ roomId, messageId }) => {
    const adminEmail = currentUser?.email || (currentUser?.id ? db.prepare('SELECT email FROM users WHERE id = ?').get(currentUser.id)?.email : null);
    if (!isAuthenticatedUser || !adminEmail || !isSuperAdminEmail(adminEmail)) {
      socket.emit('admin-action-denied', { error: 'Super Admin privileges required' });
      return;
    }
    const roomState = activeRooms.get(roomId);
    if (roomState && Array.isArray(roomState.messages)) {
      roomState.messages = roomState.messages.filter(m => m.id !== messageId);
      io.to(roomId).emit('message-deleted', { roomId, messageId });
    }
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

    // Check if custom room is now completely empty
    const remainingOnline = getAccurateRoomOnlineCount(roomId);
    if (remainingOnline === 0 && !PREDEFINED_ROOM_IDS.has(roomId)) {
      const nowIso = new Date().toISOString();
      try {
        db.prepare('UPDATE rooms SET empty_since = ? WHERE id = ?').run(nowIso, roomId);
        if (getIsConnected() && models.Room) {
          models.Room.updateOne({ id: roomId }, { $set: { empty_since: new Date(nowIso) } }).catch(() => {});
        }
      } catch (e) {}
      scheduleRoomDeletion(roomId, INACTIVITY_TIMEOUT_MS);
      io.emit('room-inactivity-started', {
        roomId,
        emptySince: nowIso,
        scheduledDeletionAt: new Date(Date.now() + INACTIVITY_TIMEOUT_MS).toISOString()
      });
      console.log(`[Auto-Delete] Custom room ${roomId} became completely empty. 15-minute deletion countdown started.`);
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
    engine: connected ? 'MongoDB Atlas (Mongoose Cloud Database)' : 'Local High-Performance SQLite (Fallback)',
    configured: Boolean(process.env.MONGODB_URI),
    models: connected ? ['User', 'Blog', 'Room', 'StudySession', 'Message', 'Task', 'DirectMessage', 'LiveSession'] : []
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

const shouldListen = !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.IS_API_HANDLER && !process.env.NO_SERVER_LISTEN;

if (shouldListen) {
  server.listen(PORT, async () => {
    console.log(`=================================================`);
    console.log(`  StudyStream Live Server Running on port ${PORT}`);
    console.log(`  Community Blogs & Unlimited Live Hours: ACTIVE `);
    console.log(`=================================================`);
    
    // Connect to MongoDB Atlas if MONGODB_URI is provided
    const mongoConnected = await connectMongoDB();
    if (mongoConnected) {
      await synchronizeCloudDatabase();
    }

    // Initialize empty room sweeper & periodic check
    try {
      await sweepEmptyRooms();
    } catch (e) {}
    const sweeperInterval = setInterval(sweepEmptyRooms, 30000);
    if (sweeperInterval.unref) sweeperInterval.unref();
  });
} else {
  // Serverless / Vercel execution environment
  connectMongoDB().then(async (connected) => {
    if (connected) {
      try {
        await synchronizeCloudDatabase();
      } catch (e) {
        console.warn('Cloud sync error in serverless:', e);
      }
    }
    try {
      await sweepEmptyRooms();
    } catch (e) {}
  }).catch(err => {
    console.warn('Serverless MongoDB connect error:', err);
  });
}

module.exports = app;
module.exports.app = app;
module.exports.server = server;

