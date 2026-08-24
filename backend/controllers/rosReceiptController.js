const db = require('../config/database');
const { parseRosReceiptPDF, parseRosReceiptPDFFromBuffer } = require('../utils/rosReceiptParser');
const { getDemoData } = require('../middleware/demoMode');

// Get all ROS receipts with optional month filter
const getAllRosReceipts = async (req, res) => {
  try {
    const { month } = req.query;
    
    // Return demo data if demo user
    if (req.isDemo) {
      const demoRosReceipts = getDemoData('rosReceipts');
      const filteredReceipts = month ? demoRosReceipts.filter(receipt => {
        const receiptDate = new Date(receipt.receipt_date);
        const monthStr = receiptDate.toISOString().slice(0, 7); // YYYY-MM
        return monthStr === month;
      }) : demoRosReceipts;
      
      const rosReceipts = filteredReceipts.map(row => ({
        id: row.id,
        receiptNumber: row.receipt_number,
        receiptDate: row.receipt_date,
        receivedFrom: row.received_from,
        totalAmount: parseFloat(row.total_amount),
        paymentMethod: row.payment_method,
        bills: row.bills,
        fileName: row.file_name,
        originalName: row.original_name,
        createdAt: row.created_at
      }));
      
      return res.json({
        success: true,
        rosReceipts
      });
    }
    
    let query = `
      SELECT 
        id,
        receipt_number,
        receipt_date,
        received_from,
        total_amount,
        payment_method,
        bills,
        file_name,
        original_name,
        created_at
      FROM ros_receipts
    `;
    
    const params = [];
    
    if (month) {
      query += ` WHERE DATE_FORMAT(receipt_date, '%Y-%m') = ?`;
      params.push(month);
    }
    
    query += ` ORDER BY receipt_date DESC, created_at DESC`;
    
    const [rows] = await db.execute(query, params);
    
    console.log('ROS receipts raw data:', rows);
    
    const rosReceipts = rows.map(row => {
      let totalAmount = parseFloat(row.total_amount) || 0;
      
      // If total_amount is 0 or null, calculate from bills
      if (totalAmount === 0 && row.bills) {
        try {
          const bills = typeof row.bills === 'string' ? JSON.parse(row.bills) : row.bills;
          if (Array.isArray(bills)) {
            totalAmount = bills.reduce((sum, bill) => sum + (parseFloat(bill.amount) || 0), 0);
          }
        } catch (e) {
          console.warn('Error parsing bills for total amount calculation:', e);
        }
      }
      
      return {
        id: row.id,
        receiptNumber: row.receipt_number,
        receiptDate: row.receipt_date,
        receivedFrom: row.received_from,
        totalAmount,
        paymentMethod: row.payment_method,
        bills: typeof row.bills === 'string' ? JSON.parse(row.bills) : row.bills,
        fileName: row.file_name,
        originalName: row.original_name,
        createdAt: row.created_at
      };
    });
    
    res.json({
      success: true,
      rosReceipts
    });
  } catch (error) {
    console.error('Error fetching ROS receipts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get ROS receipt by ID
const getRosReceiptById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Return demo data if demo user
    if (req.isDemo) {
      const demoRosReceipts = getDemoData('rosReceipts');
      const receipt = demoRosReceipts.find(r => r.id === parseInt(id));
      
      if (!receipt) {
        return res.status(404).json({ success: false, error: 'ROS receipt not found' });
      }
      
      const rosReceipt = {
        id: receipt.id,
        receiptNumber: receipt.receipt_number,
        receiptDate: receipt.receipt_date,
        receivedFrom: receipt.received_from,
        totalAmount: parseFloat(receipt.total_amount),
        paymentMethod: receipt.payment_method,
        bills: receipt.bills,
        fileName: receipt.file_name,
        originalName: receipt.original_name,
        createdAt: receipt.created_at
      };
      
      return res.json({
        success: true,
        rosReceipt
      });
    }
    
    const query = `
      SELECT 
        id,
        receipt_number,
        receipt_date,
        received_from,
        total_amount,
        payment_method,
        bills,
        file_name,
        original_name,
        created_at
      FROM ros_receipts
      WHERE id = ?
    `;
    
    const [rows] = await db.execute(query, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'ROS receipt not found' });
    }
    
    const receipt = rows[0];
    const rosReceipt = {
      id: receipt.id,
      receiptNumber: receipt.receipt_number,
      receiptDate: receipt.receipt_date,
      receivedFrom: receipt.received_from,
      totalAmount: parseFloat(receipt.total_amount),
      paymentMethod: receipt.payment_method,
      bills: typeof receipt.bills === 'string' ? JSON.parse(receipt.bills) : receipt.bills,
      fileName: receipt.file_name,
      originalName: receipt.original_name,
      createdAt: receipt.created_at
    };
    
    res.json({
      success: true,
      rosReceipt
    });
  } catch (error) {
    console.error('Error fetching ROS receipt:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Upload and parse ROS receipt
const uploadRosReceipt = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    // Cloudinary provides file info in req.file
    const cloudinaryFile = req.file;
    const fileName = cloudinaryFile.filename;
    const originalName = cloudinaryFile.originalname;
    const cloudinaryUrl = cloudinaryFile.path; // Cloudinary URL
    const publicId = cloudinaryFile.public_id; // Cloudinary public ID

    console.log('ROS Receipt uploaded to Cloudinary:', {
      fileName,
      originalName,
      cloudinaryUrl,
      publicId
    });
    
    // Download file from Cloudinary for parsing
    const { downloadFileFromCloudinary } = require('../utils/cloudinary');
    const actualPublicId = publicId || fileName;
    console.log('Using public_id for download:', actualPublicId);
    const fileBuffer = await downloadFileFromCloudinary(actualPublicId);
    
    // Parse the ROS receipt PDF using buffer
    const parsedData = await parseRosReceiptPDFFromBuffer(fileBuffer);
    
    if (!parsedData.success) {
      return res.status(400).json({ success: false, error: parsedData.error });
    }
    
    // Check if receipt already exists
    const existingQuery = `SELECT id FROM ros_receipts WHERE receipt_number = ?`;
    const [existingRows] = await db.execute(existingQuery, [parsedData.data.receipt_number]);
    
    if (existingRows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'ROS receipt with this number already exists' 
      });
    }
    
    // Insert ROS receipt
    const insertQuery = `
      INSERT INTO ros_receipts (
        receipt_number, receipt_date, received_from, total_amount, 
        payment_method, bills, file_name, original_name, cloudinary_url, cloudinary_public_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const [result] = await db.execute(insertQuery, [
      parsedData.data.receipt_number,
      parsedData.data.receipt_date,
      parsedData.data.received_from,
      parsedData.data.total_amount,
      parsedData.data.payment_method,
      JSON.stringify(parsedData.data.bills),
      fileName,
      originalName,
      cloudinaryUrl,
      actualPublicId
    ]);
    
    const rosReceiptId = result.insertId;
    
    // Process bills and update invoice/credit note statuses
    await processBillsAndUpdateStatuses(rosReceiptId, parsedData.data.bills);
    
    res.json({
      success: true,
      message: 'ROS receipt uploaded and processed successfully',
      rosReceiptId,
      data: parsedData.data
    });
    
  } catch (error) {
    console.error('Error uploading ROS receipt:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Process bills and update invoice/credit note statuses
const processBillsAndUpdateStatuses = async (rosReceiptId, bills) => {
  try {
    console.log(`Processing ${bills.length} bills for ROS receipt ${rosReceiptId}`);
    
    for (const bill of bills) {
      const { doc_type, bill_number, amount } = bill;
      
      console.log(`Processing bill: ${doc_type} - ${bill_number} - ${amount}`);
      
      if (doc_type === 'SR') {
        // Update invoice status - try multiple matching strategies
        // Strategy 1: Exact match by invoice number and amount
        let invoiceQuery = `
          UPDATE invoices 
          SET status = 'cleared' 
          WHERE invoice_number = ? AND ABS(total_amount - ?) < 0.01
        `;
        let [invoiceResult] = await db.execute(invoiceQuery, [bill_number, amount]);
        
        // Strategy 2: Match by invoice number only (if amount doesn't match)
        if (invoiceResult.affectedRows === 0) {
          invoiceQuery = `
            UPDATE invoices 
            SET status = 'cleared' 
            WHERE invoice_number = ?
          `;
          [invoiceResult] = await db.execute(invoiceQuery, [bill_number]);
        }
        
        // Strategy 3: Try to match partial invoice number (remove prefixes/suffixes)
        if (invoiceResult.affectedRows === 0) {
          const cleanBillNumber = bill_number.replace(/^[A-Z\/]+/, '').replace(/[\/\d]+$/, '');
          invoiceQuery = `
            UPDATE invoices 
            SET status = 'cleared' 
            WHERE invoice_number LIKE ? OR invoice_number LIKE ?
          `;
          [invoiceResult] = await db.execute(invoiceQuery, [`%${cleanBillNumber}%`, `%${bill_number}%`]);
        }
        
        console.log(`Invoice update result: ${invoiceResult.affectedRows} rows affected`);
        
        if (invoiceResult.affectedRows > 0) {
          // Get the actual invoice ID that was updated
          const [invoiceIdResult] = await db.execute(
            'SELECT id FROM invoices WHERE invoice_number = ? LIMIT 1',
            [bill_number]
          );
          
          if (invoiceIdResult.length > 0) {
            // Record the clearing with the actual invoice ID
            const clearQuery = `
              INSERT INTO ros_receipt_cleared_items 
              (ros_receipt_id, item_type, item_id, bill_number, amount) 
              VALUES (?, 'invoice', ?, ?, ?)
            `;
            await db.execute(clearQuery, [rosReceiptId, invoiceIdResult[0].id, bill_number, amount]);
            console.log(`Recorded clearing for invoice: ${bill_number}`);
          }
        } else {
          console.log(`No matching invoice found for: ${bill_number} with amount ${amount}`);
        }
      } else if (doc_type === 'CN') {
        // Update credit note status - try multiple matching strategies
        // Strategy 1: Exact match by credit note number
        let creditNoteQuery = `
          UPDATE credit_notes 
          SET status = 'cleared' 
          WHERE credit_note_number = ?
        `;
        let [creditNoteResult] = await db.execute(creditNoteQuery, [bill_number]);
        
        // Strategy 2: Match by partial credit note number
        if (creditNoteResult.affectedRows === 0) {
          const cleanBillNumber = bill_number.replace(/^[A-Z\/]+/, '').replace(/[\/\d]+$/, '');
          creditNoteQuery = `
            UPDATE credit_notes 
            SET status = 'cleared' 
            WHERE credit_note_number LIKE ? OR credit_note_number LIKE ?
          `;
          [creditNoteResult] = await db.execute(creditNoteQuery, [`%${cleanBillNumber}%`, `%${bill_number}%`]);
        }
        
        console.log(`Credit note update result: ${creditNoteResult.affectedRows} rows affected`);
        
        if (creditNoteResult.affectedRows > 0) {
          // Get the actual credit note ID that was updated
          const [creditNoteIdResult] = await db.execute(
            'SELECT id FROM credit_notes WHERE credit_note_number = ? LIMIT 1',
            [bill_number]
          );
          
          if (creditNoteIdResult.length > 0) {
            // Record the clearing with the actual credit note ID
            const clearQuery = `
              INSERT INTO ros_receipt_cleared_items 
              (ros_receipt_id, item_type, item_id, bill_number, amount) 
              VALUES (?, 'credit_note', ?, ?, ?)
            `;
            await db.execute(clearQuery, [rosReceiptId, creditNoteIdResult[0].id, bill_number, amount]);
            console.log(`Recorded clearing for credit note: ${bill_number}`);
          }
        } else {
          console.log(`No matching credit note found for: ${bill_number}`);
        }
      }
    }
    
    console.log(`Completed processing bills for ROS receipt ${rosReceiptId}`);
  } catch (error) {
    console.error('Error processing bills:', error);
    throw error;
  }
};

// Preview ROS receipt (parse without saving)
const previewRosReceipt = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    console.log('ROS Receipt preview - req.file:', {
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
    
    // Parse the ROS receipt PDF using buffer
    const parsedData = await parseRosReceiptPDFFromBuffer(fileBuffer);
    
    if (!parsedData.success) {
      return res.status(400).json({ success: false, error: parsedData.error });
    }
    
    res.json({
      success: true,
      data: parsedData.data
    });
    
  } catch (error) {
    console.error('Error previewing ROS receipt:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getAllRosReceipts,
  getRosReceiptById,
  uploadRosReceipt,
  previewRosReceipt
};
