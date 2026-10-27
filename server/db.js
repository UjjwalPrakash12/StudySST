const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'studystream.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high performance concurrent writes
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Create uploads directory for blog images
const uploadsDir = path.join(__dirname, 'uploads', 'blogs');
fs.mkdirSync(uploadsDir, { recursive: true });

// Initialize base tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_seed TEXT NOT NULL,
    daily_goal_minutes INTEGER DEFAULT 120,
    total_focus_minutes INTEGER DEFAULT 0,
    total_live_seconds INTEGER DEFAULT 0,
    is_live INTEGER DEFAULT 0,
    current_room_id TEXT,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_active_date TEXT,
    bio TEXT DEFAULT 'Ready to focus and achieve big goals!',
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    pomodoro_work_mins INTEGER DEFAULT 25,
    pomodoro_break_mins INTEGER DEFAULT 5,
    bg_theme TEXT DEFAULT 'cosmic',
    is_private INTEGER DEFAULT 0,
    passcode TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS study_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    room_id TEXT,
    duration_minutes INTEGER NOT NULL,
    mode TEXT NOT NULL,
    subject TEXT DEFAULT 'General Study',
    notes TEXT,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    room_id TEXT,
    title TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- FEATURE 1: Community Blogs Schema
  CREATE TABLE IF NOT EXISTS blogs (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    image_url TEXT,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'published',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS blog_likes (
    id TEXT PRIMARY KEY,
    blog_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(blog_id, user_id),
    FOREIGN KEY(blog_id) REFERENCES blogs(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS blog_comments (
    id TEXT PRIMARY KEY,
    blog_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    comment TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(blog_id) REFERENCES blogs(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- FEATURE 2: Unlimited Live-Time Tracking Schema
  CREATE TABLE IF NOT EXISTS live_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    socket_id TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    duration_seconds INTEGER DEFAULT 0,
    last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_blogs_created ON blogs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_blogs_likes ON blogs(likes_count DESC);
  CREATE INDEX IF NOT EXISTS idx_blogs_comments ON blogs(comments_count DESC);
  CREATE INDEX IF NOT EXISTS idx_live_sessions_user ON live_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_live_sessions_active ON live_sessions(is_active);
  CREATE INDEX IF NOT EXISTS idx_live_sessions_started ON live_sessions(started_at);
`);

// Safe migration for existing users table columns if needed
try {
  db.exec('ALTER TABLE users ADD COLUMN total_live_seconds INTEGER DEFAULT 0;');
} catch (e) {}
try {
  db.exec('ALTER TABLE users ADD COLUMN is_live INTEGER DEFAULT 0;');
} catch (e) {}
try {
  db.exec('ALTER TABLE users ADD COLUMN current_room_id TEXT;');
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';");
} catch (e) {}

// Seed default rooms if empty
const roomCount = db.prepare('SELECT COUNT(*) as count FROM rooms').get().count;
if (roomCount === 0) {
  const insertRoom = db.prepare(`
    INSERT INTO rooms (id, name, description, category, pomodoro_work_mins, pomodoro_break_mins, bg_theme, is_private)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `);

  insertRoom.run('room-silent-library', 'Silent Library - Deep Work', 'Strict quiet zone for laser focus. Cameras encouraged, microphones muted.', 'Silent Study', 25, 5, 'library');
  insertRoom.run('room-lofi-cafe', 'Lofi Cafe & Chill Beats', 'Warm, relaxed atmosphere with ambient coffee shop vibes for reading and writing.', 'Lofi & Casual', 25, 5, 'cafe');
  insertRoom.run('room-stem-sprint', 'STEM, Code & Math Grind', 'Software engineering, competitive programming, math proofs, and algorithms.', 'Engineering & STEM', 50, 10, 'code');
  insertRoom.run('room-med-mcat', 'Med School & High-Yield Sprint', 'Anki flashcards, USMLE, biology, and chemistry. Serious long study blocks.', 'Medical & Science', 50, 10, 'med');
  insertRoom.run('room-creative-studio', 'Creative Studio & Design Hub', 'UI/UX design, writing, digital art, video editing, and project planning.', 'Creativity & Arts', 25, 5, 'creative');
}

// Ensure demo users have total_live_seconds seeded
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
if (userCount === 0) {
  const demoSalt = bcrypt.genSaltSync(10);
  const demoHash = bcrypt.hashSync('demo1234', demoSalt);

  const insertDemo = db.prepare(`
    INSERT INTO users (id, username, email, password_hash, display_name, avatar_seed, daily_goal_minutes, total_focus_minutes, total_live_seconds, current_streak, longest_streak, last_active_date, bio, role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const todayStr = new Date().toISOString().split('T')[0];
  insertDemo.run('user-demo-1', 'student_demo', 'demo@studystream.live', demoHash, 'Alex Rivers', 'AlexRivers', 150, 385, 48 * 3600 + 25 * 60, 4, 7, todayStr, 'Final year Computer Science student prepping for end-term & interviews.', 'user');

  const salt2 = bcrypt.genSaltSync(10);
  const hash2 = bcrypt.hashSync('pass1234', salt2);
  insertDemo.run('user-demo-2', 'sarah_chen', 'sarah@example.com', hash2, 'Sarah Chen', 'SarahChen', 180, 520, 72 * 3600 + 40 * 60, 6, 12, todayStr, 'Med student mastering pathology', 'user');
  insertDemo.run('user-demo-3', 'marcus_k', 'marcus@example.com', hash2, 'Marcus Vance', 'MarcusV', 120, 290, 36 * 3600 + 15 * 60, 3, 5, todayStr, 'Building high performance web apps', 'user');

  // Seed sample tasks
  const insertTask = db.prepare(`INSERT INTO tasks (id, user_id, room_id, title, completed) VALUES (?, ?, ?, ?, ?)`);
  insertTask.run('task-1', 'user-demo-1', 'room-stem-sprint', 'Review WebRTC peer connection state handling', 1);
  insertTask.run('task-2', 'user-demo-1', 'room-stem-sprint', 'Implement unlimited live hours session tracking', 1);
  insertTask.run('task-3', 'user-demo-1', 'room-stem-sprint', 'Deploy community blog system with rich markdown & comments', 1);
} else {
  // Update live seconds for existing demo users if they have 0
  const alex = db.prepare('SELECT total_live_seconds FROM users WHERE id = ?').get('user-demo-1');
  if (alex && (!alex.total_live_seconds || alex.total_live_seconds === 0)) {
    db.prepare('UPDATE users SET total_live_seconds = ? WHERE id = ?').run(48 * 3600 + 25 * 60, 'user-demo-1');
    db.prepare('UPDATE users SET total_live_seconds = ? WHERE id = ?').run(72 * 3600 + 40 * 60, 'user-demo-2');
    db.prepare('UPDATE users SET total_live_seconds = ? WHERE id = ?').run(36 * 3600 + 15 * 60, 'user-demo-3');
  }
}

// Seed community starter blogs if blogs table is empty
const blogCount = db.prepare('SELECT COUNT(*) as count FROM blogs').get().count;
if (blogCount === 0) {
  const insertBlog = db.prepare(`
    INSERT INTO blogs (id, author_id, title, content, category, likes_count, comments_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Blog 1: Sarah Chen (Med & High Yield Focus)
  insertBlog.run(
    'blog-1',
    'user-demo-2',
    'How I Study 8+ Hours Daily Without Burnout (The Focus Ritual)',
    `Studying for medical school exams taught me that motivation is fickle, but a disciplined ritual is bulletproof.

### 1. Protect Your First 2 Hours
The morning hours determine your entire trajectory. I never check email, social media, or group chats until my first 90-minute block is finished.

### 2. Social Accountability Over Willpower
This is why platforms like StudyStream Live matter. When I enter a silent study room and see other scholars deep in work, my brain immediately matches that frequency.

### 3. Active Recall > Passive Highlighting
Stop re-reading your textbooks. Test yourself with active flashcards, practice exam prompts, and teach concepts out loud.

Good luck with your study sprints everyone! Feel free to drop your favorite daily habits in the comments below.`,
    'Study Tips',
    18,
    3,
    new Date(now - dayMs * 2).toISOString()
  );

  // Blog 2: Alex Rivers (Computer Science & System Architecture)
  insertBlog.run(
    'blog-2',
    'user-demo-1',
    'Deep Dive: Designing Real-Time WebRTC Video & Audio Meshes in Node.js',
    `Over the past week, I've been researching low-latency WebRTC mesh architectures for virtual study spaces. Here are the key lessons:

- **Signaling Server Simplicity**: Using WebSockets (Socket.IO) to relay SDP offers and ICE candidates without storing raw media packets on the server.
- **Graceful Avatar Degradation**: If a user's camera is offline or bandwidth is constrained, fallback to animated canvas waveforms rather than crashing the peer connection.
- **Web Audio API**: Synthesizing 10Hz alpha binaural beats directly in client browsers eliminates multi-megabyte MP3 bandwidth costs!

What real-time tech stacks are you all working with? Drop your questions below!`,
    'Engineering & Tech',
    24,
    4,
    new Date(now - dayMs * 1).toISOString()
  );

  // Blog 3: Marcus Vance (Lofi & Mindful Productivity)
  insertBlog.run(
    'blog-3',
    'user-demo-3',
    'The Science of Binaural Alpha Beats and White Noise for Concentration',
    `Did you know that presenting 216Hz to the left ear and 226Hz to the right ear produces an illusory **10Hz brainwave entrainment**?

This frequency range corresponds with the alpha wave spectrum (8–12Hz), which is naturally produced when the human mind is calm, alert, and receptive to learning without mental fatigue.

Combine 10Hz alpha waves with soft rain noise to mask sudden unpredictable ambient noises in your apartment. It makes a tremendous difference for 3+ hour coding or writing sessions.`,
    'Productivity',
    12,
    2,
    new Date(now - 3600000 * 4).toISOString()
  );

  // Seed sample comments
  const insertComment = db.prepare(`
    INSERT INTO blog_comments (id, blog_id, user_id, comment, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertComment.run('comm-1', 'blog-1', 'user-demo-1', 'Active recall completely changed how I prep for data structures and algorithms. Great post Sarah!', new Date(now - dayMs * 1.5).toISOString());
  insertComment.run('comm-2', 'blog-1', 'user-demo-3', 'The first 2 hours rule is gold. I do my heaviest creative design work right after morning coffee.', new Date(now - dayMs * 1).toISOString());
  insertComment.run('comm-3', 'blog-2', 'user-demo-2', 'The Web Audio API synthesizer is so smooth! Love that it does not lag on mobile devices.', new Date(now - 3600000 * 10).toISOString());
  insertComment.run('comm-4', 'blog-3', 'user-demo-1', 'Testing the 10Hz wave right now during my final project sprint—laser focus!', new Date(now - 3600000 * 2).toISOString());

  // Seed likes
  const insertLike = db.prepare(`INSERT INTO blog_likes (id, blog_id, user_id) VALUES (?, ?, ?)`);
  insertLike.run('like-1', 'blog-1', 'user-demo-1');
  insertLike.run('like-2', 'blog-1', 'user-demo-3');
  insertLike.run('like-3', 'blog-2', 'user-demo-2');
  insertLike.run('like-4', 'blog-2', 'user-demo-3');
  insertLike.run('like-5', 'blog-3', 'user-demo-1');
  insertLike.run('like-6', 'blog-3', 'user-demo-2');

  console.log('Seeded community blogs, comments, and likes successfully.');
}

// Seed historical live sessions for leaderboard weekly/monthly filters
const sessionCount = db.prepare('SELECT COUNT(*) as count FROM live_sessions').get().count;
if (sessionCount === 0) {
  const insertLive = db.prepare(`
    INSERT INTO live_sessions (id, user_id, room_id, duration_seconds, started_at, ended_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `);

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Sarah Chen (72h total)
  insertLive.run('live-1', 'user-demo-2', 'room-med-mcat', 6 * 3600, new Date(now - dayMs * 5).toISOString(), new Date(now - dayMs * 5 + 6 * 3600000).toISOString());
  insertLive.run('live-2', 'user-demo-2', 'room-med-mcat', 8 * 3600, new Date(now - dayMs * 3).toISOString(), new Date(now - dayMs * 3 + 8 * 3600000).toISOString());
  insertLive.run('live-3', 'user-demo-2', 'room-med-mcat', 7 * 3600, new Date(now - dayMs * 1).toISOString(), new Date(now - dayMs * 1 + 7 * 3600000).toISOString());

  // Alex Rivers (48h total)
  insertLive.run('live-4', 'user-demo-1', 'room-stem-sprint', 5 * 3600, new Date(now - dayMs * 4).toISOString(), new Date(now - dayMs * 4 + 5 * 3600000).toISOString());
  insertLive.run('live-5', 'user-demo-1', 'room-stem-sprint', 6 * 3600, new Date(now - dayMs * 2).toISOString(), new Date(now - dayMs * 2 + 6 * 3600000).toISOString());
  insertLive.run('live-6', 'user-demo-1', 'room-stem-sprint', 4 * 3600, new Date(now - dayMs * 1).toISOString(), new Date(now - dayMs * 1 + 4 * 3600000).toISOString());

  // Marcus Vance (36h total)
  insertLive.run('live-7', 'user-demo-3', 'room-lofi-cafe', 4 * 3600, new Date(now - dayMs * 3).toISOString(), new Date(now - dayMs * 3 + 4 * 3600000).toISOString());
  insertLive.run('live-8', 'user-demo-3', 'room-lofi-cafe', 5 * 3600, new Date(now - dayMs * 1).toISOString(), new Date(now - dayMs * 1 + 5 * 3600000).toISOString());

  console.log('Seeded historical verified live sessions.');
}

module.exports = db;
