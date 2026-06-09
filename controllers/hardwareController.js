const db = require('../config/db');
const paypack = require('../services/paypack');

// ─────────────────────────────────────────────────────────────
// SSE client registry and broadcast helpers
// ─────────────────────────────────────────────────────────────
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
    sseClients.get(key).forEach(client => {
      try { client.write(payload); } catch (_) {}
    });
  }
  if (sseClients.has('all')) {
    const payload = `data: ${JSON.stringify({ ...eventData, toilet_id: toiletId })}\n\n`;
    sseClients.get('all').forEach(client => {
      try { client.write(payload); } catch (_) {}
    });
  }
}

async function logAndBroadcast(toilet_id, event_type, details) {
  const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
  try {
    await db.query(
      'INSERT INTO `sensor_events` (toilet_id, event_type, details) VALUES (?, ?, ?)',
      [toilet_id, event_type, detailsStr]
    );
  } catch (dbErr) {
    console.error('[DB] Failed to insert sensor_event:', dbErr.message);
  }
  broadcastEvent(toilet_id, {
    event_type,
    details: detailsStr,
    toilet_id,
    created_at: new Date().toISOString()
  });
}
exports.logAndBroadcast = logAndBroadcast;

// ─────────────────────────────────────────────────────────────
// SSE stream endpoint
// ─────────────────────────────────────────────────────────────
exports.sseStream = (req, res) => {
  const { toilet_id } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (_) {}
  }, 20000);

  res.write(`data: ${JSON.stringify({ event_type: 'connected', toilet_id })}\n\n`);
  addSseClient(toilet_id, res);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeSseClient(toilet_id, res);
  });
};

// ─────────────────────────────────────────────────────────────
// RFID tap – robust UID matching + auto‑register (universal card)
// ─────────────────────────────────────────────────────────────
exports.rfidTap = async (req, res) => {
  let { uid, toilet_id } = req.body;
  if (!uid || !toilet_id) {
    return res.status(400).json({ command: 'DENY', message: 'Missing uid or toilet_id' });
  }

  let cleanUid = uid.trim().toUpperCase().replace(/\s/g, '');
  if (!cleanUid.includes(':')) {
    let parts = [];
    for (let i = 0; i < cleanUid.length; i += 2) {
      parts.push(cleanUid.substr(i, 2));
    }
    cleanUid = parts.join(':');
  }

  console.log(`[RFID_TAP] Incoming UID: ${uid} → normalized: ${cleanUid}, toilet: ${toilet_id}`);

  try {
    let [cards] = await db.query(
      `SELECT * FROM rfid_cards 
       WHERE REPLACE(UPPER(uid), ' ', '') IN (?, REPLACE(?, ':', ''))
       AND is_active = TRUE`,
      [cleanUid, cleanUid.replace(/:/g, '')]
    );

    if (cards.length === 0) {
      console.log(`[RFID] New card: ${cleanUid}, registering as universal card (works on all toilets)`);
      await db.query(
        'INSERT INTO rfid_cards (uid, holder_name, balance, toilet_id, is_active) VALUES (?, ?, ?, NULL, 1)',
        [cleanUid, 'New User', 0]
      );
      await logAndBroadcast(toilet_id, 'rfid_new_card', `New card registered: ${cleanUid}`);
      return res.json({
        command: 'DENY',
        message: 'New card registered. Please ask owner to add balance.',
        is_new_card: true
      });
    }

    const card = cards[0];
    const FARE = 200.00;

    if (parseFloat(card.balance) < FARE) {
      await logAndBroadcast(toilet_id, 'rfid_denied', `Insufficient balance for ${cleanUid}: ${card.balance}`);
      return res.json({
        command: 'DENY',
        message: `Insufficient balance (RWF ${card.balance}). Please top up.`,
        balance: card.balance
      });
    }

    const newBalance = parseFloat(card.balance) - FARE;
    await db.query('UPDATE rfid_cards SET balance = ? WHERE id = ?', [newBalance, card.id]);

    const txnId = `RFID_${Date.now()}_${card.id}`;
   await db.query(
  `INSERT INTO payments (toilet_id, amount, phone_number, transaction_id, status, paid_at, consumed)
   VALUES (?, ?, ?, ?, 'Paid', NOW(), 1)`,   // ← consumed = 1
  [toilet_id, FARE, `RFID:${cleanUid}`, txnId]
);

    await db.query('UPDATE toilets SET revenue = revenue + ? WHERE id = ?', [FARE, toilet_id]);

    await logAndBroadcast(toilet_id, 'rfid_tap', `Card ${cleanUid} (${card.holder_name}) paid RWF ${FARE}. New balance: ${newBalance}`);
    await logAndBroadcast(toilet_id, 'payment', `RWF ${FARE} deducted via RFID ${cleanUid}. Transaction: ${txnId}`);

    return res.json({
      command: 'OPEN_DOOR',
      message: `Payment accepted! RWF ${FARE} deducted. Remaining: RWF ${newBalance}`,
      balance: newBalance,
      holder: card.holder_name,
      transaction_id: txnId
    });
  } catch (error) {
    console.error('[RFID_TAP] Error:', error);
    return res.status(500).json({ command: 'DENY', message: 'Server error. Please try again.' });
  }
};

