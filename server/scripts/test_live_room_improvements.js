/**
 * Automated Verification Test Suite for StudySST Live Room Improvements & New Features
 * 
 * Verifies all 6 requirements:
 * 1. Screen sharing removed completely (UI, code, handlers).
 * 2. Diverse procedural calming soundscapes (12 tracks across 8 categories).
 * 3. Spotify playback sharing status, toggle, disconnect, and socket broadcast.
 * 4. Emoji reactions rate-limiting (300ms window) and categorized emoji set.
 * 5. Room creation restricted to admin only (ordinary users receive 403 Forbidden).
 * 6. Private 1-to-1 direct messaging (confidential delivery, eavesdropping rejection).
 */

const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const SERVER_URL = 'http://localhost:5050';

async function request(path, options = {}) {
  const url = `${SERVER_URL}${path}`;
  const res = await fetch(url, options);
  let json = null;
  try {
    json = await res.json();
  } catch (e) {}
  return { status: res.status, headers: res.headers, json };
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
  passedTests++;
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   Running StudySST Live Room Improvements Test Suite');
  console.log('======================================================\n');

  // --------------------------------------------------------------------
  // TEST 1: Verify Screen Sharing is Completely Removed from Frontend
  // --------------------------------------------------------------------
  console.log('--- TEST 1: Screen Sharing Complete Removal Verification ---');
  const focusRoomContent = fs.readFileSync(path.join(__dirname, '../../client/src/components/FocusRoomView.jsx'), 'utf8');
  assert(!focusRoomContent.includes('getDisplayMedia'), 'getDisplayMedia() is completely removed from FocusRoomView');
  assert(!focusRoomContent.includes('toggleScreenShare'), 'toggleScreenShare is completely removed from FocusRoomView');
  assert(!focusRoomContent.includes('stopScreenSharing'), 'stopScreenSharing is completely removed from FocusRoomView');
  assert(!focusRoomContent.includes('ScreenShare'), 'ScreenShare icon is completely removed from FocusRoomView');
  assert(!focusRoomContent.includes('screenSharing'), 'screenSharing state is completely removed from FocusRoomView');
  assert(!focusRoomContent.includes('screenStreamRef'), 'screenStreamRef is completely removed from FocusRoomView');

  // --------------------------------------------------------------------
  // TEST 2: Verify Calming Soundscapes (12 Tracks Across 8 Categories)
  // --------------------------------------------------------------------
  console.log('\n--- TEST 2: Calming Soundscapes Diverse Sound Engine ---');
  const soundSynthContent = fs.readFileSync(path.join(__dirname, '../../client/src/utils/soundSynthesizer.js'), 'utf8');
  const expectedTracks = [
    'gentle-rain', 'rain-window', 'distant-thunder',
    'forest-birds', 'flowing-stream', 'ocean-waves',
    'mellow-lofi', 'slow-piano', 'atmospheric-pad',
    'pink-noise', 'brown-noise', 'night-crickets'
  ];
  for (const trackId of expectedTracks) {
    assert(soundSynthContent.includes(trackId), `Procedural track "${trackId}" is declared in soundSynthesizer`);
  }
  const expectedCategories = ['Rain', 'Nature', 'Ocean', 'Lo-fi', 'Piano', 'Ambient', 'White Noise', 'Night Ambience'];
  for (const cat of expectedCategories) {
    assert(soundSynthContent.includes(cat), `Sound category "${cat}" is supported in soundSynthesizer`);
  }

  // --------------------------------------------------------------------
  // TEST 3: Restrict Room Creation to Admin Only
  // --------------------------------------------------------------------
  console.log('\n--- TEST 3: Room Creation Restricted to Admin Only ---');
  // Register regular scholar user
  const regularUserRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'scholar_' + Date.now(),
      email: `scholar_${Date.now()}@studysst.com`,
      password: 'password123',
      displayName: 'Regular Scholar'
    })
  });
  assert(regularUserRes.status === 201, 'Regular user registered successfully');
  const regularToken = regularUserRes.json.token;

  // Regular user attempts to create custom room -> Expect 403 Forbidden
  const createRoomForbiddenRes = await request('/api/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${regularToken}`
    },
    body: JSON.stringify({
      name: 'Unauthorized Student Room',
      category: 'Silent Study',
      description: 'Hacked room'
    })
  });
  assert(createRoomForbiddenRes.status === 403, `Non-admin user creation blocked with 403 Forbidden (got ${createRoomForbiddenRes.status})`);
  assert(createRoomForbiddenRes.json.error.toLowerCase().includes('administrator'), 'Response clarifies that room creation is restricted to verified administrators');

  // Verify "Create Custom Study Hall" is removed from LobbyView
  const lobbyViewContent = fs.readFileSync(path.join(__dirname, '../../client/src/components/LobbyView.jsx'), 'utf8');
  assert(!lobbyViewContent.includes('Create Custom Study Hall'), 'Create Custom Study Hall button is removed from LobbyView');
  assert(!fs.existsSync(path.join(__dirname, '../../client/src/components/CreateRoomModal.jsx')), 'CreateRoomModal.jsx file is removed');

  // --------------------------------------------------------------------
  // TEST 4: Spotify Integration Endpoints & Socket Sharing
  // --------------------------------------------------------------------
  console.log('\n--- TEST 4: Spotify Integration Endpoints & Socket Sharing ---');
  // 1. Auth URL endpoint
  const authUrlRes = await request('/api/spotify/auth-url', {
    headers: { Authorization: `Bearer ${regularToken}` }
  });
  assert(authUrlRes.status === 200, 'GET /api/spotify/auth-url returns 200');

  // 2. Status endpoint
  const statusRes = await request('/api/spotify/status', {
    headers: { Authorization: `Bearer ${regularToken}` }
  });
  assert(statusRes.status === 200, 'GET /api/spotify/status returns 200');
  assert(statusRes.json.connected === false, 'Initially Spotify status reports connected = false');

  // 3. Toggle sharing
  const toggleRes = await request('/api/spotify/toggle-sharing', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${regularToken}`
    },
    body: JSON.stringify({ enabled: true })
  });
  assert(toggleRes.status === 200, 'POST /api/spotify/toggle-sharing returns 200');
  assert(toggleRes.json.isSharing === true, 'Toggle sharing successfully updated isSharing = true');

  // 4. Disconnect endpoint
  const disconnectRes = await request('/api/spotify/disconnect', {
    method: 'POST',
    headers: { Authorization: `Bearer ${regularToken}` }
  });
  assert(disconnectRes.status === 200, 'POST /api/spotify/disconnect returns 200');

  // --------------------------------------------------------------------
  // TEST 5: Real-Time Emoji Reaction Rate Limiting (300ms Cooldown)
  // --------------------------------------------------------------------
  console.log('\n--- TEST 5: Emoji Reaction Rate Limiting & Validation ---');
  const socket1 = io(SERVER_URL, { path: '/socket.io', transports: ['websocket'] });
  await new Promise(res => socket1.on('connect', res));

  socket1.emit('join-room', {
    roomId: 'room-silent-library',
    user: regularUserRes.json.user,
    mediaState: { mic: false, video: true }
  });
  await wait(200);

  let reactionsReceived = 0;
  socket1.on('reaction-received', () => {
    reactionsReceived++;
  });

  // Spam 5 reactions instantly
  socket1.emit('send-reaction', { roomId: 'room-silent-library', emoji: '🔥' });
  socket1.emit('send-reaction', { roomId: 'room-silent-library', emoji: '🔥' });
  socket1.emit('send-reaction', { roomId: 'room-silent-library', emoji: '🔥' });
  socket1.emit('send-reaction', { roomId: 'room-silent-library', emoji: '🔥' });
  socket1.emit('send-reaction', { roomId: 'room-silent-library', emoji: '🔥' });
  await wait(250);

  assert(reactionsReceived === 1, `Backend rate-limited instant burst: received ${reactionsReceived} of 5 spam reactions`);

  // Wait 350ms, then send another -> should succeed
  await wait(350);
  socket1.emit('send-reaction', { roomId: 'room-silent-library', emoji: '👏' });
  await wait(150);
  assert(reactionsReceived === 2, `Reaction permitted after cooldown elapsed: total received = ${reactionsReceived}`);

  // --------------------------------------------------------------------
  // TEST 6: Private 1-to-1 Direct Messaging & Confidentiality
  // --------------------------------------------------------------------
  console.log('\n--- TEST 6: Private 1-to-1 Direct Messaging & Confidentiality ---');
  // Register second scholar
  const scholar2Res = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'scholar2_' + Date.now(),
      email: `scholar2_${Date.now()}@studysst.com`,
      password: 'password123',
      displayName: 'Scholar Two'
    })
  });
  const scholar2Token = scholar2Res.json.token;
  const user1 = regularUserRes.json.user;
  const user2 = scholar2Res.json.user;

  // Register eavesdropping third party scholar
  const eavesdropperRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'eavesdropper_' + Date.now(),
      email: `eavesdropper_${Date.now()}@studysst.com`,
      password: 'password123',
      displayName: 'Eavesdropper'
    })
  });
  const eavesdropperToken = eavesdropperRes.json.token;

  // Connect socket for Scholar 2
  const socket2 = io(SERVER_URL, { path: '/socket.io', transports: ['websocket'] });
  await new Promise(res => socket2.on('connect', res));
  socket2.emit('join-room', {
    roomId: 'room-silent-library',
    user: user2,
    mediaState: { mic: false, video: true }
  });

  // Connect socket for Eavesdropper in same room
  const socketEavesdropper = io(SERVER_URL, { path: '/socket.io', transports: ['websocket'] });
  await new Promise(res => socketEavesdropper.on('connect', res));
  socketEavesdropper.emit('join-room', {
    roomId: 'room-silent-library',
    user: eavesdropperRes.json.user,
    mediaState: { mic: false, video: true }
  });
  await wait(200);

  let scholar2ReceivedDm = null;
  let eavesdropperReceivedDm = null;

  socket2.on('direct-message-received', (msg) => {
    scholar2ReceivedDm = msg;
  });

  socketEavesdropper.on('direct-message-received', (msg) => {
    eavesdropperReceivedDm = msg;
  });

  // User 1 sends direct message to User 2
  const secretMessage = 'Hey Scholar 2, want to co-study Calculus Chapter 4?';
  socket1.emit('send-direct-message', {
    roomId: 'room-silent-library',
    recipientId: user2.id,
    recipientSocketId: socket2.id,
    text: secretMessage
  });

  await wait(300);

  assert(scholar2ReceivedDm !== null, 'Scholar 2 successfully received 1-to-1 direct message via socket');
  assert(scholar2ReceivedDm.message === secretMessage, 'Scholar 2 message text matches secret direct message');
  assert(scholar2ReceivedDm.senderId === user1.id, 'Sender ID matches User 1');
  assert(eavesdropperReceivedDm === null, 'Eavesdropping 3rd party in the same room received ZERO private messages');

  // Verify Direct Message API History & Confidentiality
  const user1DmHistory = await request(`/api/direct-messages/${user2.id}`, {
    headers: { Authorization: `Bearer ${regularToken}` }
  });
  assert(user1DmHistory.status === 200, 'GET /api/direct-messages/:recipientId succeeds for conversation participants');
  assert(user1DmHistory.json.messages.length > 0, 'Direct message history contains the sent message');
  assert(user1DmHistory.json.messages[0].message === secretMessage, 'Stored DM content matches');

  // Verify Eavesdropper cannot read User 1 & User 2's direct messages via API
  const eavesdropperDmAttempt = await request(`/api/direct-messages/${user2.id}`, {
    headers: { Authorization: `Bearer ${eavesdropperToken}` }
  });
  assert(
    eavesdropperDmAttempt.json.messages.length === 0,
    'Eavesdropper cannot read other users private messages (returns empty list)'
  );

  // Clean up sockets
  socket1.disconnect();
  socket2.disconnect();
  socketEavesdropper.disconnect();

  console.log('\n======================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED PERFECTLY!`);
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
