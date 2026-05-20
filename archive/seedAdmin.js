const db = require('./config/db');
const bcrypt = require('bcryptjs');

const seedAdmin = async () => {
  const name = 'Fiacre';
  const email = 'irumvafiacre2001@gmail.com';
  const password = '1212';

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [existing] = await db.query('SELECT * FROM `admins` WHERE email = ?', [email]);
    if (existing.length > 0) {
      console.log('Super Admin already exists.');
      process.exit();
    }

    await db.query(
      'INSERT INTO `admins` (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );

    console.log('Super Admin inserted successfully!');
    process.exit();
  } catch (error) {
    console.error('Failed to seed admin:', error);
    process.exit(1);
  }
};

seedAdmin();