// ─────────────────────────────────────────────────────────────
// Log hardware event (door, lid, flush)
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// Get recent sensor events
// ─────────────────────────────────────────────────────────────
exports.getSensorEvents = async (req, res) => {
  const { toilet_id } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  try {
    const [events] = await db.query(
      'SELECT * FROM sensor_events WHERE toilet_id = ? ORDER BY created_at DESC LIMIT ?',
      [toilet_id, limit]
    );
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// Check for completed online payments (ESP32 polls) – FIXED
// ─────────────────────────────────────────────────────────────
exports.checkPaymentTrigger = async (req, res) => {
  const { toilet_id } = req.params;
  if (!toilet_id) {
    return res.status(400).json({ command: 'DENY', message: 'Missing toilet_id' });
  }

  try {
    // 1. Delete stale pending payments older than 10 minutes (prevent re‑confirmation)
    await db.query(
      `DELETE FROM payments 
       WHERE toilet_id = ? AND status = 'pending' 
       AND created_at < NOW() - INTERVAL 10 MINUTE`,
      [toilet_id]
    );

    // 2. Update any recent pending payments by checking PayPack
    const [pending] = await db.query(
      `SELECT * FROM payments 
       WHERE toilet_id = ? AND status = 'pending' AND transaction_id IS NOT NULL
       AND created_at >= NOW() - INTERVAL 10 MINUTE`,
      [toilet_id]
    );

    for (const payment of pending) {
      try {
        let newStatus = null;
        let success = false;
        if (payment.transaction_id.startsWith('MOCK_')) {
          newStatus = 'completed';
          success = true;
        } else {
          const ppStatus = await paypack.checkPaymentStatus(payment.transaction_id);
          if (ppStatus.status === 'successful') {
            newStatus = 'completed';
            success = true;
          } else if (ppStatus.status === 'failed' || ppStatus.status === 'expired') {
            newStatus = ppStatus.status;
          }
        }
        if (newStatus) {
          await db.query(
            'UPDATE payments SET status = ?, paid_at = NOW() WHERE id = ? AND status = "pending"',
            [newStatus, payment.id]
          );
          if (success) {
            // Immediately consume and open door (only if payment is recent)
            await db.query('UPDATE payments SET consumed = 1 WHERE id = ?', [payment.id]);
            await db.query('UPDATE toilets SET revenue = revenue + ? WHERE id = ?', [payment.amount, payment.toilet_id]);
            await db.query('UPDATE toilets SET is_occupied = 1 WHERE id = ?', [toilet_id]);
            await logAndBroadcast(payment.toilet_id, 'payment', `Online payment confirmed: RWF ${payment.amount} – ${payment.transaction_id}`);
            await logAndBroadcast(payment.toilet_id, 'payment_trigger', `Payment ${payment.transaction_id} (${payment.amount} RWF) triggered door opening`);
            console.log(`[DOOR_TRIGGER] Pending payment ${payment.transaction_id} confirmed – opening door`);
            return res.json({
              command: 'OPEN_DOOR',
              message: `Payment accepted! RWF ${payment.amount} charged. Door opening...`,
              transaction_id: payment.transaction_id,
              amount: payment.amount
            });
          } else {
            await logAndBroadcast(payment.toilet_id, 'payment_failed', `Online payment failed: ${payment.transaction_id}`);
          }
        }
      } catch (err) {
        console.error('[PAYMENT_POLL] Error checking', payment.transaction_id, err.message);
      }
    }

    // 3. Look for completed or Paid payments that are not yet consumed AND were created recently (last 5 minutes)
    const [completed] = await db.query(
      `SELECT * FROM payments 
       WHERE toilet_id = ? AND status IN ('completed', 'Paid') 
       AND (consumed IS NULL OR consumed = 0)
       AND paid_at >= NOW() - INTERVAL 5 MINUTE
       ORDER BY paid_at DESC LIMIT 1`,
      [toilet_id]
    );

    if (completed.length === 0) {
      return res.json({ command: 'DENY', message: 'No pending payment' });
    }

    const payment = completed[0];
    await db.query('UPDATE payments SET consumed = 1 WHERE id = ?', [payment.id]);
    await db.query('UPDATE toilets SET is_occupied = 1 WHERE id = ?', [toilet_id]);
    await logAndBroadcast(toilet_id, 'payment_trigger', `Payment ${payment.transaction_id} (${payment.amount} RWF) triggered door opening`);
    console.log(`[DOOR_TRIGGER] Completed payment ${payment.transaction_id} – opening door`);

    return res.json({
      command: 'OPEN_DOOR',
      message: `Payment accepted! RWF ${payment.amount} charged. Door opening...`,
      transaction_id: payment.transaction_id,
      amount: payment.amount
    });
  } catch (error) {
    console.error('[PAYMENT_CHECK] Error:', error);
    return res.status(500).json({ command: 'DENY', message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// Sensor data update (soap, smell) + automatic alert on bad smell
// ─────────────────────────────────────────────────────────────
exports.updateSensors = async (req, res) => {
  const { toilet_id, soap_level, smell_level } = req.body;
  if (!toilet_id || !soap_level || !smell_level) {
    return res.status(400).json({ error: 'Missing parameters' });
  }
  try {
    const [result] = await db.query(
      'UPDATE toilets SET soap_level = ?, smell_level = ? WHERE id = ?',
      [soap_level, smell_level, toilet_id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Toilet not found' });

    await logAndBroadcast(toilet_id, 'sensor_update', `soap=${soap_level}, smell=${smell_level}`);

    if (smell_level === 'High') {
      const [existing] = await db.query(
        `SELECT id FROM complaints 
         WHERE toilet_id = ? AND type = 'Sensor' AND status = 'open' 
         AND created_at > NOW() - INTERVAL 10 MINUTE`,
        [toilet_id]
      );
      if (existing.length === 0) {
        await db.query(
          `INSERT INTO complaints (toilet_id, description, type, status, created_at)
           VALUES (?, ?, 'Sensor', 'open', NOW())`,
          [toilet_id, 'Unpleasant smell detected. Please check ventilation or cleaning.']
        );
        console.log(`[ALERT] Sensor complaint created for toilet ${toilet_id} (bad smell)`);
        broadcastEvent(toilet_id, {
          event_type: 'alert',
          details: 'Bad smell detected',
          level: 'High'
        });
      } else {
        console.log(`[ALERT] Smell still High, but complaint already open (toilet ${toilet_id})`);
      }
    }

    res.json({ message: 'Sensor data updated' });
  } catch (error) {
    console.error('[UPDATE_SENSORS] Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// Set occupancy (ESP32 calls when person enters/exits)
// ─────────────────────────────────────────────────────────────
exports.setOccupancy = async (req, res) => {
  const { toilet_id } = req.params;
  let { is_occupied } = req.body;
  if (!toilet_id || is_occupied === undefined) {
    return res.status(400).json({ error: 'Missing toilet_id or is_occupied' });
  }
  const occupiedBool = (is_occupied === true || is_occupied === 'true' || is_occupied === 1);
  try {
    await db.query('UPDATE toilets SET is_occupied = ? WHERE id = ?', [occupiedBool ? 1 : 0, toilet_id]);
    await logAndBroadcast(toilet_id, 'sensor_update', occupiedBool ? 'Toilet IN USE' : 'Toilet AVAILABLE');
    res.json({ success: true, is_occupied: occupiedBool });
  } catch (error) {
    console.error('[OCCUPANCY] Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};