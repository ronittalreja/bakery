// File: backend/controllers/invoiceController.js
const InvoiceParser = require('../utils/invoiceParser');
const { downloadFileFromCloudinary } = require('../utils/cloudinary');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Product = require('../models/Product');
const StockBatch = require('../models/StockBatch');
const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');

// Parse multiple invoices from a single PDF
const parseMultipleInvoices = async (req, res) => {
  try {
    console.log('Received parse request:', {
      query: req.query,
      body: req.body,
      file: !!req.file,
      user: req.user,
    });
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Ensure we have a proper buffer
    let buffer = req.file.buffer;
    if (!Buffer.isBuffer(buffer)) {
      buffer = Buffer.from(buffer);
    }
    
    console.log('Parse Multiple - Buffer type:', typeof buffer, 'Is Buffer:', Buffer.isBuffer(buffer), 'Length:', buffer.length);
    
    const invoiceParser = new InvoiceParser();
    
    // Parse PDF text
    const pdf = require('pdf-parse');
    let pdfData;
    try {
      pdfData = await pdf(buffer);
      console.log('Parse Multiple - PDF parsed successfully, text length:', pdfData.text.length);
    } catch (pdfError) {
      console.error('Parse Multiple - PDF parsing error:', pdfError);
      return res.status(400).json({ 
        success: false, 
        error: `Failed to parse PDF: ${pdfError.message}` 
      });
    }
    
    // Parse multiple invoices from text
    const parsedData = invoiceParser.parseFromText(pdfData.text);
    console.log('Parsed multiple invoices data:', parsedData);

    if (!parsedData.success) {
      return res.status(400).json({ 
        success: false, 
        error: parsedData.error || 'Failed to parse invoices' 
      });
    }

    return res.json(parsedData);
  } catch (error) {
    console.error('Multiple invoice parsing error:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to parse invoices: ${error.message}` 
    });
  }
};

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
    
    console.log('File info:', {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      path: req.file.path,
      public_id: req.file.public_id,
      buffer: !!req.file.buffer,
      allKeys: Object.keys(req.file)
    });
    
    // With Cloudinary, we get req.file.path (Cloudinary URL) instead of buffer
    let buffer;
    if (req.file.buffer) {
      // If we have a buffer (memory storage), use it directly
      buffer = req.file.buffer;
      if (!Buffer.isBuffer(buffer)) {
        buffer = Buffer.from(buffer);
      }
      console.log('✅ Using file buffer directly, length:', buffer.length);
    } else if (req.file.path) {
      // If we have a Cloudinary path, download the file
      console.log('Downloading file from Cloudinary:', req.file.path);
      console.log('Public ID:', req.file.public_id);
      
      // Use the same improved approach as checkInvoice
      let publicId = req.file.public_id || req.file.filename;
      
      // If still no public_id, try to extract from path
      if (!publicId && req.file.path) {
        // Extract public_id from Cloudinary URL patterns
        const patterns = [
          /\/v\d+\/(.+?)\.pdf$/,  // Standard: /v1234567890/folder/file.pdf
          /\/monginis\/invoices\/(.+?)\.pdf$/,  // Custom folder
          /https:\/\/res\.cloudinary\.com\/[^\/]+\/raw\/upload\/v\d+\/(.+?)\.pdf$/,  // Full URL
          /\/raw\/upload\/v\d+\/(.+?)\.pdf$/,  // Alternative path
          /\/upload\/v\d+\/(.+?)\.pdf$/  // Another alternative
        ];
        
        for (const pattern of patterns) {
          const match = req.file.path.match(pattern);
          if (match) {
            publicId = match[1];
            console.log('✅ Extracted public_id using pattern:', pattern.toString(), '->', publicId);
            break;
          }
        }
      }
      
      // Last resort: use original filename without extension
      if (!publicId && req.file.originalname) {
        publicId = req.file.originalname.replace(/\.[^/.]+$/, "");
        console.log('Using original filename as public_id:', publicId);
      }
      
      console.log('Using public_id:', publicId);
      
      if (!publicId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Could not determine Cloudinary public_id for file download' 
        });
      }
      
      buffer = await downloadFileFromCloudinary(publicId);
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'No file buffer or Cloudinary path found' 
      });
    }
    
    console.log('Upload - Buffer type:', typeof buffer, 'Is Buffer:', Buffer.isBuffer(buffer), 'Length:', buffer.length);
    
    // Try to parse multiple invoices first
    const invoiceParser = new InvoiceParser();
    const pdf = require('pdf-parse');
    
    let pdfData;
    try {
      pdfData = await pdf(buffer);
      console.log('Upload - PDF parsed successfully, text length:', pdfData.text.length);
    } catch (pdfError) {
      console.error('Upload - PDF parsing error:', pdfError);
      return res.status(400).json({ 
        success: false, 
        error: `Failed to parse PDF: ${pdfError.message}` 
      });
    }
    
    const multipleInvoicesData = invoiceParser.parseFromText(pdfData.text);
    
    let parsedData;
    
    // If multiple invoices found, use the first one for backward compatibility
    if (multipleInvoicesData.success && multipleInvoicesData.invoices.length > 0) {
      console.log(`Found ${multipleInvoicesData.invoices.length} invoices, using first one for upload`);
      parsedData = multipleInvoicesData.invoices[0];
    } else {
      // Fallback: try to parse as single invoice using the new parser
      console.log('No multiple invoices found, trying single invoice parsing');
      if (multipleInvoicesData.success && multipleInvoicesData.invoices.length === 0) {
        return res.status(400).json({ success: false, error: 'No valid invoices found in the PDF' });
      } else {
        return res.status(400).json({ success: false, error: 'Failed to parse PDF: ' + (multipleInvoicesData.error || 'Unknown error') });
      }
    }
    
    console.log('Parsed invoice data:', parsedData);

    // Validate parsed data
    if (
      !parsedData ||
      typeof parsedData.invoiceNo !== 'string' ||
      !parsedData.invoiceNo.trim() ||
      !parsedData.invoiceDate ||
      isNaN(new Date(parsedData.invoiceDate).getTime()) ||
      typeof parsedData.store !== 'string' ||
      !parsedData.store.trim() ||
      typeof parsedData.totalAmount !== 'number' ||
      !Array.isArray(parsedData.items) ||
      parsedData.items.length === 0
    ) {
      return res.status(400).json({ success: false, error: 'Invalid invoice data: missing or incorrect required fields' });
    }

    // Validate each item
    for (const item of parsedData.items) {
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
        return res.status(400).json({ success: false, error: `Invalid item data: ${JSON.stringify(item)}` });
      }
    }

    // Validate invoice
    const invoiceDate = new Date(parsedData.invoiceDate);
    if (isNaN(invoiceDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid invoice date' });
    }
    const today = new Date(req.body.invoiceDate || new Date());
    const isToday = invoiceDate.toDateString() === today.toDateString();
    const isCorrectStore = parsedData.store === 'YOUR_STORE_NAME'; // Replace with actual store name
    const isValid = isToday && isCorrectStore;

    const validationResult = {
      ...parsedData,
      totalQty: parsedData.items.reduce((sum, item) => sum + item.qty, 0),
      validation: {
        isToday,
        isCorrectStore,
        isValid,
      },
    };

    if (isPreview) {
      return res.json({ success: true, message: 'Invoice preview successful', data: validationResult });
    }

    // Check if invoice with same invoice_no exists
    const [existingInvoices] = await db.execute('SELECT * FROM invoices WHERE invoice_no = ?', [parsedData.invoiceNo]);
    if (existingInvoices.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invoice already uploaded with invoice number ${parsedData.invoiceNo}`,
      });
    }

    // Save file
    const fileName = `${parsedData.invoiceNo}_${Date.now()}.pdf`;
    const filePath = path.join(__dirname, '../Uploads', fileName);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);

    // Start transaction
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Create invoice
      const invoiceId = await Invoice.create(
        {
          invoiceNo: parsedData.invoiceNo,
          invoiceDate: parsedData.invoiceDate,
          store: parsedData.store,
          totalAmount: parsedData.totalAmount,
          fileReference: fileName,
          
        },
        connection
      );

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

      // Process items
      for (const item of parsedData.items) {
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
        const invDate = new Date(parsedData.invoiceDate);
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
            invoiceDate: parsedData.invoiceDate,
            invoiceReference: parsedData.invoiceNo,
          },
          connection
        );
      }

      await connection.commit();
      res.json({ success: true, message: 'Invoice processed successfully', data: validationResult });
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
    
    console.log('File info:', {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      path: req.file.path,
      public_id: req.file.public_id,
      buffer: !!req.file.buffer,
      allKeys: Object.keys(req.file)
    });
    
    // With Cloudinary, we get req.file.path (Cloudinary URL) instead of buffer
    let buffer;
    if (req.file.buffer) {
      // If we have a buffer (memory storage), use it directly
      buffer = req.file.buffer;
      if (!Buffer.isBuffer(buffer)) {
        buffer = Buffer.from(buffer);
      }
      console.log('✅ Using file buffer directly, length:', buffer.length);
    } else if (req.file.path) {
      // If we have a Cloudinary path, download the file
      console.log('Downloading file from Cloudinary:', req.file.path);
      console.log('Public ID:', req.file.public_id);
      
      // Use the same approach as ROS receipt controller with better fallbacks
      let publicId = req.file.public_id || req.file.filename;
      
      // If still no public_id, try to extract from path
      if (!publicId && req.file.path) {
        // Extract public_id from Cloudinary URL patterns
        const patterns = [
          /\/v\d+\/(.+?)\.pdf$/,  // Standard: /v1234567890/folder/file.pdf
          /\/monginis\/invoices\/(.+?)\.pdf$/,  // Custom folder
          /https:\/\/res\.cloudinary\.com\/[^\/]+\/raw\/upload\/v\d+\/(.+?)\.pdf$/,  // Full URL
          /\/raw\/upload\/v\d+\/(.+?)\.pdf$/,  // Alternative path
          /\/upload\/v\d+\/(.+?)\.pdf$/  // Another alternative
        ];
        
        for (const pattern of patterns) {
          const match = req.file.path.match(pattern);
          if (match) {
            publicId = match[1];
            console.log('✅ Extracted public_id using pattern:', pattern.toString(), '->', publicId);
            break;
          }
        }
      }
      
      // Last resort: use original filename without extension
      if (!publicId && req.file.originalname) {
        publicId = req.file.originalname.replace(/\.[^/.]+$/, "");
        console.log('Using original filename as public_id:', publicId);
      }
      
      console.log('Using public_id:', publicId);
      
      if (!publicId) {
        console.error('No public_id found. File object:', {
          path: req.file.path,
          public_id: req.file.public_id,
          originalname: req.file.originalname,
          fieldname: req.file.fieldname
        });
        return res.status(400).json({ 
          success: false, 
          error: 'Could not determine Cloudinary public_id for file download' 
        });
      }
      
      try {
        buffer = await downloadFileFromCloudinary(publicId);
      } catch (downloadError) {
        console.error('Error downloading file from Cloudinary:', downloadError);
        return res.status(400).json({ 
          success: false, 
          error: `Failed to download file from Cloudinary: ${downloadError.message}` 
        });
      }
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'No file buffer or Cloudinary path found' 
      });
    }
    
    console.log('Buffer type:', typeof buffer, 'Is Buffer:', Buffer.isBuffer(buffer), 'Length:', buffer.length);
    
    // Use the new InvoiceParser
    const invoiceParser = new InvoiceParser();
    const pdf = require('pdf-parse');
    
    try {
      const pdfData = await pdf(buffer);
      console.log('PDF parsed successfully, text length:', pdfData.text.length);
      
      const parsedData = invoiceParser.parseFromText(pdfData.text);
      
      if (!parsedData.success) {
        return res.status(400).json({ 
          success: false, 
          error: parsedData.error || 'Failed to parse invoice' 
        });
      }
      
      // Return all invoices for preview with proper structure
      if (parsedData.invoices && parsedData.invoices.length > 0) {
        if (parsedData.invoices.length === 1) {
          // Single invoice - return the first one for backward compatibility
          res.json({ success: true, data: parsedData.invoices[0] });
        } else {
          // Multiple invoices - return structured data for frontend
          res.json({ 
            success: true, 
            data: parsedData.invoices[0], // First invoice for backward compatibility
            invoiceCount: parsedData.invoices.length,
            allInvoices: parsedData.invoices
          });
        }
      } else {
        res.json({ success: true, data: null });
      }
    } catch (pdfError) {
      console.error('PDF parsing error:', pdfError);
      return res.status(400).json({ 
        success: false, 
        error: `Failed to parse PDF: ${pdfError.message}` 
      });
    }
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
          'SELECT id FROM invoices WHERE invoice_no = ?',
          [bill.bill_number]
        );
        
        // If it doesn't exist, add it to the list
        if (existingInvoice.length === 0) {
          invoicesFromRos.push({
            id: `ros_${rosReceipt.id}_${bill.bill_number}`, // Unique ID for frontend
            invoice_no: bill.bill_number,
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

// Upload multiple invoices from a single PDF
const uploadMultipleInvoices = async (req, res) => {
  try {
    console.log('Received multiple invoice upload request:', {
      query: req.query,
      body: req.body,
      file: !!req.file,
      user: req.user,
    });
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Ensure we have a proper buffer
    let buffer = req.file.buffer;
    if (!Buffer.isBuffer(buffer)) {
      buffer = Buffer.from(buffer);
    }
    
    console.log('Upload Multiple - Buffer type:', typeof buffer, 'Is Buffer:', Buffer.isBuffer(buffer), 'Length:', buffer.length);
    
    const invoiceParser = new InvoiceParser();
    
    // Parse PDF text
    const pdf = require('pdf-parse');
    let pdfData;
    try {
      pdfData = await pdf(buffer);
      console.log('Upload Multiple - PDF parsed successfully, text length:', pdfData.text.length);
    } catch (pdfError) {
      console.error('Upload Multiple - PDF parsing error:', pdfError);
      return res.status(400).json({ 
        success: false, 
        error: `Failed to parse PDF: ${pdfError.message}` 
      });
    }
    
    // Parse multiple invoices from text
    const parsedData = invoiceParser.parseFromText(pdfData.text);
    console.log('Parsed multiple invoices data:', parsedData);

    if (!parsedData.success) {
      return res.status(400).json({ 
        success: false, 
        error: parsedData.error || 'Failed to parse invoices' 
      });
    }

    // Process each invoice
    const storedInvoices = [];
    const successfulUploads = [];
    const failedUploads = [];

    for (const invoiceData of parsedData.invoices) {
      try {
        // Validate invoice data
        if (
          !invoiceData ||
          typeof invoiceData.invoiceNo !== 'string' ||
          !invoiceData.invoiceNo.trim() ||
          !invoiceData.invoiceDate ||
          isNaN(new Date(invoiceData.invoiceDate).getTime()) ||
          typeof invoiceData.store !== 'string' ||
          !invoiceData.store.trim() ||
          typeof invoiceData.totalAmount !== 'number' ||
          !Array.isArray(invoiceData.items) ||
          invoiceData.items.length === 0
        ) {
          throw new Error('Invalid invoice data: missing or incorrect required fields');
        }

        // Validate each item
        for (const item of invoiceData.items) {
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
            throw new Error(`Invalid item data: ${JSON.stringify(item)}`);
          }
        }

        // Check if invoice already exists
        const existingInvoice = await Invoice.findOne({ invoiceNo: invoiceData.invoiceNo });
        if (existingInvoice) {
          console.log(`Invoice ${invoiceData.invoiceNo} already exists, skipping`);
          continue;
        }

        // Create invoice
        const invoice = new Invoice({
          invoiceNo: invoiceData.invoiceNo,
          invoiceDate: new Date(invoiceData.invoiceDate),
          store: invoiceData.store,
          totalAmount: invoiceData.totalAmount,
          totalQty: invoiceData.totalQty,
          fileReference: req.file.originalname,
          uploadedBy: req.user.id,
          uploadedAt: new Date()
        });

        await invoice.save();

        // Create invoice items
        const invoiceItems = invoiceData.items.map(item => ({
          invoiceId: invoice.id,
          slNo: item.slNo,
          itemCode: item.itemCode,
          itemName: item.itemName,
          hsnCode: item.hsnCode,
          qty: item.qty,
          uom: item.uom,
          rate: item.rate,
          total: item.total
        }));

        await InvoiceItem.bulkCreate(invoiceItems);

        // Update stock for each item
        for (const item of invoiceData.items) {
          try {
            // Find or create product
            let product = await Product.findOne({ itemCode: item.itemCode });
            if (!product) {
              product = await Product.create({
                itemCode: item.itemCode,
                itemName: item.itemName,
                hsnCode: item.hsnCode,
                uom: item.uom,
                currentStock: 0
              });
            }

            // Create stock batch
            await StockBatch.create({
              productId: product.id,
              batchType: 'inward',
              quantity: item.qty,
              rate: item.rate,
              totalAmount: item.total,
              reference: `Invoice: ${invoiceData.invoiceNo}`,
              referenceId: invoice.id,
              referenceType: 'invoice',
              createdAt: new Date(invoiceData.invoiceDate)
            });

            // Update product stock
            await product.update({
              currentStock: product.currentStock + item.qty
            });
          } catch (stockError) {
            console.error(`Error updating stock for item ${item.itemCode}:`, stockError);
          }
        }

        storedInvoices.push(invoice);
        successfulUploads.push({
          invoiceNo: invoiceData.invoiceNo,
          itemsCount: invoiceData.items.length,
          totalAmount: invoiceData.totalAmount
        });

      } catch (error) {
        console.error(`Error processing invoice ${invoiceData.invoiceNo}:`, error);
        failedUploads.push({
          invoiceNo: invoiceData.invoiceNo || 'Unknown',
          error: error.message
        });
      }
    }

    let message = 'Multiple invoices processed successfully';
    if (successfulUploads.length > 0) {
      message = `${successfulUploads.length} invoice(s) uploaded successfully`;
      if (failedUploads.length > 0) {
        message += `, ${failedUploads.length} failed`;
      }
    } else if (failedUploads.length > 0) {
      message = 'All invoices failed to upload';
    }

    res.json({
      success: true,
      message,
      storedInvoices,
      successfulUploads: successfulUploads.length,
      failedUploads: failedUploads.length,
      uploadDetails: {
        successful: successfulUploads,
        failed: failedUploads
      },
      parsedData
    });

  } catch (error) {
    console.error('Multiple invoice upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to upload invoices: ${error.message}` 
    });
  }
};

module.exports = { 
  parseMultipleInvoices,
  uploadInvoice, 
  uploadMultipleInvoices,
  verifyInvoice, 
  checkInvoice,
  getInvoicesByMonth,
  getInvoiceById,
  getInvoiceItems,
  updateInvoiceStatus,
  getInvoicesFromRosReceipts
};