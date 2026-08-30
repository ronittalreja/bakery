# 🍰 Monginis Franchise Management System

A full-stack franchise management system built to streamline bakery operations including inventory, sales, POS, returns, expenses, invoicing, and business analytics.

The system is designed around the day-to-day workflow of a bakery franchise, providing separate functionality for administrators and staff while automating repetitive operational tasks such as stock rotation and invoice processing.

## 🚀 Overview

### �‍💼 Admin
- Monitor sales and business performance through analytics
- Manage products, decorations, and inventory
- Track expenses and operational costs
- Process returns and credit notes
- Manage invoices and stock movement
- Monitor staff sales performance

### 👨‍🍳 Staff
- Process sales through the POS system
- Record daily transactions
- Manage and update stock
- Process product returns
- View daily sales and inventory information

## 📦 Inventory Management

A key part of the system is the inventory workflow built around **FEFO (First Expiry, First Out)**.

The system tracks inventory at the batch level and prioritizes products based on expiry dates, helping reduce product wastage and ensuring that items approaching expiry are used first.

### Inventory capabilities
- FEFO-based stock allocation
- Batch-level inventory tracking
- Expiry date tracking
- Low-stock monitoring
- Stock movement tracking
- Inventory reports
- Automatic stock updates from sales and returns

## 🛒 Point of Sale & Sales Management

The POS module allows staff to record day-to-day bakery transactions while maintaining synchronized inventory.

### Sales capabilities
- Product-based POS billing
- Multiple payment methods
- Sales recording
- Invoice generation
- Daily sales tracking
- Sales history
- Staff-wise sales tracking
- Automatic inventory deduction

## 📄 Invoice & Document Processing

The system includes document processing functionality to reduce manual data entry from operational documents.

### Supported workflows
- PDF invoice uploads
- Automated invoice data extraction
- Invoice validation
- Credit note processing
- GRM/GVN return processing
- ROS receipt handling
- Automatic inventory updates from processed documents

This allows operational documents to be converted into structured data that can be used by the inventory and sales modules.

## 📊 Analytics Dashboard

The admin dashboard provides an overview of the franchise's operational and financial activity.

### Analytics include
- Daily sales
- Weekly and monthly sales
- Product performance
- Inventory status
- Stock movement
- Staff performance
- Expense tracking
- Sales trends

## 🏗️ System Architecture

The application follows a **separated frontend and backend architecture**:

```text
                    ┌─────────────────────┐
                    │      Next.js        │
                    │     Frontend        │
                    └──────────┬──────────┘
                               │
                         REST API / HTTP
                               │
                    ┌──────────▼──────────┐
                    │   Node.js +         │
                    │   Express.js        │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │       MySQL         │
                    │      Database       │
                    └─────────────────────┘
```

The backend is organized using controllers, routes, models, and middleware to keep business logic modular and maintainable.

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework
- **React.js** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Radix UI** - Component library
- **Recharts** - Data visualization

### Backend
- **Node.js** - Runtime
- **Express.js** - Web framework
- **MySQL** - Database
- **JWT Authentication** - Security
- **Multer** - File uploads
- **PDF Parsing** - Document processing

### Architecture & Engineering
- RESTful API architecture
- Role-based authentication
- Modular backend structure
- Batch-level inventory management
- FEFO stock allocation
- Automated document processing
- Transaction-based sales and inventory updates

## 🔐 Authentication & Authorization

The application implements JWT-based authentication with role-based access control.

Different roles receive access to functionality relevant to their responsibilities, separating administrative operations from day-to-day staff workflows.

## 💡 Key Engineering Challenges

### FEFO Inventory Logic
Implemented expiry-aware inventory allocation so that stock approaching expiry is prioritized during sales.

### Inventory Synchronization
Sales, returns, and document processing interact with the inventory system to maintain accurate stock levels.

### Document Processing
Designed a workflow for extracting structured information from PDF invoices and operational documents, reducing manual data entry.

### Role-Based Access
Implemented authentication and authorization to provide different capabilities for administrators and staff.

### Operational Analytics
Built dashboards that transform transactional data into useful sales, inventory, expense, and performance insights.

