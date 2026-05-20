const db = require('../config/db');
const bcrypt = require('bcryptjs');

// Owner manages Toilets and Cleaners
exports.getDashboardStats = async (req, res) => {
  try {
    const ownerId = req.user.id;
    
    // Get total revenue from completed payments only (not demo data)
    const [revenueResult] = await db.query(
      'SELECT SUM(p.amount) as totalRevenue FROM `payments` p JOIN `toilets` t ON p.toilet_id = t.id WHERE t.owner_id = ? AND p.status IN ("completed", "Paid") AND (p.transaction_id IS NULL OR p.transaction_id NOT LIKE "MOCK_%")',
      [ownerId]
    );
    
    // Get all toilets
    const [toilets] = await db.query('SELECT * FROM `toilets` WHERE owner_id = ?', [ownerId]);

    // Get cleaner count
    const [cleanerCount] = await db.query('SELECT COUNT(*) as count FROM `cleaners` WHERE owner_id = ?', [ownerId]);
    
    res.json({
      totalRevenue: revenueResult[0].totalRevenue || 0,
      toiletCount: toilets.length,
      cleanerCount: cleanerCount[0].count,
      toilets
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getCleaners = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const [cleaners] = await db.query('SELECT id, name, email FROM `cleaners` WHERE owner_id = ?', [ownerId]);
    res.json(cleaners);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createCleaner = async (req, res) => {
  const { name, email, password } = req.body;
  const ownerId = req.user.id;

  try {
    const [existing] = await db.query('SELECT email FROM `cleaners` WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(400).json({ error: 'Email already in use' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [result] = await db.query(
      'INSERT INTO `cleaners` (name, email, password, owner_id, secret_word) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, ownerId, req.body.secret_word || 'SmartLoo']
    );

    res.status(201).json({ message: 'Cleaner created successfully', id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteCleaner = async (req, res) => {
  const cleanerId = req.params.id;
  const ownerId = req.user.id;

  try {
    const [result] = await db.query('DELETE FROM `cleaners` WHERE id = ? AND owner_id = ?', [cleanerId, ownerId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Cleaner not found or unauthorized' });
    res.json({ message: 'Cleaner deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addToilet = async (req, res) => {
  const ownerId = req.user.id;
  const { location, cleaner_id } = req.body;
  if (!location) return res.status(400).json({ error: 'Location is required' });

  try {
    const [result] = await db.query(
      'INSERT INTO `toilets` (owner_id, location, status, cleaner_id) VALUES (?, ?, "operational", ?)',
      [ownerId, location, cleaner_id || null]
    );
    res.status(201).json({ message: 'Toilet added successfully', id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getComplaints = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const [complaints] = await db.query(
      `SELECT c.id, c.toilet_id, c.description, c.status, c.type, c.created_at, t.location 
       FROM \`complaints\` c 
       JOIN \`toilets\` t ON c.toilet_id = t.id 
       WHERE t.owner_id = ? 
       ORDER BY c.created_at DESC`,
      [ownerId]
    );

    // Mark as read
    if (complaints.length > 0) {
      await db.query(
        'UPDATE `complaints` c JOIN `toilets` t ON c.toilet_id = t.id SET c.is_read = TRUE WHERE t.owner_id = ?',
        [ownerId]
      );
    }

    res.json(complaints);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.resolveComplaint = async (req, res) => {
  const { id } = req.params;
  const ownerId = req.user.id;
  try {
    const [complaints] = await db.query(
      `SELECT c.id FROM \`complaints\` c 
       JOIN \`toilets\` t ON c.toilet_id = t.id 
       WHERE c.id = ? AND t.owner_id = ?`,
      [id, ownerId]
    );
    if (complaints.length === 0) return res.status(404).json({ error: 'Complaint not found or unauthorized' });

    await db.query('UPDATE `complaints` SET status = "resolved" WHERE id = ?', [id]);
    res.json({ message: 'Complaint resolved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAdmins = async (req, res) => {
  try {
    const ownerId = req.user.id;
    // Find the admin that created this owner
    const [ownerData] = await db.query('SELECT admin_id FROM `owners` WHERE id = ?', [ownerId]);
    if (ownerData.length === 0) return res.json([]);
    
    const adminId = ownerData[0].admin_id;
    const [admins] = await db.query('SELECT id, name, email FROM `admins` WHERE id = ?', [adminId]);
    res.json(admins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTransactions = async (req, res) => {
  const ownerId = req.user.id;
  try {
    const [transactions] = await db.query(
      `SELECT p.id, p.amount, p.phone_number, p.transaction_id, p.status, p.created_at, t.location 
       FROM \`payments\` p 
       JOIN \`toilets\` t ON p.toilet_id = t.id 
       WHERE t.owner_id = ? AND (p.transaction_id IS NULL OR p.transaction_id NOT LIKE 'MOCK_%')
       ORDER BY p.created_at DESC`,
      [ownerId]
    );
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.downloadTransactions = async (req, res) => {
  const ownerId = req.user.id;
  try {
    const [transactions] = await db.query(
      `SELECT p.id, p.amount, p.phone_number, p.transaction_id, p.status, p.created_at, t.location as toilet_location
       FROM \`payments\` p
       JOIN \`toilets\` t ON p.toilet_id = t.id
       WHERE t.owner_id = ?
       ORDER BY p.created_at DESC`,
      [ownerId]
    );

    // Determine payment method based on transaction_id format
    const transactionsWithMethod = transactions.map(t => ({
      ...t,
      payment_method: t.transaction_id.startsWith('MOCK_') ? 'QR Code' : 'USSD'
    }));

    res.json({ transactions: transactionsWithMethod });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getBroadcasts = async (req, res) => {
  try {
    const [broadcasts] = await db.query(`
      SELECT b.*, 
             CASE WHEN b.sender_role = 'Admin' THEN a.name ELSE o.name END as sender_name
      FROM \`broadcasts\` b
      LEFT JOIN \`admins\` a ON b.sender_id = a.id AND b.sender_role = 'Admin'
      LEFT JOIN \`owners\` o ON b.sender_id = o.id AND b.sender_role = 'Owner'
      WHERE b.sender_role = 'Admin' OR b.sender_id = ?
      ORDER BY b.created_at DESC
      LIMIT 10`, [req.user.id]);
    res.json(broadcasts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.sendBroadcast = async (req, res) => {
  const { message } = req.body;
  const ownerId = req.user.id;
  try {
    const [result] = await db.query(
      'INSERT INTO `broadcasts` (sender_id, sender_role, message) VALUES (?, "Owner", ?)',
      [ownerId, message]
    );
    res.status(201).json({ message: 'Broadcast sent successfully', id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateCleaner = async (req, res) => {
  const { name, email, phone_number } = req.body;
  const cleanerId = req.params.id;
  const ownerId = req.user.id;

  try {
    const [result] = await db.query(
      'UPDATE `cleaners` SET name = ?, email = ?, phone_number = ? WHERE id = ? AND owner_id = ?',
      [name, email, phone_number, cleanerId, ownerId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Cleaner not found or unauthorized' });
    res.json({ message: 'Cleaner updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
