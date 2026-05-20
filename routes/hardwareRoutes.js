const express = require('express');
const {
  updateSensors,
  rfidTap,
  logEvent,
  getSensorEvents,
  sseStream,
  checkPaymentTrigger,
  setOccupancy
} = require('../controllers/hardwareController');

const router = express.Router();

// Existing sensor update (called by ESP32)
router.post('/sensor-update', updateSensors);

// NEW: RFID card tap — ESP32 sends UID here to get OPEN_DOOR or DENY
router.post('/rfid-tap', rfidTap);

// NEW: Check for pending payments (called by ESP32 to trigger door after payment)
router.get('/payment-check/:toilet_id', checkPaymentTrigger);

// NEW: Update occupancy state
router.post('/occupancy/:toilet_id', setOccupancy);

// NEW: Log hardware events (door open/close, lid, flush)
router.post('/log-event', logEvent);

// NEW: Get recent sensor events for a toilet (used by dashboard polling fallback)
router.get('/events/:toilet_id', getSensorEvents);

// NEW: Server-Sent Events stream (browser subscribes to real-time updates)
// toilet_id can be a number OR "all" for the global owner/admin feed
router.get('/events/stream/:toilet_id', sseStream);

module.exports = router;
