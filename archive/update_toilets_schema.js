const mysql = require('mysql2/promise');
require('dotenv').config();

async function update() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    const [columns] = await connection.query('SHOW COLUMNS FROM `toilets` LIKE "cleaner_id"');
    if (columns.length === 0) {
      await connection.query('ALTER TABLE `toilets` ADD COLUMN `cleaner_id` INT NULL');
      await connection.query('ALTER TABLE `toilets` ADD CONSTRAINT `fk_cleaner` FOREIGN KEY (`cleaner_id`) REFERENCES `cleaners`(`id`) ON DELETE SET NULL');
      console.log('Toilets table updated with cleaner_id');
    } else {
      console.log('cleaner_id column already exists');
    }
  } catch (err) {
    console.error('Error updating toilets table:', err);
  } finally {
    await connection.end();
  }
}

update();
