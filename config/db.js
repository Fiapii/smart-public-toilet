const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

let dbConfig = {};
let sslConfig = {};

if (process.env.DATABASE_URL) {
  const parsed = new URL(process.env.DATABASE_URL);
  dbConfig = {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port) : 3306,
    user: parsed.username,
    password: parsed.password,
    database: parsed.pathname.replace(/^\//, ''),
  };
  // Force SSL for TiDB Cloud
  sslConfig = { ssl: { rejectUnauthorized: true, minVersion: 'TLSv1.2' } };
} else {
  dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
  sslConfig = {};
}

const pool = mysql.createPool({
  ...dbConfig,
  ...sslConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;