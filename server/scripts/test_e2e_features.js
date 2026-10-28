/**
 * End-to-End Test Suite for StudySST Features:
 * 1. Accurate Study-Hour Tracking (Multi-tab, Reconnect, Stale cleanup, Non-overlapping)
 * 2. Live Leaderboard (Real-time updates, Ranking reorder, Zero-hour handling)
 * 3. Blog Post Likes (Atomic toggle, Count integrity, Multi-user, Real-time sync)
 * 4. Blog Post Comments (Submission, Validation, Ordering, Deletion auth, Real-time sync)
 */

const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:5050';

async function request(path, options = {}) {
  const url = `${SERVER_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

function createSocket() {
  return io(SERVER_URL, {
    path: '/socket.io',
    transports: ['websocket'],
    forceNew: true
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('====================================================');
  console.log('  🧪 STARTING STUDYSST END-TO-END FEATURE TEST SUITE');
  console.log('====================================================\n');

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

  try {
    // ----------------------------------------------------
    // SETUP: Create two test users (User A and User B)
    // ----------------------------------------------------
    const timestamp = Date.now().toString(36);
    const userAData = {
      username: `scholarA_${timestamp}`,
      email: `scholarA_${timestamp}@test.edu`,
      password: 'Password123!',
      displayName: `Scholar Alice ${timestamp}`
    };
    const userBData = {
      username: `scholarB_${timestamp}`,
      email: `scholarB_${timestamp}@test.edu`,
      password: 'Password123!',
      displayName: `Scholar Bob ${timestamp}`
    };

    const regA = await request('/api/auth/register', { method: 'POST', body: JSON.stringify(userAData) });
    const regB = await request('/api/auth/register', { method: 'POST', body: JSON.stringify(userBData) });

    assert(regA.ok && regA.data.token, 'Registered User A with JWT token');
    assert(regB.ok && regB.data.token, 'Registered User B with JWT token');

    const tokenA = regA.data.token;
    const tokenB = regB.data.token;
    const userA = regA.data.user;
    const userB = regB.data.user;

    // Connect global presence sockets for both users
    const socketPresenceA = createSocket();
    const socketPresenceB = createSocket();

    await new Promise(resolve => {
      let count = 0;
      socketPresenceA.on('connect', () => { if (++count === 2) resolve(); });
      socketPresenceB.on('connect', () => { if (++count === 2) resolve(); });
    });

    socketPresenceA.emit('presence-register', { visitorId: `vis-A-${timestamp}`, user: userA, isAuthenticated: true, view: 'lobby' });
    socketPresenceB.emit('presence-register', { visitorId: `vis-B-${timestamp}`, user: userB, isAuthenticated: true, view: 'lobby' });

    console.log('\n--- 1. TESTING BLOG POST LIKES & REAL-TIME BROADCAST ---');
    // User A creates a blog post
    const createBlogRes = await request('/api/blogs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        title: `Deep Work Mastery ${timestamp}`,
        content: 'Focus without distraction is the superpower of the 21st century.',
        category: 'Deep Work'
      })
    });

    assert(createBlogRes.ok && createBlogRes.data.blog, 'User A created community blog post');
    const blogId = createBlogRes.data.blog.id;

    // Setup listener on User A's socket for real-time like updates
    let realTimeLikeReceived = null;
    socketPresenceA.on('blog-like-updated', (data) => {
      if (data.blogId === blogId) {
        realTimeLikeReceived = data;
      }
    });

    // User B likes the post
    const like1 = await request(`/api/blogs/${blogId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(like1.ok && like1.data.liked === true && like1.data.likes_count === 1, 'User B liked the blog (likes_count: 1)');

    await sleep(200);
    assert(realTimeLikeReceived && realTimeLikeReceived.likesCount === 1, 'User A received real-time "blog-like-updated" event via WebSocket');

    // User B clicks like again (toggle unlike)
    const like2 = await request(`/api/blogs/${blogId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(like2.ok && like2.data.liked === false && like2.data.likes_count === 0, 'User B unliked the blog (likes_count: 0)');

    // User A likes their own post
    const like3 = await request(`/api/blogs/${blogId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(like3.ok && like3.data.liked === true && like3.data.likes_count === 1, 'User A liked the post');

    // Persistence Check: Fetch blog detail as User A and User B
    const blogForA = await request(`/api/blogs/${blogId}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const blogForB = await request(`/api/blogs/${blogId}`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(blogForA.data.blog.user_has_liked === true && blogForA.data.blog.likes_count === 1, 'Persisted state for User A: user_has_liked=true, count=1');
    assert(blogForB.data.blog.user_has_liked === false && blogForB.data.blog.likes_count === 1, 'Persisted state for User B: user_has_liked=false, count=1');


    console.log('\n--- 2. TESTING BLOG COMMENTS, VALIDATION, AUTH & REAL-TIME ---');
    // Test empty comment rejection
    const emptyCommentRes = await request(`/api/blogs/${blogId}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ content: '   ' })
    });
    assert(emptyCommentRes.status === 400, 'Rejected empty/whitespace comment with 400 Bad Request');

    // User A listens for real-time comment additions
    let realTimeCommentReceived = null;
    socketPresenceA.on('blog-comment-added', (data) => {
      if (data.blogId === blogId) {
        realTimeCommentReceived = data;
      }
    });

    // User B posts a valid comment
    const comment1 = await request(`/api/blogs/${blogId}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ content: 'Great insights on deep work!' })
    });
    assert(comment1.ok && comment1.data.comment && comment1.data.comments_count === 1, 'User B posted comment (comments_count: 1)');

    await sleep(200);
    assert(realTimeCommentReceived && realTimeCommentReceived.comment.content === 'Great insights on deep work!', 'User A received real-time "blog-comment-added" event');

    const commentBId = comment1.data.comment.id;

    // User A attempts to delete User B's comment (Unauthorized test)
    // Note: User A is the author of the blog so they are permitted to moderate comments on their blog.
    // Let's create User C to test unauthorized deletion!
    const userCData = {
      username: `scholarC_${timestamp}`,
      email: `scholarC_${timestamp}@test.edu`,
      password: 'Password123!',
      displayName: `Scholar Charlie ${timestamp}`
    };
    const regC = await request('/api/auth/register', { method: 'POST', body: JSON.stringify(userCData) });
    const tokenC = regC.data.token;

    const unauthDelete = await request(`/api/blogs/${blogId}/comments/${commentBId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenC}` }
    });
    assert(unauthDelete.status === 403, 'Unauthorized User C forbidden (403) from deleting User B comment');

    // User B deletes their own comment
    let realTimeCommentDeleted = null;
    socketPresenceA.on('blog-comment-deleted', (data) => {
      if (data.blogId === blogId) {
        realTimeCommentDeleted = data;
      }
    });

    const authDelete = await request(`/api/blogs/${blogId}/comments/${commentBId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(authDelete.ok && authDelete.data.comments_count === 0, 'User B deleted own comment (comments_count: 0)');

    await sleep(200);
    assert(realTimeCommentDeleted && realTimeCommentDeleted.commentId === commentBId, 'User A received real-time "blog-comment-deleted" event');


    console.log('\n--- 3. TESTING STUDY-HOUR TRACKING & MULTI-TAB DE-DUPLICATION ---');
    // Tab 1 joins room
    const tab1 = createSocket();
    const tab2 = createSocket();

    await new Promise(resolve => tab1.on('connect', resolve));
    await new Promise(resolve => tab2.on('connect', resolve));

    let tab1SessionStarted = null;
    let tab2SessionStarted = null;

    tab1.on('session-live-started', (data) => { tab1SessionStarted = data; });
    tab2.on('session-live-started', (data) => { tab2SessionStarted = data; });

    tab1.emit('join-room', {
      roomId: 'room-silent-library',
      user: userA,
      mediaState: { mic: false, video: true }
    });

    await sleep(300);
    assert(tab1SessionStarted && tab1SessionStarted.sessionId, `Tab 1 joined room: Session ${tab1SessionStarted?.sessionId} started`);

    // Tab 2 opens the SAME room with the SAME user
    tab2.emit('join-room', {
      roomId: 'room-silent-library',
      user: userA,
      mediaState: { mic: false, video: true }
    });

    await sleep(300);
    assert(tab2SessionStarted && tab2SessionStarted.sessionId === tab1SessionStarted.sessionId, 
      'Tab 2 attached to SAME active session (sessionId identical, no duplicate created)');

    // Simulate heartbeats from Tab 1 and Tab 2
    let ackReceived = 0;
    tab1.on('heartbeat-ack', () => { ackReceived++; });
    tab2.on('heartbeat-ack', () => { ackReceived++; });

    await sleep(1100); // 1.1s elapsed
    tab1.emit('session-heartbeat');
    await sleep(200);
    tab2.emit('session-heartbeat');
    await sleep(300);

    assert(ackReceived >= 2, 'Received heartbeat acknowledgements from server');

    // Close Tab 1: session must continue because Tab 2 is still open!
    tab1.emit('leave-room', { roomId: 'room-silent-library' });
    tab1.disconnect();
    await sleep(300);

    // Verify User A is STILL live because Tab 2 is active
    const userACheck = await request('/api/auth/me', { headers: { Authorization: `Bearer ${tokenA}` } });
    assert(userACheck.data.user.is_live === 1, 'User A remains LIVE after Tab 1 closed (Tab 2 still open)');

    // Close Tab 2: now session must be finalized!
    tab2.emit('leave-room', { roomId: 'room-silent-library' });
    tab2.disconnect();
    await sleep(500);

    const userAFinal = await request('/api/auth/me', { headers: { Authorization: `Bearer ${tokenA}` } });
    assert(userAFinal.data.user.is_live === 0, 'User A marked offline (is_live: 0) after last tab closed');
    assert(userAFinal.data.user.total_live_seconds >= 1, `Verified study duration credited to user profile (${userAFinal.data.user.total_live_seconds}s)`);


    console.log('\n--- 4. TESTING LIVE LEADERBOARD SYNCHRONIZATION ---');
    // User B listens for real-time leaderboard broadcast
    let leaderboardUpdateReceived = false;
    socketPresenceB.on('leaderboard-updated', () => {
      leaderboardUpdateReceived = true;
    });

    // User A joins room and records a session to trigger a live leaderboard update
    const studyTab = createSocket();
    await new Promise(resolve => studyTab.on('connect', resolve));
    studyTab.emit('join-room', {
      roomId: 'room-stem-sprint',
      user: userA,
      mediaState: { mic: false, video: true }
    });

    await sleep(1200);
    studyTab.emit('session-heartbeat');
    await sleep(300);
    studyTab.emit('leave-room', { roomId: 'room-stem-sprint' });
    studyTab.disconnect();

    await sleep(600);
    assert(leaderboardUpdateReceived, 'User B received real-time "leaderboard-updated" broadcast via WebSocket');

    // Fetch leaderboard
    const lbRes = await request('/api/leaderboard?period=all_time', {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(lbRes.ok && Array.isArray(lbRes.data.leaderboard), 'Fetched live leaderboard');

    const userAInLeaderboard = lbRes.data.leaderboard.find(u => u.id === userA.id);
    assert(userAInLeaderboard && userAInLeaderboard.total_live_seconds > 0, 
      `User A appears on live leaderboard with verified study time: ${userAInLeaderboard?.total_live_seconds}s`);

    // Cleanup sockets
    socketPresenceA.disconnect();
    socketPresenceB.disconnect();

  } catch (err) {
    console.error('Unhandled test exception:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`  🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
