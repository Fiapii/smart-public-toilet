const express = require('express');
const db = require('../config/db');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getAlerts,
  updateToiletStatus,
  getOwners,
  getComplaints,
  resolveComplaint,
  getBroadcasts
} = require('../controllers/cleanerController');

const router = express.Router();

// Require Cleaner role for all routes in this file
router.use(protect);
router.use(authorize('Cleaner'));

// Existing routes
router.get('/alerts', getAlerts);
router.get('/complaints', getComplaints);
router.put('/complaints/:id/resolve', resolveComplaint);
router.put('/toilet/:id', updateToiletStatus);
router.get('/owners', getOwners);
router.get('/broadcasts', getBroadcasts);

// ============================================================
// PUSH NOTIFICATION SUBSCRIPTION ENDPOINTS
// ============================================================

// Subscribe to push notifications (store subscription)
router.post('/push/subscribe', async (req, res) => {
  const cleanerId = req.user.id;
  const { subscription } = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }

  try {
    // Insert or update subscription for this cleaner
    await db.query(
      `INSERT INTO push_subscriptions (cleaner_id, endpoint, auth, p256dh)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       auth = VALUES(auth), p256dh = VALUES(p256dh)`,
      [
        cleanerId,
        subscription.endpoint,
        subscription.keys.auth,
        subscription.keys.p256dh
      ]
    );
    res.json({ success: true, message: 'Subscribed to push notifications' });
  } catch (error) {
    console.error('[Push Subscribe Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// Unsubscribe (remove subscription)
router.delete('/push/unsubscribe', async (req, res) => {
  const cleanerId = req.user.id;
  try {
    await db.query('DELETE FROM push_subscriptions WHERE cleaner_id = ?', [cleanerId]);
    res.json({ success: true, message: 'Unsubscribed from push notifications' });
  } catch (error) {
    console.error('[Push Unsubscribe Error]', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;