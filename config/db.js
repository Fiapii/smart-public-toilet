const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is missing');
  process.exit(1);
}

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true, minVersion: 'TLSv1.2' }
});

module.exports = pool;