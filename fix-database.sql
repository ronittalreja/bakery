-- Fix database schema issues
-- Run these commands in your MySQL client

-- Add missing columns to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_date DATE NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS store VARCHAR(255) NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS file_reference VARCHAR(255) NULL;

-- Add missing columns to invoice_items table
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS sl_no INT NOT NULL DEFAULT 1;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS item_code VARCHAR(50) NULL;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50) NULL;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS qty INT NOT NULL DEFAULT 1;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS uom VARCHAR(20) NULL;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS rate DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Rename columns in invoice_items table (if they exist)
ALTER TABLE invoice_items CHANGE COLUMN product_name item_name VARCHAR(255) NOT NULL;
ALTER TABLE invoice_items CHANGE COLUMN quantity qty INT NOT NULL DEFAULT 1;
ALTER TABLE invoice_items CHANGE COLUMN unit_price rate DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE invoice_items CHANGE COLUMN total_price total DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Fix sale_items table
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS item_type VARCHAR(50) NOT NULL DEFAULT 'product';
ALTER TABLE sale_items CHANGE COLUMN product_id item_id VARCHAR(50) NOT NULL;

-- Add missing column to returns table
ALTER TABLE returns ADD COLUMN IF NOT EXISTS rtd DECIMAL(10,2) DEFAULT 0;

-- Show final table structures
DESCRIBE invoices;
DESCRIBE invoice_items;
DESCRIBE sale_items;
DESCRIBE returns;
