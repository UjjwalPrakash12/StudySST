const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const server = http.createServer(app);

const JWT_SECRET = process.env.JWT_SECRET || 'studystream_dev_secret_key_2026_super_secure';

app.use(cors());
app.use(express.json());

// In-Memory Live State for Rooms, WebSockets, and Synced Pomodoro Timers
const activeRooms = new Map();

function getOrCreateRoomState(roomId) {
  if (!activeRooms.has(roomId)) {
    // Check room settings from DB
    const roomInfo = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    const workMins = roomInfo ? roomInfo.pomodoro_work_mins : 25;
    const breakMins = roomInfo ? roomInfo.pomodoro_break_mins : 5;

    activeRooms.set(roomId, {
      participants: new Map(), // socketId -> participant info
      messages: [], // last 50 messages
      timer: {
        isRunning: false,
        mode: 'work', // 'work' | 'break'
        remainingSeconds: workMins * 60,
        totalSeconds: workMins * 60,
        workMins,
        breakMins,
        timerInterval: null,
      }
    });
  }
  return activeRooms.get(roomId);
}

// ==========================================
// Authentication Middleware & Helpers
// ==========================================
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
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

    // Check duplicate
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
      INSERT INTO users (id, username, email, password_hash, display_name, avatar_seed, last_active_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, cleanUsername, cleanEmail, passwordHash, display, avatarSeed, todayStr);

    const newUser = db.prepare('SELECT id, username, email, display_name, avatar_seed, daily_goal_minutes, total_focus_minutes, current_streak, longest_streak, bio, created_at FROM users WHERE id = ?').get(userId);
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
    const { login, password } = req.body; // login can be username or email

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

app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, email, display_name, avatar_seed, daily_goal_minutes, total_focus_minutes, current_streak, longest_streak, bio, created_at FROM users WHERE id = ?').get(req.user.id);
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

    const updatedUser = db.prepare('SELECT id, username, email, display_name, avatar_seed, daily_goal_minutes, total_focus_minutes, current_streak, longest_streak, bio, created_at FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ==========================================
// API Routes: Study Rooms
// ==========================================
app.get('/api/rooms', (req, res) => {
  try {
    const rooms = db.prepare('SELECT * FROM rooms ORDER BY created_at ASC').all();

    // Attach live participant counts from activeRooms in-memory map
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
    const { name, description, category, pomodoroWorkMins, pomodoroBreakMins, bgTheme, isPrivate, passcode } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'Room name and category are required' });
    }

    const roomId = 'room-' + crypto.randomUUID().slice(0, 8);
    const workMins = Number(pomodoroWorkMins) || 25;
    const breakMins = Number(pomodoroBreakMins) || 5;

    db.prepare(`
      INSERT INTO rooms (id, name, description, category, pomodoro_work_mins, pomodoro_break_mins, bg_theme, is_private, passcode, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      roomId,
      name.trim(),
      description ? description.trim() : '',
      category.trim(),
      workMins,
      breakMins,
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
// API Routes: Study Sessions & Analytics
// ==========================================
app.post('/api/sessions/record', authenticateToken, (req, res) => {
  try {
    const { durationMinutes, mode, subject, roomId, notes } = req.body;
    const mins = Math.max(1, Math.round(Number(durationMinutes) || 25));
    const sessionMode = mode || 'work';
    const subj = subject ? subject.trim() : 'General Study';

    const sessionId = 'sess-' + crypto.randomUUID();

    // Insert session record
    db.prepare(`
      INSERT INTO study_sessions (id, user_id, room_id, duration_minutes, mode, subject, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, req.user.id, roomId || null, mins, sessionMode, subj, notes || null);

    // Calculate streaks & total minutes
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    let newCurrentStreak = user.current_streak || 0;
    let newLongestStreak = user.longest_streak || 0;

    if (user.last_active_date) {
      const lastDate = new Date(user.last_active_date);
      const diffTime = Math.abs(today - lastDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        // Same day, streak intact (ensure at least 1)
        if (newCurrentStreak === 0) newCurrentStreak = 1;
      } else if (diffDays === 1) {
        // Consecutive day
        newCurrentStreak += 1;
      } else {
        // Streak broken
        newCurrentStreak = 1;
      }
    } else {
      newCurrentStreak = 1;
    }

    if (newCurrentStreak > newLongestStreak) {
      newLongestStreak = newCurrentStreak;
    }

    const newTotalMinutes = (user.total_focus_minutes || 0) + mins;

    db.prepare(`
      UPDATE users
      SET total_focus_minutes = ?, current_streak = ?, longest_streak = ?, last_active_date = ?
      WHERE id = ?
    `).run(newTotalMinutes, newCurrentStreak, newLongestStreak, todayStr, req.user.id);

    const updatedUser = db.prepare('SELECT id, username, display_name, avatar_seed, daily_goal_minutes, total_focus_minutes, current_streak, longest_streak, last_active_date FROM users WHERE id = ?').get(req.user.id);

    res.status(201).json({
      message: 'Study session logged successfully!',
      sessionId,
      session: { durationMinutes: mins, mode: sessionMode, subject: subj, completedAt: new Date().toISOString() },
      user: updatedUser
    });
  } catch (error) {
    console.error('Session record error:', error);
    res.status(500).json({ error: 'Failed to record study session' });
  }
});

