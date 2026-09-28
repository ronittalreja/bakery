-- Tomorrow AI Database Schema
-- Separate tables for demand forecasting system
-- These tables do not modify existing invoice/CRDR tables

-- Product Master Table
-- Stores all products with classification for ML forecasting
CREATE TABLE IF NOT EXISTS tomorrow_ai_product_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(50) UNIQUE NOT NULL COMMENT 'Original product ID from products table',
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  size VARCHAR(50),
  variant VARCHAR(100),
  price DECIMAL(10, 2),
  item_type ENUM('DISPLAY', 'SPECIAL_ORDER', 'PACKING_MATERIAL', 'OTHER') DEFAULT 'OTHER',
  ml_group_id VARCHAR(50) NOT NULL COMMENT 'ML group ID for forecasting - groups similar products across SKU changes',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ml_group (ml_group_id),
  INDEX idx_item_type (item_type),
  INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Product Aliases Table
-- Maps historical item codes to current products for ML group normalization
CREATE TABLE IF NOT EXISTS tomorrow_ai_product_aliases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(50) NOT NULL COMMENT 'Current product ID from product_master',
  historical_item_code VARCHAR(50) NOT NULL COMMENT 'Historical item code from invoices',
  historical_name VARCHAR(255),
  effective_from DATE COMMENT 'Date when this alias was valid',
  effective_to DATE COMMENT 'Date when this alias stopped being valid',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES tomorrow_ai_product_master(product_id) ON DELETE CASCADE,
  INDEX idx_historical_code (historical_item_code),
  INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Events Calendar Table
-- Stores events/festivals with actual dates per year
CREATE TABLE IF NOT EXISTS tomorrow_ai_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_name VARCHAR(100) NOT NULL,
  event_type ENUM('FESTIVAL', 'HOLIDAY', 'SPECIAL_DAY', 'OTHER') DEFAULT 'OTHER',
  event_date DATE NOT NULL,
  year INT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_event_year (event_name, year),
  INDEX idx_event_date (event_date),
  INDEX idx_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Daily Sales Data Table
-- Normalized daily sales data for ML training
-- This is populated from invoice/CRDR data via pipeline
CREATE TABLE IF NOT EXISTS tomorrow_ai_daily_sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_date DATE NOT NULL,
  ml_group_id VARCHAR(50) NOT NULL,
  actual_sales INT DEFAULT 0 COMMENT 'Actual quantity sold (excluding special orders)',
  is_shop_open BOOLEAN DEFAULT TRUE COMMENT 'Was the shop open on this day',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_date_group (sale_date, ml_group_id),
  INDEX idx_sale_date (sale_date),
  INDEX idx_ml_group (ml_group_id),
  FOREIGN KEY (ml_group_id) REFERENCES tomorrow_ai_product_master(ml_group_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tomorrow AI Predictions Table
-- Stores model predictions for tracking and comparison
CREATE TABLE IF NOT EXISTS tomorrow_ai_predictions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prediction_date DATE NOT NULL COMMENT 'The date being predicted',
  product_id VARCHAR(50) NOT NULL COMMENT 'Product being predicted',
  ml_group_id VARCHAR(50) NOT NULL,
  predicted_demand INT NOT NULL COMMENT 'ML model prediction',
  recommended_order INT NOT NULL COMMENT 'Recommended order quantity (may include safety buffer)',
  model_version VARCHAR(50) DEFAULT 'v1.0',
  prediction_generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actual_sales INT DEFAULT NULL COMMENT 'Filled later when actual sales are known for comparison',
  FOREIGN KEY (product_id) REFERENCES tomorrow_ai_product_master(product_id) ON DELETE CASCADE,
  INDEX idx_prediction_date (prediction_date),
  INDEX idx_ml_group (ml_group_id),
  INDEX idx_generated_at (prediction_generated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data Sync Log Table
-- Tracks when invoice/CRDR data was synced to Tomorrow AI tables
CREATE TABLE IF NOT EXISTS tomorrow_ai_sync_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sync_date DATE NOT NULL,
  sync_type ENUM('FULL', 'INCREMENTAL') DEFAULT 'INCREMENTAL',
  records_processed INT DEFAULT 0,
  status ENUM('SUCCESS', 'FAILED', 'PARTIAL') DEFAULT 'SUCCESS',
  error_message TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  INDEX idx_sync_date (sync_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
