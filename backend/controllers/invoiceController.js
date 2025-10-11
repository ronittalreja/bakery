// File: backend/controllers/invoiceController.js
const { parseInvoice } = require('../utils/pdfParser');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Product = require('../models/Product');
const StockBatch = require('../models/StockBatch');
const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');

const uploadInvoice = async (req, res) => {
  try {
    console.log('Received upload request:', {
      query: req.query,
      body: req.body,
      file: !!req.file,
      user: req.user,
    });
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const isPreview = req.query.preview === 'true';
    
    // Download file from Cloudinary for parsing
    const { downloadFileFromCloudinary } = require('../utils/cloudinary');
    const publicId = req.file.public_id || req.file.filename;
    const buffer = await downloadFileFromCloudinary(publicId);
    
    const parsedData = await parseInvoice(buffer);
    console.log('Parsed invoice data:', parsedData);

    // Handle multiple invoices
    const invoicesToProcess = parsedData.allInvoices || [parsedData];
    console.log(`Processing ${invoicesToProcess.length} invoice(s)`);

    // Validate each invoice
    for (let i = 0; i < invoicesToProcess.length; i++) {
      const invoice = invoicesToProcess[i];
      if (
        !invoice ||
        typeof invoice.invoiceNo !== 'string' ||
        !invoice.invoiceNo.trim() ||
        !invoice.invoiceDate ||
        isNaN(new Date(invoice.invoiceDate).getTime()) ||
        typeof invoice.store !== 'string' ||
        !invoice.store.trim() ||
        typeof invoice.totalAmount !== 'number' ||
        !Array.isArray(invoice.items) ||
        invoice.items.length === 0
      ) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid invoice data for invoice ${i + 1}: missing or incorrect required fields` 
        });
      }

      // Validate each item in this invoice
      for (const item of invoice.items) {
        if (
          typeof item.slNo !== 'number' ||
          typeof item.itemCode !== 'string' ||
          !item.itemCode.trim() ||
          typeof item.itemName !== 'string' ||
          !item.itemName.trim() ||
          typeof item.hsnCode !== 'string' ||
          !item.hsnCode.trim() ||
          typeof item.qty !== 'number' ||
          item.qty <= 0 ||
          typeof item.uom !== 'string' ||
          !item.uom.trim() ||
          typeof item.rate !== 'number' ||
          item.rate <= 0 ||
          typeof item.total !== 'number' ||
          item.total <= 0
        ) {
          return res.status(400).json({ 
            success: false, 
            error: `Invalid item data in invoice ${i + 1}: ${JSON.stringify(item)}` 
          });
        }
      }
    }

    // Use the first invoice for validation (backward compatibility)
    const firstInvoice = invoicesToProcess[0];

    // Validate invoice
    const invoiceDate = new Date(firstInvoice.invoiceDate);
    if (isNaN(invoiceDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid invoice date' });
    }
    const today = new Date(req.body.invoiceDate || new Date());
    const isToday = invoiceDate.toDateString() === today.toDateString();
    const isCorrectStore = firstInvoice.store === 'YOUR_STORE_NAME'; // Replace with actual store name
    const isValid = isToday && isCorrectStore;

    const validationResult = {
      ...firstInvoice,
      totalQty: firstInvoice.items.reduce((sum, item) => sum + item.qty, 0),
      validation: {
        isToday,
        isCorrectStore,
        isValid,
      },
      // Add multiple invoices info
      allInvoices: invoicesToProcess,
      invoiceCount: invoicesToProcess.length
    };

    if (isPreview) {
      return res.json({ 
        success: true, 
        message: `Invoice preview successful - Found ${invoicesToProcess.length} invoice(s)`, 
        data: validationResult 
      });
    }

    // Check if any invoice with same invoice_number exists
    for (const invoice of invoicesToProcess) {
      const [existingInvoices] = await db.execute('SELECT * FROM invoices WHERE invoice_number = ?', [invoice.invoiceNo]);
      if (existingInvoices.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invoice already uploaded with invoice number ${invoice.invoiceNo}`,
        });
      }
    }

    // Save file
    const fileName = `${firstInvoice.invoiceNo}_${Date.now()}.pdf`;
    const filePath = path.join(__dirname, '../Uploads', fileName);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);

    // Start transaction
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const createdInvoices = [];
      
      // Process each invoice
      for (let i = 0; i < invoicesToProcess.length; i++) {
        const invoice = invoicesToProcess[i];
        console.log(`Creating invoice ${i + 1}/${invoicesToProcess.length}: ${invoice.invoiceNo}`);
        
        // Create invoice
        const invoiceId = await Invoice.create(
          {
            invoiceNo: invoice.invoiceNo,
            invoiceDate: invoice.invoiceDate,
            store: invoice.store,
            totalAmount: invoice.totalAmount,
            fileReference: fileName,
          },
          connection
        );
        
        createdInvoices.push({
          id: invoiceId,
          invoiceNo: invoice.invoiceNo,
          totalAmount: invoice.totalAmount,
          itemCount: invoice.items.length
        });

        // Helper: pricing rules
        const roundUpToNearest5 = (value) => {
          const remainder = value % 5;
          return remainder === 0 ? value : value + (5 - remainder);
        };

        const computeMrp = (invoicePrice) => {
          const increased = invoicePrice * 1.33; // +33%
          // Round up to nearest 5 (e.g., 121 -> 125, 130 -> 130)
          return roundUpToNearest5(Math.ceil(increased));
        };

        const computeGrmLossValue = (invoicePrice) => Number((invoicePrice * 0.15).toFixed(2));

        // Process items for this invoice
        for (const item of invoice.items) {
          let [product] = await connection.execute('SELECT id FROM products WHERE item_code = ?', [item.itemCode]);
          let productId;
          if (product && product.length > 0) {
            productId = product[0].id;
            // Update pricing and also ensure category/shelf-life present using item code inference
            const inferred = Product.inferCategoryAndShelfLife(item.itemCode);
            await connection.execute(
              'UPDATE products SET name = ?, invoice_price = ?, sale_price = ?, grm_value = ?, category = COALESCE(category, ?), shelf_life_days = COALESCE(shelf_life_days, ?), updated_at = NOW() WHERE id = ?',
              [item.itemName, item.rate, computeMrp(item.rate), computeGrmLossValue(item.rate), inferred.category || null, inferred.shelf_life_days ?? null, productId]
            );
          } else {
            const inferred = Product.inferCategoryAndShelfLife(item.itemCode);
            const [result] = await connection.execute(
              'INSERT INTO products (name, item_code, hsn_code, invoice_price, sale_price, grm_value, category, shelf_life_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [item.itemName, item.itemCode, item.hsnCode, item.rate, computeMrp(item.rate), computeGrmLossValue(item.rate), inferred.category || null, inferred.shelf_life_days ?? null]
            );
            productId = result.insertId;
          }

          await InvoiceItem.create(
            {
              invoiceId,
              slNo: item.slNo,
              itemCode: item.itemCode,
              itemName: item.itemName,
              hsnCode: item.hsnCode,
              qty: item.qty,
              uom: item.uom,
              rate: item.rate,
              total: item.total,
            },
            connection
          );

          // Compute expiry using product shelf_life_days (0 means no expiry)
          const [[productRow]] = await connection.execute('SELECT shelf_life_days FROM products WHERE id = ?', [productId]);
          const shelfLifeDays = productRow ? Number(productRow.shelf_life_days ?? 0) : 0;
          const invDate = new Date(invoice.invoiceDate);
          let expiryDateStr;
          if (!shelfLifeDays) {
            expiryDateStr = '2099-12-31';
          } else {
            const exp = new Date(invDate);
            exp.setDate(exp.getDate() + shelfLifeDays);
            expiryDateStr = exp.toISOString().split('T')[0];
          }

          await StockBatch.create(
            {
              productId,
              quantity: item.qty,
              expiryDate: expiryDateStr,
              invoiceDate: invoice.invoiceDate,
              invoiceReference: invoice.invoiceNo,
            },
            connection
          );
        }
      }

      await connection.commit();
      res.json({ 
        success: true, 
        message: `Successfully processed ${createdInvoices.length} invoice(s)`, 
        data: {
          ...validationResult,
          createdInvoices,
          summary: {
            totalInvoices: createdInvoices.length,
            totalItems: createdInvoices.reduce((sum, inv) => sum + inv.itemCount, 0),
            totalAmount: createdInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0)
          }
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Invoice processing error:', error);
    res.status(500).json({ success: false, error: `Failed to process invoice: ${error.message}` });
  }
};

