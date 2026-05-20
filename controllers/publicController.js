const db = require('../config/db');

exports.createComplaint = async (req, res) => {
  const { toilet_id, description } = req.body;

  if (!toilet_id || !description) {
    return res.status(400).json({ error: 'Missing toilet_id or description' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO `complaints` (toilet_id, description, status, type) VALUES (?, ?, "open", "User")',
      [toilet_id, description]
    );

    res.status(201).json({ 
      success: true, 
      message: 'Thank you for your feedback!', 
      complaint_id: result.insertId 
    });
  } catch (error) {
    console.error('Complaint creation error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};
exports.getToilets = async (req, res) => {
  try {
    const [toilets] = await db.query('SELECT id, location FROM `toilets`');
    res.json(toilets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
