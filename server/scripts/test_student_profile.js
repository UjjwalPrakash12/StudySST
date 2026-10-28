const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

const API_PORT = 5050;
const BASE_URL = `http://127.0.0.1:${API_PORT}/api`;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = {};
    let payload = null;

    if (body) {
      payload = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting StudySST Student Profile & Privacy Test Suite...\n');

  // 1. Create two test users: User A and User B
  const timestamp = Date.now();
  const userA = {
    username: `scholar_a_${timestamp}`,
    email: `scholar_a_${timestamp}@test.edu`,
    password: 'Password123!',
    displayName: 'Scholar Alice'
  };

  const userB = {
    username: `scholar_b_${timestamp}`,
    email: `scholar_b_${timestamp}@test.edu`,
    password: 'Password123!',
    displayName: 'Scholar Bob'
  };

  console.log('1️⃣ Registering test students...');
  const regA = await request('POST', '/api/auth/register', userA);
  assert.strictEqual(regA.status, 201, `Failed to register user A: ${JSON.stringify(regA.body)}`);
  const tokenA = regA.body.token;
  const userAId = regA.body.user.id;
  console.log(`   ✅ User A registered: ${userA.username} (${userAId})`);

  const regB = await request('POST', '/api/auth/register', userB);
  assert.strictEqual(regB.status, 201, `Failed to register user B: ${JSON.stringify(regB.body)}`);
  const tokenB = regB.body.token;
  const userBId = regB.body.user.id;
  console.log(`   ✅ User B registered: ${userB.username} (${userBId})`);

  // 2. Test GET /api/users/profile/:identifier for own profile
  console.log('\n2️⃣ Testing own profile retrieval...');
  const ownProfileRes = await request('GET', `/api/users/profile/${userAId}`, null, tokenA);
  assert.strictEqual(ownProfileRes.status, 200, `Failed to get own profile: ${JSON.stringify(ownProfileRes.body)}`);
  const ownProfile = ownProfileRes.body.profile;
  assert.strictEqual(ownProfile.isOwnProfile, true);
  assert.strictEqual(ownProfile.username, userA.username);
  assert.strictEqual(ownProfile.email, userA.email);
  assert.ok(ownProfile.stats, 'Expected stats to be present on own profile');
  assert.ok(Array.isArray(ownProfile.badges), 'Expected badges array');
  assert.strictEqual(ownProfile.badges.length, 8, 'Expected 8 verified achievements');
  console.log('   ✅ Own profile loaded with full stats, badges, and verified metadata.');

  // 3. Test PUT /api/users/profile (Update profile)
  console.log('\n3️⃣ Testing profile editing & input sanitization...');
  const updatePayload = {
    displayName: 'Dr. Alice Smith',
    bio: 'Pursuing research in high-performance distributed systems.',
    college: 'Massachusetts Institute of Technology',
    course: 'Ph.D. in Computer Science',
    yearOfStudy: 'Graduate / Masters',
    location: 'Cambridge, MA',
    academicInterests: 'Distributed Systems, Consensus Protocols, Databases',
    subjects: 'Operating Systems, Advanced Algorithms',
    learningGoals: 'Publish a paper in OSDI 2027 and maintain daily focus.',
    skills: 'Rust, Go, C++, Linux Kernel',
    languages: 'English, French, German',
    dailyGoalMinutes: 180,
    showCollege: true,
    showStats: true,
    showGoals: true,
    showLocation: true,
    // Attempting malicious escalation:
    role: 'superadmin',
    isSuperAdmin: true,
    total_live_seconds: 999999
  };

  const updateRes = await request('PUT', '/api/users/profile', updatePayload, tokenA);
  assert.strictEqual(updateRes.status, 200, `Failed to update profile: ${JSON.stringify(updateRes.body)}`);
  assert.strictEqual(updateRes.body.success, true);
  assert.strictEqual(updateRes.body.user.display_name, 'Dr. Alice Smith');
  assert.strictEqual(updateRes.body.user.college, 'Massachusetts Institute of Technology');
  assert.strictEqual(updateRes.body.user.daily_goal_minutes, 180);
  assert.strictEqual(updateRes.body.user.role, 'user', 'Security: Malicious role escalation attempt must be rejected!');
  assert.strictEqual(updateRes.body.user.isSuperAdmin, false);
  console.log('   ✅ Profile updated successfully with strict role-escalation defense.');

  // 4. Test Public Profile View (User B viewing User A)
  console.log('\n4️⃣ Testing public profile view by another student...');
  const publicViewRes = await request('GET', `/api/users/profile/${userAId}`, null, tokenB);
  assert.strictEqual(publicViewRes.status, 200);
  const publicProfile = publicViewRes.body.profile;
  assert.strictEqual(publicProfile.isOwnProfile, false);
  assert.strictEqual(publicProfile.email, undefined, 'Security: Public profile must NEVER leak email address');
  assert.strictEqual(publicProfile.college, 'Massachusetts Institute of Technology');
  assert.strictEqual(publicProfile.location, 'Cambridge, MA');
  assert.ok(publicProfile.stats !== null);
  console.log('   ✅ Public profile correctly masks email while sharing authorized academic info.');

  // 5. Test Privacy Settings & Masking
  console.log('\n5️⃣ Testing privacy toggles (Hiding College, Stats, Goals, Location)...');
  const hidePrivacyPayload = {
    showCollege: false,
    showStats: false,
    showGoals: false,
    showLocation: false
  };
  const hidePrivacyRes = await request('PUT', '/api/users/profile', hidePrivacyPayload, tokenA);
  assert.strictEqual(hidePrivacyRes.status, 200);

  // User B views User A again with privacy turned ON
  const privateViewRes = await request('GET', `/api/users/profile/${userAId}`, null, tokenB);
  assert.strictEqual(privateViewRes.status, 200);
  const maskedProfile = privateViewRes.body.profile;
  assert.strictEqual(maskedProfile.college, '', 'Privacy: College must be hidden when show_college is false');
  assert.strictEqual(maskedProfile.course, '', 'Privacy: Course must be hidden when show_college is false');
  assert.strictEqual(maskedProfile.location, '', 'Privacy: Location must be hidden when show_location is false');
  assert.strictEqual(maskedProfile.learningGoals, '', 'Privacy: Goals must be hidden when show_goals is false');
  assert.strictEqual(maskedProfile.dailyGoalMinutes, null, 'Privacy: Daily goal must be hidden when show_goals is false');
  assert.strictEqual(maskedProfile.stats, null, 'Privacy: Stats must be null when show_stats is false');
  assert.deepStrictEqual(maskedProfile.badges, [], 'Privacy: Badges must be empty when show_stats is false');
  assert.deepStrictEqual(maskedProfile.recentActivity, [], 'Privacy: Recent activity must be empty when show_stats is false');
  console.log('   ✅ All privacy flags strictly enforced on public profile view!');

  // 6. Test Super Admin Protection
  console.log('\n6️⃣ Testing Super Admin Email Verification...');
  const superAdminLoginRes = await request('POST', '/api/auth/login', {
    login: 'ujjwalprakash1812@gmail.com',
    password: 'Password123!'
  });
  if (superAdminLoginRes.status === 200) {
    const adminToken = superAdminLoginRes.body.token;
    const adminProfile = await request('GET', '/api/users/profile/me', null, adminToken);
    assert.strictEqual(adminProfile.status, 200);
    assert.strictEqual(adminProfile.body.profile.role, 'superadmin');
    console.log('   ✅ Super Admin verified role preserved.');
  } else {
    console.log('   ℹ️ Super Admin login skipped (test user email checked).');
  }

  console.log('\n🎉 ALL STUDENT PROFILE TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