app.get('/api/sessions/history', authenticateToken, (req, res) => {
  try {
    const sessions = db.prepare(`
      SELECT s.*, r.name as room_name 
      FROM study_sessions s
      LEFT JOIN rooms r ON s.room_id = r.id
      WHERE s.user_id = ?
      ORDER BY s.completed_at DESC
      LIMIT 50
    `).all(req.user.id);

    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

app.get('/api/analytics/overview', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Today's focus minutes
    const todayStr = new Date().toISOString().split('T')[0];
    const todayResult = db.prepare(`
      SELECT COALESCE(SUM(duration_minutes), 0) as today_minutes 
      FROM study_sessions 
      WHERE user_id = ? AND date(completed_at) = date('now')
    `).get(req.user.id);

    // Past 7 days activity
    const past7Days = db.prepare(`
      SELECT date(completed_at) as date, COALESCE(SUM(duration_minutes), 0) as minutes
      FROM study_sessions
      WHERE user_id = ? AND completed_at >= datetime('now', '-7 days')
      GROUP BY date(completed_at)
      ORDER BY date(completed_at) ASC
    `).all(req.user.id);

    // Subject breakdown
    const subjectDistribution = db.prepare(`
      SELECT subject, COALESCE(SUM(duration_minutes), 0) as minutes, COUNT(*) as count
      FROM study_sessions
      WHERE user_id = ?
      GROUP BY subject
      ORDER BY minutes DESC
      LIMIT 6
    `).all(req.user.id);

    // Tasks summary
    const taskStats = db.prepare(`
      SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_tasks
      FROM tasks
      WHERE user_id = ?
    `).get(req.user.id);

    res.json({
      totalFocusMinutes: user.total_focus_minutes || 0,
      todayMinutes: todayResult ? todayResult.today_minutes : 0,
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

app.get('/api/leaderboard', (req, res) => {
  try {
    const topUsers = db.prepare(`
      SELECT id, username, display_name, avatar_seed, total_focus_minutes, current_streak, bio
      FROM users
      ORDER BY total_focus_minutes DESC
      LIMIT 15
    `).all();

    res.json({ leaderboard: topUsers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ==========================================
// API Routes: Tasks / To-Do Items
// ==========================================
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
// WebSockets & Real-Time Engine (Socket.IO)
// ==========================================
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Timer sync ticker helper
function handleTimerTick(roomId) {
  const room = activeRooms.get(roomId);
  if (!room || !room.timer.isRunning) return;

  room.timer.remainingSeconds -= 1;

  if (room.timer.remainingSeconds <= 0) {
    // Switch mode
    const completedMode = room.timer.mode;
    const nextMode = completedMode === 'work' ? 'break' : 'work';
    const nextTotal = (nextMode === 'work' ? room.timer.workMins : room.timer.breakMins) * 60;

    room.timer.mode = nextMode;
    room.timer.remainingSeconds = nextTotal;
    room.timer.totalSeconds = nextTotal;

    io.to(roomId).emit('timer-completed', {
      completedMode,
      nextMode,
      timestamp: Date.now()
    });

    io.to(roomId).emit('timer-sync', {
      isRunning: room.timer.isRunning,
      mode: room.timer.mode,
      remainingSeconds: room.timer.remainingSeconds,
      totalSeconds: room.timer.totalSeconds
    });
  } else {
    // Regular tick broadcast every 5 seconds or whenever state changed to conserve bandwidth
    if (room.timer.remainingSeconds % 5 === 0 || room.timer.remainingSeconds < 5) {
      io.to(roomId).emit('timer-tick', {
        remainingSeconds: room.timer.remainingSeconds,
        totalSeconds: room.timer.totalSeconds
      });
    }
  }
}

io.on('connection', (socket) => {
  let currentRoomId = null;
  let currentUser = null;

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

    // Store participant in room
    roomState.participants.set(socket.id, participantInfo);

    // Send the joining user the current list of all peers in room, timer state, and recent chat
    const allParticipants = Array.from(roomState.participants.values());
    socket.emit('room-joined', {
      roomId,
      participants: allParticipants,
      timer: {
        isRunning: roomState.timer.isRunning,
        mode: roomState.timer.mode,
        remainingSeconds: roomState.timer.remainingSeconds,
        totalSeconds: roomState.timer.totalSeconds,
      },
      messages: roomState.messages,
    });

    // Notify existing peers that a new user joined
    socket.to(roomId).emit('user-joined', {
      participant: participantInfo
    });

    console.log(`[Socket] ${currentUser.display_name} joined room ${roomId} (Total: ${roomState.participants.size})`);
  });

  // WebRTC Signaling Relay
  socket.on('signal-send', ({ to, signal, callerName, callerAvatar, mediaState }) => {
    io.to(to).emit('signal-receive', {
      from: socket.id,
      signal,
      callerName,
      callerAvatar,
      mediaState
    });
  });

  // Media state changes (mute, video toggle, screen share)
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

  // Update Status message ("Reading chapter 3", "Coding backend")
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

  // Synchronized Pomodoro Timer actions
  socket.on('timer-action', ({ roomId, action, mode, minutes }) => {
    const roomState = getOrCreateRoomState(roomId);
    const timer = roomState.timer;

    if (action === 'start') {
      if (!timer.isRunning) {
        timer.isRunning = true;
        if (!timer.timerInterval) {
          timer.timerInterval = setInterval(() => handleTimerTick(roomId), 1000);
        }
      }
    } else if (action === 'pause') {
      timer.isRunning = false;
      if (timer.timerInterval) {
        clearInterval(timer.timerInterval);
        timer.timerInterval = null;
      }
    } else if (action === 'reset') {
      timer.isRunning = false;
      if (timer.timerInterval) {
        clearInterval(timer.timerInterval);
        timer.timerInterval = null;
      }
      const dur = (timer.mode === 'work' ? timer.workMins : timer.breakMins) * 60;
      timer.remainingSeconds = dur;
      timer.totalSeconds = dur;
    } else if (action === 'switch-mode') {
      const targetMode = mode || (timer.mode === 'work' ? 'break' : 'work');
      timer.mode = targetMode;
      const dur = (targetMode === 'work' ? timer.workMins : timer.breakMins) * 60;
      timer.remainingSeconds = dur;
      timer.totalSeconds = dur;
    } else if (action === 'set-duration') {
      const newMins = Number(minutes) || 25;
      if (timer.mode === 'work') timer.workMins = newMins;
      else timer.breakMins = newMins;
      timer.remainingSeconds = newMins * 60;
      timer.totalSeconds = newMins * 60;
    }

    io.to(roomId).emit('timer-sync', {
      isRunning: timer.isRunning,
      mode: timer.mode,
      remainingSeconds: timer.remainingSeconds,
      totalSeconds: timer.totalSeconds
    });
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

  // Floating live emoji reactions (applause, fire, coffee, star, cheer)
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

  // Socket Disconnect
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

      // Stop timer ticker if room is completely empty
      if (roomState.participants.size === 0) {
        if (roomState.timer.timerInterval) {
          clearInterval(roomState.timer.timerInterval);
          roomState.timer.timerInterval = null;
          roomState.timer.isRunning = false;
        }
      }
    }
    console.log(`[Socket] ${s.id} left room ${roomId}`);
  }
});

// Serve frontend production build if available
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
}

const PORT = process.env.PORT || 5050;
server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`  StudyStream Live Server Running on port ${PORT}`);
  console.log(`  WebRTC Signaling & Synced Pomodoro: ACTIVE     `);
  console.log(`=================================================`);
});
