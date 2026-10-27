const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'studystream.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high performance concurrent writes
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize tables
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
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_active_date TEXT,
    bio TEXT DEFAULT 'Ready to focus and achieve big goals!',
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
    mode TEXT NOT NULL, -- 'work', 'short_break', 'long_break'
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
`);

// Seed default rooms if empty
const roomCount = db.prepare('SELECT COUNT(*) as count FROM rooms').get().count;
if (roomCount === 0) {
  const insertRoom = db.prepare(`
    INSERT INTO rooms (id, name, description, category, pomodoro_work_mins, pomodoro_break_mins, bg_theme, is_private)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `);

  insertRoom.run(
    'room-silent-library',
    'Silent Library - Deep Work',
    'Strict quiet zone for laser focus. Cameras encouraged, microphones muted.',
    'Silent Study',
    25,
    5,
    'library'
  );

  insertRoom.run(
    'room-lofi-cafe',
    'Lofi Cafe & Chill Beats',
    'Warm, relaxed atmosphere with ambient coffee shop vibes for reading and writing.',
    'Lofi & Casual',
    25,
    5,
    'cafe'
  );

  insertRoom.run(
    'room-stem-sprint',
    'STEM, Code & Math Grind',
    'Software engineering, competitive programming, math proofs, and algorithms.',
    'Engineering & STEM',
    50,
    10,
    'code'
  );

  insertRoom.run(
    'room-med-mcat',
    'Med School & High-Yield Sprint',
    'Anki flashcards, USMLE, biology, and chemistry. Serious long study blocks.',
    'Medical & Science',
    50,
    10,
    'med'
  );

  insertRoom.run(
    'room-creative-studio',
    'Creative Studio & Design Hub',
    'UI/UX design, writing, digital art, video editing, and project planning.',
    'Creativity & Arts',
    25,
    5,
    'creative'
  );

  console.log('Seeded default StudyStream rooms successfully.');
}

// Seed a demo user for quick evaluator login if not existing
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
if (userCount === 0) {
  const demoSalt = bcrypt.genSaltSync(10);
  const demoHash = bcrypt.hashSync('demo1234', demoSalt);

  const insertDemo = db.prepare(`
    INSERT INTO users (id, username, email, password_hash, display_name, avatar_seed, daily_goal_minutes, total_focus_minutes, current_streak, longest_streak, last_active_date, bio)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const todayStr = new Date().toISOString().split('T')[0];
  insertDemo.run(
    'user-demo-1',
    'student_demo',
    'demo@studystream.live',
    demoHash,
    'Alex Rivers',
    'AlexRivers',
    150,
    385,
    4,
    7,
    todayStr,
    'Final year Computer Science student prepping for end-term & interviews.'
  );

  // Seed sample past sessions for Alex
  const insertSession = db.prepare(`
    INSERT INTO study_sessions (id, user_id, room_id, duration_minutes, mode, subject, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  insertSession.run('sess-1', 'user-demo-1', 'room-stem-sprint', 50, 'work', 'Distributed Systems', new Date(now - dayMs * 3).toISOString());
  insertSession.run('sess-2', 'user-demo-1', 'room-stem-sprint', 50, 'work', 'Distributed Systems', new Date(now - dayMs * 3 + 3600000).toISOString());
  insertSession.run('sess-3', 'user-demo-1', 'room-lofi-cafe', 25, 'work', 'Algorithm Practice', new Date(now - dayMs * 2).toISOString());
  insertSession.run('sess-4', 'user-demo-1', 'room-silent-library', 50, 'work', 'OS Kernel Concurrency', new Date(now - dayMs * 1).toISOString());
  insertSession.run('sess-5', 'user-demo-1', 'room-silent-library', 60, 'work', 'Full-Stack Software Architecture', new Date(now - 14400000).toISOString());

  // Seed sample tasks
  const insertTask = db.prepare(`
    INSERT INTO tasks (id, user_id, room_id, title, completed)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertTask.run('task-1', 'user-demo-1', 'room-stem-sprint', 'Review WebRTC peer connection state handling', 1);
  insertTask.run('task-2', 'user-demo-1', 'room-stem-sprint', 'Implement Pomodoro synchronized timer socket event', 1);
  insertTask.run('task-3', 'user-demo-1', 'room-stem-sprint', 'Deploy application and finalize README documentation', 0);

  // Seed 2 other leaderboard users
  const salt2 = bcrypt.genSaltSync(10);
  const hash2 = bcrypt.hashSync('pass1234', salt2);
  insertDemo.run('user-demo-2', 'sarah_chen', 'sarah@example.com', hash2, 'Sarah Chen', 'SarahChen', 180, 520, 6, 12, todayStr, 'Med student mastering pathology');
  insertDemo.run('user-demo-3', 'marcus_k', 'marcus@example.com', hash2, 'Marcus Vance', 'MarcusV', 120, 290, 3, 5, todayStr, 'Building high performance web apps');

  console.log('Seeded demo users and historical sessions successfully.');
}

module.exports = db;
