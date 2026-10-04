const db = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    // First, create the stores table
    const createStoresTable = `
      CREATE TABLE IF NOT EXISTS stores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        store_code VARCHAR(50) UNIQUE NOT NULL,
        store_name VARCHAR(255) NOT NULL,
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        pincode VARCHAR(10),
        contact_person VARCHAR(255),
        contact_phone VARCHAR(20),
        contact_email VARCHAR(255),
        area_manager_id INT,
        regional_manager_id INT,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_store_code (store_code),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await db.execute(createStoresTable);
    console.log('Stores table created successfully');
    
    // Insert initial store if not exists
    await db.execute(
      `INSERT INTO stores (store_code, store_name, city, status) 
       VALUES ('R3309', 'R3309 Bakery', 'Mumbai', 'active') 
       ON DUPLICATE KEY UPDATE store_name = 'R3309 Bakery'`
    );
    console.log('Initial store inserted');
    
    // Add store_id column to users if not exists
    try {
      await db.execute(`ALTER TABLE users ADD COLUMN store_id INT NULL AFTER id`);
      await db.execute(`ALTER TABLE users ADD INDEX idx_store_id (store_id)`);
      console.log('store_id column added to users table');
    } catch (err) {
      if (err.message.includes('Duplicate column')) {
        console.log('store_id column already exists in users table');
      } else {
        throw err;
      }
    }
    
    // Add role column to users if not exists
    try {
      await db.execute(`ALTER TABLE users ADD COLUMN role ENUM('store_manager', 'area_manager', 'regional_manager', 'super_admin') DEFAULT 'store_manager' AFTER username`);
      await db.execute(`ALTER TABLE users ADD INDEX idx_role (role)`);
      console.log('role column added to users table');
    } catch (err) {
      if (err.message.includes('Duplicate column')) {
        console.log('role column already exists in users table');
      } else {
        throw err;
      }
    }
    
    // Update existing users
    await db.execute(`UPDATE users SET store_id = 1 WHERE store_id IS NULL`);
    console.log('Existing users updated with store_id = 1');
    
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();
