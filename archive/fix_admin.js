const db = require('./config/db');
const bcrypt = require('bcryptjs');

async function createSuperAdmin() {
  try {
    const email = 'irumvafiacre2001@gmail.com';
    const password = '1212@';
    
    console.log(`Checking if admin ${email} exists...`);
    const [existing] = await db.query('SELECT * FROM `admins` WHERE email = ?', [email]);
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    if (existing.length > 0) {
      console.log('Admin exists, updating password...');
      await db.query('UPDATE `admins` SET password = ? WHERE email = ?', [hashedPassword, email]);
    } else {
      console.log('Creating new Super Admin...');
      await db.query(
        'INSERT INTO `admins` (name, email, password) VALUES (?, ?, ?)',
        ['Super Admin', email, hashedPassword]
      );
    }

    console.log('Super Admin credentials updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createSuperAdmin();
