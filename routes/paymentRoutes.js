const express = require('express');
const {
  momoCallback,
  createPayment,
  checkPaymentStatus,
  getPendingPayment,
  manualConfirmPayment,
  paypackWebhook               // webhook handler
} = require('../controllers/paymentController');

const router = express.Router();

// Initiate payment
router.post('/create', createPayment);

// Poll payment status
router.get('/status/:transaction_id', checkPaymentStatus);

// Legacy callback (deprecated, but kept for compatibility)
router.post('/momo-callback', momoCallback);

// Get pending payment for ESP32
router.get('/pending/:toilet_id', getPendingPayment);

// Admin/Owner manual confirmation (for stuck payments)
router.post('/manual-confirm', manualConfirmPayment);

// PayPack webhook (instant confirmation)
router.post('/webhook', paypackWebhook);

module.exports = router;