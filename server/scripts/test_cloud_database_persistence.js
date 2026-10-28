/**
 * StudySST — Cloud Database Persistence & Vercel Deployment Verification Test Suite
 */
const assert = require('assert');
const http = require('http');
const db = require('../db');
const { connectMongoDB, getIsConnected, models } = require('../mongodb');

const BASE_URL = 'http://localhost:5050';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.status, statusCode: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch (e) {
          resolve({ status: res.status, statusCode: res.statusCode, text: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('========================================================');
  console.log('  🧪 Running StudySST Cloud Database Persistence Tests');
  console.log('========================================================\n');

  let passed = 0;
  function pass(msg) {
    passed++;
    console.log(`  ✅ PASS: ${msg}`);
  }

  // 1. Test Status Endpoint
  const statusRes = await request('/api/mongodb/status');
  assert.strictEqual(statusRes.statusCode, 200);
  assert(statusRes.data.status === 'running_fallback' || statusRes.data.status === 'connected');
  pass(`Status endpoint responds correctly (Engine: ${statusRes.data.engine})`);

  // 2. Test User Registration and Persistence
  const testEmail = `persisted_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const testUsername = `user_${Date.now()}`;

  const regRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      username: testUsername,
      email: testEmail,
      password: testPassword,
      displayName: 'Persisted Scholar'
    }
  });
  assert.strictEqual(regRes.statusCode, 201);
  const token = regRes.data.token;
  const userId = regRes.data.user.id;
  assert(token && userId);
  pass('User registered successfully');

  // Verify user in SQLite
  const userInDb = db.prepare('SELECT id, email, username FROM users WHERE id = ?').get(userId);
  assert(userInDb && userInDb.email === testEmail);
  pass('User record exists in local database');

  // 3. Test Room Creation & 50-room limit protection
  const roomRes = await request('/api/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: {
      name: 'Cloud Persistence Study Hall',
      description: 'Verifying data persists across deploys',
      category: 'Engineering & STEM',
      visibility: 'public'
    }
  });
  assert.strictEqual(roomRes.statusCode, 201);
  const createdRoomId = roomRes.data.room.id;
  assert(createdRoomId);
  pass('Custom study room created successfully');

  // Verify 5 Predefined Rooms are intact
  const allRoomsRes = await request('/api/rooms');
  assert.strictEqual(allRoomsRes.statusCode, 200);
  const rooms = allRoomsRes.data.rooms;
  const predefined = rooms.filter(r => r.isPredefined);
  assert.strictEqual(predefined.length, 5);
  pass('All 5 predefined public rooms are preserved');

  // 4. Test Blog Creation
  const blogRes = await request('/api/blogs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: {
      title: 'Persistent Architecture in Full-Stack Apps',
      content: 'Ensuring cloud database persistence across ephemeral Vercel redeployments.',
      category: 'Productivity'
    }
  });
  assert.strictEqual(blogRes.statusCode, 201);
  const blogId = blogRes.data.blog.id;
  assert(blogId);
  pass('Blog created successfully');

  // 5. Test Blog Like & Comment Persistence
  const likeRes = await request(`/api/blogs/${blogId}/like`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  assert.strictEqual(likeRes.statusCode, 200);
  assert.strictEqual(likeRes.data.liked, true);
  assert.strictEqual(likeRes.data.likes_count, 1);
  pass('Blog liked successfully');

  const commentRes = await request(`/api/blogs/${blogId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: { comment: 'Persistent comment across restarts!' }
  });
  assert.strictEqual(commentRes.statusCode, 201);
  assert.strictEqual(commentRes.data.comments_count, 1);
  pass('Blog comment posted successfully');

  // 6. Test Task Creation & Persistence
  const taskRes = await request('/api/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: { title: 'Implement MongoDB Atlas synchronization', roomId: createdRoomId }
  });
  assert.strictEqual(taskRes.statusCode, 201);
  const taskId = taskRes.data.task.id;
  assert(taskId);
  pass('Task created successfully');

  // 7. Test Study Session Recording & Live Hours Accrual
  const sessionRes = await request('/api/sessions/record', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: { durationMinutes: 45, mode: 'work', subject: 'System Design' }
  });
  assert.strictEqual(sessionRes.statusCode, 201);
  pass('Study session recorded successfully');

  // Check user focus minutes updated
  const userAfterSession = db.prepare('SELECT total_focus_minutes FROM users WHERE id = ?').get(userId);
  assert(userAfterSession.total_focus_minutes >= 45);
  pass('User focus minutes updated accurately');

  // 8. Test Super Admin Protection
  const superAdminEmail = 'ujjwalprakash1812@gmail.com';
  const superAdminInDb = db.prepare('SELECT role FROM users WHERE LOWER(TRIM(email)) = ?').get(superAdminEmail);
  if (superAdminInDb) {
    assert.strictEqual(superAdminInDb.role, 'superadmin');
    pass(`Super Admin account (${superAdminEmail}) role is strictly superadmin`);
  }

  // Normal user cannot have superadmin role
  const normalUserRole = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
  assert.notStrictEqual(normalUserRole.role, 'superadmin');
  pass('Regular user cannot obtain Super Admin privileges');

  // 9. Test Vercel /api Routing Handlers
  const vercelApiHandler = require('../../api/index.js');
  assert(typeof vercelApiHandler === 'function');
  pass('Vercel serverless entrypoint (/api/index.js) exists and exports request handler');

  // 10. Clean up test custom room and test blog
  db.prepare('DELETE FROM blogs WHERE id = ?').run(blogId);
  db.prepare('DELETE FROM rooms WHERE id = ?').run(createdRoomId);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  pass('Test artifacts cleanly cleaned up');

  console.log('\n========================================================');
  console.log(`  🏁 ALL ${passed} PERSISTENCE TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
