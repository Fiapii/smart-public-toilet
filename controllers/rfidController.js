const db = require('../config/db');

// GET /api/rfid/cards  — List all cards for toilets owned by logged-in owner
exports.listCards = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const role    = req.user.role;

    let query, params;
    if (role === 'Admin') {
      query = `
        SELECT rc.*, t.location AS toilet_location
        FROM rfid_cards rc
        LEFT JOIN toilets t ON t.id = rc.toilet_id
        ORDER BY rc.created_at DESC`;
      params = [];
    } else {
      // Owner: only their toilets
      query = `
        SELECT rc.*, t.location AS toilet_location
        FROM rfid_cards rc
        JOIN toilets t ON t.id = rc.toilet_id
        WHERE t.owner_id = ?
        ORDER BY rc.created_at DESC`;
      params = [ownerId];
    }

    const [cards] = await db.query(query, params);
    res.json(cards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/rfid/cards  — Register a new card
// Body: { uid, holder_name, balance, toilet_id }
exports.registerCard = async (req, res) => {
  const { uid, holder_name, balance, toilet_id } = req.body;

  if (!uid) return res.status(400).json({ error: 'UID is required' });

  const cleanUid  = uid.trim().toUpperCase();
  const initBal   = parseFloat(balance) || 5000.00;
  const holderName = holder_name || 'User';

  try {
    // Check ownership if owner role
    if (req.user.role === 'Owner' && toilet_id) {
      const [toilets] = await db.query(
        'SELECT id FROM toilets WHERE id = ? AND owner_id = ?',
        [toilet_id, req.user.id]
      );
      if (toilets.length === 0) {
        return res.status(403).json({ error: 'You do not own that toilet' });
      }
    }

    const [result] = await db.query(
      'INSERT INTO rfid_cards (uid, holder_name, balance, toilet_id) VALUES (?, ?, ?, ?)',
      [cleanUid, holderName, initBal, toilet_id || null]
    );

    res.json({
      message: 'Card registered successfully',
      card_id: result.insertId,
      uid: cleanUid,
      holder_name: holderName,
      balance: initBal
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A card with that UID already exists' });
    }
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/rfid/cards/:id  — Top up / update card
// Body: { add_amount?, balance?, holder_name?, is_active? }
exports.updateCard = async (req, res) => {
  const { id } = req.params;
  const { add_amount, balance, holder_name, is_active } = req.body;

  try {
    const [cards] = await db.query('SELECT * FROM rfid_cards WHERE id = ?', [id]);
    if (cards.length === 0) return res.status(404).json({ error: 'Card not found' });

    const card = cards[0];
    let newBalance = parseFloat(card.balance);

    if (add_amount !== undefined) {
      newBalance += parseFloat(add_amount);
    } else if (balance !== undefined) {
      newBalance = parseFloat(balance);
    }

    const newName      = holder_name   !== undefined ? holder_name   : card.holder_name;
    const newIsActive  = is_active     !== undefined ? is_active     : card.is_active;

    await db.query(
      'UPDATE rfid_cards SET balance = ?, holder_name = ?, is_active = ? WHERE id = ?',
      [newBalance, newName, newIsActive ? 1 : 0, id]
    );

    res.json({ message: 'Card updated', balance: newBalance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/rfid/cards/:id
exports.deleteCard = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM rfid_cards WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Card not found' });
    res.json({ message: 'Card deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