const verifyInvoice = async (req, res) => {
  try {
    const { invoiceDate, verified } = req.body;
    if (!invoiceDate || verified === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    res.json({ success: true, message: 'Invoice verified successfully' });
  } catch (error) {
    console.error('Invoice verification error:', error);
    res.status(500).json({ success: false, error: `Failed to verify invoice: ${error.message}` });
  }
};

const checkInvoice = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    console.log('Invoice check - req.file:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      path: req.file.path,
      public_id: req.file.public_id,
      url: req.file.url
    });
    
    // Download file from Cloudinary for parsing
    const { downloadFileFromCloudinary } = require('../utils/cloudinary');
    const publicId = req.file.public_id || req.file.filename;
    console.log('Using public_id:', publicId);
    
    const fileBuffer = await downloadFileFromCloudinary(publicId);
    
    const validationResult = await parseInvoice(fileBuffer);
    res.json({ success: true, data: validationResult });
  } catch (error) {
    console.error('Invoice check error:', error);
    res.status(400).json({ success: false, error: `Failed to validate invoice: ${error.message}` });
  }
};

// Get all invoices for a specific month (for payments page)
const getInvoicesByMonth = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({ 
        success: false, 
        error: 'Month and year are required' 
      });
    }

    const [invoices] = await db.execute(
      'SELECT * FROM invoices WHERE MONTH(invoice_date) = ? AND YEAR(invoice_date) = ? ORDER BY invoice_date DESC',
      [parseInt(month), parseInt(year)]
    );
    
    res.json({ 
      success: true, 
      invoices,
      count: invoices.length 
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// Get invoice by ID (for payments page)
const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await db.execute('SELECT * FROM invoices WHERE id = ?', [parseInt(id)]);
    const invoice = rows[0];
    
    if (!invoice) {
      return res.status(404).json({ 
        success: false, 
        error: 'Invoice not found' 
      });
    }

    res.json({ 
      success: true, 
      invoice 
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// Get invoice items (for payments page)
const getInvoiceItems = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get invoice items from the invoice_items table
    const [items] = await db.execute(`
      SELECT 
        ii.id,
        ii.item_name as product_name,
        ii.qty as quantity,
        ii.rate as unit_price,
        ii.total as total_price,
        ii.item_code,
        ii.hsn_code,
        ii.uom
      FROM invoice_items ii
      WHERE ii.invoice_id = ?
      ORDER BY ii.sl_no ASC
    `, [parseInt(id)]);
    
    res.json({ 
      success: true, 
      items 
    });
  } catch (error) {
    console.error('Error fetching invoice items:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// Update invoice status (for payments page)
const updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['pending', 'cleared'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid status. Must be pending or cleared' 
      });
    }

    // Add status column if it doesn't exist
    try {
      await db.execute('ALTER TABLE invoices ADD COLUMN status ENUM("pending", "cleared") DEFAULT "pending"');
    } catch (e) {
      // Column might already exist
    }

    const [result] = await db.execute(
      'UPDATE invoices SET status = ? WHERE id = ?',
      [status, parseInt(id)]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Invoice not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Invoice status updated successfully' 
    });
  } catch (error) {
    console.error('Error updating invoice status:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// Get invoices from ROS receipts that don't exist in invoices table
const getInvoicesFromRosReceipts = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({ 
        success: false, 
        error: 'Month and year are required' 
      });
    }

    // Get all ROS receipts for the specified month/year
    const [rosReceipts] = await db.execute(`
      SELECT id, receipt_number, receipt_date, bills, created_at
      FROM ros_receipts 
      WHERE MONTH(receipt_date) = ? AND YEAR(receipt_date) = ?
      ORDER BY receipt_date DESC
    `, [parseInt(month), parseInt(year)]);

    const invoicesFromRos = [];

    for (const rosReceipt of rosReceipts) {
      const bills = typeof rosReceipt.bills === 'string' ? JSON.parse(rosReceipt.bills) : rosReceipt.bills;
      
      // Filter for SR (Sales Return) bills which are invoices
      const srBills = bills.filter(bill => bill.doc_type === 'SR');
      
      for (const bill of srBills) {
        // Check if this invoice already exists in invoices table
        const [existingInvoice] = await db.execute(
          'SELECT id FROM invoices WHERE invoice_number = ?',
          [bill.bill_number]
        );
        
        // If it doesn't exist, add it to the list
        if (existingInvoice.length === 0) {
          invoicesFromRos.push({
            id: `ros_${rosReceipt.id}_${bill.bill_number}`, // Unique ID for frontend
            invoice_number: bill.bill_number,
            invoice_date: bill.bill_date,
            store: 'From ROS Receipt', // Default store name
            total_amount: Number(bill.amount) || 0,
            file_reference: rosReceipt.receipt_number,
            uploaded_at: rosReceipt.created_at,
            status: 'cleared', // ROS receipts are already cleared
            source: 'ros_receipt',
            ros_receipt_id: rosReceipt.id,
            ros_receipt_number: rosReceipt.receipt_number
          });
        }
      }
    }

    res.json({
      success: true,
      invoices: invoicesFromRos,
      count: invoicesFromRos.length
    });

  } catch (error) {
    console.error('Error fetching invoices from ROS receipts:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

module.exports = { 
  uploadInvoice, 
  verifyInvoice, 
  checkInvoice,
  getInvoicesByMonth,
  getInvoiceById,
  getInvoiceItems,
  updateInvoiceStatus,
  getInvoicesFromRosReceipts
};