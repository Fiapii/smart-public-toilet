-- Create broadcasts table for admin messages to all owners
CREATE TABLE IF NOT EXISTS `broadcasts` (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
