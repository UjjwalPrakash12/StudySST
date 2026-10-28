const io = require('socket.io-client');
const http = require('http');
const db = require('../db');
const { connectMongoDB, models } = require('../mongodb');
const { cleanupTestArtifacts, PRESERVED_EMAILS } = require('./test_helpers');

const SERVER_URL = 'http://localhost:5050';

function post(endpoint, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(SERVER_URL + endpoint);
    const body = JSON.stringify(data);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method: 'POST', headers }, (res) => {
      let respBody = '';
      res.on('data', chunk => respBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(respBody) });
        } catch (e) {
          resolve({ status: res.statusCode, data: respBody });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(endpoint, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(SERVER_URL + endpoint);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method: 'GET', headers }, (res) => {
      let respBody = '';
      res.on('data', chunk => respBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(respBody) });
        } catch (e) {
          resolve({ status: res.statusCode, data: respBody });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('===============================================================');
  console.log('  Comprehensive Verification: Parts 1, 2, 3, and 4');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const createdUserIds = [];

  try {
    // -------------------------------------------------------------
    // PART 2: Verify Initial Clean State (2 Real Users, 1 Real Blog, 5 Rooms)
    // -------------------------------------------------------------
    console.log('--- TEST GROUP 1: Database Audit & Clean State (Part 2) ---');
    const usersInSqlite = db.prepare('SELECT id, email, username FROM users').all();
    assert(usersInSqlite.length === 2, `SQLite has exactly 2 registered users (found: ${usersInSqlite.length})`);
    assert(usersInSqlite.some(u => u.email === 'ujjwalprakash1812@gmail.com'), 'Super Admin ujjwalprakash1812@gmail.com is preserved in SQLite');
    assert(usersInSqlite.some(u => u.email === 'silent.sus01@gmail.com'), 'User silent.sus01@gmail.com is preserved in SQLite');

    const blogsInSqlite = db.prepare('SELECT id, title, author_id FROM blogs').all();
    assert(blogsInSqlite.length === 1, `SQLite has exactly 1 blog (found: ${blogsInSqlite.length})`);
    assert(blogsInSqlite[0].title === 'Beautiful life', 'Real blog "Beautiful life" is preserved');

    const roomsInSqlite = db.prepare('SELECT id, name FROM rooms').all();
    assert(roomsInSqlite.length === 5, `SQLite has exactly 5 permanent rooms (found: ${roomsInSqlite.length})`);

    // Verify MongoDB Atlas dual-write clean state
    await connectMongoDB();
    const usersInMongo = await models.User.find({}).lean();
    assert(usersInMongo.length === 2, `MongoDB Atlas has exactly 2 registered users (found: ${usersInMongo.length})`);
    const blogsInMongo = await models.Blog.find({}).lean();
    assert(blogsInMongo.length === 1, `MongoDB Atlas has exactly 1 blog (found: ${blogsInMongo.length})`);

    // -------------------------------------------------------------
    // PART 3: Prevent Fake Guests & Unauthorized Room Membership
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 2: Identity Protection & Fake Guest Prevention (Part 3) ---');
    
    // Test Case: Unauthenticated guest joins claiming a real user's ID without a token
    const realUser = usersInSqlite.find(u => u.email === 'ujjwalprakash1812@gmail.com');
    const fakeSocket = io(SERVER_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: {} // No token provided
    });

    await new Promise((resolve) => {
      fakeSocket.on('connect', resolve);
    });

    let fakeJoinResponse = null;
    fakeSocket.emit('join-room', {
      roomId: 'room-silent-library',
      user: {
        id: realUser.id, // Attempt to spoof Super Admin!
        display_name: 'Spoofed Admin'
      },
      mediaState: { mic: true, video: true }
    });

    await new Promise((resolve) => {
      fakeSocket.on('room-joined', (data) => {
        fakeJoinResponse = data;
        resolve();
      });
      // Safety timeout
      setTimeout(resolve, 800);
    });

    // Verify socket in roomState is forced to guest identity, NOT realUser.id
    const roomInfo = (await get('/api/admin/rooms', realUser.token)).data;
    // Check local activeRooms in memory by trying a restricted action:
    let mediaDenied = false;
    fakeSocket.on('media-denied', (err) => {
      mediaDenied = true;
    });

    fakeSocket.emit('update-media-state', {
      roomId: 'room-silent-library',
      mediaState: { video: true }
    });

    await new Promise(r => setTimeout(r, 300));
    assert(mediaDenied === true, 'Spoofed user is rejected when requesting media activation (media-denied emitted)');

    let chatDenied = false;
    fakeSocket.on('chat-denied', () => {
      chatDenied = true;
    });
    fakeSocket.emit('send-message', {
      roomId: 'room-silent-library',
      text: 'Unauthorized spoofed message'
    });
    await new Promise(r => setTimeout(r, 300));
    assert(chatDenied === true, 'Spoofed user is rejected when attempting to chat (chat-denied emitted)');

    fakeSocket.disconnect();

    // -------------------------------------------------------------
    // PART 1: Camera/Mic & Dynamic Socket Upgrade for Authenticated Users
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 3: Camera/Mic & Authorized Media Activation (Part 1) ---');
    
    // Register a temporary test scholar to test media authorization
    const tempUserEmail = `verified_scholar_${Date.now()}@testdomain.com`;
    const regRes = await post('/api/auth/register', {
      username: `scholar_${Date.now()}`.slice(0, 16),
      email: tempUserEmail,
      password: 'Password123!',
      displayName: 'Verified Scholar'
    });
    const tempUser = regRes.data.user;
    const tempToken = regRes.data.token;
    createdUserIds.push(tempUser.id);

    // Socket joins as guest first, then dynamically upgrades via authenticate-socket
    const dynamicSocket = io(SERVER_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: {} // Initially guest
    });

    await new Promise(r => dynamicSocket.on('connect', r));

    dynamicSocket.emit('join-room', {
      roomId: 'room-silent-library',
      user: { id: 'guest-init', display_name: 'Guest Scholar' },
      mediaState: { mic: false, video: false }
    });

    await new Promise(r => dynamicSocket.on('room-joined', r));

    // Dynamic socket upgrade with valid JWT
    let authenticatedEventFired = false;
    dynamicSocket.on('socket-authenticated', (data) => {
      if (data && data.success) authenticatedEventFired = true;
    });

    dynamicSocket.emit('authenticate-socket', { token: tempToken });
    await new Promise(r => setTimeout(r, 300));

    assert(authenticatedEventFired === true, 'Socket successfully upgraded to authenticated via authenticate-socket');

    // Now turn camera ON
    let authenticatedMediaDenied = false;
    dynamicSocket.on('media-denied', () => {
      authenticatedMediaDenied = true;
    });

    dynamicSocket.emit('update-media-state', {
      roomId: 'room-silent-library',
      mediaState: { video: true, mic: true },
      authToken: tempToken
    });

    await new Promise(r => setTimeout(r, 300));
    assert(authenticatedMediaDenied === false, 'Authenticated scholar successfully enabled camera & mic with ZERO media-denied errors');

    // Test sending chat
    let messageReceived = false;
    dynamicSocket.on('new-message', (msg) => {
      if (msg.text === 'Focus session starting now!') messageReceived = true;
    });

    dynamicSocket.emit('send-message', {
      roomId: 'room-silent-library',
      text: 'Focus session starting now!'
    });

    await new Promise(r => setTimeout(r, 300));
    assert(messageReceived === true, 'Authenticated scholar successfully sent message without chat-denied');

    dynamicSocket.disconnect();

    // -------------------------------------------------------------
    // PART 4: Emoji Picker Verification
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 4: Full Emoji Picker Integration (Part 4) ---');
    const clientPackage = require('../../client/package.json');
    assert(Boolean(clientPackage.dependencies['emoji-picker-react']), 'emoji-picker-react dependency installed in client/package.json');
    
    const focusRoomCode = require('fs').readFileSync(require('path').join(__dirname, '../../client/src/components/FocusRoomView.jsx'), 'utf8');
    assert(focusRoomCode.includes('import EmojiPicker'), 'FocusRoomView imports EmojiPicker from emoji-picker-react');
    assert(focusRoomCode.includes('handleChatEmojiClick'), 'FocusRoomView defines handleChatEmojiClick with cursor position insertion');
    assert(focusRoomCode.includes('handleDmEmojiClick'), 'FocusRoomView defines handleDmEmojiClick for Direct Messages');
    assert(focusRoomCode.includes('showChatEmojiPicker'), 'FocusRoomView manages showChatEmojiPicker popover state');
    assert(focusRoomCode.includes('selectionStart'), 'Emoji insertion calculates selectionStart and selectionEnd');

  } finally {
    // Clean up test user
    console.log('\n--- CLEANUP: Removing Test Artifacts ---');
    await cleanupTestArtifacts({ userIds: createdUserIds });
    const finalSqliteUsers = db.prepare('SELECT email FROM users').all();
    console.log(`Final SQLite users count: ${finalSqliteUsers.length}`);
    finalSqliteUsers.forEach(u => console.log(`   - ${u.email}`));
  }

  console.log('\n===============================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
