const db = require('./config/db');

async function alterTable() {
  try {
    await db.query("ALTER TABLE `payments` MODIFY COLUMN `status` ENUM('pending', 'completed', 'Paid', 'failed') DEFAULT 'pending'");
    console.log("Payments table altered successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error altering table:", error);
    process.exit(1);
  }
}

alterTable();
