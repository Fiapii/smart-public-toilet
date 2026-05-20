CREATE DATABASE IF NOT EXISTS `smart public toilet`;
USE `smart public toilet`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `sensor_events`;
DROP TABLE IF EXISTS `rfid_cards`;
DROP TABLE IF EXISTS `complaints`;
DROP TABLE IF EXISTS `chats`;
DROP TABLE IF EXISTS `payments`;
DROP TABLE IF EXISTS `toilets`;
DROP TABLE IF EXISTS `cleaners`;
DROP TABLE IF EXISTS `owners`;
DROP TABLE IF EXISTS `admins`;
DROP TABLE IF EXISTS `password_resets`;
DROP TABLE IF EXISTS `broadcasts`;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Admins Table
CREATE TABLE IF NOT EXISTS `admins` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `secret_word` VARCHAR(255) DEFAULT 'SmartLoo',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Owners Table
CREATE TABLE IF NOT EXISTS `owners` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `admin_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `secret_word` VARCHAR(255) DEFAULT 'SmartLoo',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE
);

-- 3. Cleaners Table
CREATE TABLE IF NOT EXISTS `cleaners` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `owner_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `secret_word` VARCHAR(255) DEFAULT 'SmartLoo',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`owner_id`) REFERENCES `owners`(`id`) ON DELETE CASCADE
);

-- 4. Toilets Table
CREATE TABLE IF NOT EXISTS `toilets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `owner_id` INT NOT NULL,
  `cleaner_id` INT,
  `location` VARCHAR(100) NOT NULL,
  `status` ENUM('operational','maintenance') DEFAULT 'operational',
  `is_occupied` BOOLEAN DEFAULT FALSE,
  `revenue` DECIMAL(10,2) DEFAULT 0.00,
  `soap_level` VARCHAR(50) DEFAULT 'High',
  `smell_level` VARCHAR(50) DEFAULT 'Low',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`owner_id`) REFERENCES `owners`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`cleaner_id`) REFERENCES `cleaners`(`id`) ON DELETE SET NULL
);

-- 5. Payments Table
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `toilet_id` INT NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `phone_number` VARCHAR(50) NOT NULL DEFAULT 'RFID',
  `transaction_id` VARCHAR(255) UNIQUE,
  `status` ENUM('pending', 'completed', 'Paid', 'failed') DEFAULT 'pending',
  `paid_at` TIMESTAMP NULL,
  `consumed` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`toilet_id`) REFERENCES `toilets`(`id`) ON DELETE CASCADE
);

-- 6. Chats Table
CREATE TABLE IF NOT EXISTS `chats` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sender_id` INT NOT NULL,
  `sender_role` ENUM('Admin', 'Owner', 'Cleaner') NOT NULL,
  `receiver_id` INT NOT NULL,
  `receiver_role` ENUM('Admin', 'Owner', 'Cleaner') NOT NULL,
  `message` TEXT NOT NULL,
  `is_read` BOOLEAN DEFAULT FALSE,
  `is_edited` BOOLEAN DEFAULT FALSE,
  `deleted_by_sender` BOOLEAN DEFAULT FALSE,
  `deleted_by_receiver` BOOLEAN DEFAULT FALSE,
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Password reset tokens
CREATE TABLE IF NOT EXISTS `password_resets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `role` ENUM('Admin', 'Owner', 'Cleaner') NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Complaints Table
CREATE TABLE IF NOT EXISTS `complaints` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `toilet_id` INT NOT NULL,
  `description` TEXT NOT NULL,
  `status` ENUM('open', 'resolved') DEFAULT 'open',
  `type` ENUM('User', 'Sensor') DEFAULT 'User',
  `is_read` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`toilet_id`) REFERENCES `toilets`(`id`) ON DELETE CASCADE
);

-- 9. Broadcasts Table
CREATE TABLE IF NOT EXISTS `broadcasts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sender_id` INT NOT NULL,
  `sender_role` ENUM('Admin', 'Owner') NOT NULL,
  `message` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. RFID Cards Table
CREATE TABLE IF NOT EXISTS `rfid_cards` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `uid` VARCHAR(50) UNIQUE NOT NULL,
  `holder_name` VARCHAR(100) DEFAULT 'User',
  `balance` DECIMAL(10,2) DEFAULT 5000.00,
  `toilet_id` INT,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`toilet_id`) REFERENCES `toilets`(`id`) ON DELETE SET NULL
);

-- 11. Sensor Events Log
CREATE TABLE IF NOT EXISTS `sensor_events` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `toilet_id` INT NOT NULL,
  `event_type` ENUM('door_open','door_close','lid_open','lid_close','flush','rfid_tap','rfid_denied','rfid_new_card','payment','payment_failed','payment_trigger','sensor_update') NOT NULL,
  `details` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`toilet_id`) REFERENCES `toilets`(`id`) ON DELETE CASCADE
);
