const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

// Support both DATABASE_URL and individual DB_* env vars
let pool;

if (process.env.DATABASE_URL) {
  pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true, minVersion: 'TLSv1.2' }
  });
} else {
  // Use individual variables from .env
  const dbName = (process.env.DB_NAME || 'smart_public_toilet').replace(/\s+/g, '_');
  pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10
  });
  console.log(`✅ DB connecting to mysql://${process.env.DB_HOST}/${dbName}`);
}

module.exports = pool;