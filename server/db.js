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
module.exports = db;

