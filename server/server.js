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
const db = require('./db');

const app = express();
const server = http.createServer(app);

const JWT_SECRET = process.env.JWT_SECRET || 'studystream_dev_secret_key_2026_super_secure';

app.use(cors());
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
// Live Session & Presence State (In-Memory)
// ==========================================
const activeRooms = new Map();
const activeLiveSessions = new Map(); // socketId -> { sessionId, userId, roomId, startedAt, lastHeartbeat }

function getOrCreateRoomState(roomId) {
  if (!activeRooms.has(roomId)) {
    activeRooms.set(roomId, {
      participants: new Map(), // socketId -> participant info
      messages: [], // last 60 messages
    });
  }
  return activeRooms.get(roomId);
}

// Clean up stale abandoned sessions every 60s
function cleanupStaleSessions() {
  try {
    const staleCutoff = new Date(Date.now() - 90 * 1000).toISOString();
    const staleSessions = db.prepare(`
      SELECT id, user_id, started_at, last_heartbeat 
      FROM live_sessions 
      WHERE is_active = 1 AND last_heartbeat < ?
    `).all(staleCutoff);

    for (const session of staleSessions) {
      const startMs = new Date(session.started_at).getTime();
      const lastMs = new Date(session.last_heartbeat).getTime();
      const duration = Math.max(0, Math.round((lastMs - startMs) / 1000));

      db.prepare(`
        UPDATE live_sessions 
        SET ended_at = last_heartbeat, duration_seconds = ?, is_active = 0 
        WHERE id = ?
      `).run(duration, session.id);

      db.prepare(`
        UPDATE users 
        SET total_live_seconds = total_live_seconds + ?, is_live = 0, current_room_id = NULL 
        WHERE id = ?
      `).run(duration, session.user_id);
    }
  } catch (err) {
    console.error('Error during stale sessions cleanup:', err);
  }
}
setInterval(cleanupStaleSessions, 60000);
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
    const blogsQuery = `
      SELECT 
        b.id, b.title, b.content, b.category, b.image_url, b.likes_count, b.comments_count, b.created_at, b.updated_at,
        u.id as author_id, u.username as author_username, u.display_name as author_name, u.avatar_seed as author_avatar, u.is_live as author_is_live,
        ${currentUserId ? `(SELECT COUNT(*) FROM blog_likes bl WHERE bl.blog_id = b.id AND bl.user_id = '${currentUserId}') > 0 as user_has_liked` : '0 as user_has_liked'}
      FROM blogs b
      JOIN users u ON b.author_id = u.id
      ${whereSQL}
      ${orderSQL}
      LIMIT ? OFFSET ?
    `;

    const blogs = db.prepare(blogsQuery).all(...params, limitNum, offset);

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
    const blog = db.prepare(`
      SELECT 
        b.*,
        u.id as author_id, u.username as author_username, u.display_name as author_name, u.avatar_seed as author_avatar, u.bio as author_bio, u.is_live as author_is_live,
        ${currentUserId ? `(SELECT COUNT(*) FROM blog_likes bl WHERE bl.blog_id = b.id AND bl.user_id = '${currentUserId}') > 0 as user_has_liked` : '0 as user_has_liked'}
      FROM blogs b
      JOIN users u ON b.author_id = u.id
      WHERE b.id = ?
    `).get(req.params.id);

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
      ORDER BY c.created_at ASC
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

    const existingLike = db.prepare('SELECT id FROM blog_likes WHERE blog_id = ? AND user_id = ?').get(blog.id, req.user.id);

    if (existingLike) {
      // Unlike
      db.prepare('DELETE FROM blog_likes WHERE id = ?').run(existingLike.id);
      db.prepare('UPDATE blogs SET likes_count = MAX(0, likes_count - 1) WHERE id = ?').run(blog.id);
      const updated = db.prepare('SELECT likes_count FROM blogs WHERE id = ?').get(blog.id);
      return res.json({ liked: false, likesCount: updated.likes_count });
    } else {
      // Like
      const likeId = 'like-' + crypto.randomUUID();
      db.prepare('INSERT INTO blog_likes (id, blog_id, user_id) VALUES (?, ?, ?)').run(likeId, blog.id, req.user.id);
      db.prepare('UPDATE blogs SET likes_count = likes_count + 1 WHERE id = ?').run(blog.id);
      const updated = db.prepare('SELECT likes_count FROM blogs WHERE id = ?').get(blog.id);
      return res.json({ liked: true, likesCount: updated.likes_count });
    }
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

    const blog = db.prepare('SELECT id FROM blogs WHERE id = ?').get(req.params.id);
    if (!blog) return res.status(404).json({ error: 'Blog not found' });

    const commentId = 'comm-' + crypto.randomUUID();
    db.prepare('INSERT INTO blog_comments (id, blog_id, user_id, comment) VALUES (?, ?, ?, ?)').run(
      commentId,
      blog.id,
      req.user.id,
      rawComment
    );

    db.prepare('UPDATE blogs SET comments_count = comments_count + 1 WHERE id = ?').run(blog.id);

    const createdComment = db.prepare(`
      SELECT 
        c.id, c.comment, c.comment as content, c.created_at,
        u.id as user_id, u.username, u.display_name, u.display_name as author_name, u.avatar_seed
      FROM blog_comments c JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(commentId);

    res.status(201).json({ comment: createdComment });
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

    db.prepare('DELETE FROM blog_comments WHERE id = ?').run(comment.id);
    db.prepare('UPDATE blogs SET comments_count = MAX(0, comments_count - 1) WHERE id = ?').run(req.params.blogId);

    res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// ==========================================
// API Routes: Study Rooms
// ==========================================
app.get('/api/rooms', (req, res) => {
  try {
    const rooms = db.prepare('SELECT * FROM rooms ORDER BY created_at ASC').all();

    const enrichedRooms = rooms.map(room => {
      const roomState = activeRooms.get(room.id);
      const onlineCount = roomState ? roomState.participants.size : 0;
      return {
        ...room,
        onlineCount,
      };
    });

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

    const roomState = activeRooms.get(room.id);
    const onlineCount = roomState ? roomState.participants.size : 0;

    res.json({ room: { ...room, onlineCount } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

app.post('/api/rooms', authenticateToken, (req, res) => {
  try {
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

  // 1. Join Room & Start Authoritative Live Time Tracking
  socket.on('join-room', ({ roomId, user, mediaState, statusText }) => {
    currentRoomId = roomId;
    currentUser = user || {
      id: 'guest-' + socket.id.slice(0, 5),
      display_name: 'Guest ' + socket.id.slice(0, 4),
      avatar_seed: socket.id
    };

    socket.join(roomId);
    const roomState = getOrCreateRoomState(roomId);

    const participantInfo = {
      socketId: socket.id,
      user: currentUser,
      mediaState: mediaState || { mic: false, video: true, screenShare: false },
      statusText: statusText || 'Focusing...',
      joinedAt: Date.now(),
    };

    roomState.participants.set(socket.id, participantInfo);

    // If registered user, start live session in DB
    if (currentUser.id && !currentUser.id.startsWith('guest-')) {
      const sessionId = 'live-' + crypto.randomUUID();
      const nowMs = Date.now();

      // Close any previous dangling session for this user
      db.prepare(`
        UPDATE live_sessions 
        SET ended_at = CURRENT_TIMESTAMP, is_active = 0 
        WHERE user_id = ? AND is_active = 1
      `).run(currentUser.id);

      db.prepare(`
        INSERT INTO live_sessions (id, user_id, room_id, socket_id, started_at, last_heartbeat, is_active)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
      `).run(sessionId, currentUser.id, roomId, socket.id);

      db.prepare('UPDATE users SET is_live = 1, current_room_id = ? WHERE id = ?').run(roomId, currentUser.id);

      activeLiveSessions.set(socket.id, {
        sessionId,
        userId: currentUser.id,
        roomId,
        startedAt: nowMs,
        lastHeartbeat: nowMs,
      });

      // Acknowledge session started to client with verified start timestamp
      socket.emit('session-live-started', {
        sessionId,
        startedAt: nowMs,
        isLive: true
      });

      // Broadcast user is live globally
      io.emit('user-live-status-changed', {
        userId: currentUser.id,
        isLive: true,
        roomId
      });
    }

    const allParticipants = Array.from(roomState.participants.values());
    socket.emit('room-joined', {
      roomId,
      participants: allParticipants,
      messages: roomState.messages,
      sessionStartedAt: Date.now(),
    });

    socket.to(roomId).emit('user-joined', {
      participant: participantInfo
    });

    console.log(`[Socket] ${currentUser.display_name} joined room ${roomId} (Total: ${roomState.participants.size})`);
  });

  // 2. Periodic Live Session Heartbeat (Every 30s)
  socket.on('session-heartbeat', () => {
    if (activeLiveSessions.has(socket.id)) {
      const session = activeLiveSessions.get(socket.id);
      const nowMs = Date.now();
      session.lastHeartbeat = nowMs;

      db.prepare(`
        UPDATE live_sessions 
        SET last_heartbeat = CURRENT_TIMESTAMP 
        WHERE id = ? AND is_active = 1
      `).run(session.sessionId);

      const elapsedSeconds = Math.max(0, Math.round((nowMs - session.startedAt) / 1000));
      socket.emit('heartbeat-ack', {
        elapsedSeconds,
        isLive: true
      });
    }
  });

  // 3. WebRTC Signaling Relay
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
  });

  // Floating live emoji reactions
  socket.on('send-reaction', ({ roomId, emoji, senderName }) => {
    io.to(roomId).emit('reaction-received', {
      id: 'react-' + crypto.randomUUID(),
      emoji,
      senderName: senderName || (currentUser ? currentUser.display_name : 'Peer'),
      socketId: socket.id,
      timestamp: Date.now()
    });
  });

  // Explicit Leave Room
  socket.on('leave-room', ({ roomId }) => {
    handleLeave(socket, roomId);
  });

  socket.on('disconnect', () => {
    if (currentRoomId) {
      handleLeave(socket, currentRoomId);
    }
  });

  function handleLeave(s, roomId) {
    s.leave(roomId);
    const roomState = activeRooms.get(roomId);
    if (roomState) {
      roomState.participants.delete(s.id);
      socket.to(roomId).emit('user-left', {
        socketId: s.id,
        user: currentUser
      });
    }

    // Authoritative Live Session End
    if (activeLiveSessions.has(s.id)) {
      const session = activeLiveSessions.get(s.id);
      const nowMs = Date.now();
      const durationSeconds = Math.max(0, Math.round((nowMs - session.startedAt) / 1000));

      db.prepare(`
        UPDATE live_sessions 
        SET ended_at = CURRENT_TIMESTAMP, duration_seconds = ?, is_active = 0 
        WHERE id = ?
      `).run(durationSeconds, session.sessionId);

      if (durationSeconds > 0) {
        db.prepare(`
          UPDATE users 
          SET total_live_seconds = total_live_seconds + ?, is_live = 0, current_room_id = NULL 
          WHERE id = ?
        `).run(durationSeconds, session.userId);

        // Update streak if session was at least 60s
        if (durationSeconds >= 60) {
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
      } else {
        db.prepare('UPDATE users SET is_live = 0, current_room_id = NULL WHERE id = ?').run(session.userId);
      }

      activeLiveSessions.delete(s.id);

      io.emit('user-live-status-changed', {
        userId: session.userId,
        isLive: false
      });
    }

    console.log(`[Socket] ${s.id} left room ${roomId}`);
  }
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
server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`  StudyStream Live Server Running on port ${PORT}`);
  console.log(`  Community Blogs & Unlimited Live Hours: ACTIVE `);
  console.log(`=================================================`);
});
