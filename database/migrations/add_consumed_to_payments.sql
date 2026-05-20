-- Migration: Add consumed column to payments table for tracking payment-triggered door openings
-- Run this if you have an existing database

-- Check if consumed column exists before adding it
ALTER TABLE `payments` ADD COLUMN `consumed` BOOLEAN DEFAULT FALSE;

-- Create sensor_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS `sensor_events` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `toilet_id` INT NOT NULL,
  `event_type` ENUM(
    'door_open', 'door_close', 
    'lid_open', 'lid_close', 
    'flush', 
    'rfid_tap', 'rfid_denied', 'rfid_new_card',
    'payment', 'payment_trigger', 'payment_door_open',
    'sensor_update'
  ) NOT NULL,
  `details` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`toilet_id`) REFERENCES `toilets`(`id`) ON DELETE CASCADE
);
