const db = require('../config/db');
const paypack = require('../services/paypack');

// ── In-memory SSE client registry ────────────────────────────────────────────
// Maps  toiletId (string) → Set of res objects (SSE connections)
const sseClients = new Map();

function addSseClient(toiletId, res) {
  if (!sseClients.has(toiletId)) sseClients.set(toiletId, new Set());
  sseClients.get(toiletId).add(res);
}

function removeSseClient(toiletId, res) {
  if (sseClients.has(toiletId)) {
    sseClients.get(toiletId).delete(res);
  }
}

function broadcastEvent(toiletId, eventData) {
  const key = String(toiletId);
  if (sseClients.has(key)) {
    const payload = `data: ${JSON.stringify(eventData)}\n\n`;
    sseClients.get(key).forEach((client) => {
      try { client.write(payload); } catch (_) { /* ignore broken pipes */ }
    });
  }
  // Also broadcast to the global "all" channel (for admin/owner dashboards)
  if (sseClients.has('all')) {
    const payload = `data: ${JSON.stringify({ ...eventData, toilet_id: toiletId })}\n\n`;
    sseClients.get('all').forEach((client) => {
      try { client.write(payload); } catch (_) {}
    });
  }
}

// ── Helper: log an event to DB and broadcast via SSE ─────────────────────────
async function logAndBroadcast(toilet_id, event_type, details) {
  const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
  try {
    await db.query(
      'INSERT INTO `sensor_events` (toilet_id, event_type, details) VALUES (?, ?, ?)',
      [toilet_id, event_type, detailsStr]
    );
  } catch (dbErr) {
    console.error('[DB] Failed to insert sensor_event:', dbErr.message);
    // Continue — we still want to broadcast events to connected dashboards even if DB is down
  }

  // Broadcast to SSE clients even if DB write failed
  broadcastEvent(toilet_id, {
    event_type,
    details: detailsStr,
    toilet_id,
    created_at: new Date().toISOString()
  });
}
exports.logAndBroadcast = logAndBroadcast;

