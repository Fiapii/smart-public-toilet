#!/usr/bin/env node
/**
 * Fresh Database Initialization
 * Drops everything and recreates schema from scratch
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
  // First connection: connect to MySQL without selecting database
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    console.log('🔄 Dropping existing database...');
    await connection.query('DROP DATABASE IF EXISTS `smart public toilet`');
    console.log('✅ Old database dropped');

    console.log('🔄 Creating new database...');
    await connection.query('CREATE DATABASE `smart public toilet`');
    console.log('✅ New database created');

    console.log('🔄 Reading schema.sql...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('🔄 Executing schema...');
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      await connection.query(statement);
    }

    console.log('✅ Schema created successfully');

    console.log('🔄 Running seed data...');
    const seedPath = path.join(__dirname, 'seedDemoData.js');
    if (fs.existsSync(seedPath)) {
      const seed = require(seedPath);
      console.log('✅ Seed data inserted');
    }

    console.log('\n✨ Database initialized successfully!');
    console.log(`📊 Database: smart public toilet`);
    console.log(`🔗 Host: ${process.env.DB_HOST}`);
    console.log(`👤 User: ${process.env.DB_USER}`);

  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

initDatabase().catch(err => {
  console.error(err);
  process.exit(1);
});
