const webpush = require('web-push');
const db = require('../config/db');

function setupPush() {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'admin@example.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

async function sendPushToCleaner(cleanerId, title, body) {
  try {
    const [rows] = await db.query(
      'SELECT endpoint, auth, p256dh FROM push_subscriptions WHERE cleaner_id = ?',
      [cleanerId]
    );
    if (rows.length === 0) return false;

    const subscription = {
      endpoint: rows[0].endpoint,
      keys: { auth: rows[0].auth, p256dh: rows[0].p256dh }
    };
    const payload = JSON.stringify({ title, body });
    await webpush.sendNotification(subscription, payload);
    console.log(`✅ Push sent to cleaner ${cleanerId}`);
    return true;
  } catch (err) {
    console.error(`❌ Push error:`, err);
    if (err.statusCode === 410) {
      await db.query('DELETE FROM push_subscriptions WHERE cleaner_id = ?', [cleanerId]);
    }
    return false;
  }
}

module.exports = { setupPush, sendPushToCleaner };