const express = require('express');
const {
  momoCallback,
  createPayment,
  checkPaymentStatus,
  getPendingPayment
} = require('../controllers/paymentController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment management via PayPack
 */

/**
 * @swagger
 * /api/payments/create:
 *   post:
 *     summary: Initiate a new payment
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - toilet_id
 *               - amount
 *               - phone_number
 *             properties:
 *               toilet_id:
 *                 type: integer
 *               amount:
 *                 type: number
 *               phone_number:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment initiated
 */
router.post('/create', createPayment);

/**
 * @swagger
 * /api/payments/status/{transaction_id}:
 *   get:
 *     summary: Check payment status
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: transaction_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment status details
 */
router.get('/status/:transaction_id', checkPaymentStatus);

/**
 * @swagger
 * /api/payments/momo-callback:
 *   post:
 *     summary: Webhook callback for payments
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: OK
 */
router.post('/momo-callback', momoCallback);

/**
 * @swagger
 * /api/payments/pending/{toilet_id}:
 *   get:
 *     summary: Get pending payment for ESP32 door control
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: toilet_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Pending payment details
 */
router.get('/pending/:toilet_id', getPendingPayment);

module.exports = router;
