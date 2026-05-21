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

// ESP32 calls – sensor data, RFID, events, occupancy
router.post('/sensor-update', updateSensors);
router.post('/rfid-tap', rfidTap);
router.post('/log-event', logEvent);
router.post('/occupancy/:toilet_id', setOccupancy);

// Payment check (ESP32 polls this)
router.get('/payment-check/:toilet_id', checkPaymentTrigger);

// Dashboard endpoints
router.get('/events/:toilet_id', getSensorEvents);
router.get('/events/stream/:toilet_id', sseStream);

module.exports = router;