#!/usr/bin/env node

// Database Migration Script for Railway MySQL
// Run this after deploying to Railway to set up the database schema

const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigrations() {
  let connection;
  
  try {
    console.log('🚀 Starting database migration...');
    
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('✅ Connected to database');

    // Create users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('staff', 'admin') DEFAULT 'staff',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created users table');

    // Insert default users (password is 'admin123' and 'staff123' hashed)
    await connection.execute(`
      INSERT IGNORE INTO users (username, password, role) VALUES 
      ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
      ('R3309', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff')
    `);
    console.log('✅ Inserted default users');

    // Create products table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        item_code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        hsn_code VARCHAR(20) DEFAULT '19059010',
        description TEXT,
        category VARCHAR(100),
        invoice_price DECIMAL(10,2) NOT NULL,
        sale_price DECIMAL(10,2) NOT NULL,
        grm_value DECIMAL(10,2) DEFAULT 0,
        image_url VARCHAR(255),
        is_active BOOLEAN DEFAULT 1,
        shelf_life_days INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created products table');

    // Create stock_batches table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS stock_batches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        expiry_date DATE,
        invoice_date DATE NOT NULL,
        invoice_reference VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Created stock_batches table');

    // Create sales table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sale_date DATETIME NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        payment_type VARCHAR(50) NOT NULL,
        staff_id INT DEFAULT 0,
        product_mrp_total DECIMAL(10,2) DEFAULT 0,
        decoration_mrp_total DECIMAL(10,2) DEFAULT 0,
        product_cost_total DECIMAL(10,2) DEFAULT 0,
        decoration_cost_total DECIMAL(10,2) DEFAULT 0,
        total_cost DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created sales table');

    // Create sale_items table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sale_id INT NOT NULL,
        item_id VARCHAR(50) NOT NULL,
        batch_id INT,
        quantity INT NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        name VARCHAR(255) NOT NULL,
        item_type VARCHAR(50) NOT NULL DEFAULT 'product',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Created sale_items table');

    // Add missing columns to existing sale_items table
    try {
      await connection.execute('ALTER TABLE sale_items ADD COLUMN item_type VARCHAR(50) NOT NULL DEFAULT "product"');
      console.log('✅ Added item_type column to sale_items table');
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.log('ℹ️ item_type column already exists or error:', error.message);
      }
    }

    try {
      await connection.execute('ALTER TABLE sale_items CHANGE COLUMN product_id item_id VARCHAR(50) NOT NULL');
      console.log('✅ Renamed product_id to item_id in sale_items table');
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.log('ℹ️ product_id already renamed or error:', error.message);
      }
    }

    // Create returns table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS returns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        return_date DATE NOT NULL,
        type ENUM('GRM', 'GVN') NOT NULL,
        product_id INT NOT NULL,
        batch_id INT,
        quantity INT NOT NULL,
        invoice_price DECIMAL(10,2) NOT NULL,
        loss_amount DECIMAL(10,2) DEFAULT 0,
        rtd DECIMAL(10,2) DEFAULT 0,
        staff_id INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Created returns table');

    // Add missing columns to existing returns table
    try {
      await connection.execute('ALTER TABLE returns ADD COLUMN rtd DECIMAL(10,2) DEFAULT 0');
      console.log('✅ Added rtd column to returns table');
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.log('ℹ️ rtd column already exists or error:', error.message);
      }
    }

    // Create decorations table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS decorations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sku VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        cost DECIMAL(10,2) NOT NULL DEFAULT 0,
        sale_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        stock_quantity INT NOT NULL DEFAULT 0,
        image_url VARCHAR(255) NULL,
        description TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created decorations table');

    // Create expenses table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        expense_date DATE NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        staff_id INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created expenses table');

    // Create invoices table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        invoice_date DATE NULL,
        store VARCHAR(255) NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NULL,
        customer_phone VARCHAR(20) NULL,
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        status ENUM('pending', 'cleared') NOT NULL DEFAULT 'pending',
        notes TEXT NULL,
        file_reference VARCHAR(255) NULL,
        created_by INT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created invoices table');

    // Add missing columns to existing invoices table
    try {
      await connection.execute('ALTER TABLE invoices ADD COLUMN invoice_date DATE NULL');
      console.log('✅ Added invoice_date column to invoices table');
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.log('ℹ️ invoice_date column already exists or error:', error.message);
      }
    }

    try {
      await connection.execute('ALTER TABLE invoices ADD COLUMN store VARCHAR(255) NULL');
      console.log('✅ Added store column to invoices table');
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.log('ℹ️ store column already exists or error:', error.message);
      }
    }

    try {
      await connection.execute('ALTER TABLE invoices ADD COLUMN file_reference VARCHAR(255) NULL');
      console.log('✅ Added file_reference column to invoices table');
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.log('ℹ️ file_reference column already exists or error:', error.message);
      }
    }

    // Create invoice_items table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id INT NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        product_code VARCHAR(50) NULL,
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Created invoice_items table');

    // Create credit_notes table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS credit_notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        credit_note_number VARCHAR(50) NOT NULL,
        date DATE NOT NULL,
        return_date DATE,
        receiver_name VARCHAR(255) NOT NULL,
        receiver_gstin VARCHAR(50),
        reason TEXT NOT NULL,
        total_items INT DEFAULT 0,
        gross_value DECIMAL(10,2) DEFAULT 0,
        net_value DECIMAL(10,2) DEFAULT 0,
        file_name VARCHAR(255),
        original_name VARCHAR(255),
        cloudinary_url VARCHAR(500) NULL,
        cloudinary_public_id VARCHAR(255) NULL,
        items JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_credit_note_date (credit_note_number, date)
      )
    `);
    console.log('✅ Created credit_notes table');

    // Create ros_receipts table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS ros_receipts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        receipt_number VARCHAR(50) UNIQUE NOT NULL,
        receipt_date DATE NOT NULL,
        received_from VARCHAR(255) NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(100) NOT NULL,
        bills JSON,
        file_name VARCHAR(255),
        original_name VARCHAR(255),
        cloudinary_url VARCHAR(500) NULL,
        cloudinary_public_id VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created ros_receipts table');

    console.log('🎉 Database migration completed successfully!');
    console.log('📝 Default credentials:');
    console.log('   Admin: admin / admin123');
    console.log('   Staff: R3309 / staff123');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;
