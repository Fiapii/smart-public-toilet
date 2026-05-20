const mysql = require('mysql2/promise');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

async function initCloudDatabase() {
  const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  };

  console.log(`🔌 Attempting to connect to database at: ${dbConfig.host}...`);

  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully!');

    // Check if database is already initialized to prevent wiping existing data on restart
    const [tables] = await connection.query("SHOW TABLES LIKE 'admins'");
    if (tables.length > 0) {
      console.log('✨ Database is already initialized. Skipping schema setup to protect existing data.');
      await connection.end();
      return;
    }

    // Read schema.sql from root folder
    const schemaPath = path.join(__dirname, '../schema.sql');
    console.log(`📖 Reading schema.sql from ${schemaPath}...`);
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema queries
    console.log('⏳ Executing schema to create tables...');
    await connection.query(schema);
    console.log('✅ Database tables initialized successfully!');

    // Generate seeded admin credentials
    const salt = await bcrypt.genSalt(10);
    const hashedAdminPassword = await bcrypt.hash('1111', salt);

    console.log('👤 Seeding default Super Admin...');
    await connection.query(
      'INSERT INTO `admins` (id, name, email, password, secret_word) VALUES (1, "Super Admin", ?, ?, ?) ON DUPLICATE KEY UPDATE email = VALUES(email), password = VALUES(password)',
      ['irumvafiacre2001@gmail.com', hashedAdminPassword, 'SmartLoo']
    );
    console.log('✅ Super Admin added successfully!');
    console.log('   Email: irumvafiacre2001@gmail.com');
    console.log('   Password: 1111');

    // Generate seeded owner credentials
    console.log('👤 Seeding default Sample Owner...');
    const hashedOwnerPassword = await bcrypt.hash('owner123', salt);
    await connection.query(
      'INSERT INTO `owners` (id, admin_id, name, email, password, secret_word) VALUES (1, 1, "Sample Owner", "owner@test.com", ?, ?) ON DUPLICATE KEY UPDATE id = id',
      [hashedOwnerPassword, 'SmartLoo']
    );
    console.log('✅ Sample Owner added successfully!');

    // Seed default toilet
    console.log('🚻 Seeding default Toilet (ID 1)...');
    await connection.query(
      'INSERT INTO `toilets` (id, owner_id, location, status, revenue) VALUES (1, 1, "Test Location", "operational", 0.00) ON DUPLICATE KEY UPDATE id = id',
      []
    );
    console.log('✅ Toilet added successfully!');

    // Seed default cleaner
    console.log('🧹 Seeding default Cleaner...');
    const hashedCleanerPassword = await bcrypt.hash('cleaner123', salt);
    await connection.query(
      'INSERT INTO `cleaners` (id, owner_id, name, email, password, secret_word) VALUES (1, 1, "Sample Cleaner", "cleaner@test.com", ?, ?) ON DUPLICATE KEY UPDATE id = id',
      [hashedCleanerPassword, 'SmartLoo']
    );
    console.log('✅ Sample Cleaner added successfully!');

    // Seed test RFID card
    console.log('💳 Seeding default RFID card...');
    await connection.query(
      'INSERT INTO `rfid_cards` (uid, holder_name, balance, toilet_id, is_active) VALUES (?, ?, ?, ?, TRUE) ON DUPLICATE KEY UPDATE balance = ?',
      ['29 67 1C 06', 'Test User', 5000.00, 1, 5000.00]
    );
    console.log('✅ RFID Card added successfully!');

    console.log('\n🎉 ===== CLOUD INITIALIZATION COMPLETE =====');
    console.log('Connected to:', dbConfig.host);
    console.log('Admin Account: irumvafiacre2001@gmail.com / 1111');

    await connection.end();
  } catch (error) {
    console.error('❌ Database Initialization Failed:', error);
    process.exit(1); // Exit with error code to notify Railway
  }
}

initCloudDatabase();
