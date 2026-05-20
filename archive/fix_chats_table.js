const mysql = require('mysql2/promise');
require('dotenv').config();

async function fix() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    await connection.query('DROP TABLE IF EXISTS `chats`');
    await connection.query(`
      CREATE TABLE \`chats\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`sender_id\` INT NOT NULL,
        \`sender_role\` ENUM('Admin', 'Owner', 'Cleaner') NOT NULL,
        \`receiver_id\` INT NOT NULL,
        \`receiver_role\` ENUM('Admin', 'Owner', 'Cleaner') NOT NULL,
        \`message\` TEXT NOT NULL,
        \`timestamp\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Chats table recreated with correct role columns');
  } catch (err) {
    console.error('Error fixing chats table:', err);
  } finally {
    await connection.end();
  }
}

fix();