// ─────────────────────────────────────────────────────────────────────────────
// SSE stream endpoint  GET /api/hardware/events/stream/:toilet_id
// ─────────────────────────────────────────────────────────────────────────────
exports.sseStream = (req, res) => {
  const { toilet_id } = req.params;   // pass "all" for the global feed

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send a heartbeat every 20 s so the browser doesn't time out
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (_) {}
  }, 20000);

  // Send a welcome event
  res.write(`data: ${JSON.stringify({ event_type: 'connected', toilet_id })}\n\n`);

  addSseClient(toilet_id, res);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeSseClient(toilet_id, res);
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// RFID tap  POST /api/hardware/rfid-tap
// Body: { uid, toilet_id }
// Response: { command: "OPEN_DOOR" | "DENY", message, balance }
// ─────────────────────────────────────────────────────────────────────────────
exports.rfidTap = async (req, res) => {
  const { uid, toilet_id } = req.body;

  if (!uid || !toilet_id) {
    return res.status(400).json({ command: 'DENY', message: 'Missing uid or toilet_id' });
  }

  const cleanUid = uid.trim().toUpperCase();

  try {
    // 1. Look up card
    let [cards] = await db.query(
      'SELECT * FROM `rfid_cards` WHERE UPPER(uid) = ? AND is_active = TRUE',
      [cleanUid]
    );

    // 2. Auto-register unknown cards (NEW: instead of denying)
    if (cards.length === 0) {
      console.log(`[RFID] New card detected: ${cleanUid}. Auto-registering with 0 balance...`);
      
      try {
        const [result] = await db.query(
          'INSERT INTO `rfid_cards` (uid, holder_name, balance, toilet_id, is_active) VALUES (?, ?, ?, ?, 1)',
          [cleanUid, 'New User', 0.00, toilet_id]
        );

        await logAndBroadcast(toilet_id, 'rfid_new_card', 
          `New card registered: ${cleanUid}. Owner should top up balance via dashboard.`
        );
      } catch (insertError) {
        console.error('[RFID] Error registering new card:', insertError.message);
        await logAndBroadcast(toilet_id, 'rfid_tap', 
          `Error registering card ${cleanUid}`
        );
      }

      return res.json({ 
        command: 'DENY', 
        message: 'New card registered! Please ask the owner to add balance.',
        is_new_card: true,
        card_uid: cleanUid
      });
    }

    const card = cards[0];

    // 2. Check balance
    const FARE = 200.00;
    if (parseFloat(card.balance) < FARE) {
      await logAndBroadcast(toilet_id, 'rfid_denied', `Insufficient balance for card ${cleanUid}. Balance: ${card.balance}`);
      return res.json({ command: 'DENY', message: `Insufficient balance (RWF ${card.balance}). Please top up.`, balance: card.balance });
    }

    // 3. Deduct balance
    const newBalance = parseFloat(card.balance) - FARE;
    await db.query('UPDATE `rfid_cards` SET balance = ? WHERE id = ?', [newBalance, card.id]);

    // 4. Record payment in payments table
    const txnId = 'RFID_' + Date.now() + '_' + card.id;
    await db.query(
      'INSERT INTO `payments` (toilet_id, amount, phone_number, transaction_id, status, paid_at) VALUES (?, ?, ?, ?, "Paid", NOW())',
      [toilet_id, FARE, 'RFID:' + cleanUid, txnId]
    );

    // 5. Update toilet revenue
    await db.query('UPDATE `toilets` SET revenue = revenue + ? WHERE id = ?', [FARE, toilet_id]);

    // 6. Log tap event and broadcast
    await logAndBroadcast(toilet_id, 'rfid_tap',
      `Card ${cleanUid} (${card.holder_name}) paid RWF ${FARE}. New balance: RWF ${newBalance}`
    );
    await logAndBroadcast(toilet_id, 'payment',
      `RWF ${FARE} deducted via RFID card ${cleanUid}. Transaction: ${txnId}`
    );

    return res.json({
      command: 'OPEN_DOOR',
      message: `Payment accepted! RWF ${FARE} deducted. Remaining balance: RWF ${newBalance}`,
      balance: newBalance,
      holder: card.holder_name,
      transaction_id: txnId
    });

  } catch (error) {
    console.error('[RFID_TAP] Error:', error.message);
    return res.status(500).json({ command: 'DENY', message: 'Server error. Please try again.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Log hardware event  POST /api/hardware/log-event
// Body: { toilet_id, event_type, details }
// ─────────────────────────────────────────────────────────────────────────────
exports.logEvent = async (req, res) => {
  const { toilet_id, event_type, details } = req.body;

  const validTypes = ['door_open','door_close','lid_open','lid_close','flush','sensor_update'];
  if (!toilet_id || !event_type || !validTypes.includes(event_type)) {
    return res.status(400).json({ error: 'Invalid event data' });
  }

  try {
    await logAndBroadcast(toilet_id, event_type, details || '');
    res.json({ message: 'Event logged' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Get recent events  GET /api/hardware/events/:toilet_id
// ─────────────────────────────────────────────────────────────────────────────
exports.getSensorEvents = async (req, res) => {
  const { toilet_id } = req.params;
  const limit = parseInt(req.query.limit) || 50;

  try {
    const [events] = await db.query(
      'SELECT * FROM `sensor_events` WHERE toilet_id = ? ORDER BY created_at DESC LIMIT ?',
      [toilet_id, limit]
    );
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Check for pending payments  GET /api/hardware/payment-check/:toilet_id
// ESP32 calls this to see if a payment was completed → triggers door opening
// Response: { command: "OPEN_DOOR", message } OR { command: "DENY", message }
// ─────────────────────────────────────────────────────────────────────────────
exports.checkPaymentTrigger = async (req, res) => {
  const { toilet_id } = req.params;

  if (!toilet_id) {
    return res.status(400).json({ command: 'DENY', message: 'Missing toilet_id' });
  }

  try {
    // 1. Check PayPack for any pending payments for this toilet
    const [pendingPayments] = await db.query(
      `SELECT * FROM payments 
       WHERE toilet_id = ? AND status = "pending" AND transaction_id IS NOT NULL 
       AND created_at >= NOW() - INTERVAL 10 MINUTE`,
      [toilet_id]
    );

    for (let payment of pendingPayments) {
      try {
        let statusToSet = null;
        let isSuccess = false;

        if (payment.transaction_id.startsWith('MOCK_')) {
          statusToSet = 'completed';
          isSuccess = true;
        } else {
          const paypackStatus = await paypack.checkPaymentStatus(payment.transaction_id);
          if (paypackStatus.status === 'successful' || paypackStatus.status === 'completed') {
            statusToSet = 'completed';
            isSuccess = true;
          } else if (paypackStatus.status === 'failed' || paypackStatus.status === 'expired') {
            statusToSet = paypackStatus.status === 'expired' ? 'expired' : 'failed';
          }
        }

        if (statusToSet) {
          // Update payment status ONLY if it's still pending
          const [updateResult] = await db.query(
            'UPDATE `payments` SET status = ?, paid_at = NOW() WHERE id = ? AND status = "pending"',
            [statusToSet, payment.id]
          );

          if (updateResult.affectedRows > 0) {
            if (isSuccess) {
              await db.query(
                'UPDATE `toilets` SET revenue = revenue + ? WHERE id = ?',
                [payment.amount, payment.toilet_id]
              );
              const details = `Online payment confirmed: RWF ${payment.amount} via phone ${payment.phone_number}. Transaction: ${payment.transaction_id}`;
              await logAndBroadcast(payment.toilet_id, 'payment', details);
            } else {
              const details = `❌ FAILED: Online payment of RWF ${payment.amount} for phone ${payment.phone_number}. Transaction: ${payment.transaction_id}`;
              await logAndBroadcast(payment.toilet_id, 'payment_failed', details);
            }
          }
        }
      } catch (checkErr) {
        console.error('[HARDWARE_POLL] Error checking payment:', payment.transaction_id, checkErr.message);
      }
    }

    // 2. Check for completed payments that haven't been consumed yet
    const [payments] = await db.query(
      `SELECT * FROM payments 
       WHERE toilet_id = ? AND status = "completed" AND consumed = 0 
       ORDER BY paid_at DESC LIMIT 1`,
      [toilet_id]
    );

    if (payments.length === 0) {
      return res.json({ command: 'DENY', message: 'No pending payments' });
    }

    const payment = payments[0];

    // Mark as consumed so it doesn't trigger multiple times
    await db.query('UPDATE payments SET consumed = 1 WHERE id = ?', [payment.id]);

    try {
      await logAndBroadcast(toilet_id, 'payment_trigger',
        `Payment ${payment.transaction_id} (${payment.amount} RWF) triggered door opening`
      );
    } catch (logError) {
      console.error('[PAYMENT_CHECK] Error logging event:', logError.message);
    }

    return res.json({
      command: 'OPEN_DOOR',
      message: `Payment accepted! RWF ${payment.amount} charged. Door opening...`,
      transaction_id: payment.transaction_id,
      amount: payment.amount
    });

  } catch (error) {
    console.error('[PAYMENT_CHECK] Error:', error.message);
    return res.status(500).json({ command: 'DENY', message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Sensor update  POST /api/hardware/sensor-update  (existing, enhanced)
// ─────────────────────────────────────────────────────────────────────────────
exports.updateSensors = async (req, res) => {
  const { toilet_id, soap_level, smell_level } = req.body;

  if (!toilet_id || !soap_level || !smell_level) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const [result] = await db.query(
      'UPDATE `toilets` SET soap_level = ?, smell_level = ? WHERE id = ?',
      [soap_level, smell_level, toilet_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Toilet not found' });
    }

    const details = `soap=${soap_level}, smell=${smell_level}`;
    await logAndBroadcast(toilet_id, 'sensor_update', details);

    if (smell_level === 'High') {
      console.warn(`[ALERT] High smell at toilet ${toilet_id}`);
    }
    if (soap_level === 'Low') {
      console.warn(`[ALERT] Low soap at toilet ${toilet_id}`);
    }

    res.json({ message: 'Sensor data updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Set Occupancy  POST /api/hardware/occupancy/:toilet_id
// ESP32 calls this to mark the toilet as in-use or available
// ─────────────────────────────────────────────────────────────────────────────
exports.setOccupancy = async (req, res) => {
  const { toilet_id } = req.params;
  const { is_occupied } = req.body;

  if (!toilet_id || is_occupied === undefined) {
    return res.status(400).json({ error: 'Missing toilet_id or is_occupied flag' });
  }

  try {
    const isOccupiedBool = is_occupied === true || is_occupied === 'true' || is_occupied === 1;
    
    await db.query(
      'UPDATE `toilets` SET is_occupied = ? WHERE id = ?',
      [isOccupiedBool ? 1 : 0, toilet_id]
    );

    const details = isOccupiedBool ? 'Toilet is now IN USE' : 'Toilet is now AVAILABLE';
    await logAndBroadcast(toilet_id, 'sensor_update', details);

    return res.json({ success: true, is_occupied: isOccupiedBool });
  } catch (error) {
    console.error('[OCCUPANCY] Error:', error.message);
    return res.status(500).json({ error: 'Server error' });
  }
};
