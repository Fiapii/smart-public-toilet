const db = require('./config/db');

async function verifyData() {
  try {
    console.log('\n📊 === DATABASE VERIFICATION ===\n');

    // Check payments
    const [payments] = await db.query('SELECT * FROM payments ORDER BY created_at DESC LIMIT 5');
    console.log('💰 Recent Payments (Last 5):');
    payments.forEach((p, i) => {
      console.log(`  ${i+1}. Transaction: ${p.transaction_id} | Amount: RWF ${p.amount} | Phone: ${p.phone_number} | Status: ${p.status}`);
    });

    // Check RFID cards
    const [cards] = await db.query('SELECT uid, holder_name, balance FROM rfid_cards ORDER BY created_at');
    console.log('\n💳 RFID Cards in System:');
    cards.forEach((c, i) => {
      console.log(`  ${i+1}. UID: ${c.uid} | Name: ${c.holder_name} | Balance: RWF ${c.balance}`);
    });

    // Check events
    const [events] = await db.query(`
      SELECT event_type, details, created_at 
      FROM sensor_events 
      WHERE event_type IN ('rfid_tap', 'payment', 'rfid_new_card') 
      ORDER BY created_at DESC LIMIT 10
    `);
    console.log('\n📝 RFID & Payment Events (Last 10):');
    events.forEach((e, i) => {
      console.log(`  ${i+1}. [${e.event_type}] ${e.details} (${new Date(e.created_at).toLocaleTimeString()})`);
    });

    // Check toilet revenue
    const [toilets] = await db.query('SELECT id, location, revenue FROM toilets');
    console.log('\n🚽 Toilet Revenue:');
    toilets.forEach(t => {
      console.log(`  Toilet ${t.id} (${t.location}): RWF ${t.revenue} revenue`);
    });

    console.log('\n✨ Verification Complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyData();
