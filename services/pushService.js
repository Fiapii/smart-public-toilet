const webpush = require('web-push');
const db = require('../config/db');

function setupPush() {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'admin@example.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ─── Send to ALL subscriptions for a cleaner ──────────────
async function sendPushToCleaner(cleanerId, title, body) {
  try {
    // Get all subscriptions for this cleaner
    const [rows] = await db.query(
      'SELECT id, endpoint, auth, p256dh FROM push_subscriptions WHERE cleaner_id = ?',
      [cleanerId]
    );
    if (rows.length === 0) {
      console.log(`[PUSH] No subscriptions for cleaner ${cleanerId}`);
      return false;
    }

    let successCount = 0;
    const payload = JSON.stringify({ title, body });

    for (const row of rows) {
      const subscription = {
        endpoint: row.endpoint,
        keys: { auth: row.auth, p256dh: row.p256dh }
      };

      try {
        await webpush.sendNotification(subscription, payload);
        console.log(`✅ Push sent to cleaner ${cleanerId} (subscription ${row.id})`);
        successCount++;
      } catch (err) {
        console.error(`❌ Push error for subscription ${row.id}:`, err);
        if (err.statusCode === 410) {
          // Subscription expired – remove it
          await db.query('DELETE FROM push_subscriptions WHERE id = ?', [row.id]);
          console.log(`🗑️ Removed expired subscription ${row.id}`);
        }
      }
    }

    return successCount > 0;
  } catch (err) {
    console.error(`❌ sendPushToCleaner error:`, err);
    return false;
  }
}

// ─── For owners (optional) – same multi‑device logic ──────
async function sendPushToOwner(ownerId, title, body) {
  try {
    const [rows] = await db.query(
      'SELECT id, endpoint, auth, p256dh FROM owner_push_subscriptions WHERE owner_id = ?',
      [ownerId]
    );
    if (rows.length === 0) return false;

    let successCount = 0;
    const payload = JSON.stringify({ title, body });

    for (const row of rows) {
      const subscription = {
        endpoint: row.endpoint,
        keys: { auth: row.auth, p256dh: row.p256dh }
      };

      try {
        await webpush.sendNotification(subscription, payload);
        console.log(`✅ Push sent to owner ${ownerId} (subscription ${row.id})`);
        successCount++;
      } catch (err) {
        console.error(`❌ Push error for owner subscription ${row.id}:`, err);
        if (err.statusCode === 410) {
          await db.query('DELETE FROM owner_push_subscriptions WHERE id = ?', [row.id]);
          console.log(`🗑️ Removed expired owner subscription ${row.id}`);
        }
      }
    }
    return successCount > 0;
  } catch (err) {
    console.error(`❌ sendPushToOwner error:`, err);
    return false;
  }
}

module.exports = { setupPush, sendPushToCleaner, sendPushToOwner };