## 🔧 Technical Implementation

### Email Processing Automation

The system uses IMAP to automatically process emails from receipt5@mongini.in and extract attachments for upload.

**Implementation:**
- **IMAP Connection**: Uses `imap` library to connect to Gmail with app password authentication
- **Email Parsing**: `mailparser` library extracts attachments and metadata from emails
- **Type Detection**: Email subject patterns identify document type (Invoice, CRDR, ROS Receipt)
- **Upload API**: Attachments are uploaded to respective endpoints via REST API
- **Deduplication**: `processed_emails.json` tracks processed emails to prevent reprocessing
- **Scheduling**: GitHub Actions cron job runs every 3 hours (`0 */3 * * *`)
- **Timeout Handling**: IMAP connection and authentication timeouts set to 60 seconds to prevent failures

### PDF Document Processing

PDF invoices and credit notes are parsed using `pdf-parse` to extract structured data.

**Implementation:**
- **Text Extraction**: `pdf-parse` library extracts raw text from PDF files
- **Regex Pattern Matching**: Custom regex patterns identify invoice numbers, dates, line items, and amounts
- **Data Validation**: Extracted data is validated against expected formats before database insertion
- **Item Code Resolution**: Line item codes are matched against existing products; new products are auto-created
- **Cloudinary Storage**: Original PDFs are uploaded to Cloudinary for persistent storage
- **Error Handling**: Failed uploads are logged to error JSON files for review

### Status Reconciliation System

The system maintains bidirectional status updates between ROS receipts and invoices/credit notes.

**Implementation:**
- **Forward Logic**: When ROS receipt is uploaded, matching invoices/CRDR are updated to 'cleared' status
- **Reverse Logic**: When invoice/CRDR is uploaded, system checks if it exists in any existing ROS receipt and updates status
- **JSON Search**: MySQL `JSON_SEARCH` function queries JSON bills array for matching bill numbers
- **Cleared Items Tracking**: `ros_receipt_cleared_items` table records all status updates for audit trail
- **Null Safety**: Explicit ID queries prevent null foreign key errors when matching documents don't exist

### FEFO Inventory Algorithm

The First Expiry, First Out algorithm prioritizes stock based on expiry dates.

**Implementation:**
- **Batch Tracking**: Each inventory entry has `invoice_id` and `expiry_date`
- **Sorting**: Stock is sorted by `expiry_date ASC` before allocation
- **Allocation Logic**: Sales consume from earliest-expiring batches first
- **Stock Updates**: `stock_quantity` is decremented per batch; batches reach zero before moving to next
- **Return Handling**: Returns add stock back to original batch with same expiry date

### Authentication & Authorization

JWT-based authentication with role-based access control.

**Implementation:**
- **JWT Generation**: User login generates signed JWT with user ID and role
- **Middleware**: `authMiddleware.js` verifies JWT token on protected routes
- **Role Check**: Routes check `req.user.role` to authorize access (admin vs staff)
- **Password Hashing**: `bcrypt` hashes passwords before storage
- **Token Expiry**: JWT tokens expire after configurable time (default 24h)

### File Upload Handling

Multer handles file uploads with Cloudinary integration for persistent storage.

**Implementation:**
- **Multer Config**: Memory storage for temporary file handling
- **Cloudinary Upload**: `cloudinary.uploader.upload` stores files with organized folder structure
- **Folder Structure**: `invoices/`, `credit-notes/`, `ros-receipts/` folders
- **URL Retrieval**: Cloudinary returns secure URLs stored in database
- **Error Handling**: Upload failures return 400/500 with descriptive messages

### Database Schema

MySQL database with normalized tables for data integrity.

**Key Tables:**
- **users**: Authentication and role management
- **products**: Product catalog with pricing and stock levels
- **inventory**: Batch-level stock tracking with expiry dates
- **sales**: Transaction records with items and payment details
- **invoices**: Parsed invoice data with Cloudinary URLs
- **credit_notes**: Credit note records with return details
- **ros_receipts**: ROS receipts with JSON bills array
- **ros_receipt_cleared_items**: Audit trail for status updates
- **expenses**: Operational expense tracking

