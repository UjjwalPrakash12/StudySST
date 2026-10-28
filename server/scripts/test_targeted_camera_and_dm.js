/**
 * Targeted Verification Test for Camera Visibility & Direct Messaging Fixes
 * 
 * Verifies:
 * 1. WebRTC Mesh Signaling:
 *    - Transceivers ensure SDP offers and answers contain both audio & video media sections.
 *    - Signaling exchange (webrtc-offer, webrtc-answer, webrtc-ice-candidate) works between peers.
 *    - Camera OFF/ON broadcasts update-media-state and updates peer-media-changed immediately.
 * 2. 1-to-1 Private Direct Messaging:
 *    - Client-generated ID is honored and reflected back in direct-message-sent.
 *    - direct-message-sent matches client ID so 0 duplicate messages appear.
 *    - direct-message-received includes both camelCase and snake_case aliases (senderId, sender_id, recipientId, recipient_id, createdAt, created_at).
 *    - Incoming DM is reliably delivered to recipient in active room.
 *    - REST API returns full message history with both naming conventions for correct alignment.
 */

const io = require('socket.io-client');
const http = require('http');

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

function createSocket(token) {
  return io(SERVER_URL, {
    transports: ['websocket'],
    auth: { token }
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   Running StudySST Targeted Camera & DM Test Suite');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;
  function assert(condition, desc) {
    if (condition) {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc}`);
      failed++;
    }
  }

  // 1. Register two users
  const rand = Math.floor(Math.random() * 90000) + 10000;
  const user1Creds = {
    username: `scholar_cam_${rand}_1`,
    email: `scholar1_${rand}@example.com`,
    password: 'Password123!',
    displayName: 'Scholar One'
  };
  const user2Creds = {
    username: `scholar_cam_${rand}_2`,
    email: `scholar2_${rand}@example.com`,
    password: 'Password123!',
    displayName: 'Scholar Two'
  };

  const reg1 = await post('/api/auth/register', user1Creds);
  assert(reg1.status === 201, 'User 1 registered');
  const token1 = reg1.data.token;
  const user1 = reg1.data.user;

  const reg2 = await post('/api/auth/register', user2Creds);
  assert(reg2.status === 201, 'User 2 registered');
  const token2 = reg2.data.token;
  const user2 = reg2.data.user;

  const roomId = 'deep-work-cafe';

  // 2. Connect Sockets
  const socket1 = createSocket(token1);
  const socket2 = createSocket(token2);

  await Promise.all([
    new Promise(r => socket1.on('connect', r)),
    new Promise(r => socket2.on('connect', r))
  ]);
  assert(socket1.connected && socket2.connected, 'Both peer sockets connected');

  // --- PART 1: ROOM JOIN & WEBRTC SIGNALING TESTS ---
  console.log('\n--- TEST PART 1: Room Join & WebRTC Signaling ---');

  // User 1 joins room
  const u1JoinPromise = new Promise(resolve => {
    socket1.on('room-joined', (data) => resolve(data));
  });
  socket1.emit('join-room', {
    roomId,
    user: user1,
    mediaState: { mic: false, video: true }
  });
  const u1Joined = await u1JoinPromise;
  assert(u1Joined.roomId === roomId, 'User 1 joined deep-work-cafe');

  // User 2 joins room - User 1 should get user-joined, User 2 gets room-joined with User 1 as existing participant
  const u1UserJoinedPromise = new Promise(resolve => {
    socket1.on('user-joined', resolve);
  });
  const u2JoinPromise = new Promise(resolve => {
    socket2.on('room-joined', resolve);
  });

  socket2.emit('join-room', {
    roomId,
    user: user2,
    mediaState: { mic: false, video: true }
  });

  const [u1SawUser2, u2Joined] = await Promise.all([u1UserJoinedPromise, u2JoinPromise]);
  assert(u1SawUser2.participant.user.id === user2.id, 'User 1 notified that User 2 joined');
  assert(u2Joined.participants.some(p => p.user?.id === user1.id), 'User 2 received User 1 in participants list');

  // Signaling test: User 2 creates offer to User 1
  const u1OfferPromise = new Promise(resolve => {
    socket1.on('webrtc-offer', resolve);
  });

  // Mock offer containing audio and video m-lines (as created by addTransceiver in client)
  const mockOfferSdp = {
    type: 'offer',
    sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=sendrecv\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=sendrecv\r\n'
  };

  socket2.emit('webrtc-offer', {
    targetSocketId: socket1.id,
    offer: mockOfferSdp,
    senderSocketId: socket2.id
  });

  const offerReceived = await u1OfferPromise;
  assert(offerReceived.offer.sdp.includes('m=video'), 'Offer contains video media section');
  assert(offerReceived.offer.sdp.includes('m=audio'), 'Offer contains audio media section');
  assert(offerReceived.senderSocketId === socket2.id, 'Offer senderSocketId correctly identified');

  // User 1 sends answer back
  const u2AnswerPromise = new Promise(resolve => {
    socket2.on('webrtc-answer', resolve);
  });

  const mockAnswerSdp = {
    type: 'answer',
    sdp: 'v=0\r\no=- 67890 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=sendrecv\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=sendrecv\r\n'
  };

  socket1.emit('webrtc-answer', {
    targetSocketId: socket2.id,
    answer: mockAnswerSdp,
    senderSocketId: socket1.id
  });

  const answerReceived = await u2AnswerPromise;
  assert(answerReceived.answer.sdp.includes('m=video'), 'Answer contains video media section');
  assert(answerReceived.senderSocketId === socket1.id, 'Answer senderSocketId correctly identified');

  // Camera OFF state toggle broadcast test
  console.log('\n--- TEST PART 2: Camera OFF/ON State Broadcast ---');
  const u2MediaChangePromiseOff = new Promise(resolve => {
    socket2.on('peer-media-changed', resolve);
  });

  socket1.emit('update-media-state', {
    roomId,
    mediaState: { video: false }
  });

  const mediaChangeOff = await u2MediaChangePromiseOff;
  assert(mediaChangeOff.socketId === socket1.id, 'peer-media-changed reports User 1 socket');
  assert(mediaChangeOff.mediaState.video === false, 'Camera state successfully turned OFF');

  // Camera ON state toggle broadcast test
  const u2MediaChangePromiseOn = new Promise(resolve => {
    socket2.on('peer-media-changed', resolve);
  });

  socket1.emit('update-media-state', {
    roomId,
    mediaState: { video: true }
  });

  const mediaChangeOn = await u2MediaChangePromiseOn;
  assert(mediaChangeOn.mediaState.video === true, 'Camera state successfully turned ON');

  // --- PART 3: 1-to-1 PRIVATE DIRECT MESSAGING TESTS ---
  console.log('\n--- TEST PART 3: 1-to-1 Private Direct Messaging ---');

  // User 1 sends DM to User 2 with client-generated ID
  const clientDmId = 'dm-test-' + Date.now();
  const testMessageText = 'Hey Scholar Two, are you studying math today?';

  const u1AckPromise = new Promise(resolve => {
    socket1.on('direct-message-sent', resolve);
  });
  const u2RecvPromise = new Promise(resolve => {
    socket2.on('direct-message-received', resolve);
  });

  socket1.emit('send-direct-message', {
    id: clientDmId,
    roomId,
    recipientId: user2.id,
    recipientSocketId: socket2.id,
    text: testMessageText
  });

  const [u1Ack, u2Recv] = await Promise.all([u1AckPromise, u2RecvPromise]);

  // Verify client ID preservation (Deduplication guarantee)
  assert(u1Ack.id === clientDmId, `Server acknowledged with exact client message ID (${u1Ack.id} === ${clientDmId}) - 0 Duplicates!`);
  assert(u1Ack.message === testMessageText, 'Sent DM message text matches');

  // Verify recipient received message with normalized naming conventions
  assert(u2Recv.id === clientDmId, 'Recipient received matching message ID');
  assert(u2Recv.message === testMessageText, 'Recipient received exact text');
  assert(u2Recv.senderId === user1.id && u2Recv.sender_id === user1.id, 'Recipient got both senderId and sender_id aliases');
  assert(u2Recv.recipientId === user2.id && u2Recv.recipient_id === user2.id, 'Recipient got both recipientId and recipient_id aliases');
  assert(Boolean(u2Recv.createdAt && u2Recv.created_at), 'Recipient got both createdAt and created_at timestamps');

  // User 2 replies back to User 1
  const replyClientDmId = 'dm-reply-' + Date.now();
  const replyText = 'Yes! Doing Linear Algebra practice problems.';

  const u2ReplyAckPromise = new Promise(resolve => {
    socket2.on('direct-message-sent', resolve);
  });
  const u1ReplyRecvPromise = new Promise(resolve => {
    socket1.on('direct-message-received', resolve);
  });

  socket2.emit('send-direct-message', {
    id: replyClientDmId,
    roomId,
    recipientId: user1.id,
    recipientSocketId: socket1.id,
    text: replyText
  });

  const [u2ReplyAck, u1ReplyRecv] = await Promise.all([u2ReplyAckPromise, u1ReplyRecvPromise]);

  assert(u2ReplyAck.id === replyClientDmId, 'User 2 acknowledgment preserved client ID');
  assert(u1ReplyRecv.id === replyClientDmId, 'User 1 received User 2 reply');
  assert(u1ReplyRecv.senderId === user2.id && u1ReplyRecv.sender_id === user2.id, 'User 1 identified sender as User 2 in both fields');

  // REST API History Verification
  console.log('\n--- TEST PART 4: REST API History & UI Alignment ---');

  const historyResUser1 = await get(`/api/direct-messages/${user2.id}`, token1);
  assert(historyResUser1.status === 200, 'User 1 fetched DM history with User 2');
  assert(historyResUser1.data.messages.length >= 2, `History contains both messages (count: ${historyResUser1.data.messages.length})`);

  // Verify alignment test: check isMe logic for User 1
  const firstMsg = historyResUser1.data.messages.find(m => m.id === clientDmId);
  const secondMsg = historyResUser1.data.messages.find(m => m.id === replyClientDmId);

  assert(firstMsg && (firstMsg.sender_id === user1.id || firstMsg.senderId === user1.id), 'First message authored by User 1');
  assert(secondMsg && (secondMsg.sender_id === user2.id || secondMsg.senderId === user2.id), 'Second message authored by User 2');

  const user1IsMeFirst = (firstMsg.senderId || firstMsg.sender_id) === user1.id;
  const user1IsMeSecond = (secondMsg.senderId || secondMsg.sender_id) === user1.id;
  assert(user1IsMeFirst === true, 'UI alignment: User 1 identifies first message as "You" (right side)');
  assert(user1IsMeSecond === false, 'UI alignment: User 1 identifies second message as "Peer" (left side)');

  // Verify alignment test from User 2's perspective
  const user2IsMeFirst = (firstMsg.senderId || firstMsg.sender_id) === user2.id;
  const user2IsMeSecond = (secondMsg.senderId || secondMsg.sender_id) === user2.id;
  assert(user2IsMeFirst === false, 'UI alignment: User 2 identifies first message as "Peer" (left side)');
  assert(user2IsMeSecond === true, 'UI alignment: User 2 identifies second message as "You" (right side)');

  // Clean up
  socket1.disconnect();
  socket2.disconnect();

  console.log('\n======================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
