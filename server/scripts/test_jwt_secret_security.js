const { execSync, spawnSync } = require('child_process');
const jwt = require('jsonwebtoken');
const path = require('path');
const http = require('http');
const { validateJwtSecret, getOrAssertJwtSecret, MIN_SECRET_LENGTH, REJECTED_SECRETS } = require('../jwtConfig');
const db = require('../db');

const SERVER_URL = 'http://127.0.0.1:5050';

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

async function runJwtSecurityTests() {
  console.log('===============================================================');
  console.log('  SECURITY FIX 2: JWT Secret Configuration & Token Security');
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

  // -------------------------------------------------------------------------
  // TEST GROUP 1: Secret Validation & Rejection Logic
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Insecure Secret Rejection Logic ---');

  // Case 1: Missing JWT_SECRET (undefined)
  try {
    validateJwtSecret(undefined);
    assert(false, 'Expected undefined JWT_SECRET to throw');
  } catch (err) {
    assert(err.message.includes('missing'), 'Missing JWT_SECRET throws descriptive error');
    assert(!err.message.includes('undefined'), 'Error message does not leak sensitive information');
  }

  // Case 2: Missing JWT_SECRET (null)
  try {
    validateJwtSecret(null);
    assert(false, 'Expected null JWT_SECRET to throw');
  } catch (err) {
    assert(err.message.includes('missing'), 'Null JWT_SECRET throws descriptive error');
  }

  // Case 3: Empty string
  try {
    validateJwtSecret('');
    assert(false, 'Expected empty string JWT_SECRET to throw');
  } catch (err) {
    assert(err.message.includes('empty'), 'Empty string JWT_SECRET throws descriptive error');
  }

  // Case 4: Whitespace only
  try {
    validateJwtSecret('     ');
    assert(false, 'Expected whitespace JWT_SECRET to throw');
  } catch (err) {
    assert(err.message.includes('empty or whitespace'), 'Whitespace-only JWT_SECRET throws descriptive error');
  }

  // Case 5: Weak / short secret (< 32 chars)
  try {
    validateJwtSecret('short_secret_123');
    assert(false, 'Expected short secret to throw');
  } catch (err) {
    assert(err.message.includes('at least 32 characters'), 'Short secret (< 32 chars) rejected');
    assert(!err.message.includes('short_secret_123'), 'Candidate secret value is NOT printed in error message');
  }

  // Case 6: Legacy hardcoded fallback string rejected
  try {
    validateJwtSecret('studystream_dev_secret_key_2026_super_secure');
    assert(false, 'Expected legacy hardcoded default to throw');
  } catch (err) {
    assert(err.message.includes('insecure, known default or placeholder'), 'Legacy default studystream_dev_secret_key_2026_super_secure is strictly rejected');
  }

  // Case 7: Placeholder string from .env.example rejected
  try {
    validateJwtSecret('your_super_secret_jwt_key_here');
    assert(false, 'Expected placeholder from .env.example to throw');
  } catch (err) {
    assert(err.message.includes('insecure, known default or placeholder'), 'Placeholder your_super_secret_jwt_key_here is strictly rejected');
  }

  // Case 8: Trivial repeated characters rejected (low entropy)
  try {
    validateJwtSecret('a'.repeat(40));
    assert(false, 'Expected repetitive characters to throw');
  } catch (err) {
    assert(err.message.includes('insufficient entropy'), 'Low entropy repeated characters rejected');
  }

  // Case 9: Valid 64-char hex secret accepted
  const validHexSecret = '821ef6fe03b632adea6778a0e136e82860343f0939691dc459ffae19395c9be1';
  try {
    const validated = validateJwtSecret(validHexSecret);
    assert(validated === validHexSecret, 'Cryptographically strong 64-char hex secret accepted');
  } catch (err) {
    assert(false, `Valid secret unexpectedly rejected: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 2: Process Startup Termination on Invalid Configuration
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Process Startup Termination Behavior ---');

  const jwtConfigPath = path.resolve(__dirname, '../jwtConfig.js');

  // Subprocess test 1a: Missing JWT_SECRET terminates process with exit code 1
  const subprocMissing = spawnSync(process.execPath, [
    '-e', `require('${jwtConfigPath}').getOrAssertJwtSecret();`
  ], { env: { PATH: process.env.PATH, IGNORE_ENV_FILE: 'true', NODE_ENV: 'production' } });
  assert(subprocMissing.status === 1, `Process exits with code 1 when JWT_SECRET is missing (status: ${subprocMissing.status})`);
  const missingStderr = subprocMissing.stderr.toString();
  assert(missingStderr.includes('FATAL: JWT_SECRET CONFIGURATION ERROR'), 'Clear, actionable fatal error logged on stderr');
  assert(missingStderr.includes('openssl rand -hex 32'), 'Actionable command for generating secret provided');

  // Subprocess test 1b: Empty JWT_SECRET terminates process with exit code 1
  const subprocEmpty = spawnSync(process.execPath, [
    '-e', `require('${jwtConfigPath}').getOrAssertJwtSecret();`
  ], { env: { ...process.env, JWT_SECRET: '', NODE_ENV: 'production' } });
  assert(subprocEmpty.status === 1, `Process exits with code 1 when JWT_SECRET is empty string (status: ${subprocEmpty.status})`);
  const emptyStderr = subprocEmpty.stderr.toString();
  assert(emptyStderr.includes('empty or whitespace only'), 'Empty string error logged on stderr');

  // Subprocess test 2: Legacy fallback terminates process with exit code 1
  const subprocLegacy = spawnSync(process.execPath, [
    '-e', `require('${jwtConfigPath}').getOrAssertJwtSecret();`
  ], { env: { ...process.env, JWT_SECRET: 'studystream_dev_secret_key_2026_super_secure', NODE_ENV: 'production' } });
  assert(subprocLegacy.status === 1, `Process exits with code 1 when legacy fallback is supplied (status: ${subprocLegacy.status})`);

  // Subprocess test 3: Valid secret startup succeeds with exit code 0
  const subprocValid = spawnSync(process.execPath, [
    '-e', `require('${jwtConfigPath}').getOrAssertJwtSecret(); console.log('STARTUP_OK');`
  ], { env: { ...process.env, JWT_SECRET: validHexSecret, NODE_ENV: 'production' } });
  assert(subprocValid.status === 0, 'Process exits with code 0 when valid JWT_SECRET is provided');
  assert(subprocValid.stdout.toString().includes('STARTUP_OK'), 'Startup successfully completes');

  // -------------------------------------------------------------------------
  // TEST GROUP 3: Token Signing, Verification & Signature Rejection
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Token Signing & Signature Verification ---');

  const activeSecret = getOrAssertJwtSecret();
  const testPayload = {
    id: 'user-bafcb5a5-3b80-418e-ad9d-6c00c1d77166',
    email: 'ujjwalprakash1812@gmail.com',
    role: 'superadmin',
    isSuperAdmin: true
  };

  // 1. Token signed with active secret verifies cleanly
  const validToken = jwt.sign(testPayload, activeSecret, { expiresIn: '1h' });
  let decoded = null;
  try {
    decoded = jwt.verify(validToken, activeSecret);
    assert(decoded && decoded.email === testPayload.email, 'Token signed with active secret verified successfully');
    assert(decoded.role === 'superadmin', 'Token claims preserved accurately');
  } catch (err) {
    assert(false, `Valid token verification failed: ${err.message}`);
  }

  // 2. Token signed with a different secret is rejected
  const fakeSecret = 'wrong_secret_12345678901234567890123456789012';
  const forgedToken = jwt.sign(testPayload, fakeSecret, { expiresIn: '1h' });
  try {
    jwt.verify(forgedToken, activeSecret);
    assert(false, 'Forged token unexpectedly accepted');
  } catch (err) {
    assert(err.name === 'JsonWebTokenError' && err.message.includes('invalid signature'), 'Forged token rejected with invalid signature');
  }

  // 3. Token signed with legacy default is rejected against active secret
  const legacyForgedToken = jwt.sign(testPayload, 'studystream_dev_secret_key_2026_super_secure', { expiresIn: '1h' });
  try {
    jwt.verify(legacyForgedToken, activeSecret);
    assert(false, 'Token signed with legacy default unexpectedly accepted');
  } catch (err) {
    assert(err.name === 'JsonWebTokenError', 'Token signed with old legacy default rejected by active secret');
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 4: Live Server Authentication Integration
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Live Server Authentication Integration ---');

  // Authenticated user exists in SQLite
  const adminUser = db.prepare('SELECT id, email, role FROM users WHERE email = ?').get('ujjwalprakash1812@gmail.com');
  if (adminUser) {
    const liveValidToken = jwt.sign({
      id: adminUser.id,
      email: adminUser.email,
      role: 'superadmin',
      isSuperAdmin: true
    }, activeSecret, { expiresIn: '1h' });

    const resValid = await get('/api/auth/me', liveValidToken);
    assert(resValid.status === 200, `Live server accepted valid token (status: ${resValid.status})`);
    assert(resValid.data.user && resValid.data.user.email === adminUser.email, 'Live server returned correct user session');

    // Attempting to access live server with token signed with old legacy secret
    const liveLegacyToken = jwt.sign({
      id: adminUser.id,
      email: adminUser.email,
      role: 'superadmin',
      isSuperAdmin: true
    }, 'studystream_dev_secret_key_2026_super_secure', { expiresIn: '1h' });

    const resLegacy = await get('/api/auth/me', liveLegacyToken);
    assert(resLegacy.status === 403, `Live server rejected token signed with old legacy default (status: ${resLegacy.status})`);
    assert(resLegacy.data.error && resLegacy.data.error.includes('Invalid or expired token'), 'Live server returned 403 Invalid or expired token');

    // Attempting to access live server with no token
    const resNoToken = await get('/api/auth/me', null);
    assert(resNoToken.status === 401, `Live server rejected request without token (status: ${resNoToken.status})`);
  } else {
    console.warn('⚠️ Admin user not found in SQLite for live auth test.');
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

runJwtSecurityTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
