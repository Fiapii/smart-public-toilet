const db = require('../config/db');
const paypack = require('../services/paypack');
const { logAndBroadcast } = require('./hardwareController');

// ─────────────────────────────────────────────────────────────
// CREATE PAYMENT (initiate PayPack cash‑in)
// ─────────────────────────────────────────────────────────────
exports.createPayment = async (req, res) => {
  let { toilet_id, amount, phone_number } = req.body;

  if (!toilet_id || !amount || !phone_number) {
    return res.status(400).json({ error: 'Missing required parameters: toilet_id, amount, phone_number' });
  }

  // Sanitize phone number
  phone_number = phone_number.replace(/\s+/g, '').replace(/\+/g, '');
  if (phone_number.startsWith('07')) {
    phone_number = '250' + phone_number.slice(1);
  } else if (phone_number.length === 9 && phone_number.startsWith('7')) {
    phone_number = '250' + phone_number;
  }

  try {
    // 1. Check toilet exists and is free
    const [toilets] = await db.query('SELECT is_occupied FROM `toilets` WHERE id = ?', [toilet_id]);
    if (toilets.length === 0) {
      return res.status(404).json({ error: 'Toilet not found' });
    }
    if (toilets[0].is_occupied) {
      return res.status(400).json({ success: false, error: 'Toilet is currently in use. Please wait.' });
    }

    // 2. Create pending record
    const [result] = await db.query(
      'INSERT INTO `payments` (toilet_id, amount, phone_number, status) VALUES (?, ?, ?, "pending")',
      [toilet_id, amount, phone_number]
    );
    const paymentId = result.insertId;

    // 3. Call PayPack
    try {
      console.log('[PAYMENT] Initiating PayPack:', { phone_number, amount });
      const paypackRes = await paypack.initiateCashin(phone_number, amount);
      console.log('[PAYMENT] PayPack response:', paypackRes);
      const transactionId = paypackRes.ref;

      await db.query('UPDATE `payments` SET transaction_id = ? WHERE id = ?', [transactionId, paymentId]);

      res.json({
        success: true,
        message: 'Payment initiated. Please check your phone to confirm.',
        transaction_id: transactionId,
        payment_id: paymentId,
        amount
      });
    } catch (paypackError) {
      console.error('[PAYMENT] PayPack initiation failed:', paypackError.message);
      const errorDetail = paypackError.response?.data || paypackError.message;

      // Mock mode for testing
      if (process.env.MOCK_PAYMENT === 'true') {
        console.log('[PAYMENT] Using mock payment (MOCK_PAYMENT=true)');
        const mockTransactionId = 'MOCK_' + Date.now();
        await db.query(
          'UPDATE `payments` SET transaction_id = ?, status = "completed", paid_at = NOW() WHERE id = ?',
          [mockTransactionId, paymentId]
        );
        await db.query('UPDATE `toilets` SET revenue = revenue + ? WHERE id = ?', [amount, toilet_id]);
        await logAndBroadcast(toilet_id, 'payment', `Mock payment confirmed: RWF ${amount} – ${mockTransactionId}`);
        return res.json({
          success: true,
          message: 'Payment successful (MOCK MODE). Door opening...',
          transaction_id: mockTransactionId,
          payment_id: paymentId,
          status: 'successful',
          amount,
          mock: true
        });
      }

      res.status(500).json({
        success: false,
        error: 'PayPack initiation failed',
        details: typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : errorDetail
      });
    }
  } catch (error) {
    console.error('[PAYMENT] Database error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// CHECK PAYMENT STATUS (polled by frontend)
// ─────────────────────────────────────────────────────────────
exports.checkPaymentStatus = async (req, res) => {
  const { transaction_id } = req.params;
  if (!transaction_id) {
    return res.status(400).json({ error: 'Transaction ID is required' });
  }

  try {
    // 1. Get status from PayPack (already normalised by paypack.js)
    const paypackStatus = await paypack.checkPaymentStatus(transaction_id);
    console.log(`[PAYMENT_POLL] Txn ${transaction_id} – PayPack:`, paypackStatus);

    // 2. Find payment in DB
    const [payments] = await db.query('SELECT * FROM `payments` WHERE transaction_id = ?', [transaction_id]);
    if (payments.length === 0) {
      console.warn(`[PAYMENT_POLL] No DB record for txn: ${transaction_id}`);
      return res.status(404).json({ error: 'Payment record not found' });
    }

    const payment = payments[0];
    const now = new Date();
    const createdAt = new Date(payment.created_at);
    const diffMinutes = (now - createdAt) / (1000 * 60);

    console.log(`[PAYMENT_POLL] Txn ${transaction_id} | DB status: ${payment.status} | PayPack status: ${paypackStatus.status}`);

    // 3. Successful payment
    if ((paypackStatus.status === 'successful' || paypackStatus.status === 'completed') && payment.status === 'pending') {
      console.log(`[PAYMENT_SUCCESS] Confirmed for txn ${transaction_id}. Updating DB...`);

      await db.query(
        'UPDATE `payments` SET status = "completed", paid_at = NOW() WHERE transaction_id = ?',
        [transaction_id]
      );
      await db.query(
        'UPDATE `toilets` SET revenue = revenue + ? WHERE id = ?',
        [payment.amount, payment.toilet_id]
      );
      // Mark toilet as occupied (door will open shortly)
      await db.query('UPDATE `toilets` SET is_occupied = 1 WHERE id = ?', [payment.toilet_id]);
      // Mark payment as consumed so ESP32's payment‑check can use it
      await db.query('UPDATE `payments` SET consumed = 1 WHERE transaction_id = ?', [transaction_id]);

      await logAndBroadcast(payment.toilet_id, 'payment', `Online payment confirmed: RWF ${payment.amount} – ${transaction_id}`);
      console.log(`[PAYMENT_SUCCESS] Toilet ${payment.toilet_id} marked occupied, payment consumed`);

      return res.json({
        success: true,
        status: 'successful',
        command: 'OPEN_DOOR',
        message: 'Payment confirmed! Door is opening...',
        transaction_id,
        amount: payment.amount,
        toilet_id: payment.toilet_id
      });
    }

    // 4. Failure / Expired
    if (paypackStatus.status === 'failed' || paypackStatus.status === 'expired' || (payment.status === 'pending' && diffMinutes >= 5)) {
      const finalStatus = paypackStatus.status === 'expired' ? 'expired' : 'failed';
      console.log(`[PAYMENT_FAIL] Txn ${transaction_id} marked as ${finalStatus}`);
      await db.query('UPDATE `payments` SET status = ? WHERE transaction_id = ?', [finalStatus, transaction_id]);
      await logAndBroadcast(payment.toilet_id, 'payment_failed', `Payment failed: ${transaction_id}`);
      return res.json({ success: true, status: 'failed', message: 'Payment was cancelled or expired.' });
    }

    // 5. Already completed (e.g., from webhook or previous poll)
    if (payment.status === 'completed' || payment.status === 'Paid') {
      return res.json({
        success: true,
        status: 'successful',
        command: 'OPEN_DOOR',
        message: 'Payment already confirmed. Door is opening...',
        transaction_id,
        amount: payment.amount,
        toilet_id: payment.toilet_id
      });
    }

    // 6. Still pending
    res.json({ success: true, status: 'pending', message: 'Waiting for confirmation...' });
  } catch (error) {
    console.error('[PAYMENT_STATUS] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// WEBHOOK (instant confirmation from PayPack)
// ─────────────────────────────────────────────────────────────
exports.paypackWebhook = async (req, res) => {
  const { transaction_id, status } = req.body;
  console.log(`[WEBHOOK] Received: txn=${transaction_id}, status=${status}`);
  if (!transaction_id) return res.status(400).send('Missing transaction_id');
  const isSuccess = (status || '').toString().toLowerCase() === 'successful';
  try {
    const [payments] = await db.query('SELECT * FROM payments WHERE transaction_id = ?', [transaction_id]);
    if (payments.length === 0) return res.status(404).send('Transaction not found');
    const payment = payments[0];
    if (payment.status === 'completed') return res.status(200).send('OK');
    if (isSuccess) {
      await db.query('UPDATE payments SET status = "completed", paid_at = NOW() WHERE id = ?', [payment.id]);
      await db.query('UPDATE toilets SET revenue = revenue + ? WHERE id = ?', [payment.amount, payment.toilet_id]);
      await db.query('UPDATE payments SET consumed = 1 WHERE id = ?', [payment.id]);
      await db.query('UPDATE toilets SET is_occupied = 1 WHERE id = ?', [payment.toilet_id]);
      await logAndBroadcast(payment.toilet_id, 'payment', `Webhook confirmed: RWF ${payment.amount} – ${transaction_id}`);
    } else {
      await db.query('UPDATE payments SET status = ? WHERE id = ?', [status, payment.id]);
    }
    res.status(200).send('OK');
  } catch (error) {
    console.error('[WEBHOOK] Error:', error);
    res.status(500).send('Internal error');
  }
};

// ─────────────────────────────────────────────────────────────
// MANUAL CONFIRMATION (for stuck payments)
// ─────────────────────────────────────────────────────────────
exports.manualConfirmPayment = async (req, res) => {
  const { transaction_id } = req.body;
  if (!transaction_id) {
    return res.status(400).json({ error: 'Transaction ID is required' });
  }
  try {
    const [payments] = await db.query('SELECT * FROM `payments` WHERE transaction_id = ?', [transaction_id]);
    if (payments.length === 0) return res.status(404).json({ error: 'Payment not found' });
    const payment = payments[0];
    if (payment.status === 'completed') {
      return res.json({ success: true, message: 'Payment already confirmed', payment });
    }
    await db.query('UPDATE `payments` SET status = "completed", paid_at = NOW() WHERE id = ?', [payment.id]);
    await db.query('UPDATE `toilets` SET revenue = revenue + ? WHERE id = ?', [payment.amount, payment.toilet_id]);
    await db.query('UPDATE `toilets` SET is_occupied = 1 WHERE id = ?', [payment.toilet_id]);
    await db.query('UPDATE `payments` SET consumed = 1 WHERE id = ?', [payment.id]);
    await logAndBroadcast(payment.toilet_id, 'payment', `[MANUAL] Payment confirmed: ${transaction_id}`);
    console.log(`[MANUAL_CONFIRM] Payment ${transaction_id} manually confirmed for toilet ${payment.toilet_id}`);
    res.json({
      success: true,
      message: 'Payment manually confirmed',
      payment: { id: payment.id, transaction_id, amount: payment.amount, toilet_id: payment.toilet_id, status: 'completed' }
    });
  } catch (error) {
    console.error('[MANUAL_CONFIRM] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// LEGACY / OPTIONAL
// ─────────────────────────────────────────────────────────────
exports.momoCallback = async (req, res) => {
  console.log('Webhook received (momoCallback):', req.body);
  res.status(200).send('OK');
};

exports.getPendingPayment = async (req, res) => {
  const { toilet_id } = req.params;
  if (!toilet_id) return res.status(400).json({ error: 'Toilet ID is required' });
  try {
    const [payments] = await db.query(
      'SELECT transaction_id FROM `payments` WHERE toilet_id = ? AND status = "pending" ORDER BY created_at DESC LIMIT 1',
      [toilet_id]
    );
    if (payments.length === 0) return res.json({ message: 'No pending payments' });
    res.json({ transaction_id: payments[0].transaction_id });
  } catch (error) {
    console.error('Pending payment error:', error.message);
    res.status(500).json({ error: error.message });
  }
};