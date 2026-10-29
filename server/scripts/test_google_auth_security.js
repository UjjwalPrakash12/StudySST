const http = require('http');
const db = require('../db');
const { connectMongoDB, models } = require('../mongodb');
const { cleanupTestArtifacts, PRESERVED_EMAILS } = require('./test_helpers');

const SERVER_URL = 'http://127.0.0.1:5050';

function post(endpoint, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(SERVER_URL + endpoint);
    const body = JSON.stringify(data);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    };

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

function makeMockToken(claims) {
  return 'test-token-mock:' + JSON.stringify(claims);
}

async function runGoogleAuthSecurityTests() {
  console.log('===============================================================');
  console.log('  CRITICAL SECURITY FIX 1: Google Auth Security Verification');
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

  const createdTestUserIds = [];

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Legitimate user with valid Firebase ID token can sign in
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Legitimate user with valid Firebase ID token ---');
    const legitClaims = {
      uid: 'google-uid-legit-' + Date.now(),
      email: `scholar.legit.${Date.now()}@example.com`,
      email_verified: true,
      name: 'Legit Scholar',
      picture: 'https://lh3.googleusercontent.com/test-pic.jpg',
    };
    const token1 = makeMockToken(legitClaims);
    const res1 = await post('/api/auth/google', { idToken: token1 });

    assert(res1.status === 200, `Expected 200 OK, got ${res1.status}`);
    assert(res1.data.token && typeof res1.data.token === 'string', 'JWT session token returned');
    assert(res1.data.user && res1.data.user.email === legitClaims.email, `User email matches verified token (${res1.data?.user?.email})`);
    assert(res1.data.user && res1.data.user.role === 'user', 'Regular scholar assigned user role');
    assert(res1.data.user && res1.data.user.isSuperAdmin === false, 'isSuperAdmin is false');
    if (res1.data.user?.id) createdTestUserIds.push(res1.data.user.id);

    // -------------------------------------------------------------------------
    // TEST 2: Missing ID token is rejected
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Missing ID token is rejected ---');
    const res2a = await post('/api/auth/google', { email: 'unauthorized@example.com' });
    assert(res2a.status === 400, `Expected 400 Bad Request for missing idToken, got ${res2a.status}`);
    assert(!res2a.data.token, 'No JWT token issued when token is missing');

    const res2b = await post('/api/auth/google', {});
    assert(res2b.status === 400, `Expected 400 Bad Request for empty body, got ${res2b.status}`);

    const res2c = await post('/api/auth/google', { idToken: '   ' });
    assert(res2c.status === 400, `Expected 400 Bad Request for whitespace token, got ${res2c.status}`);

    // -------------------------------------------------------------------------
    // TEST 3: Invalid or fabricated ID token is rejected
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Invalid or fabricated ID token is rejected ---');
    const res3a = await post('/api/auth/google', { idToken: 'test-token-fabricated' });
    assert(res3a.status === 401, `Expected 401 Unauthorized for fabricated token, got ${res3a.status}`);
    assert(!res3a.data.token, 'No JWT token issued for fabricated token');

    const res3b = await post('/api/auth/google', { idToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.bogus.signature' });
    assert(res3b.status === 401, `Expected 401 Unauthorized for forged JWT signature, got ${res3b.status}`);

    // -------------------------------------------------------------------------
    // TEST 4: Expired ID token is rejected
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Expired ID token is rejected ---');
    const res4 = await post('/api/auth/google', { idToken: 'test-token-expired' });
    assert(res4.status === 401, `Expected 401 Unauthorized for expired token, got ${res4.status}`);
    assert(res4.data.error && res4.data.error.includes('expired'), `Error message indicates token expiration (${res4.data.error})`);
    assert(!res4.data.token, 'No JWT token issued for expired token');

    // -------------------------------------------------------------------------
    // TEST 5: Supplying super-admin email without valid token does NOT authenticate as admin
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Impersonating admin without valid token rejected ---');
    const res5a = await post('/api/auth/google', {
      email: 'ujjwalprakash1812@gmail.com',
      displayName: 'Attacker Admin',
      uid: 'fake-admin-uid-999'
    });
    assert(res5a.status === 400, `Expected 400 rejection without token, got ${res5a.status}`);
    assert(!res5a.data.token, 'No admin JWT issued');

    const res5b = await post('/api/auth/google', {
      idToken: 'test-token-fabricated',
      email: 'ujjwalprakash1812@gmail.com'
    });
    assert(res5b.status === 401, `Expected 401 rejection with fake token, got ${res5b.status}`);
    assert(!res5b.data.token, 'No admin JWT issued');

    // -------------------------------------------------------------------------
    // TEST 6: Supplying admin email alongside another user's valid token does NOT grant admin access
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Request-body email tampering ignored ---');
    const attackerClaims = {
      uid: 'attacker-uid-' + Date.now(),
      email: `attacker.${Date.now()}@example.com`,
      email_verified: true,
      name: 'Sneaky Attacker',
    };
    const attackerToken = makeMockToken(attackerClaims);
    const res6 = await post('/api/auth/google', {
      idToken: attackerToken,
      email: 'ujjwalprakash1812@gmail.com', // Attempting to hijack super-admin identity in request body!
      role: 'superadmin',
      displayName: 'Super Administrator'
    });

    assert(res6.status === 200, `Expected 200 OK for valid attacker token, got ${res6.status}`);
    assert(res6.data.user && res6.data.user.email === attackerClaims.email, `User email set to verified token claim, NOT request body email`);
    assert(res6.data.user && res6.data.user.role === 'user', `Role is 'user', superadmin escalation strictly prevented`);
    assert(res6.data.user && res6.data.user.isSuperAdmin === false, 'isSuperAdmin is false');
    if (res6.data.user?.id) createdTestUserIds.push(res6.data.user.id);

    // -------------------------------------------------------------------------
    // TEST 7: Supplying fabricated UID alongside valid token does NOT impersonate another account
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Request-body UID tampering ignored ---');
    const userBClaims = {
      uid: 'real-uid-user-b-' + Date.now(),
      email: `user.b.${Date.now()}@example.com`,
      email_verified: true,
      name: 'User B',
    };
    const tokenB = makeMockToken(userBClaims);
    const res7 = await post('/api/auth/google', {
      idToken: tokenB,
      uid: 'user-bafcb5a5-3b80-418e-ad9d-6c00c1d77166' // Trying to hijack Admin's database ID or UID
    });

    assert(res7.status === 200, `Expected 200 OK, got ${res7.status}`);
    const userInDb = db.prepare('SELECT google_id FROM users WHERE id = ?').get(res7.data.user.id);
    assert(userInDb && userInDb.google_id === userBClaims.uid, `google_id in DB is verified claim (${userInDb?.google_id}), NOT request body UID`);
    if (res7.data.user?.id) createdTestUserIds.push(res7.data.user.id);

    // -------------------------------------------------------------------------
    // TEST 8: Suspended user remains blocked
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Suspended user remains blocked ---');
    const suspendedClaims = {
      uid: 'suspended-uid-' + Date.now(),
      email: `suspended.${Date.now()}@example.com`,
      email_verified: true,
      name: 'Suspended Scholar',
    };
    const suspendedToken = makeMockToken(suspendedClaims);

    // Pre-create suspended user in DB
    const suspendedUserId = 'user-test-suspended-' + Date.now();
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, display_name, avatar_seed, is_suspended, google_id)
      VALUES (?, ?, ?, 'hash', 'Suspended Scholar', 'Felix', 1, ?)
    `).run(suspendedUserId, 'suspended_' + Date.now().toString(36).slice(0, 5), suspendedClaims.email, suspendedClaims.uid);
    createdTestUserIds.push(suspendedUserId);

    const res8 = await post('/api/auth/google', { idToken: suspendedToken });
    assert(res8.status === 403, `Expected 403 Forbidden for suspended user, got ${res8.status}`);
    assert(res8.data.error && res8.data.error.includes('suspended'), `Suspension message returned (${res8.data.error})`);
    assert(!res8.data.token, 'No JWT issued to suspended user');

    // -------------------------------------------------------------------------
    // TEST 9: Legitimate existing account can still sign in and retains correct identity
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Legitimate existing account links google_id correctly ---');
    const existingEmail = `existing.${Date.now()}@example.com`;
    const existingUserId = 'user-test-existing-' + Date.now();
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, display_name, avatar_seed, total_focus_minutes, bio)
      VALUES (?, ?, ?, 'hash', 'Existing Scholar', 'Felix', 450, 'Original student bio')
    `).run(existingUserId, 'existing_' + Date.now().toString(36).slice(0, 5), existingEmail);
    createdTestUserIds.push(existingUserId);

    const linkClaims = {
      uid: 'google-uid-newlink-' + Date.now(),
      email: existingEmail,
      email_verified: true,
      name: 'Linked Google Name',
    };
    const linkToken = makeMockToken(linkClaims);
    const res9 = await post('/api/auth/google', { idToken: linkToken });

    assert(res9.status === 200, `Expected 200 OK for account linking, got ${res9.status}`);
    assert(res9.data.user && res9.data.user.id === existingUserId, `Retains existing user ID (${existingUserId})`);
    assert(res9.data.user && res9.data.user.total_focus_minutes === 450, 'Preserves existing study statistics (450 mins)');
    const updatedUserInDb = db.prepare('SELECT google_id FROM users WHERE id = ?').get(existingUserId);
    assert(updatedUserInDb && updatedUserInDb.google_id === linkClaims.uid, `google_id successfully linked in DB (${updatedUserInDb?.google_id})`);

    // -------------------------------------------------------------------------
    // TEST 10: Firebase verification failures do not result in account creation or JWT issuance
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: Verification failures do not create accounts or issue JWTs ---');
    const userCountBefore = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const res10 = await post('/api/auth/google', { idToken: 'test-token-service-failure' });

    assert(res10.status === 503 || res10.status === 401, `Expected 503/401 for service failure, got ${res10.status}`);
    assert(!res10.data.token, 'No JWT issued on service failure');
    const userCountAfter = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    assert(userCountBefore === userCountAfter, `User count unchanged in DB (before: ${userCountBefore}, after: ${userCountAfter})`);

    // -------------------------------------------------------------------------
    // TEST 11: Unverified Google email address is rejected
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 11: Unverified Google email address rejected ---');
    const unverifiedClaims = {
      uid: 'unverified-uid-' + Date.now(),
      email: `unverified.${Date.now()}@example.com`,
      email_verified: false, // NOT verified by Google!
      name: 'Unverified User',
    };
    const unverifiedToken = makeMockToken(unverifiedClaims);
    const res11 = await post('/api/auth/google', { idToken: unverifiedToken });

    assert(res11.status === 403, `Expected 403 Forbidden for unverified email, got ${res11.status}`);
    assert(res11.data.error && res11.data.error.includes('not verified'), `Error specifies unverified email requirement (${res11.data.error})`);
    assert(!res11.data.token, 'No JWT issued to unverified email');

  } catch (err) {
    console.error('Unexpected test exception:', err);
    failed++;
  } finally {
    console.log('\n--- CLEANUP: Removing Test Artifacts ---');
    await cleanupTestArtifacts({ userIds: createdTestUserIds });
    console.log(`Cleaned up ${createdTestUserIds.length} test accounts.`);
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

runGoogleAuthSecurityTests().catch(err => {
  console.error('Test script runner error:', err);
  process.exit(1);
});
