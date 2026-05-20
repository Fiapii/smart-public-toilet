const db = require('./config/db');
db.query("ALTER TABLE `toilets` ADD COLUMN `is_occupied` BOOLEAN DEFAULT FALSE")
  .then(() => console.log('Occupancy column added successfully'))
  .catch(err => {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Column already exists, moving on.');
    } else {
      console.error('Error:', err);
    }
  })
  .finally(() => process.exit(0));
