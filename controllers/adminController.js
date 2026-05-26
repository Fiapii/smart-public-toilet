const db = require('../config/db');
const bcrypt = require('bcryptjs');

// Admin manages Owners
exports.getAllOwners = async (req, res) => {
  try {
    const [owners] = await db.query('SELECT id, name, email, created_at FROM `owners`');
    res.json(owners);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createOwner = async (req, res) => {
  const { name, email, password } = req.body;
  const adminId = req.user.id;

  try {
    const [existing] = await db.query('SELECT email FROM `owners` WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(400).json({ error: 'Email already in use' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [result] = await db.query(
      'INSERT INTO `owners` (name, email, password, admin_id, secret_word) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, adminId, req.body.secret_word || 'SmartLoo']
    );

    res.status(201).json({ message: 'Owner created successfully', id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getOwnerById = async (req, res) => {
  try {
    const [owners] = await db.query('SELECT id, name, email, created_at FROM `owners` WHERE id = ?', [req.params.id]);
    if (owners.length === 0) return res.status(404).json({ error: 'Owner not found' });
    res.json(owners[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateOwner = async (req, res) => {
  const { name, email, password } = req.body;
  const ownerId = req.params.id;

  try {
    let query = 'UPDATE `owners` SET name = ?, email = ?';
    let params = [name, email];

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(ownerId);

    const [result] = await db.query(query, params);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Owner not found' });
    res.json({ message: 'Owner updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteOwner = async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM `owners` WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Owner not found' });
    res.json({ message: 'Owner deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// MODIFIED: added adminInterest (5% commission)
exports.getAdminDashboard = async (req, res) => {
  try {
    // Total system revenue from completed payments only
    const [revResult] = await db.query('SELECT SUM(p.amount) as total FROM `payments` p WHERE p.status IN ("completed", "Paid") AND (p.transaction_id IS NULL OR p.transaction_id NOT LIKE "MOCK_%")');
    const totalRevenue = revResult[0].total || 0;

    // Total toilets
    const [toiletCount] = await db.query('SELECT COUNT(*) as count FROM `toilets`');

    // Total cleaners
    const [cleanerCount] = await db.query('SELECT COUNT(*) as count FROM `cleaners`');

    // Total owners
    const [ownerCount] = await db.query('SELECT COUNT(*) as count FROM `owners`');

    // Admin commission: 5% of total revenue
    const adminInterest = totalRevenue * 0.05;

    const [owners] = await db.query(`
      SELECT o.id, o.name, o.email,
             COUNT(t.id) as totalToilets,
             COALESCE(SUM(p.amount), 0) as ownerRevenue,
             COUNT(DISTINCT c.id) as cleanerCount
      FROM \`owners\` o
      LEFT JOIN \`toilets\` t ON o.id = t.owner_id
      LEFT JOIN \`payments\` p ON t.id = p.toilet_id AND p.status IN ("completed", "Paid") AND (p.transaction_id IS NULL OR p.transaction_id NOT LIKE 'MOCK_%')
      LEFT JOIN \`cleaners\` c ON o.id = c.owner_id
      GROUP BY o.id
    `);

    res.json({
      totalRevenue,
      totalToilets: toiletCount[0].count,
      totalCleaners: cleanerCount[0].count,
      totalOwners: ownerCount[0].count,
      adminInterest,   // ← 5% commission
      owners
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.sendBroadcast = async (req, res) => {
  const { message } = req.body;
  const adminId = req.user.id;

  try {
    const [result] = await db.query(
      'INSERT INTO `broadcasts` (sender_id, sender_role, message) VALUES (?, "Admin", ?)',
      [adminId, message]
    );

    res.status(201).json({ message: 'Broadcast sent successfully', id: result.insertId });
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
      ORDER BY b.created_at DESC
    `);
    res.json(broadcasts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSystemRevenueFiltered = async (req, res) => {
  const { period, from, to } = req.query;
  // same date logic as above (copy from owner version)
  try {
    const [rows] = await db.query(
      `SELECT DATE(paid_at) as date, SUM(amount) as total, COUNT(*) as count
       FROM payments
       WHERE status IN ('completed', 'Paid')
         AND paid_at BETWEEN ? AND ?
       GROUP BY DATE(paid_at)
       ORDER BY date ASC`,
      [startDate, endDate]
    );
    const total = rows.reduce((sum, r) => sum + parseFloat(r.total), 0);
    res.json({ period, startDate, endDate, data: rows, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};