-- Migration 001: Add Multi-Tenancy Support
-- This migration adds store_id to all tables for multi-store support
-- Run this script to upgrade your database for 70 stores

-- ============================================
-- STEP 1: Create stores table
-- ============================================

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- STEP 2: Add store_id and role to users table
-- ============================================

ALTER TABLE users 
ADD COLUMN store_id INT NULL AFTER id,
ADD COLUMN role ENUM('store_manager', 'area_manager', 'regional_manager', 'super_admin') DEFAULT 'store_manager' AFTER username,
ADD INDEX idx_store_id (store_id),
ADD INDEX idx_role (role);

-- Add foreign key constraint for store_id
ALTER TABLE users 
ADD CONSTRAINT fk_users_store 
FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;

-- ============================================
-- STEP 3: Add store_id to products table
-- ============================================

ALTER TABLE products 
ADD COLUMN store_id INT NULL AFTER id,
ADD INDEX idx_store_id (store_id);

ALTER TABLE products 
ADD CONSTRAINT fk_products_store 
FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;

-- ============================================
-- STEP 4: Add store_id to credit_notes table
-- ============================================

ALTER TABLE credit_notes 
ADD COLUMN store_id INT NULL AFTER id,
ADD INDEX idx_store_id (store_id);

ALTER TABLE credit_notes 
ADD CONSTRAINT fk_credit_notes_store 
FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;

-- ============================================
-- STEP 5: Add store_id to returns table
-- ============================================

ALTER TABLE returns 
ADD COLUMN store_id INT NULL AFTER id,
ADD INDEX idx_store_id (store_id);

ALTER TABLE returns 
ADD CONSTRAINT fk_returns_store 
FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;

-- ============================================
-- STEP 6: Add store_id to invoices table
-- ============================================

ALTER TABLE invoices 
ADD COLUMN store_id INT NULL AFTER id,
ADD INDEX idx_store_id (store_id);

ALTER TABLE invoices 
ADD CONSTRAINT fk_invoices_store 
FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;

-- ============================================
-- STEP 7: Add store_id to stock_batches table
-- ============================================

ALTER TABLE stock_batches 
ADD COLUMN store_id INT NULL AFTER id,
ADD INDEX idx_store_id (store_id);

ALTER TABLE stock_batches 
ADD CONSTRAINT fk_stock_batches_store 
FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;

-- ============================================
-- STEP 8: Add store_id to daily_sales table (if exists)
-- ============================================

-- Check if table exists and add store_id
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables 
                     WHERE table_schema = DATABASE() 
                     AND table_name = 'daily_sales');

SET @sql = IF(@table_exists > 0, 
  'ALTER TABLE daily_sales ADD COLUMN store_id INT NULL AFTER id, ADD INDEX idx_store_id (store_id)',
  'SELECT "Table daily_sales does not exist, skipping" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key if table exists
SET @sql = IF(@table_exists > 0,
  'ALTER TABLE daily_sales ADD CONSTRAINT fk_daily_sales_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL',
  'SELECT "Skipping foreign key for daily_sales" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- STEP 9: Add store_id to tomorrow_ai tables
-- ============================================

-- Add store_id to tomorrow_ai_daily_sales
ALTER TABLE tomorrow_ai_daily_sales 
ADD COLUMN store_id INT NULL AFTER id,
ADD INDEX idx_store_id (store_id);

ALTER TABLE tomorrow_ai_daily_sales 
ADD CONSTRAINT fk_tomorrow_ai_daily_sales_store 
FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;

-- Add store_id to tomorrow_ai_predictions
ALTER TABLE tomorrow_ai_predictions 
ADD COLUMN store_id INT NULL AFTER id,
ADD INDEX idx_store_id (store_id);

ALTER TABLE tomorrow_ai_predictions 
ADD CONSTRAINT fk_tomorrow_ai_predictions_store 
FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;

-- ============================================
-- STEP 10: Insert initial store (R3309)
-- ============================================

INSERT INTO stores (store_code, store_name, city, status)
VALUES ('R3309', 'R3309 Bakery', 'Mumbai', 'active')
ON DUPLICATE KEY UPDATE store_name = 'R3309 Bakery';

-- ============================================
-- STEP 11: Update existing data with store_id = 1
-- ============================================

-- Update users
UPDATE users SET store_id = 1 WHERE store_id IS NULL;

-- Update products
UPDATE products SET store_id = 1 WHERE store_id IS NULL;

-- Update credit_notes
UPDATE credit_notes SET store_id = 1 WHERE store_id IS NULL;

-- Update returns
UPDATE returns SET store_id = 1 WHERE store_id IS NULL;

-- Update invoices
UPDATE invoices SET store_id = 1 WHERE store_id IS NULL;

-- Update stock_batches
UPDATE stock_batches SET store_id = 1 WHERE store_id IS NULL;

-- Update daily_sales (if exists)
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables 
                     WHERE table_schema = DATABASE() 
                     AND table_name = 'daily_sales');
SET @sql = IF(@table_exists > 0,
  'UPDATE daily_sales SET store_id = 1 WHERE store_id IS NULL',
  'SELECT "Skipping daily_sales update" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update tomorrow_ai_daily_sales
UPDATE tomorrow_ai_daily_sales SET store_id = 1 WHERE store_id IS NULL;

-- Update tomorrow_ai_predictions
UPDATE tomorrow_ai_predictions SET store_id = 1 WHERE store_id IS NULL;

-- ============================================
-- STEP 12: Add composite indexes for performance
-- ============================================

-- Products: store_id + is_active
ALTER TABLE products ADD INDEX idx_store_active (store_id, is_active);

-- Credit notes: store_id + date
ALTER TABLE credit_notes ADD INDEX idx_store_date (store_id, date);

-- Returns: store_id + return_date
ALTER TABLE returns ADD INDEX idx_store_return_date (store_id, return_date);

-- Invoices: store_id + invoice_date
ALTER TABLE invoices ADD INDEX idx_store_invoice_date (store_id, invoice_date);

-- Stock batches: store_id + expiry_date
ALTER TABLE stock_batches ADD INDEX idx_store_expiry (store_id, expiry_date);

-- Tomorrow AI daily sales: store_id + sale_date
ALTER TABLE tomorrow_ai_daily_sales ADD INDEX idx_store_sale_date (store_id, sale_date);

-- ============================================
-- Migration Complete
-- ============================================

SELECT 'Multi-tenancy migration completed successfully!' AS message;
SELECT COUNT(*) AS total_stores FROM stores;
SELECT COUNT(*) AS users_updated FROM users WHERE store_id = 1;
SELECT COUNT(*) AS products_updated FROM products WHERE store_id = 1;
