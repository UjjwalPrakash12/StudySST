const fs = require('fs');
const path = require('path');
const db = require('../db');
const { connectMongoDB, models } = require('../mongodb');

const PRESERVED_EMAILS = [
  'ujjwalprakash1812@gmail.com',
  'silent.sus01@gmail.com'
];

const PREDEFINED_ROOM_IDS = [
  'room-silent-library',
  'room-lofi-cafe',
  'room-stem-sprint',
  'room-med-mcat',
  'room-creative-studio'
];

async function runCleanup() {
  console.log('========================================================');
  console.log('   StudySST — Safe Audit, Backup, and Cleanup Script');
  console.log('========================================================\n');

  // 1. Connect to MongoDB Atlas
  console.log('1. Connecting to MongoDB Atlas...');
  const mongoConnected = await connectMongoDB();
  if (!mongoConnected) {
    console.error('❌ Failed to connect to MongoDB Atlas. Aborting cleanup to preserve dual-write consistency.');
    process.exit(1);
  }

  // 2. Fetch legitimate users
  const legitUsersSqlite = db.prepare(`
    SELECT * FROM users WHERE email IN (${PRESERVED_EMAILS.map(() => '?').join(',')})
  `).all(...PRESERVED_EMAILS);

  console.log('\n2. Preserved Real Accounts:');
  legitUsersSqlite.forEach(u => {
    console.log(`   - [${u.id}] ${u.email} (${u.display_name || u.username}) | Role: ${u.role}`);
  });

  if (legitUsersSqlite.length < 2) {
    console.error('⚠️ Warning: Expected at least 2 real accounts (ujjwalprakash1812@gmail.com and silent.sus01@gmail.com). Found:', legitUsersSqlite.length);
  }

  const legitUserIds = new Set(legitUsersSqlite.map(u => u.id));

  // 3. Perform Complete Backup of SQLite and MongoDB Atlas before any deletion
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilePath = path.join(__dirname, `../backups/backup_before_cleanup_${timestamp}.json`);

  console.log(`\n3. Creating complete snapshot backup at: ${backupFilePath}...`);
  const backupData = {
    createdAt: new Date().toISOString(),
    preservedEmails: PRESERVED_EMAILS,
    sqlite: {
      users: db.prepare('SELECT * FROM users').all(),
      rooms: db.prepare('SELECT * FROM rooms').all(),
      blogs: db.prepare('SELECT * FROM blogs').all(),
      blog_likes: db.prepare('SELECT * FROM blog_likes').all(),
      blog_comments: db.prepare('SELECT * FROM blog_comments').all(),
      live_sessions: db.prepare('SELECT * FROM live_sessions').all(),
      direct_messages: db.prepare('SELECT * FROM direct_messages').all(),
      tasks: db.prepare('SELECT * FROM tasks').all(),
      study_sessions: db.prepare('SELECT * FROM study_sessions').all(),
      spotify_connections: db.prepare('SELECT * FROM spotify_connections').all(),
    },
    mongodb: {
      users: await models.User.find({}).lean(),
      rooms: await models.Room.find({}).lean(),
      blogs: await models.Blog.find({}).lean(),
      live_sessions: await models.LiveSession.find({}).lean(),
      direct_messages: await models.DirectMessage.find({}).lean(),
    }
  };

  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`   ✅ Backup created successfully (${(fs.statSync(backupFilePath).size / 1024).toFixed(1)} KB).`);

  // 4. Categorize Dummy Data in SQLite
  const allUsersSqlite = db.prepare('SELECT id, email, username FROM users').all();
  const dummyUsersSqlite = allUsersSqlite.filter(u => !legitUserIds.has(u.id) && !PRESERVED_EMAILS.includes(u.email));
  const dummyUserIds = dummyUsersSqlite.map(u => u.id);

  console.log(`\n4. Categorized Dummy Records:`);
  console.log(`   - Dummy Users in SQLite to remove: ${dummyUsersSqlite.length}`);
  console.log(`   - Preserved Users in SQLite: ${allUsersSqlite.length - dummyUsersSqlite.length}`);

  const allBlogsSqlite = db.prepare('SELECT id, title, author_id FROM blogs').all();
  const dummyBlogsSqlite = allBlogsSqlite.filter(b => !legitUserIds.has(b.author_id));
  const dummyBlogIds = dummyBlogsSqlite.map(b => b.id);
  console.log(`   - Dummy Blogs in SQLite to remove: ${dummyBlogsSqlite.length}`);
  console.log(`   - Preserved Blogs in SQLite: ${allBlogsSqlite.length - dummyBlogsSqlite.length}`);

  // 5. Delete Dummy Content & Accounts from SQLite
  console.log('\n5. Executing SQLite deletion...');
  db.exec('BEGIN TRANSACTION;');
  try {
    if (dummyBlogIds.length > 0) {
      const blogPlaceholders = dummyBlogIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM blog_comments WHERE blog_id IN (${blogPlaceholders})`).run(...dummyBlogIds);
      db.prepare(`DELETE FROM blog_likes WHERE blog_id IN (${blogPlaceholders})`).run(...dummyBlogIds);
      db.prepare(`DELETE FROM blogs WHERE id IN (${blogPlaceholders})`).run(...dummyBlogIds);
    }

    if (dummyUserIds.length > 0) {
      const userPlaceholders = dummyUserIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM blog_comments WHERE user_id IN (${userPlaceholders})`).run(...dummyUserIds);
      db.prepare(`DELETE FROM blog_likes WHERE user_id IN (${userPlaceholders})`).run(...dummyUserIds);
      db.prepare(`DELETE FROM live_sessions WHERE user_id IN (${userPlaceholders})`).run(...dummyUserIds);
      db.prepare(`DELETE FROM direct_messages WHERE sender_id IN (${userPlaceholders}) OR recipient_id IN (${userPlaceholders})`).run(...dummyUserIds, ...dummyUserIds);
      db.prepare(`DELETE FROM tasks WHERE user_id IN (${userPlaceholders})`).run(...dummyUserIds);
      db.prepare(`DELETE FROM study_sessions WHERE user_id IN (${userPlaceholders})`).run(...dummyUserIds);
      db.prepare(`DELETE FROM users WHERE id IN (${userPlaceholders})`).run(...dummyUserIds);
    }

    db.exec('COMMIT;');
    console.log('   ✅ SQLite dummy data deleted successfully.');
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('❌ SQLite deletion error, rolled back:', err);
    process.exit(1);
  }

  // 6. Delete Dummy Content & Accounts from MongoDB Atlas
  console.log('\n6. Executing MongoDB Atlas deletion...');
  try {
    const mongoUserDel = await models.User.deleteMany({
      email: { $nin: PRESERVED_EMAILS }
    });
    console.log(`   - MongoDB Users deleted: ${mongoUserDel.deletedCount}`);

    const mongoBlogDel = await models.Blog.deleteMany({
      author_id: { $nin: Array.from(legitUserIds) }
    });
    console.log(`   - MongoDB Blogs deleted: ${mongoBlogDel.deletedCount}`);

    const mongoLiveDel = await models.LiveSession.deleteMany({
      user_id: { $nin: Array.from(legitUserIds) }
    });
    console.log(`   - MongoDB LiveSessions deleted: ${mongoLiveDel.deletedCount}`);

    const mongoDmDel = await models.DirectMessage.deleteMany({
      $or: [
        { sender_id: { $nin: Array.from(legitUserIds) } },
        { recipient_id: { $nin: Array.from(legitUserIds) } }
      ]
    });
    console.log(`   - MongoDB DirectMessages deleted: ${mongoDmDel.deletedCount}`);

    // Clean up any test rooms in MongoDB that are not in the 5 predefined rooms
    const mongoRoomDel = await models.Room.deleteMany({
      id: { $nin: PREDEFINED_ROOM_IDS }
    });
    console.log(`   - MongoDB Extra Test Rooms deleted: ${mongoRoomDel.deletedCount}`);

    console.log('   ✅ MongoDB Atlas dummy data cleaned successfully.');
  } catch (err) {
    console.error('❌ MongoDB Atlas deletion error:', err);
    process.exit(1);
  }

  // 7. Verification of Final Database State
  console.log('\n7. Final State Verification:');
  const finalUsersSqlite = db.prepare('SELECT id, email, username, role FROM users').all();
  const finalBlogsSqlite = db.prepare('SELECT id, title, author_id FROM blogs').all();
  const finalRoomsSqlite = db.prepare('SELECT id, name FROM rooms').all();

  console.log(`   - SQLite Users Remaining: ${finalUsersSqlite.length}`);
  finalUsersSqlite.forEach(u => console.log(`     * ${u.email} (${u.role})`));
  console.log(`   - SQLite Blogs Remaining: ${finalBlogsSqlite.length}`);
  finalBlogsSqlite.forEach(b => console.log(`     * "${b.title}"`));
  console.log(`   - SQLite Rooms Remaining: ${finalRoomsSqlite.length}`);
  finalRoomsSqlite.forEach(r => console.log(`     * [${r.id}] ${r.name}`));

  const finalUsersMongo = await models.User.find({}).lean();
  const finalBlogsMongo = await models.Blog.find({}).lean();
  const finalRoomsMongo = await models.Room.find({}).lean();

  console.log(`   - MongoDB Users Remaining: ${finalUsersMongo.length}`);
  finalUsersMongo.forEach(u => console.log(`     * ${u.email} (${u.role})`));
  console.log(`   - MongoDB Blogs Remaining: ${finalBlogsMongo.length}`);
  finalBlogsMongo.forEach(b => console.log(`     * "${b.title}"`));
  console.log(`   - MongoDB Rooms Remaining: ${finalRoomsMongo.length}`);
  finalRoomsMongo.forEach(r => console.log(`     * [${r.id}] ${r.name}`));

  console.log('\n========================================================');
  console.log('   ✅ Audit & Cleanup Completed Successfully!');
  console.log('========================================================\n');
  process.exit(0);
}

runCleanup().catch(err => {
  console.error('Unhandled cleanup script error:', err);
  process.exit(1);
});
