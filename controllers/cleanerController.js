const db = require('../config/db');

exports.getAlerts = async (req, res) => {
  try {
    const cleanerId = req.user.id;
    // Find toilets assigned to this cleaner (Assuming we link cleaners to toilets somehow, or just show all for simplicity as before)
    // For now, keep showing toilets with alerts
    const [alerts] = await db.query(
      'SELECT id, location, status, soap_level, smell_level FROM `toilets` WHERE smell_level = "High" OR soap_level = "Low"'
    );
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateToiletStatus = async (req, res) => {
  const { status, soap_level, smell_level } = req.body;
  const { id } = req.params;
  try {
    await db.query(
      'UPDATE `toilets` SET status = ?, soap_level = ?, smell_level = ? WHERE id = ?',
      [status || 'operational', soap_level || 'High', smell_level || 'Low', id]
    );
    res.json({ message: 'Toilet status updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getOwners = async (req, res) => {
  try {
    const cleanerId = req.user.id;
    // Find the owner that created this cleaner from the `cleaners` table
    const [cleanerData] = await db.query('SELECT owner_id FROM `cleaners` WHERE id = ?', [cleanerId]);
    if (cleanerData.length === 0) return res.json([]);
    
    const ownerId = cleanerData[0].owner_id;
    const [owners] = await db.query('SELECT id, name, email FROM `owners` WHERE id = ?', [ownerId]);
    res.json(owners);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getComplaints = async (req, res) => {
  try {
    const cleanerId = req.user.id;
    // Get complaints for toilets assigned to this cleaner
    const [complaints] = await db.query(
      `SELECT c.id, c.toilet_id, c.description, c.status, c.type, c.created_at, t.location 
       FROM \`complaints\` c 
       JOIN \`toilets\` t ON c.toilet_id = t.id 
       WHERE t.cleaner_id = ? 
       ORDER BY c.created_at DESC`,
      [cleanerId]
    );

    // Mark as read
    if (complaints.length > 0) {
      await db.query(
        'UPDATE `complaints` c JOIN `toilets` t ON c.toilet_id = t.id SET c.is_read = TRUE WHERE t.cleaner_id = ?',
        [cleanerId]
      );
    }

    res.json(complaints);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.resolveComplaint = async (req, res) => {
  const { id } = req.params;
  try {
    // Verify this complaint belongs to a toilet assigned to this cleaner
    const [complaint] = await db.query(
      'SELECT c.id FROM `complaints` c JOIN `toilets` t ON c.toilet_id = t.id WHERE c.id = ? AND t.cleaner_id = ?',
      [id, req.user.id]
    );

    if (complaint.length === 0) return res.status(403).json({ error: 'Unauthorized or complaint not found' });

    await db.query('UPDATE `complaints` SET status = "resolved" WHERE id = ?', [id]);
    res.json({ message: 'Complaint resolved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getBroadcasts = async (req, res) => {
  try {
    const cleanerId = req.user.id;
    // Get this cleaner's owner
    const [cleaner] = await db.query('SELECT owner_id FROM `cleaners` WHERE id = ?', [cleanerId]);
    const ownerId = cleaner.length > 0 ? cleaner[0].owner_id : 0;

    const [broadcasts] = await db.query(`
      SELECT b.*, 
             CASE WHEN b.sender_role = 'Admin' THEN a.name ELSE o.name END as sender_name
      FROM \`broadcasts\` b
      LEFT JOIN \`admins\` a ON b.sender_id = a.id AND b.sender_role = 'Admin'
      LEFT JOIN \`owners\` o ON b.sender_id = o.id AND b.sender_role = 'Owner'
      WHERE b.sender_role = 'Owner' AND b.sender_id = ?
      ORDER BY b.created_at DESC
      LIMIT 10`, [ownerId]);
    res.json(broadcasts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
