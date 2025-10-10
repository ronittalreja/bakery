// File: backend/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const db = require('./config/database');

dotenv.config();

const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'https://bakery-phi-two.vercel.app', // Your actual Vercel domain
  'https://bakery-git-main-talrejaronit13-gmailcoms-projects.vercel.app', // Your Vercel project domain
  'https://monginis-frontend.vercel.app', // Placeholder
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
const authMiddleware = (roles = []) => (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    console.error('No token provided:', req.method, req.url);
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (roles.length && !roles.includes(decoded.role)) {
      console.error('Forbidden: Invalid role:', decoded.role, req.method, req.url);
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message, req.method, req.url);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/invoices', authMiddleware(['staff', 'admin']), require('./routes/invoices'));
app.use('/api/credit-notes', authMiddleware(['staff', 'admin']), require('./routes/creditNotes'));
app.use('/api/stock', authMiddleware(['staff', 'admin']), require('./routes/stock'));
app.use('/api/sales', authMiddleware(['staff', 'admin']), require('./routes/sales'));
app.use('/api/returns', authMiddleware(['staff', 'admin']), require('./routes/returns'));
app.use('/api/products', authMiddleware(['admin']), require('./routes/products'));
app.use('/api/decorations', authMiddleware(['staff', 'admin']), require('./routes/decorations'));
app.use('/api/expenses', authMiddleware(['admin']), require('./routes/expenses'));
app.use('/api/reports', authMiddleware(['admin']), require('./routes/reports'));
app.use('/api/ros-receipts', authMiddleware(['staff', 'admin']), require('./routes/rosReceipts'));
app.use('/api/insights', authMiddleware(['admin']), require('./routes/insights'));

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

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();