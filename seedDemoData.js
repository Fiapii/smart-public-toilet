const db = require('./config/db');
const bcrypt = require('bcryptjs');

const seedDemoData = async () => {
  try {
    console.log('Starting role-separated demo data seeding...');

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    // 1. Clear existing data
    console.log('Cleaning up existing data...');
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    await db.query('TRUNCATE TABLE `complaints`');
    await db.query('TRUNCATE TABLE `chats`');
    await db.query('TRUNCATE TABLE `payments`');
    await db.query('TRUNCATE TABLE `toilets`');
    await db.query('TRUNCATE TABLE `cleaners`');
    await db.query('TRUNCATE TABLE `owners`');
    await db.query('TRUNCATE TABLE `admins`');
    await db.query('SET FOREIGN_KEY_CHECKS = 1');

    // 2. Create Admin
    console.log('Seeding Admin...');
    const [adminResult] = await db.query(
      'INSERT INTO `admins` (name, email, password) VALUES (?, ?, ?)',
      ['Super Admin', 'admin@gmail.com', hashedPassword]
    );
    const adminId = adminResult.insertId;

    // 3. Create Owners
    console.log('Seeding Owners...');
    const [owner1Result] = await db.query(
      'INSERT INTO `owners` (name, email, password, admin_id) VALUES (?, ?, ?, ?)',
      ['Owner Alpha', 'owner1@gmail.com', hashedPassword, adminId]
    );
    const owner1Id = owner1Result.insertId;

    const [owner2Result] = await db.query(
      'INSERT INTO `owners` (name, email, password, admin_id) VALUES (?, ?, ?, ?)',
      ['Owner Beta', 'owner2@gmail.com', hashedPassword, adminId]
    );
    const owner2Id = owner2Result.insertId;

    // 4. Create Cleaners
    console.log('Seeding Cleaners...');
    const [cleaner1Result] = await db.query(
      'INSERT INTO `cleaners` (name, email, password, owner_id) VALUES (?, ?, ?, ?)',
      ['Cleaner 1-1', 'cleaner1_1@gmail.com', hashedPassword, owner1Id]
    );
    const cleaner1Id = cleaner1Result.insertId;

    const [cleaner2Result] = await db.query(
      'INSERT INTO `cleaners` (name, email, password, owner_id) VALUES (?, ?, ?, ?)',
      ['Cleaner 2-1', 'cleaner2_1@gmail.com', hashedPassword, owner2Id]
    );
    const cleaner2Id = cleaner2Result.insertId;

    // 5. Create Toilets
    console.log('Seeding Toilets...');
    const [toilet1Result] = await db.query(
      'INSERT INTO `toilets` (owner_id, cleaner_id, location, status, revenue) VALUES (?, ?, ?, ?, ?)',
      [owner1Id, cleaner1Id, 'Kigali City Mall', 'operational', 5000]
    );
    const [toilet2Result] = await db.query(
      'INSERT INTO `toilets` (owner_id, cleaner_id, location, status, revenue) VALUES (?, ?, ?, ?, ?)',
      [owner2Id, cleaner2Id, 'Gisementi Plaza', 'operational', 3000]
    );

    // 6. Create Chats (Strictly between registrar and registered)
    console.log('Seeding Chats...');
    // Admin to Owner 1
    await db.query(
      'INSERT INTO `chats` (sender_id, sender_role, receiver_id, receiver_role, message) VALUES (?, ?, ?, ?, ?)',
      [adminId, 'Admin', owner1Id, 'Owner', 'Hello Owner Alpha, welcome to the system.']
    );
    // Owner 1 to Cleaner 1-1
    await db.query(
      'INSERT INTO `chats` (sender_id, sender_role, receiver_id, receiver_role, message) VALUES (?, ?, ?, ?, ?)',
      [owner1Id, 'Owner', cleaner1Id, 'Cleaner', 'Please clean the mall toilets today.']
    );

    // 7. Create Test RFID Cards
    console.log('Seeding Test RFID Cards...');
    const toilet1Id = toilet1Result.insertId;
    const toilet2Id = toilet2Result.insertId;

    await db.query(
      'INSERT INTO `rfid_cards` (uid, holder_name, balance, toilet_id, is_active) VALUES (?, ?, ?, ?, 1)',
      ['29 67 1C 06', 'Test Card 1', 5000.00, toilet1Id]
    );
    await db.query(
      'INSERT INTO `rfid_cards` (uid, holder_name, balance, toilet_id, is_active) VALUES (?, ?, ?, ?, 1)',
      ['AA BB CC DD', 'Test Card 2', 10000.00, toilet1Id]
    );
    await db.query(
      'INSERT INTO `rfid_cards` (uid, holder_name, balance, toilet_id, is_active) VALUES (?, ?, ?, ?, 1)',
      ['11 22 33 44', 'Test Card 3', 2000.00, toilet2Id]
    );

    console.log('Demo data seeded successfully with separate tables!');
    console.log('\n📋 Test RFID Cards Created:');
    console.log('  Card 1 (29 67 1C 06): Balance RWF 5000 - Toilet 1');
    console.log('  Card 2 (AA BB CC DD): Balance RWF 10000 - Toilet 1');
    console.log('  Card 3 (11 22 33 44): Balance RWF 2000 - Toilet 2');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding demo data:', error);
    process.exit(1);
  }
};

seedDemoData();
