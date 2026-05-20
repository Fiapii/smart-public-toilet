const db = require('./config/db');
db.query("ALTER TABLE `sensor_events` MODIFY COLUMN `event_type` ENUM('door_open','door_close','lid_open','lid_close','flush','rfid_tap','rfid_denied','rfid_new_card','payment','payment_failed','payment_trigger','sensor_update') NOT NULL")
  .then(() => console.log('DB Altered successfully'))
  .catch(err => console.error('Error:', err))
  .finally(() => process.exit(0));
