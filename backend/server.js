// File: backend/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const db = require('./config/database');
const { creditNoteUpload } = require('./utils/cloudinary');
const { demoModeMiddleware } = require('./middleware/demoMode');

dotenv.config();

const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'https://bakery-phi-two.vercel.app', // Your actual Vercel domain
  'https://bakery-git-main-talrejaronit13-gmailcoms-projects.vercel.app', // Your Vercel project domain
  'https://monginis-frontend.vercel.app', // Placeholder
  'https://r3309.vercel.app', // Current Vercel domain
  process.env.FRONTEND_URL // Allow custom frontend URL
].filter(Boolean);

app.use(cors({ 
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Log the origin for debugging
    console.log('CORS request from origin:', origin);
    
    // Allow all Vercel domains (more permissive)
    if (origin.includes('vercel.app') || origin.includes('localhost')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined')); // Logger for all requests

// Auth middleware
const authMiddleware = (roles = []) => async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    console.error('No token provided:', req.method, req.url);
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    
    // Map old roles to new multi-tenant roles
    const roleMapping = {
      'staff': 'store_manager',
      'admin': 'super_admin'
    };
    const mappedRole = roleMapping[decoded.role] || decoded.role;
    
    // If store_id is missing from token, fetch it from database
    if (!decoded.store_id && decoded.id) {
      try {
        const [users] = await db.execute('SELECT store_id FROM users WHERE id = ?', [decoded.id]);
        if (users.length > 0) {
          decoded.store_id = users[0].store_id;
        }
      } catch (err) {
        console.error('Error fetching store_id from database:', err);
      }
    }
    
    // Check if user has required role (or is super_admin)
    if (roles.length && !roles.includes(mappedRole) && !roles.includes(decoded.role) && mappedRole !== 'super_admin' && !decoded.isDemo) {
      console.error('Forbidden: Invalid role:', decoded.role, '(mapped:', mappedRole, ')', req.method, req.url);
      return res.status(403).json({ error: 'Forbidden: Invalid role' });
    }
    
    req.user = { ...decoded, mappedRole };
    // Apply demo mode middleware
    demoModeMiddleware(req, res, next);
  } catch (error) {
    console.error('Auth middleware error:', error.message, req.method, req.url);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/stores', require('./routes/stores'));
app.use('/api/invoices', authMiddleware(['store_manager', 'staff', 'admin', 'super_admin']), require('./routes/invoices'));
app.use('/api/credit-notes', authMiddleware(['store_manager', 'staff', 'admin', 'super_admin']), require('./routes/creditNotes'));
app.use('/api/stock', authMiddleware(['store_manager', 'staff', 'admin', 'super_admin']), require('./routes/stock'));
app.use('/api/sales', authMiddleware(['store_manager', 'staff', 'admin', 'super_admin']), require('./routes/sales'));
app.use('/api/add-sales', authMiddleware(['store_manager', 'staff', 'admin', 'super_admin']), require('./routes/add-sales'));
app.use('/api/returns', authMiddleware(['store_manager', 'staff', 'admin', 'super_admin']), require('./routes/returns'));
app.use('/api/decorations', authMiddleware(['store_manager', 'staff', 'admin', 'super_admin']), require('./routes/decorations'));
app.use('/api/expenses', authMiddleware(['store_manager', 'staff', 'admin', 'super_admin']), require('./routes/expenses'));
app.use('/api/reports', authMiddleware(['super_admin', 'admin']), require('./routes/reports'));
app.use('/api/ros-receipts', authMiddleware(['store_manager', 'staff', 'admin', 'super_admin']), require('./routes/rosReceipts'));
app.use('/api/insights', authMiddleware(['store_manager', 'staff', 'admin', 'super_admin']), require('./routes/insights'));
app.use('/api/tomorrow-ai/products', authMiddleware(['super_admin', 'admin', 'store_manager', 'staff']), require('./routes/tomorrowAIProducts'));
app.use('/api/tomorrow-ai', authMiddleware(['super_admin', 'admin', 'store_manager', 'staff']), require('./routes/tomorrowAI'));
app.use('/api/tomorrow-ai/features', authMiddleware(['super_admin', 'admin', 'store_manager', 'staff']), require('./routes/tomorrowAIFeatures'));
app.use('/api/tomorrow-ai/model', authMiddleware(['super_admin', 'admin', 'store_manager', 'staff']), require('./routes/tomorrowAIModel'));
app.use('/api/tomorrow-ai/events', authMiddleware(['super_admin', 'admin', 'store_manager', 'staff']), require('./routes/tomorrowAIEvents'));
app.use('/api/products', authMiddleware(['store_manager', 'staff', 'admin', 'super_admin']), require('./routes/products'));
app.use('/api/analytics', authMiddleware(['super_admin', 'admin', 'store_manager']), require('./routes/analytics'));

// Daily sync job - runs automatically
// Uncomment to enable automatic daily sync
// const { dailySyncJob } = require('./jobs/dailySyncJob');
// setInterval(dailySyncJob, 24 * 60 * 60 * 1000); // Run every 24 hours
// dailySyncJob(); // Run once on startup

// Migration endpoint
app.post('/api/migrate', async (req, res) => {
  try {
    console.log('🚀 Starting complete database migration...');
    
    const mysql = require('mysql2/promise');
    let connection;
    
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false
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

    // Insert default users (password is 'admin123', 'staff123', and 'demo123' hashed)
    await connection.execute(`
      INSERT INTO users (username, password, role) VALUES 
      ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
      ('R3309', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff'),
      ('demo', '$2a$10$t8.p/6qXM0Vfa8FHOT6kNenLFU15RJ1IQYyjZ7qBr.ChR774v/UnC', 'staff')
      ON DUPLICATE KEY UPDATE 
      password = VALUES(password),
      role = VALUES(role)
    `);
    console.log('✅ Inserted default users');

    // Create stores table
    await connection.execute(`
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
    `);
    console.log('✅ Created stores table');

    // Insert initial store
    await connection.execute(`
      INSERT INTO stores (store_code, store_name, city, status)
      VALUES ('R3309', 'R3309 Bakery', 'Mumbai', 'active')
      ON DUPLICATE KEY UPDATE store_name = 'R3309 Bakery'
    `);
    console.log('✅ Inserted initial store');

    // Add store_id column to users if not exists
    try {
      await connection.execute(`ALTER TABLE users ADD COLUMN store_id INT NULL AFTER id`);
      await connection.execute(`ALTER TABLE users ADD INDEX idx_store_id (store_id)`);
      console.log('✅ Added store_id column to users table');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('✅ store_id column already exists in users table');
      }
    }

    // Add role column to users if not exists
    try {
      await connection.execute(`ALTER TABLE users ADD COLUMN role ENUM('store_manager', 'area_manager', 'regional_manager', 'super_admin') DEFAULT 'store_manager' AFTER username`);
      await connection.execute(`ALTER TABLE users ADD INDEX idx_role (role)`);
      console.log('✅ Added role column to users table');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('✅ role column already exists in users table');
      }
    }

    // Update existing users with store_id
    await connection.execute(`UPDATE users SET store_id = 1 WHERE store_id IS NULL`);
    console.log('✅ Updated existing users with store_id');

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
        invoice_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        sale_price DECIMAL(10,2) NOT NULL DEFAULT 0,
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
        product_id VARCHAR(50) NOT NULL,
        batch_id INT,
        quantity INT NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Created sale_items table');

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
        staff_id INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Created returns table');

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
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NULL,
        customer_phone VARCHAR(20) NULL,
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        status ENUM('pending', 'cleared') NOT NULL DEFAULT 'pending',
        notes TEXT NULL,
        created_by INT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created invoices table');

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

    await connection.end();
    
    res.json({ 
      success: true, 
      message: 'Complete migration completed successfully! All 12 tables created.',
      tables: [
        'users', 'products', 'stock_batches', 'sales', 'sale_items', 'returns',
        'decorations', 'expenses', 'invoices', 'invoice_items', 'credit_notes', 'ros_receipts'
      ]
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Fix passwords endpoint
app.post('/api/fix-passwords', async (req, res) => {
  try {
    console.log('🔧 Fixing user passwords...');
    
    const mysql = require('mysql2/promise');
    const bcrypt = require('bcryptjs');
    let connection;
    
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false
    });

    console.log('✅ Connected to database');

    // Hash the correct passwords
    const adminPassword = await bcrypt.hash('admin123', 10);
    const staffPassword = await bcrypt.hash('123456', 10);

    // Update admin password
    await connection.execute(
      'UPDATE users SET password = ? WHERE username = ?',
      [adminPassword, 'admin']
    );
    console.log('✅ Updated admin password');

    // Update staff password
    await connection.execute(
      'UPDATE users SET password = ? WHERE username = ?',
      [staffPassword, 'R3309']
    );
    console.log('✅ Updated staff password');

    await connection.end();
    
    res.json({ 
      success: true, 
      message: 'Passwords fixed successfully!',
      credentials: {
        admin: 'admin / admin123',
        staff: 'R3309 / 123456'
      }
    });
    
  } catch (error) {
    console.error('❌ Password fix failed:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Clear all data endpoint
app.post('/api/clear-all-data', async (req, res) => {
  try {
    console.log('🧹 Clearing all data from database...');
    
    const mysql = require('mysql2/promise');
    let connection;
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false
    });

    console.log('✅ Connected to database');

    // Clear all data tables (keep users)
    const tablesToClear = [
      'sales', 'sale_items', 'products', 'stock_batches', 'returns',
      'decorations', 'expenses', 'invoices', 'invoice_items', 
      'credit_notes', 'ros_receipts'
    ];

    for (const table of tablesToClear) {
      await connection.execute(`DELETE FROM ${table}`);
      console.log(`✅ Cleared ${table} table`);
    }

    await connection.end();
    
    res.json({ 
      success: true, 
      message: 'All data cleared successfully! Database is now empty.',
      clearedTables: tablesToClear
    });
    
  } catch (error) {
    console.error('❌ Clear data failed:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Debug endpoint to check users
app.get('/api/debug-users', async (req, res) => {
  try {
    const mysql = require('mysql2/promise');
    let connection;
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false
    });

    const [rows] = await connection.execute('SELECT username, role FROM users');
    await connection.end();
    
    res.json({ 
      success: true, 
      users: rows 
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Debug endpoint to check invoices table structure
app.get('/api/debug-invoices-table', async (req, res) => {
  try {
    const mysql = require('mysql2/promise');
    let connection;
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    const [rows] = await connection.execute('DESCRIBE invoices');
    await connection.end();
    
    res.json({ 
      success: true, 
      columns: rows 
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Manual ALTER TABLE for invoices
app.post('/api/fix-invoices-table', async (req, res) => {
  try {
    const mysql = require('mysql2/promise');
    let connection;
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    // Add missing columns
    await connection.execute('ALTER TABLE invoices ADD COLUMN invoice_date DATE NULL');
    console.log('✅ Added invoice_date column');
    
    await connection.execute('ALTER TABLE invoices ADD COLUMN store VARCHAR(255) NULL');
    console.log('✅ Added store column');
    
    await connection.execute('ALTER TABLE invoices ADD COLUMN file_reference VARCHAR(255) NULL');
    console.log('✅ Added file_reference column');
    
    await connection.end();
    
    res.json({ 
      success: true, 
      message: 'All missing columns added to invoices table' 
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Manual ALTER TABLE for invoice_items
app.post('/api/fix-invoice-items-table', async (req, res) => {
  try {
    const mysql = require('mysql2/promise');
    let connection;
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    // Add missing columns
    await connection.execute('ALTER TABLE invoice_items ADD COLUMN sl_no INT NOT NULL DEFAULT 1');
    console.log('✅ Added sl_no column');
    
    await connection.execute('ALTER TABLE invoice_items ADD COLUMN item_code VARCHAR(50) NULL');
    console.log('✅ Added item_code column');
    
    await connection.execute('ALTER TABLE invoice_items ADD COLUMN hsn_code VARCHAR(50) NULL');
    console.log('✅ Added hsn_code column');
    
    await connection.execute('ALTER TABLE invoice_items ADD COLUMN qty INT NOT NULL DEFAULT 1');
    console.log('✅ Added qty column');
    
    await connection.execute('ALTER TABLE invoice_items ADD COLUMN uom VARCHAR(20) NULL');
    console.log('✅ Added uom column');
    
    await connection.execute('ALTER TABLE invoice_items ADD COLUMN rate DECIMAL(10,2) NOT NULL DEFAULT 0');
    console.log('✅ Added rate column');
    
    await connection.end();
    
    res.json({ 
      success: true, 
      message: 'All missing columns added to invoice_items table' 
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Direct fix for invoice_items table - run immediately
app.post('/api/fix-invoice-items-direct', async (req, res) => {
  try {
    const mysql = require('mysql2/promise');
    let connection;
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    console.log('🔧 Starting direct fix for invoice_items table...');
    
    // Check current table structure
    const [currentColumns] = await connection.execute('DESCRIBE invoice_items');
    console.log('Current columns:', currentColumns.map(col => col.Field));
    
    // Add missing columns one by one
    const columnsToAdd = [
      { name: 'sl_no', sql: 'ALTER TABLE invoice_items ADD COLUMN sl_no INT NOT NULL DEFAULT 1' },
      { name: 'item_code', sql: 'ALTER TABLE invoice_items ADD COLUMN item_code VARCHAR(50) NULL' },
      { name: 'hsn_code', sql: 'ALTER TABLE invoice_items ADD COLUMN hsn_code VARCHAR(50) NULL' },
      { name: 'qty', sql: 'ALTER TABLE invoice_items ADD COLUMN qty INT NOT NULL DEFAULT 1' },
      { name: 'uom', sql: 'ALTER TABLE invoice_items ADD COLUMN uom VARCHAR(20) NULL' },
      { name: 'rate', sql: 'ALTER TABLE invoice_items ADD COLUMN rate DECIMAL(10,2) NOT NULL DEFAULT 0' }
    ];
    
    for (const column of columnsToAdd) {
      try {
        await connection.execute(column.sql);
        console.log(`✅ Added ${column.name} column`);
      } catch (error) {
        if (error.message.includes('Duplicate column name')) {
          console.log(`ℹ️ ${column.name} column already exists`);
        } else {
          console.log(`❌ Error adding ${column.name}:`, error.message);
        }
      }
    }
    
    // Rename existing columns
    try {
      await connection.execute('ALTER TABLE invoice_items CHANGE COLUMN product_name item_name VARCHAR(255) NOT NULL');
      console.log('✅ Renamed product_name to item_name');
    } catch (error) {
      console.log('ℹ️ product_name rename:', error.message);
    }
    
    try {
      await connection.execute('ALTER TABLE invoice_items CHANGE COLUMN quantity qty INT NOT NULL DEFAULT 1');
      console.log('✅ Renamed quantity to qty');
    } catch (error) {
      console.log('ℹ️ quantity rename:', error.message);
    }
    
    try {
      await connection.execute('ALTER TABLE invoice_items CHANGE COLUMN unit_price rate DECIMAL(10,2) NOT NULL DEFAULT 0');
      console.log('✅ Renamed unit_price to rate');
    } catch (error) {
      console.log('ℹ️ unit_price rename:', error.message);
    }
    
    try {
      await connection.execute('ALTER TABLE invoice_items CHANGE COLUMN total_price total DECIMAL(10,2) NOT NULL DEFAULT 0');
      console.log('✅ Renamed total_price to total');
    } catch (error) {
      console.log('ℹ️ total_price rename:', error.message);
    }
    
    // Check final table structure
    const [finalColumns] = await connection.execute('DESCRIBE invoice_items');
    console.log('Final columns:', finalColumns.map(col => col.Field));
    
    await connection.end();
    
    res.json({ 
      success: true, 
      message: 'Direct fix completed for invoice_items table',
      columns: finalColumns.map(col => col.Field)
    });
    
  } catch (error) {
    console.error('Direct fix error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Direct fix for sale_items table
app.post('/api/fix-sale-items-direct', async (req, res) => {
  try {
    const mysql = require('mysql2/promise');
    let connection;
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    console.log('🔧 Starting direct fix for sale_items table...');
    
    // Check current table structure
    const [currentColumns] = await connection.execute('DESCRIBE sale_items');
    console.log('Current columns:', currentColumns.map(col => col.Field));
    
    // Add missing columns
    try {
      await connection.execute('ALTER TABLE sale_items ADD COLUMN item_type VARCHAR(50) NOT NULL DEFAULT "product"');
      console.log('✅ Added item_type column');
    } catch (error) {
      console.log('ℹ️ item_type column:', error.message);
    }
    
    // Rename product_id to item_id
    try {
      await connection.execute('ALTER TABLE sale_items CHANGE COLUMN product_id item_id VARCHAR(50) NOT NULL');
      console.log('✅ Renamed product_id to item_id');
    } catch (error) {
      console.log('ℹ️ product_id rename:', error.message);
    }
    
    // Check final table structure
    const [finalColumns] = await connection.execute('DESCRIBE sale_items');
    console.log('Final columns:', finalColumns.map(col => col.Field));
    
    await connection.end();
    
    res.json({ 
      success: true, 
      message: 'Direct fix completed for sale_items table',
      columns: finalColumns.map(col => col.Field)
    });
    
  } catch (error) {
    console.error('Direct fix error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Add missing item_type column to sale_items
app.post('/api/add-item-type-column', async (req, res) => {
  try {
    const mysql = require('mysql2/promise');
    let connection;
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    // Add missing column
    try {
      await connection.execute('ALTER TABLE sale_items ADD COLUMN item_type VARCHAR(50) NOT NULL DEFAULT "product"');
      console.log('✅ Added item_type column');
    } catch (error) {
      console.log('ℹ️ item_type column:', error.message);
    }
    
    await connection.end();
    
    res.json({ 
      success: true, 
      message: 'item_type column added successfully' 
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Update tomorrow_ai_events event_type ENUM to include fixed and dynamic
app.post('/api/update-event-type-enum', async (req, res) => {
  try {
    const mysql = require('mysql2/promise');
    let connection;
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    console.log('🔧 Updating tomorrow_ai_events event_type ENUM...');
    
    // MySQL doesn't support ALTER ENUM directly, need to modify the column
    try {
      await connection.execute(`
        ALTER TABLE tomorrow_ai_events 
        MODIFY COLUMN event_type ENUM('FESTIVAL', 'HOLIDAY', 'SPECIAL_DAY', 'OTHER', 'fixed', 'dynamic') 
        DEFAULT 'OTHER'
      `);
      console.log('✅ Updated event_type ENUM to include fixed and dynamic');
    } catch (error) {
      console.log('ℹ️ event_type ENUM update:', error.message);
    }
    
    await connection.end();
    
    res.json({ 
      success: true, 
      message: 'event_type ENUM updated successfully' 
    });
    
  } catch (error) {
    console.error('Error updating event_type ENUM:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Update tomorrow_ai_events unique constraint to allow multiple dates per event
app.post('/api/update-event-unique-constraint', async (req, res) => {
  try {
    const mysql = require('mysql2/promise');
    let connection;
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    console.log('🔧 Updating tomorrow_ai_events unique constraint...');
    
    try {
      // Drop old unique constraint
      await connection.execute(`
        ALTER TABLE tomorrow_ai_events 
        DROP INDEX unique_event_year
      `);
      console.log('✅ Dropped old unique_event_year constraint');
    } catch (error) {
      console.log('ℹ️ Dropping old constraint:', error.message);
    }
    
    try {
      // Add new unique constraint that includes event_date
      await connection.execute(`
        ALTER TABLE tomorrow_ai_events 
        ADD UNIQUE KEY unique_event_date (event_name, event_date, year, store_id)
      `);
      console.log('✅ Added new unique_event_date constraint');
    } catch (error) {
      console.log('ℹ️ Adding new constraint:', error.message);
    }
    
    await connection.end();
    
    res.json({ 
      success: true, 
      message: 'Unique constraint updated successfully' 
    });
    
  } catch (error) {
    console.error('Error updating unique constraint:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Execute raw SQL
app.post('/api/execute-sql', async (req, res) => {
  try {
    const mysql = require('mysql2/promise');
    let connection;
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    const { sql } = req.body;
    console.log('🔧 Executing SQL:', sql);
    
    const [result] = await connection.execute(sql);
    console.log('✅ SQL executed successfully');
    
    await connection.end();
    
    res.json({ 
      success: true, 
      message: 'SQL executed successfully',
      result: result
    });
    
  } catch (error) {
    console.error('SQL execution error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Quick fix endpoint to create stock_adjustments table
app.post('/api/fix-stock-adjustments-table', async (req, res) => {
  try {
    const mysql = require('mysql2/promise');
    let connection;
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS stock_adjustments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        batch_id INT NOT NULL,
        old_quantity INT NOT NULL,
        new_quantity INT NOT NULL,
        reason VARCHAR(255),
        staff_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES stock_batches(id) ON DELETE CASCADE,
        FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    await connection.end();
    
    res.json({ success: true, message: 'stock_adjustments table created successfully' });
  } catch (error) {
    console.error('Create stock_adjustments table error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Populate Tomorrow AI product master
app.post('/api/populate-tomorrow-ai-products', async (req, res) => {
  try {
    const mysql = require('mysql2/promise');
    let connection;
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    console.log('🔧 Populating Tomorrow AI product master...');
    
    // Fetch all existing products
    const [products] = await connection.execute(`
      SELECT 
        id as product_id,
        name,
        category,
        sale_price as price,
        item_code
      FROM products
      WHERE is_active = 1
    `);
    
    console.log(`Found ${products.length} active products`);
    
    let inserted = 0;
    
    for (const product of products) {
      // Determine item_type
      const nameLower = product.name.toLowerCase();
      const categoryLower = product.category ? product.category.toLowerCase() : '';
      
      let itemType = 'DISPLAY';
      if (nameLower.includes('box') || nameLower.includes('packing') || nameLower.includes('wrap') || categoryLower.includes('packing')) {
        itemType = 'PACKING_MATERIAL';
      } else if (nameLower.includes('custom') || nameLower.includes('special') || nameLower.includes('order')) {
        itemType = 'SPECIAL_ORDER';
      }
      
      // Generate ml_group_id
      const mlGroupId = product.name.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 50);
      
      // Insert or update
      await connection.execute(`
        INSERT INTO tomorrow_ai_product_master 
        (product_id, name, category, price, item_type, ml_group_id, active)
        VALUES (?, ?, ?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        category = VALUES(category),
        price = VALUES(price),
        item_type = VALUES(item_type),
        ml_group_id = VALUES(ml_group_id),
        updated_at = CURRENT_TIMESTAMP
      `, [
        product.product_id,
        product.name,
        product.category,
        product.price,
        itemType,
        mlGroupId
      ]);
      
      // Add alias if item_code exists
      if (product.item_code) {
        await connection.execute(`
          INSERT INTO tomorrow_ai_product_aliases 
          (product_id, historical_item_code, historical_name)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
          historical_name = VALUES(historical_name)
        `, [
          product.product_id,
          product.item_code,
          product.name
        ]);
      }
      
      inserted++;
    }
    
    await connection.end();
    
    console.log(`✓ Product master populated: ${inserted} products`);
    
    res.json({ success: true, message: `Product master populated: ${inserted} products` });
  } catch (error) {
    console.error('Populate product master error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Populate Tomorrow AI events with date rules
app.post('/api/populate-tomorrow-ai-events', async (req, res) => {
  try {
    const mysql = require('mysql2/promise');
    let connection;
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    console.log('🔧 Populating Tomorrow AI events with date rules...');
    
    // Helper function to get nth weekday of month
    function getNthWeekdayOfMonth(year, month, weekday, n) {
      const date = new Date(year, month - 1, 1);
      let count = 0;
      while (date.getMonth() === month - 1) {
        if (date.getDay() === weekday) {
          count++;
          if (count === n) return date;
        }
        date.setDate(date.getDate() + 1);
      }
      return null;
    }
    
    // Helper function to get last weekday of month
    function getLastWeekdayOfMonth(year, month, weekday) {
      const date = new Date(year, month, 0);
      while (date.getDay() !== weekday) {
        date.setDate(date.getDate() - 1);
      }
      return date;
    }
    
    // Event definitions with date rules
    const eventRules = [
      // Fixed date events
      { event_name: 'New Year', event_type: 'HOLIDAY', date_rule: 'fixed', month: 1, day: 1, description: 'New Year Day' },
      { event_name: 'Republic Day', event_type: 'HOLIDAY', date_rule: 'fixed', month: 1, day: 26, description: 'Republic Day of India' },
      { event_name: 'Valentine Day', event_type: 'SPECIAL_DAY', date_rule: 'fixed', month: 2, day: 14, description: 'Valentine Day' },
      { event_name: 'Gandhi Jayanti', event_type: 'HOLIDAY', date_rule: 'fixed', month: 10, day: 2, description: 'Gandhi Jayanti' },
      { event_name: 'Independence Day', event_type: 'HOLIDAY', date_rule: 'fixed', month: 8, day: 15, description: 'Independence Day of India' },
      { event_name: 'Children Day', event_type: 'SPECIAL_DAY', date_rule: 'fixed', month: 11, day: 14, description: 'Children Day' },

      { event_name: 'New Year Eve', event_type: 'SPECIAL_DAY', date_rule: 'fixed', month: 12, day: 31, description: 'New Year Eve' },
      
      // Nth weekday events
      { event_name: 'Mother Day', event_type: 'SPECIAL_DAY', date_rule: 'nth_weekday', month: 5, weekday: 0, n: 2, description: 'Mother Day (2nd Sunday of May)' },
      { event_name: 'Father Day', event_type: 'SPECIAL_DAY', date_rule: 'nth_weekday', month: 6, weekday: 0, n: 3, description: 'Father Day (3rd Sunday of June)' },
      { event_name: 'Friendship Day', event_type: 'SPECIAL_DAY', date_rule: 'nth_weekday', month: 8, weekday: 0, n: 1, description: 'Friendship Day (1st Sunday of August)' },
      
      // Moving festivals (manual dates for now - should use API)
      { event_name: 'Holi', event_type: 'FESTIVAL', date_rule: 'manual', description: 'Holi Festival of Colors' },
      { event_name: 'Good Friday', event_type: 'HOLIDAY', date_rule: 'manual', description: 'Good Friday' },
      { event_name: 'Easter Sunday', event_type: 'SPECIAL_DAY', date_rule: 'manual', description: 'Easter Sunday' },
      { event_name: 'Eid ul-Fitr', event_type: 'FESTIVAL', date_rule: 'manual', description: 'Eid ul-Fitr' },
      { event_name: 'Buddha Purnima', event_type: 'FESTIVAL', date_rule: 'manual', description: 'Buddha Purnima' },
      { event_name: 'Eid al-Adha', event_type: 'FESTIVAL', date_rule: 'manual', description: 'Eid al-Adha' },
      { event_name: 'Raksha Bandhan', event_type: 'FESTIVAL', date_rule: 'manual', description: 'Raksha Bandhan' },
      { event_name: 'Janmashtami', event_type: 'FESTIVAL', date_rule: 'manual', description: 'Janmashtami' },
      { event_name: 'Ganesh Chaturthi', event_type: 'FESTIVAL', date_rule: 'manual', description: 'Ganesh Chaturthi' },
      { event_name: 'Onam', event_type: 'FESTIVAL', date_rule: 'manual', description: 'Onam Festival' },
      { event_name: 'Dussehra', event_type: 'FESTIVAL', date_rule: 'manual', description: 'Dussehra' },
      { event_name: 'Diwali', event_type: 'FESTIVAL', date_rule: 'manual', description: 'Diwali Festival of Lights' },
      { event_name: 'Govardhan Puja', event_type: 'FESTIVAL', date_rule: 'manual', description: 'Govardhan Puja' },
      { event_name: 'Bhai Dooj', event_type: 'FESTIVAL', date_rule: 'manual', description: 'Bhai Dooj' },
    ];
    
    // Manual dates for moving festivals (2024-2028)
    const manualDates = {
      'Holi': {
        2024: '2024-03-25',
        2025: '2025-03-14',
        2026: '2026-03-04',
        2027: '2027-02-24',
        2028: '2028-03-14',
      },
      'Good Friday': {
        2024: '2024-03-29',
        2025: '2025-04-18',
        2026: '2026-04-03',
        2027: '2027-03-26',
        2028: '2028-04-14',
      },
      'Easter Sunday': {
        2024: '2024-03-31',
        2025: '2025-04-20',
        2026: '2026-04-05',
        2027: '2027-03-28',
        2028: '2028-04-16',
      },
      'Eid ul-Fitr': {
        2024: '2024-04-11',
        2025: '2025-03-30',
        2026: '2026-03-20',
        2027: '2027-03-09',
        2028: '2028-02-28',
      },
      'Buddha Purnima': {
        2024: '2024-05-23',
        2025: '2025-05-12',
        2026: '2026-05-12',
        2027: '2027-05-02',
        2028: '2028-05-21',
      },
      'Eid al-Adha': {
        2024: '2024-06-17',
        2025: '2025-06-06',
        2026: '2026-05-27',
        2027: '2027-05-17',
        2028: '2028-06-06',
      },
      'Raksha Bandhan': {
        2024: '2024-08-19',
        2025: '2025-08-09',
        2026: '2026-08-29',
        2027: '2027-08-18',
        2028: '2028-08-07',
      },
      'Janmashtami': {
        2024: '2024-08-26',
        2025: '2025-08-16',
        2026: '2026-08-05',
        2027: '2027-08-25',
        2028: '2028-08-14',
      },
      'Ganesh Chaturthi': {
        2024: '2024-09-07',
        2025: '2025-08-27',
        2026: '2026-09-16',
        2027: '2027-09-05',
        2028: '2028-08-23',
      },
      'Onam': {
        2024: '2024-09-15',
        2025: '2025-09-05',
        2026: '2026-09-14',
        2027: '2027-09-03',
        2028: '2028-08-22',
      },
      'Dussehra': {
        2024: '2024-10-12',
        2025: '2025-10-02',
        2026: '2026-10-21',
        2027: '2027-10-10',
        2028: '2028-09-29',
      },
      'Diwali': {
        2024: '2024-10-31',
        2025: '2025-10-20',
        2026: '2026-11-08',
        2027: '2027-10-29',
        2028: '2028-10-17',
      },
      'Govardhan Puja': {
        2024: '2024-11-02',
        2025: '2025-10-21',
        2026: '2026-11-09',
        2027: '2027-10-31',
        2028: '2028-10-18',
      },
      'Bhai Dooj': {
        2024: '2024-11-03',
        2025: '2025-10-22',
        2026: '2026-11-10',
        2027: '2027-11-01',
        2028: '2028-10-19',
      },
    };
    
    const years = [2024, 2025, 2026, 2027, 2028];
    let inserted = 0;
    
    for (const rule of eventRules) {
      for (const year of years) {
        let eventDate;
        
        if (rule.date_rule === 'fixed') {
          eventDate = `${year}-${String(rule.month).padStart(2, '0')}-${String(rule.day).padStart(2, '0')}`;
        } else if (rule.date_rule === 'nth_weekday') {
          const date = getNthWeekdayOfMonth(year, rule.month, rule.weekday, rule.n);
          if (date) {
            eventDate = date.toISOString().split('T')[0];
          }
        } else if (rule.date_rule === 'manual') {
          eventDate = manualDates[rule.event_name]?.[year];
        }
        
        if (eventDate) {
          await connection.execute(`
            INSERT INTO tomorrow_ai_events
            (event_name, event_type, event_date, year, description, status)
            VALUES (?, ?, ?, ?, ?, 'approved')
            ON DUPLICATE KEY UPDATE
            event_type = VALUES(event_type),
            description = VALUES(description),
            status = 'approved',
            updated_at = CURRENT_TIMESTAMP
          `, [
            rule.event_name,
            rule.event_type,
            eventDate,
            year,
            rule.description
          ]);
          inserted++;
        }
      }
    }
    
    await connection.end();
    
    console.log(`✓ Events populated: ${inserted} events`);
    
    res.json({ success: true, message: `Events populated: ${inserted} events` });
  } catch (error) {
    console.error('Populate events error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Setup Tomorrow AI tables
app.post('/api/setup-tomorrow-ai', async (req, res) => {
  try {
    const mysql = require('mysql2/promise');
    let connection;
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    console.log('🔧 Setting up Tomorrow AI tables...');
    
    // Create product_master table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tomorrow_ai_product_master (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        size VARCHAR(50),
        variant VARCHAR(100),
        price DECIMAL(10, 2),
        item_type ENUM('DISPLAY', 'SPECIAL_ORDER', 'PACKING_MATERIAL', 'OTHER') DEFAULT 'OTHER',
        ml_group_id VARCHAR(50) NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ml_group (ml_group_id),
        INDEX idx_item_type (item_type),
        INDEX idx_active (active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created tomorrow_ai_product_master table');
    
    // Create product_aliases table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tomorrow_ai_product_aliases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id VARCHAR(50) NOT NULL,
        historical_item_code VARCHAR(50) NOT NULL,
        historical_name VARCHAR(255),
        effective_from DATE,
        effective_to DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES tomorrow_ai_product_master(product_id) ON DELETE CASCADE,
        INDEX idx_historical_code (historical_item_code),
        INDEX idx_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created tomorrow_ai_product_aliases table');
    
    // Create events table
    await connection.execute(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created tomorrow_ai_events table');
    
    // Create daily_sales table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tomorrow_ai_daily_sales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sale_date DATE NOT NULL,
        ml_group_id VARCHAR(50) NOT NULL,
        actual_sales INT DEFAULT 0,
        is_shop_open BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_date_group (sale_date, ml_group_id),
        INDEX idx_sale_date (sale_date),
        INDEX idx_ml_group (ml_group_id),
        FOREIGN KEY (ml_group_id) REFERENCES tomorrow_ai_product_master(ml_group_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created tomorrow_ai_daily_sales table');
    
    // Create predictions table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tomorrow_ai_predictions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        prediction_date DATE NOT NULL,
        product_id VARCHAR(50) NOT NULL,
        ml_group_id VARCHAR(50) NOT NULL,
        predicted_demand INT NOT NULL,
        recommended_order INT NOT NULL,
        model_version VARCHAR(50) DEFAULT 'v1.0',
        prediction_generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        actual_sales INT DEFAULT NULL,
        FOREIGN KEY (product_id) REFERENCES tomorrow_ai_product_master(product_id) ON DELETE CASCADE,
        INDEX idx_prediction_date (prediction_date),
        INDEX idx_ml_group (ml_group_id),
        INDEX idx_generated_at (prediction_generated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created tomorrow_ai_predictions table');
    
    // Create sync_log table
    await connection.execute(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created tomorrow_ai_sync_log table');
    
    await connection.end();
    
    res.json({ success: true, message: 'Tomorrow AI tables created successfully' });
  } catch (error) {
    console.error('Setup Tomorrow AI tables error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add price columns to stock_batches table
app.post('/api/add-price-columns-stock', async (req, res) => {
  try {
    const mysql = require('mysql2/promise');
    let connection;
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    console.log('🔧 Adding price columns to stock_batches table...');
    
    // Add invoice_price column
    try {
      await connection.execute('ALTER TABLE stock_batches ADD COLUMN invoice_price DECIMAL(10,2) NOT NULL DEFAULT 0');
      console.log('✅ Added invoice_price column');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('ℹ️ invoice_price column already exists');
      } else {
        console.log('❌ Error adding invoice_price:', error.message);
      }
    }
    
    // Add sale_price column
    try {
      await connection.execute('ALTER TABLE stock_batches ADD COLUMN sale_price DECIMAL(10,2) NOT NULL DEFAULT 0');
      console.log('✅ Added sale_price column');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('ℹ️ sale_price column already exists');
      } else {
        console.log('❌ Error adding sale_price:', error.message);
      }
    }
    
    // Update existing stock batches with current product prices
    try {
      await connection.execute(`
        UPDATE stock_batches sb
        JOIN products p ON sb.product_id = p.id
        SET sb.invoice_price = p.invoice_price,
            sb.sale_price = p.sale_price
        WHERE sb.invoice_price = 0 OR sb.sale_price = 0
      `);
      console.log('✅ Updated existing stock batches with product prices');
    } catch (error) {
      console.log('❌ Error updating existing stock batches:', error.message);
    }
    
    await connection.end();
    
    res.json({ 
      success: true, 
      message: 'Price columns added to stock_batches table and existing data updated' 
    });
    
  } catch (error) {
    console.error('Add price columns error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Safe add item_type column to sale_items
app.post('/api/safe-add-item-type', async (req, res) => {
  try {
    const mysql = require('mysql2/promise');
    let connection;
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    console.log('🔧 Safely adding item_type column...');
    
    // Check if column already exists
    const [columns] = await connection.execute('DESCRIBE sale_items');
    const columnNames = columns.map(col => col.Field);
    
    if (columnNames.includes('item_type')) {
      console.log('ℹ️ item_type column already exists');
      await connection.end();
      return res.json({ 
        success: true, 
        message: 'item_type column already exists',
        columns: columnNames
      });
    }
    
    // Add the column
    await connection.execute('ALTER TABLE sale_items ADD COLUMN item_type VARCHAR(50) NOT NULL DEFAULT "product"');
    console.log('✅ Added item_type column');
    
    // Update existing records to have default value
    await connection.execute('UPDATE sale_items SET item_type = "product" WHERE item_type IS NULL');
    console.log('✅ Updated existing records');
    
    // Check final structure
    const [finalColumns] = await connection.execute('DESCRIBE sale_items');
    console.log('Final columns:', finalColumns.map(col => col.Field));
    
    await connection.end();
    
    res.json({ 
      success: true, 
      message: 'item_type column added safely',
      columns: finalColumns.map(col => col.Field)
    });
    
  } catch (error) {
    console.error('Safe add error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Debug endpoint to check credit note upload errors
app.post('/api/debug-credit-upload', async (req, res) => {
  try {
    console.log('🔍 Credit note upload debug - req.body:', req.body);
    console.log('🔍 Credit note upload debug - req.file:', req.file);
    console.log('🔍 Credit note upload debug - req.headers:', req.headers);
    
    res.json({ 
      success: true, 
      message: 'Debug info logged',
      body: req.body,
      file: req.file,
      hasFile: !!req.file
    });
    
  } catch (error) {
    console.error('Debug credit upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Debug endpoint to test credit note upload with detailed logging
app.post('/api/debug-credit-upload-detailed', creditNoteUpload.single('file'), async (req, res) => {
  try {
    console.log('🔍 Detailed debug credit note upload request received');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded',
        debug: {
          body: req.body,
          files: req.files,
          file: req.file
        }
      });
    }
    
    console.log('File details:', {
      originalname: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path,
      public_id: req.file.public_id,
      url: req.file.url
    });
    
    res.json({
      success: true,
      message: 'File uploaded successfully',
      file: req.file,
      body: req.body
    });
  } catch (error) {
    console.error('Detailed debug error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error details:', err.stack, 'Request:', req.method, req.url, 'Body:', req.body);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  console.error('404 Not Found:', req.method, req.url);
  res.status(404).json({ error: 'Endpoint not found' });
});
app.disable('etag'); // Disable ETag globally
const PORT = process.env.PORT || 5000;

async function ensureColumn(table, column, type) {
  try {
    const [rows] = await db.execute(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    if (!rows[0].cnt) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      console.log(`Added missing column ${column} to ${table}`);
    }
  } catch (e) {
    console.warn(`ensureColumn error for ${table}.${column}:`, e.message);
  }
}

(async () => {
  // Minimal migration: add new product fields if missing
  await ensureColumn('products', 'category', 'VARCHAR(50) NULL');
  await ensureColumn('products', 'shelf_life_days', 'INT NULL');
  await ensureColumn('products', 'image_url', 'VARCHAR(255) NULL');

  // Ensure sales.sale_date stores time (DATETIME)
  try {
    const [rows] = await db.execute(
      `SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'sale_date'`
    );
    const type = (rows[0]?.DATA_TYPE || '').toLowerCase();
    if (type && type !== 'datetime' && type !== 'timestamp') {
      await db.execute(`ALTER TABLE sales MODIFY COLUMN sale_date DATETIME NOT NULL`);
      console.log('Modified sales.sale_date to DATETIME');
    }
  } catch (e) {
    console.warn('ensure DATETIME for sales.sale_date warning:', e.message);
  }

  // Create decorations table if it doesn't exist
  try {
    await db.execute(`
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
    console.log('Decorations table ensured');
  } catch (e) {
    console.warn('Decorations table creation warning:', e.message);
  }

  // Create invoices table if it doesn't exist
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NULL,
        customer_phone VARCHAR(20) NULL,
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        status ENUM('pending', 'cleared') NOT NULL DEFAULT 'pending',
        notes TEXT NULL,
        created_by INT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('Invoices table ensured');
  } catch (e) {
    console.warn('Invoices table creation warning:', e.message);
  }

  // Create invoice_items table if it doesn't exist
  try {
    await db.execute(`
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
    console.log('Invoice items table ensured');
  } catch (e) {
    console.warn('Invoice items table creation warning:', e.message);
  }

  // Create credit_notes table if it doesn't exist
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS credit_notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        credit_note_number VARCHAR(50) UNIQUE NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NULL,
        customer_phone VARCHAR(20) NULL,
        amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        reason TEXT NOT NULL,
        status ENUM('active', 'used', 'cancelled') NOT NULL DEFAULT 'active',
        notes TEXT NULL,
        created_by INT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('Credit notes table ensured');
  } catch (e) {
    console.warn('Credit notes table creation warning:', e.message);
  }

  // Create stores table if it doesn't exist
  try {
    await db.execute(`
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
    `);
    console.log('Stores table ensured');
  } catch (e) {
    console.warn('Stores table creation warning:', e.message);
  }

  // Add status column to stores if not exists
  try {
    await db.execute(`ALTER TABLE stores ADD COLUMN status ENUM('active', 'inactive') DEFAULT 'active'`);
    console.log('status column added to stores table');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('status column already exists in stores table');
    } else {
      console.warn('status column addition warning:', e.message);
    }
  }

  // Insert initial store
  try {
    await db.execute(`
      INSERT INTO stores (store_code, store_name, city, status)
      VALUES ('R3309', 'R3309 Bakery', 'Mumbai', 'active')
      ON DUPLICATE KEY UPDATE store_name = 'R3309 Bakery'
    `);
    console.log('Initial store ensured');
  } catch (e) {
    console.warn('Initial store insertion warning:', e.message);
  }

  // Add store_id column to users if not exists
  try {
    await db.execute(`ALTER TABLE users ADD COLUMN store_id INT NULL AFTER id`);
    await db.execute(`ALTER TABLE users ADD INDEX idx_store_id (store_id)`);
    console.log('store_id column added to users table');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('store_id column already exists in users table');
    } else {
      console.warn('store_id column addition warning:', e.message);
    }
  }

  // Add role column to users if not exists
  try {
    await db.execute(`ALTER TABLE users ADD COLUMN role ENUM('store_manager', 'area_manager', 'regional_manager', 'super_admin') DEFAULT 'store_manager' AFTER username`);
    await db.execute(`ALTER TABLE users ADD INDEX idx_role (role)`);
    console.log('role column added to users table');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('role column already exists in users table');
      // Check if enum needs to be updated
      try {
        const [columns] = await db.execute(`SHOW COLUMNS FROM users LIKE 'role'`);
        if (columns.length > 0) {
          const currentType = columns[0].Type;
          if (!currentType.includes('store_manager')) {
            console.log('Updating role column enum to support new roles...');
            // Expand enum to include both old and new values
            await db.execute(
              `ALTER TABLE users MODIFY COLUMN role ENUM('staff','admin','store_manager','area_manager','regional_manager','super_admin') DEFAULT 'store_manager'`
            );
            // Update existing users to new roles
            await db.execute(`UPDATE users SET role = 'store_manager' WHERE role IN ('staff', 'admin')`);
            // Shrink enum to only new values
            await db.execute(
              `ALTER TABLE users MODIFY COLUMN role ENUM('store_manager','area_manager','regional_manager','super_admin') DEFAULT 'store_manager'`
            );
            console.log('role column enum updated successfully');
          }
        }
      } catch (enumError) {
        console.warn('role column enum update warning:', enumError.message);
      }
    } else {
      console.warn('role column addition warning:', e.message);
    }
  }

  // Update existing users with store_id
  try {
    await db.execute(`UPDATE users SET store_id = 1 WHERE store_id IS NULL`);
    console.log('Updated existing users with store_id');
  } catch (e) {
    console.warn('Update users with store_id warning:', e.message);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();