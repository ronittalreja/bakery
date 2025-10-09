# 🚀 Monginis Deployment Guide

## 📋 Prerequisites
- GitHub account
- Railway account (free tier)
- Vercel account (free tier)

## 🗄️ Database Setup (Railway MySQL)

### Step 1: Create Railway Project
1. Go to [Railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project"
4. Select "Provision MySQL"

### Step 2: Get Database Credentials
Railway will automatically provide these environment variables:
- `DB_HOST`
- `DB_USER` 
- `DB_PASSWORD`
- `DB_NAME`

## 🔧 Backend Deployment (Railway)

### Step 1: Deploy Backend
1. In Railway dashboard, click "New Service"
2. Select "GitHub Repo"
3. Choose your repository
4. Set root directory to `backend/`

### Step 2: Configure Environment Variables
Add these in Railway dashboard:
```
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

### Step 3: Database Migration
After deployment, you'll need to create the database tables. Railway provides a MySQL console.

## 🎨 Frontend Deployment (Vercel)

### Step 1: Deploy Frontend
1. Go to [Vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click "New Project"
4. Import your repository
5. Set root directory to `frontend/`

### Step 2: Configure Environment Variables
Add these in Vercel dashboard:
```
NEXT_PUBLIC_API_URL=https://your-backend-domain.railway.app
```

## 🔗 Update URLs

### After Backend Deployment:
1. Copy your Railway backend URL
2. Update Vercel environment variable `NEXT_PUBLIC_API_URL`

### After Frontend Deployment:
1. Copy your Vercel frontend URL
2. Update Railway environment variable `FRONTEND_URL`

## 📊 Database Schema Setup

Run these SQL commands in Railway MySQL console:

```sql
-- Create users table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('staff', 'admin') DEFAULT 'staff',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default users
INSERT INTO users (username, password, role) VALUES 
('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
('R3309', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff');

-- Create products table
CREATE TABLE products (
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
);

-- Create stock_batches table
CREATE TABLE stock_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  expiry_date DATE,
  invoice_date DATE NOT NULL,
  invoice_reference VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Create sales table
CREATE TABLE sales (
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
);

-- Create sale_items table
CREATE TABLE sale_items (
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
);

-- Create returns table
CREATE TABLE returns (
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
);

-- Create decorations table
CREATE TABLE decorations (
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
);

-- Create expenses table
CREATE TABLE expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expense_date DATE NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  staff_id INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create invoices table
CREATE TABLE invoices (
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
);

-- Create invoice_items table
CREATE TABLE invoice_items (
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
);

-- Create credit_notes table
CREATE TABLE credit_notes (
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
);
```

## ✅ Testing Deployment

1. **Backend Health Check**: Visit `https://your-backend.railway.app/health`
2. **Frontend**: Visit your Vercel URL
3. **Login Test**: Use credentials `admin/admin123` or `R3309/staff123`

## 🔧 Troubleshooting

### Common Issues:
1. **CORS Errors**: Update `FRONTEND_URL` in Railway
2. **Database Connection**: Check Railway MySQL service status
3. **Environment Variables**: Ensure all required vars are set
4. **File Uploads**: Railway provides `/tmp` storage (temporary)

### Support:
- Railway: [docs.railway.app](https://docs.railway.app)
- Vercel: [vercel.com/docs](https://vercel.com/docs)
