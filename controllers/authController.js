const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Generate JWT
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

exports.register = async (req, res) => {
  const { name, email, password, role, secret_word } = req.body;
  
  // Restriction: Only Admins can register other Admins
  const [adminsCount] = await db.query('SELECT COUNT(*) as count FROM `admins`');
  const isFirstAdmin = adminsCount[0].count === 0;

  if (!isFirstAdmin) {
    if (!req.user || req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only a Super Admin can register another Admin account.' });
    }
  }

  try {
    const [existing] = await db.query('SELECT email FROM `admins` WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(400).json({ error: 'Admin email already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [result] = await db.query(
      'INSERT INTO `admins` (name, email, password, secret_word) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, secret_word || 'SmartLoo']
    );

    res.status(201).json({
      id: result.insertId,
      name,
      email,
      role: 'Admin',
      token: generateToken(result.insertId, 'Admin')
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllAdmins = async (req, res) => {
  try {
    const [admins] = await db.query('SELECT id, name, email, created_at FROM `admins`');
    res.json(admins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    let user = null;
    let role = null;

    // Check all tables
    const [admins] = await db.query('SELECT * FROM `admins` WHERE email = ?', [email]);
    if (admins.length > 0) { user = admins[0]; role = 'Admin'; }
    else {
      const [owners] = await db.query('SELECT * FROM `owners` WHERE email = ?', [email]);
      if (owners.length > 0) { user = owners[0]; role = 'Owner'; }
      else {
        const [cleaners] = await db.query('SELECT * FROM `cleaners` WHERE email = ?', [email]);
        if (cleaners.length > 0) { user = cleaners[0]; role = 'Cleaner'; }
      }
    }

    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: role,
      secret_word: user.secret_word,
      token: generateToken(user.id, role)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const { id, role } = req.user;

  try {
    let tableName = role === 'Admin' ? 'admins' : (role === 'Owner' ? 'owners' : 'cleaners');
    const [users] = await db.query(`SELECT * FROM \`${tableName}\` WHERE id = ?`, [id]);
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const isMatch = await bcrypt.compare(currentPassword, users[0].password);
    if (!isMatch) return res.status(401).json({ error: 'Incorrect current password' });
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    await db.query(`UPDATE \`${tableName}\` SET password = ? WHERE id = ?`, [hashedPassword, id]);
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  const { name, email, secret_word, currentPassword } = req.body;
  const { id, role } = req.user;
  
  if (!currentPassword) return res.status(400).json({ error: 'Current password is required to save changes' });

  try {
    let tableName = role === 'Admin' ? 'admins' : (role === 'Owner' ? 'owners' : 'cleaners');
    const [users] = await db.query(`SELECT password FROM \`${tableName}\` WHERE id = ?`, [id]);
    const isMatch = await bcrypt.compare(currentPassword, users[0].password);
    if (!isMatch) return res.status(401).json({ error: 'Incorrect password' });

    await db.query(`UPDATE \`${tableName}\` SET name = ?, email = ?, secret_word = ? WHERE id = ?`, [name, email, secret_word, id]);
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Simplified: Just check if user exists for Forgot Password UI
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  try {
    const [a] = await db.query('SELECT id FROM `admins` WHERE email = ?', [email]);
    const [o] = await db.query('SELECT id FROM `owners` WHERE email = ?', [email]);
    const [c] = await db.query('SELECT id FROM `cleaners` WHERE email = ?', [email]);

    if (a.length === 0 && o.length === 0 && c.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }
    res.json({ message: 'User verified. Please enter your secret word.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Reset using Secret Word instead of Token
exports.resetPassword = async (req, res) => {
  const { email, secret_word, newPassword } = req.body;
  try {
    let user = null;
    let tableName = '';

    const [a] = await db.query('SELECT * FROM `admins` WHERE email = ?', [email]);
    if (a.length > 0) { user = a[0]; tableName = 'admins'; }
    else {
      const [o] = await db.query('SELECT * FROM `owners` WHERE email = ?', [email]);
      if (o.length > 0) { user = o[0]; tableName = 'owners'; }
      else {
        const [c] = await db.query('SELECT * FROM `cleaners` WHERE email = ?', [email]);
        if (c.length > 0) { user = c[0]; tableName = 'cleaners'; }
      }
    }

    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.secret_word.toLowerCase() !== secret_word.toLowerCase()) {
      return res.status(401).json({ error: 'Incorrect secret word' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await db.query(`UPDATE \`${tableName}\` SET password = ? WHERE email = ?`, [hashedPassword, email]);
    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getNotifications = async (req, res) => {
  const { id, role } = req.user;
  try {
    const [unreadMsgs] = await db.query(
      'SELECT COUNT(*) as count FROM `chats` WHERE receiver_id = ? AND receiver_role = ? AND is_read = FALSE',
      [id, role]
    );

    let unreadComplaints = 0;
    if (role === 'Owner') {
      const [complaints] = await db.query(
        'SELECT COUNT(*) as count FROM `complaints` c JOIN `toilets` t ON c.toilet_id = t.id WHERE t.owner_id = ? AND c.is_read = FALSE',
        [id]
      );
      unreadComplaints = complaints[0].count;
    } else if (role === 'Admin') {
      const [complaints] = await db.query('SELECT COUNT(*) as count FROM `complaints` WHERE is_read = FALSE');
      unreadComplaints = complaints[0].count;
    } else if (role === 'Cleaner') {
      const [complaints] = await db.query(
        'SELECT COUNT(*) as count FROM `complaints` c JOIN `toilets` t ON c.toilet_id = t.id WHERE t.cleaner_id = ? AND c.is_read = FALSE',
        [id]
      );
      unreadComplaints = complaints[0].count;
    }

    res.json({
      unreadMessages: unreadMsgs[0].count,
      unreadComplaints: unreadComplaints,
      total: unreadMsgs[0].count + unreadComplaints
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getRoleEmails = async (req, res) => {
  const { role } = req.params;
  try {
    let tableName = role === 'Admin' ? 'admins' : (role === 'Owner' ? 'owners' : 'cleaners');
    const [users] = await db.query(`SELECT name, email, secret_word FROM \`${tableName}\``);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.checkInit = async (req, res) => {
  try {
    const [adminsCount] = await db.query('SELECT COUNT(*) as count FROM `admins`');
    res.json({ initialized: adminsCount[0].count > 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
