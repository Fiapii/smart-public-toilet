const mysql = require('mysql2/promise');
const fs = require('fs');
const bcrypt = require('bcryptjs');

async function initDatabase() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'fiacre2001',
    multipleStatements: true
  });

  try {
    console.log('Reading schema.sql...');
    const schema = fs.readFileSync('./schema.sql', 'utf8');
    
    console.log('Executing schema...');
    await connection.query(schema);
    console.log('✅ Database initialized successfully!');
    
    // Hash password "1111" for admin
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('1111', salt);
    
    // Add admin with provided credentials
    console.log('Adding super admin...');
    await connection.query(
      'INSERT INTO `admins` (id, name, email, password, secret_word) VALUES (1, "Super Admin", ?, ?, ?) ON DUPLICATE KEY UPDATE email = VALUES(email), password = VALUES(password)',
      ['irumvafiacre2001@gmail.com', hashedPassword, 'SmartLoo']
    );
    console.log('✅ Super Admin added successfully!');
    console.log('   Email: irumvafiacre2001@gmail.com');
    console.log('   Password: 1111');
    
    // Add sample owner (required for toilet)
    console.log('Adding sample owner...');
    const ownerPassword = await bcrypt.hash('owner123', salt);
    await connection.query(
      'INSERT INTO `owners` (id, admin_id, name, email, password, secret_word) VALUES (1, 1, "Sample Owner", "owner@test.com", ?, ?) ON DUPLICATE KEY UPDATE id = id',
      [ownerPassword, 'SmartLoo']
    );
    console.log('✅ Sample Owner added successfully!');
    
    // Add toilet (required for card)
    console.log('Adding toilet ID 1...');
    await connection.query(
      'INSERT INTO `toilets` (id, owner_id, location, status, revenue) VALUES (1, 1, "Test Location", "operational", 0.00) ON DUPLICATE KEY UPDATE id = id',
      []
    );
    console.log('✅ Toilet added successfully!');
    
    // Add sample cleaner (client)
    console.log('Adding sample cleaner...');
    const cleanerPassword = await bcrypt.hash('cleaner123', salt);
    await connection.query(
      'INSERT INTO `cleaners` (id, owner_id, name, email, password, secret_word) VALUES (1, 1, "Sample Cleaner", "cleaner@test.com", ?, ?) ON DUPLICATE KEY UPDATE id = id',
      [cleanerPassword, 'SmartLoo']
    );
    console.log('✅ Sample Cleaner added successfully!');
    
    // Add the card with balance
    console.log('Adding card UID 29 67 1C 06 with 5000 RWF balance...');
    await connection.query(
      'INSERT INTO `rfid_cards` (uid, holder_name, balance, toilet_id, is_active) VALUES (?, ?, ?, ?, TRUE) ON DUPLICATE KEY UPDATE balance = ?',
      ['29 67 1C 06', 'Test User', 5000.00, 1, 5000.00]
    );
    console.log('✅ Card added successfully!');
    
    // Verify the card
    const [cards] = await connection.query('SELECT * FROM rfid_cards WHERE uid = ?', ['29 67 1C 06']);
    console.log('Card details:', cards[0]);
    
    console.log('\n✅ ===== INITIALIZATION COMPLETE =====');
    console.log('Admin Login:');
    console.log('  Email: irumvafiacre2001@gmail.com');
    console.log('  Password: 1111');
    console.log('  Role: Admin');
    console.log('\n📝 Sample Test Accounts Created:');
    console.log('  Owner Email: owner@test.com / owner123');
    console.log('  Cleaner Email: cleaner@test.com / cleaner123');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

initDatabase();
