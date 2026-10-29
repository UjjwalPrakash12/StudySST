const db = require('../db');
const { connectMongoDB, models } = require('../mongodb');

const PRESERVED_EMAILS = [
  'ujjwalprakash1812@gmail.com',
  'silent.sus01@gmail.com',
  'sattelite.xyz@gmail.com'
];

async function cleanupTestArtifacts({ userIds = [], roomIds = [] } = {}) {
  // Never delete preserved real accounts
  const safeUserIds = [];
  for (const uid of userIds) {
    if (!uid) continue;
    const u = db.prepare('SELECT email FROM users WHERE id = ?').get(uid);
    if (!u || !PRESERVED_EMAILS.includes(u.email)) {
      safeUserIds.push(uid);
    }
  }

  // Delete from SQLite
  if (safeUserIds.length > 0) {
    const ph = safeUserIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM blog_comments WHERE user_id IN (${ph})`).run(...safeUserIds);
    db.prepare(`DELETE FROM blog_likes WHERE user_id IN (${ph})`).run(...safeUserIds);
    db.prepare(`DELETE FROM live_sessions WHERE user_id IN (${ph})`).run(...safeUserIds);
    db.prepare(`DELETE FROM direct_messages WHERE sender_id IN (${ph}) OR recipient_id IN (${ph})`).run(...safeUserIds, ...safeUserIds);
    db.prepare(`DELETE FROM blogs WHERE author_id IN (${ph})`).run(...safeUserIds);
    db.prepare(`DELETE FROM tasks WHERE user_id IN (${ph})`).run(...safeUserIds);
    db.prepare(`DELETE FROM study_sessions WHERE user_id IN (${ph})`).run(...safeUserIds);
    db.prepare(`DELETE FROM users WHERE id IN (${ph})`).run(...safeUserIds);
  }

  if (roomIds.length > 0) {
    const ph = roomIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM rooms WHERE id IN (${ph})`).run(...roomIds);
  }

  // Delete from MongoDB Atlas if connected
  try {
    if (safeUserIds.length > 0 && models.User) {
      await models.User.deleteMany({ id: { $in: safeUserIds } });
      await models.Blog.deleteMany({ author_id: { $in: safeUserIds } });
      await models.LiveSession.deleteMany({ user_id: { $in: safeUserIds } });
      await models.DirectMessage.deleteMany({
        $or: [
          { sender_id: { $in: safeUserIds } },
          { recipient_id: { $in: safeUserIds } }
        ]
      });
    }
    if (roomIds.length > 0 && models.Room) {
      await models.Room.deleteMany({ id: { $in: roomIds } });
    }
  } catch (e) {
    // MongoDB cleanup best-effort
  }
}

module.exports = {
  PRESERVED_EMAILS,
  cleanupTestArtifacts
};
