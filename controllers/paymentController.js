const db = require('../config/db');
const paypack = require('../services/paypack');
const { logAndBroadcast } = require('./hardwareController');

// Create a new payment using PayPack
exports.createPayment = async (req, res) => {
  let { toilet_id, amount, phone_number } = req.body;

  if (!toilet_id || !amount || !phone_number) {
    return res.status(400).json({ error: 'Missing required parameters: toilet_id, amount, phone_number' });
  }

  // Sanitize phone number for PayPack
  phone_number = phone_number.replace(/\s+/g, '').replace(/\+/g, ''); // Remove spaces and plus
  
  // Ensure it's a valid Rwandan number format
  if (phone_number.startsWith('250')) {
    // Keep as is, many PayPack integrations prefer 250...
  } else if (phone_number.startsWith('07')) {
    phone_number = '250' + phone_number.slice(1);
  } else if (phone_number.length === 9 && phone_number.startsWith('7')) {
    phone_number = '250' + phone_number;
  }

  try {
    // 0. Check if toilet is occupied
    const [toilets] = await db.query('SELECT is_occupied FROM `toilets` WHERE id = ?', [toilet_id]);
    if (toilets.length === 0) {
      return res.status(404).json({ error: 'Toilet not found' });
    }
    if (toilets[0].is_occupied) {
      return res.status(400).json({ success: false, error: 'Toilet is currently in use. Please wait.' });
    }

    // 1. Create a pending record in our database
    const [result] = await db.query(
      'INSERT INTO `payments` (toilet_id, amount, phone_number, status) VALUES (?, ?, ?, "pending")',
      [toilet_id, amount, phone_number]
    );
    const paymentId = result.insertId;

    // 2. Initiate payment via PayPack
    try {
      console.log('Initiating PayPack payment:', { phone_number, amount });
      const paypackRes = await paypack.initiateCashin(phone_number, amount);
      console.log('PayPack response:', paypackRes);
      const transactionId = paypackRes.ref;

      // 3. Update record with transaction ID from PayPack
      await db.query(
        'UPDATE `payments` SET transaction_id = ? WHERE id = ?',
        [transactionId, paymentId]
      );

      res.json({
        success: true,
        message: 'Payment initiated. Please check your phone to confirm.',
        transaction_id: transactionId,
        payment_id: paymentId,
        amount
      });
    } catch (paypackError) {
      console.error('PayPack initiation failed:', paypackError.message);
      const errorDetail = paypackError.response?.data || paypackError.message;
      console.error('PayPack error details:', errorDetail);

      // Check if mock mode is explicitly enabled in .env
      if (process.env.MOCK_PAYMENT === 'true') {
        console.log('Using mock payment for testing (MOCK_PAYMENT=true)...');
        const mockTransactionId = 'MOCK_' + Date.now();

        await db.query(
          'UPDATE `payments` SET transaction_id = ?, status = "completed", paid_at = NOW() WHERE id = ?',
          [mockTransactionId, paymentId]
        );

        // Update toilet revenue
        await db.query(
          'UPDATE `toilets` SET revenue = revenue + ? WHERE id = ?',
          [amount, toilet_id]
        );

        // Log payment event
        try {
          const details = `Mock payment confirmed: RWF ${amount} via phone ${phone_number}. Transaction: ${mockTransactionId}`;
          await logAndBroadcast(toilet_id, 'payment', details);
        } catch (logErr) {
          console.error('[PAYMENT_LOG_ERROR]', logErr.message);
        }

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

      // Otherwise, return the actual error
      res.status(500).json({ 
        success: false, 
        error: 'PayPack initiation failed', 
        details: typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : errorDetail 
      });
    }
  } catch (error) {
    console.error('Database error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Check payment status from PayPack and update DB
exports.checkPaymentStatus = async (req, res) => {
  const { transaction_id } = req.params;

  if (!transaction_id) {
    return res.status(400).json({ error: 'Transaction ID is required' });
  }

  try {
    // 1. Check status with PayPack
    const paypackStatus = await paypack.checkPaymentStatus(transaction_id);
    
    // 2. Find payment in our DB
    const [payments] = await db.query('SELECT * FROM `payments` WHERE transaction_id = ?', [transaction_id]);
    
    if (payments.length === 0) {
      console.warn(`[PAYMENT_POLL] No DB record found for txn: ${transaction_id}`);
      return res.status(404).json({ error: 'Payment record not found' });
    }

    const payment = payments[0];
    const now = new Date();
    const createdAt = new Date(payment.created_at);
    const diffMinutes = (now - createdAt) / (1000 * 60);

    console.log(`[PAYMENT_POLL] Txn: ${transaction_id} | DB Status: ${payment.status} | PayPack Response Status: ${paypackStatus.status}`);

    // 3. Handle Success
    if ((paypackStatus.status === 'successful' || paypackStatus.status === 'completed') && payment.status === 'pending') {
      console.log(`[PAYMENT_SUCCESS] REAL CONFIRMATION for txn: ${transaction_id}. Door opening...`);
      
      await db.query(
        'UPDATE `payments` SET status = "completed", paid_at = NOW() WHERE transaction_id = ?',
        [transaction_id]
      );

      await db.query(
        'UPDATE `toilets` SET revenue = revenue + ?, is_occupied = 1 WHERE id = ?',
        [payment.amount, payment.toilet_id]
      );

      // Log payment event to sensor_events for dashboard
      try {
        const details = `Online payment confirmed: RWF ${payment.amount} via phone ${payment.phone_number}. Transaction: ${transaction_id}`;
        await logAndBroadcast(payment.toilet_id, 'payment', details);
      } catch (logErr) {
        console.error('[PAYMENT_LOG_ERROR]', logErr.message);
      }

      console.log(`[PAYMENT_SUCCESS] Toilet ${payment.toilet_id} marked as occupied for transaction ${transaction_id}`);

      return res.json({
        success: true,
        status: 'successful',
        command: "OPEN_DOOR",
        message: 'Payment confirmed! Door is opening...',
        transaction_id: transaction_id,
        amount: payment.amount,
        toilet_id: payment.toilet_id
      });
    }

    // 4. Handle Failure / Cancellation
    if (paypackStatus.status === 'failed' || paypackStatus.status === 'expired' || (payment.status === 'pending' && diffMinutes >= 5)) {
      const finalStatus = paypackStatus.status === 'expired' ? 'expired' : 'failed';
      console.log(`[PAYMENT_FAIL] Txn ${transaction_id} marked as ${finalStatus}.`);
      
      await db.query(
        'UPDATE `payments` SET status = ? WHERE transaction_id = ?',
        [finalStatus, transaction_id]
      );
      
      try {
        const details = `❌ FAILED: Online payment of RWF ${payment.amount} for phone ${payment.phone_number}. Transaction: ${transaction_id}`;
        await logAndBroadcast(payment.toilet_id, 'payment_failed', details);
      } catch (logErr) {
        console.error('[PAYMENT_LOG_ERROR]', logErr.message);
      }

      return res.json({
        success: true,
        status: 'failed',
        message: paypackStatus.status === 'failed' ? 'Payment was cancelled or failed.' : 'Payment session expired.'
      });
    }

    // 5. Handle Already Paid
    if (payment.status === 'completed' || payment.status === 'Paid') {
      return res.json({
        success: true,
        status: 'successful',
        command: 'OPEN_DOOR',
        message: 'Payment already confirmed. Door is opening...',
        transaction_id: transaction_id,
        amount: payment.amount,
        toilet_id: payment.toilet_id
      });
    }

    // 6. Still Pending
    res.json({
      success: true,
      status: 'pending',
      message: 'Waiting for your confirmation on phone...',
      transaction_id: transaction_id
    });

  } catch (error) {
    console.error('Status check error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Handle momo-callback webhooks (optional, if PayPack is configured for webhooks)
exports.momoCallback = async (req, res) => {
  // PayPack webhooks have a specific structure, we could implement it here if needed
  // For now, we rely on polling (checkPaymentStatus) as it's more reliable for instant feedback
  console.log('Webhook received:', req.body);
  res.status(200).send('OK');
};

// Get pending payment for ESP32 door control
exports.getPendingPayment = async (req, res) => {
  const { toilet_id } = req.params;

  if (!toilet_id) {
    return res.status(400).json({ error: 'Toilet ID is required' });
  }

  try {
    const [payments] = await db.query(
      'SELECT transaction_id FROM `payments` WHERE toilet_id = ? AND status = "pending" ORDER BY created_at DESC LIMIT 1',
      [toilet_id]
    );

    if (payments.length === 0) {
      return res.json({ message: 'No pending payments' });
    }

    res.json({
      transaction_id: payments[0].transaction_id
    });
  } catch (error) {
    console.error('Pending payment error:', error.message);
    res.status(500).json({ error: error.message });
  }
};
