// File: backend/controllers/creditNoteController.js
const CreditNoteParser = require('../utils/creditNoteParser');
const returnsController = require('./returnsController');
const db = require('../config/database');
const { creditNoteUpload, downloadFileFromCloudinary, getFileUrl } = require('../utils/cloudinary');

// Middleware for file upload using Cloudinary
const uploadMiddleware = creditNoteUpload.single('file');

// Upload credit note file
const uploadCreditNote = (req, res) => {
  uploadMiddleware(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
    uploadCreditNoteHandler(req, res);
  });
};

const uploadCreditNoteHandler = async (req, res) => {
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

    console.log('File uploaded to Cloudinary:', {
      fileName,
      originalName,
      cloudinaryUrl,
      publicId
    });

    // Download file from Cloudinary for parsing
    const fileBuffer = await downloadFileFromCloudinary(publicId);
    
    // Parse the uploaded credit note using buffer
    const parser = new CreditNoteParser();
    const parsedData = await parser.parseFromBuffer(fileBuffer);
    
    if (!parsedData.success) {
      return res.status(400).json({ success: false, error: parsedData.error });
    }

    // Validate parsed data
    const validation = parser.validateParsedData(parsedData);
    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid credit note format',
        validationErrors: validation.errors
      });
    }

    // Store each credit note in the database (now split by return date)
    const storedCreditNotes = [];
    for (const creditNote of parsedData.creditNotes) {
      try {
        // Create unique identifier for this credit note + return date combination
        const uniqueId = `${creditNote.creditNoteNumber}_${creditNote.returnDate}`;
        
        // Check if this specific credit note + return date combination already exists
        const [existing] = await db.execute(
          'SELECT id, cloudinary_url FROM credit_notes WHERE credit_note_number = ? AND date = ?',
          [creditNote.creditNoteNumber, creditNote.returnDate || creditNote.date]
        );

        if (existing.length > 0) {
          // Check if it's from the same Cloudinary file
          const existingCloudinaryUrl = existing[0].cloudinary_url;
          if (existingCloudinaryUrl === cloudinaryUrl) {
            // Same PDF, same credit note number, same return date - this is expected for split entries
            console.log(`Credit note ${creditNote.creditNoteNumber} with return date ${creditNote.returnDate || creditNote.date} already exists from same file, skipping...`);
            continue;
          } else {
            // Different PDF file, same credit note number and return date - this is a duplicate
            return res.status(400).json({ 
              success: false, 
              error: `Credit note ${creditNote.creditNoteNumber} with return date ${creditNote.returnDate || creditNote.date} already exists from a different file` 
            });
          }
        }

        const [result] = await db.execute(`
          INSERT INTO credit_notes (
            credit_note_number, date, return_date, receiver_name, receiver_gstin, 
            reason, total_items, gross_value, net_value, 
            file_name, original_name, cloudinary_url, cloudinary_public_id, items, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
          creditNote.creditNoteNumber,
          creditNote.date, // Original credit note date
          creditNote.returnDate || creditNote.date, // Return date (item-specific)
          creditNote.receiver?.name || 'Unknown',
          creditNote.receiver?.gstin || 'Unknown',
          creditNote.reason || 'EXPIRED GOODS',
          creditNote.totalItems || creditNote.items?.length || 0,
          creditNote.totals?.grossValue || 0,
          creditNote.totals?.netValue || 0,
          fileName,
          originalName,
          cloudinaryUrl,
          publicId,
          JSON.stringify(creditNote.items || [])
        ]);

        // Check if this credit note exists in any ROS receipt (reverse logic)
        await checkAndUpdateCreditNoteStatus(result.insertId, creditNote.creditNoteNumber);

        storedCreditNotes.push({
          id: result.insertId,
          creditNoteNumber: creditNote.creditNoteNumber,
          returnDate: creditNote.returnDate,
          success: true
        });
      } catch (dbError) {
        storedCreditNotes.push({
          creditNoteNumber: creditNote.creditNoteNumber,
          returnDate: creditNote.returnDate,
          success: false,
          error: dbError.message || 'Failed to store credit note'
        });
      }
    }

    // Check if any credit notes were successfully stored
    const successfulUploads = storedCreditNotes.filter(cn => cn.success);
    const failedUploads = storedCreditNotes.filter(cn => !cn.success);
    const samePdfSkips = failedUploads.filter(cn => cn.error.includes('already exists in this PDF'));
    const differentPdfSkips = failedUploads.filter(cn => cn.error.includes('already exists from a different PDF'));
    
    // Auto-compare with returns for each successful upload
    const comparisonResults = [];
    if (successfulUploads.length > 0) {
      for (const creditNote of successfulUploads) {
        try {
          const returnDate = creditNote.returnDate;
          if (returnDate) {
            console.log(`Auto-comparing credit note ${creditNote.creditNoteNumber} for date ${returnDate}`);
            
            // Get pending returns for this date
            const [pendingReturns] = await db.execute(`
              SELECT 
                r.id,
                p.item_code,
                r.quantity,
                r.rtd,
                r.credit_status,
                r.return_date,
                r.type,
                p.name as product_name
              FROM returns r
              LEFT JOIN products p ON r.product_id = p.id
              WHERE r.credit_status = 'pending' 
              AND DATE(r.return_date) = ?
              ORDER BY p.item_code, r.quantity
            `, [returnDate]);
            
            // Get credit note items for this specific credit note
            const [creditNoteData] = await db.execute(`
              SELECT items FROM credit_notes WHERE id = ?
            `, [creditNote.id]);
            
            if (creditNoteData.length > 0) {
              const items = JSON.parse(creditNoteData[0].items);
              
              // Compare and update status
              const matches = [];
              const unmatchedReturns = [...pendingReturns];
              
              for (const returnItem of pendingReturns) {
                for (let i = items.length - 1; i >= 0; i--) {
                  const creditItem = items[i];
                  
                  // Check if item codes match
                  if (returnItem.item_code === creditItem.itemCode) {
                    // Check if RTD matches (GRM = 15.00, GVN = 0.00)
                    const returnRtd = parseFloat(returnItem.rtd);
                    const creditRtd = parseFloat(creditItem.rtd);
                    
                    if (returnRtd === creditRtd) {
                      // Check if quantities match
                      if (returnItem.quantity === creditItem.quantity) {
                        // Perfect match - update to received
                        await db.execute(
                          `UPDATE returns SET credit_status = 'received' WHERE id = ?`,
                          [returnItem.id]
                        );
                        matches.push({
                          returnId: returnItem.id,
                          itemCode: returnItem.item_code,
                          quantity: returnItem.quantity,
                          status: 'received'
                        });
                        unmatchedReturns.splice(unmatchedReturns.findIndex(r => r.id === returnItem.id), 1);
                        items.splice(i, 1);
                        break;
                      } else {
                        // Quantity mismatch - update to alert
                        await db.execute(
                          `UPDATE returns SET credit_status = 'alert' WHERE id = ?`,
                          [returnItem.id]
                        );
                        matches.push({
                          returnId: returnItem.id,
                          itemCode: returnItem.item_code,
                          returnQuantity: returnItem.quantity,
                          creditQuantity: creditItem.quantity,
                          status: 'alert'
                        });
                        unmatchedReturns.splice(unmatchedReturns.findIndex(r => r.id === returnItem.id), 1);
                        items.splice(i, 1);
                        break;
                      }
                    }
                  }
                }
              }
              
              // Update remaining unmatched returns to alert
              for (const unmatchedReturn of unmatchedReturns) {
                await db.execute(
                  `UPDATE returns SET credit_status = 'alert' WHERE id = ?`,
                  [unmatchedReturn.id]
                );
                matches.push({
                  returnId: unmatchedReturn.id,
                  itemCode: unmatchedReturn.item_code,
                  quantity: unmatchedReturn.quantity,
                  status: 'alert'
                });
              }
              
              comparisonResults.push({
                creditNoteNumber: creditNote.creditNoteNumber,
                returnDate,
                perfectMatches: matches.filter(m => m.status === 'received').length,
                alerts: matches.filter(m => m.status === 'alert').length,
                totalProcessed: matches.length
              });
              
              console.log(`Auto-comparison completed for ${creditNote.creditNoteNumber}: ${matches.filter(m => m.status === 'received').length} received, ${matches.filter(m => m.status === 'alert').length} alerts`);
            }
          }
        } catch (compareError) {
          console.error(`Error auto-comparing credit note ${creditNote.creditNoteNumber}:`, compareError);
          comparisonResults.push({
            creditNoteNumber: creditNote.creditNoteNumber,
            returnDate: creditNote.returnDate,
            error: compareError.message
          });
        }
      }
    }
    
    let message = 'Credit note processed successfully';
    if (successfulUploads.length > 0) {
      message = `${successfulUploads.length} credit note entry(ies) uploaded successfully`;
      if (samePdfSkips.length > 0) {
        message += `, ${samePdfSkips.length} skipped (already processed from this PDF)`;
      }
      if (differentPdfSkips.length > 0) {
        message += `, ${differentPdfSkips.length} skipped (already exists from different PDF)`;
      }
      
      // Add comparison results to message
      const totalReceived = comparisonResults.reduce((sum, r) => sum + (r.perfectMatches || 0), 0);
      const totalAlerts = comparisonResults.reduce((sum, r) => sum + (r.alerts || 0), 0);
      if (totalReceived > 0 || totalAlerts > 0) {
        message += `. Auto-comparison: ${totalReceived} items marked as received, ${totalAlerts} items marked as alert`;
      }
    } else if (differentPdfSkips.length > 0) {
      message = 'Credit note already exists from a different PDF';
    } else if (samePdfSkips.length > 0) {
      message = 'All credit note entries from this PDF have already been processed';
    }
    
    res.json({ 
      success: true, 
      message,
      file: {
        fileName,
        originalName,
        path: relativePath,
        size: req.file.size
      },
      storedCreditNotes,
      successfulUploads: successfulUploads.length,
      failedUploads: failedUploads.length,
      comparisonResults,
      parsedData
    });
  } catch (error) {
    console.error('Error uploading credit note:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Parse credit note from uploaded file
const parseCreditNote = (req, res) => {
  uploadMiddleware(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
    parseCreditNoteHandler(req, res);
  });
};

const parseCreditNoteHandler = async (req, res) => {
  try {
    console.log('🔍 Credit note parse request received');
    
    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    console.log('📄 File received:', {
      originalname: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Download file from Cloudinary for parsing
    const { downloadFileFromCloudinary } = require('../utils/cloudinary');
    const fileBuffer = await downloadFileFromCloudinary(req.file.public_id);
    
    const parser = new CreditNoteParser();
    const parsedData = await parser.parseFromBuffer(fileBuffer, req.file.originalname);
    
    console.log('📊 Parse result:', {
      success: parsedData.success,
      error: parsedData.error,
      creditNotesCount: parsedData.creditNotes?.length || 0
    });
    
    if (!parsedData.success) {
      console.log('❌ Parse failed:', parsedData.error);
      return res.status(400).json({ success: false, error: parsedData.error });
    }

    // Validate parsed data
    const validation = parser.validateParsedData(parsedData);
    console.log('✅ Validation result:', validation);
    
    if (!validation.isValid) {
      console.log('❌ Validation failed:', validation.errors);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid credit note format',
        validationErrors: validation.errors
      });
    }

    console.log('✅ Credit note parsed successfully, sending response');
    res.json({ 
      success: true, 
      creditNotes: parsedData.creditNotes || [],
      totalCreditNotes: parsedData.totalCreditNotes || parsedData.creditNotes?.length || 0,
      debugInfo: parsedData.debugInfo || { totalLines: 0, firstLines: [] },
      message: 'Credit note parsed successfully'
    });
  } catch (error) {
    console.error('❌ Error parsing credit note:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Parse and process credit note from file path (for stored files)
const parseCreditNoteFromPath = async (req, res) => {
  try {
    const { filePath, date } = req.body; // Changed from fileName to filePath to match upload response
    
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'File path is required' });
    }

    const fullFilePath = path.join(__dirname, '..', filePath); // Resolve full path from relative path
    if (!fs.existsSync(fullFilePath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const parser = new CreditNoteParser();
    const parsedData = await parser.parseFromFile(fullFilePath);
    
    if (!parsedData.success) {
      return res.status(400).json({ success: false, error: parsedData.error });
    }

    // Validate parsed data
    const validation = parser.validateParsedData(parsedData);
    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid credit note format',
        validationErrors: validation.errors
      });
    }

    // Process each credit note
    const processResults = [];
    
    for (const creditNote of parsedData.creditNotes) {
      const targetDate = date || creditNote.date;
      if (!targetDate) {
        processResults.push({
          creditNoteNumber: creditNote.creditNoteNumber,
        success: false, 
          error: 'Date is required'
        });
        continue;
      }

      // Process with returns controller
      const processResult = await returnsController.processCreditNote(req, res, {
        creditNoteData: creditNote.items,
        date: targetDate
      });
      processResults.push({
        creditNoteNumber: creditNote.creditNoteNumber,
        date: targetDate,
        ...processResult
      });
    }

    res.json({ 
      success: true, 
      message: 'Credit note parsed and processed successfully',
      parsedData: {
        totalCreditNotes: parsedData.totalCreditNotes,
        creditNotes: parsedData.creditNotes
      },
      processResults
    });
  } catch (error) {
    console.error('Error parsing credit note:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Process credit note with returns (internal function)
const processCreditNoteWithReturns = async (req, res, { creditNoteData, date }) => {
  try {
    // Delegate to returnsController with proper context
    const result = await returnsController.processCreditNote(req, res, { creditNoteData, date });
    return result || { success: false, error: 'Processing failed' };
  } catch (error) {
    console.error('Error processing credit note with returns:', error);
    throw error;
  }
};

// Get credit note processing history
const getCreditNoteHistory = async (req, res) => {
  try {
    const { date } = req.query;
    
    const reqObj = {
      query: { date: date || new Date().toISOString().split('T')[0] }
    };
    
    const resData = await returnsController.getProcessedReturnsForCreditNote(reqObj, res);
    
    if (resData.success) {
      const processedReturns = resData.processedReturns;
      const summary = {
        totalReturns: processedReturns.length,
        pendingReturns: processedReturns.filter(r => r.creditStatus === 'pending').length,
        receivedReturns: processedReturns.filter(r => r.creditStatus === 'received').length,
        grmReturns: processedReturns.filter(r => r.type === 'GRM').length,
        gvnReturns: processedReturns.filter(r => r.type === 'GVN').length
      };
      
      res.json({
        success: true,
        date: resData.date,
        summary,
        returns: processedReturns
      });
    } else {
      res.status(500).json({ success: false, error: 'Failed to fetch returns data' });
    }
  } catch (error) {
    console.error('Error fetching credit note history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Store parsed credit note in database
const storeCreditNote = async (req, res) => {
  try {
    const { creditNoteData, fileName, originalName } = req.body;
    
    if (!creditNoteData || !creditNoteData.creditNotes) {
      return res.status(400).json({ success: false, error: 'Credit note data is required' });
    }

    const storedCreditNotes = [];
    
    for (const creditNote of creditNoteData.creditNotes) {
      const creditNoteRecord = {
        credit_note_number: creditNote.creditNoteNumber,
        date: creditNote.date,
        receiver_name: creditNote.receiver?.name || '',
        receiver_gstin: creditNote.receiver?.gstin || '',
        reason: creditNote.reason || '',
        total_items: creditNote.totalItems,
        gross_value: creditNote.totals?.grossValue || 0,
        net_value: creditNote.totals?.netValue || 0,
        file_name: fileName,
        original_name: originalName,
        items: JSON.stringify(creditNote.items),
        created_at: new Date()
      };

      try {
        const [result] = await db.execute(
          `INSERT INTO credit_notes 
           (credit_note_number, date, receiver_name, receiver_gstin, reason, total_items, gross_value, net_value, file_name, original_name, items, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            creditNoteRecord.credit_note_number,
            creditNoteRecord.date,
            creditNoteRecord.receiver_name,
            creditNoteRecord.receiver_gstin,
            creditNoteRecord.reason,
            creditNoteRecord.total_items,
            creditNoteRecord.gross_value,
            creditNoteRecord.net_value,
            creditNoteRecord.file_name,
            creditNoteRecord.original_name,
            creditNoteRecord.items,
            creditNoteRecord.created_at
          ]
        );

        storedCreditNotes.push({
          id: result.insertId,
          ...creditNoteRecord,
          items: creditNote.items
        });
      } catch (dbError) {
        if (dbError.code === 'ER_DUP_ENTRY') {
          storedCreditNotes.push({
            creditNoteNumber: creditNoteRecord.credit_note_number,
        success: false, 
            error: 'Duplicate credit note number'
      });
        } else {
          throw dbError;
        }
      }
    }

    res.json({ 
      success: true, 
      message: 'Credit notes stored successfully',
      storedCreditNotes
    });
  } catch (error) {
    console.error('Error storing credit note:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get all credit notes with month filter
const getAllCreditNotes = async (req, res) => {
  try {
    const { month } = req.query;
    
    let query = `
      SELECT 
        id,
        credit_note_number,
        date,
        return_date,
        receiver_name,
        receiver_gstin,
        reason,
        total_items,
        gross_value,
        net_value,
        file_name,
        original_name,
        items,
        created_at,
        COALESCE(status, 'pending') as status
      FROM credit_notes
    `;
    
    const params = [];
    
    if (month) {
      query += ` WHERE DATE_FORMAT(date, '%Y-%m') = ?`;
      params.push(month);
    }
    
    query += ` ORDER BY date DESC, created_at DESC LIMIT 100`; // Added limit for performance
    
    const [creditNotes] = await db.execute(query, params);
    
    // Filter out any credit notes with invalid items JSON
    const validCreditNotes = creditNotes.filter(row => {
      try {
        if (row.items && typeof row.items === 'string') {
          JSON.parse(row.items);
        }
        return true;
      } catch (e) {
        console.warn(`Skipping credit note ${row.id} due to invalid items JSON`);
        return false;
      }
    });
    
    res.json({
      success: true,
      creditNotes: validCreditNotes.map(row => ({
        id: row.id,
        creditNoteNumber: row.credit_note_number,
        date: row.date, // Original credit note date
        returnDate: row.return_date || row.date, // Use return_date if available, otherwise fallback to date
        receiverName: row.receiver_name,
        receiverGstin: row.receiver_gstin,
        reason: row.reason,
        totalItems: row.total_items,
        grossValue: Number(row.gross_value) || 0,
        netValue: Number(row.net_value) || 0,
        fileName: row.file_name,
        originalName: row.original_name,
        status: row.status || 'pending', // Default to pending if not set
        items: (() => {
          try {
            if (!row.items) return [];
            if (typeof row.items === 'string') {
              return JSON.parse(row.items);
            }
            return row.items;
          } catch (e) {
            console.warn('Failed to parse items JSON:', e.message);
            return [];
          }
        })(),
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching credit notes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get credit note details by ID
const getCreditNoteDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await db.execute(
      `SELECT 
        id,
        credit_note_number,
        date,
        return_date,
        receiver_name,
        receiver_gstin,
        reason,
        total_items,
        gross_value,
        net_value,
        file_name,
        original_name,
        items,
        created_at
      FROM credit_notes 
      WHERE id = ?`,
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Credit note not found' });
    }
    
    const creditNote = rows[0];
    
    res.json({
      success: true,
      creditNote: {
        id: creditNote.id,
        creditNoteNumber: creditNote.credit_note_number,
        date: creditNote.date,
        returnDate: creditNote.return_date || creditNote.date, // Use return_date if available, otherwise fallback to date
        receiverName: creditNote.receiver_name,
        receiverGstin: creditNote.receiver_gstin,
        reason: creditNote.reason,
        totalItems: creditNote.total_items,
        grossValue: Number(creditNote.gross_value) || 0,
        netValue: Number(creditNote.net_value) || 0,
        fileName: creditNote.file_name,
        originalName: creditNote.original_name,
        items: (() => {
          try {
            if (!creditNote.items) return [];
            if (typeof creditNote.items === 'string') {
              return JSON.parse(creditNote.items);
            }
            return creditNote.items;
          } catch (e) {
            console.warn('Failed to parse items JSON in credit note details:', e.message);
            return [];
          }
        })(),
        createdAt: creditNote.created_at
      }
    });
  } catch (error) {
    console.error('Error fetching credit note details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update credit note status
const updateCreditNoteStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'cleared'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Status must be either "pending" or "cleared"' 
      });
    }

    const query = `
      UPDATE credit_notes 
      SET status = ? 
      WHERE id = ?
    `;

    const [result] = await db.execute(query, [status, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Credit note not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Credit note status updated successfully',
      status 
    });
  } catch (error) {
    console.error('Error updating credit note status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Check if credit note exists in any ROS receipt and update status to cleared (reverse logic)
const checkAndUpdateCreditNoteStatus = async (creditNoteId, creditNoteNumber) => {
  try {
    console.log(`Checking reverse logic for credit note: ${creditNoteNumber}`);
    
    // Check if this credit note number exists in any ROS receipt bills
    const [rosReceipts] = await db.execute(`
      SELECT id, receipt_number, bills 
      FROM ros_receipts 
      WHERE JSON_SEARCH(bills, 'one', ?, NULL, '$[*].bill_number') IS NOT NULL
    `, [creditNoteNumber]);
    
    if (rosReceipts.length > 0) {
      console.log(`Found ${rosReceipts.length} ROS receipt(s) containing credit note ${creditNoteNumber}`);
      
      // Update credit note status to cleared
      await db.execute(`
        UPDATE credit_notes 
        SET status = 'cleared' 
        WHERE id = ?
      `, [creditNoteId]);
      
      console.log(`Updated credit note ${creditNoteNumber} status to 'cleared' due to existing ROS receipt`);
      
      // Record the clearing in ros_receipt_cleared_items for each matching ROS receipt
      for (const rosReceipt of rosReceipts) {
        const bills = typeof rosReceipt.bills === 'string' ? JSON.parse(rosReceipt.bills) : rosReceipt.bills;
        
        // Find the matching bill in this ROS receipt
        const matchingBill = bills.find(bill => bill.bill_number === creditNoteNumber);
        if (matchingBill) {
          await db.execute(`
            INSERT INTO ros_receipt_cleared_items 
            (ros_receipt_id, item_type, item_id, bill_number, amount) 
            VALUES (?, 'credit_note', ?, ?, ?)
            ON DUPLICATE KEY UPDATE amount = VALUES(amount)
          `, [rosReceipt.id, creditNoteId, creditNoteNumber, matchingBill.amount]);
          
          console.log(`Recorded clearing for credit note ${creditNoteNumber} in ROS receipt ${rosReceipt.receipt_number}`);
        }
      }
    } else {
      console.log(`No ROS receipt found containing credit note ${creditNoteNumber}`);
    }
  } catch (error) {
    console.error('Error in reverse logic check:', error);
    // Don't throw error - this is a background process
  }
};

// Get credit notes from ROS receipts that don't exist in credit_notes table
const getCreditNotesFromRosReceipts = async (req, res) => {
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

    const creditNotesFromRos = [];

    for (const rosReceipt of rosReceipts) {
      const bills = typeof rosReceipt.bills === 'string' ? JSON.parse(rosReceipt.bills) : rosReceipt.bills;
      
      // Filter for CN (Credit Note) bills
      const cnBills = bills.filter(bill => bill.doc_type === 'CN');
      
      for (const bill of cnBills) {
        // Check if this credit note already exists in credit_notes table
        const [existingCreditNote] = await db.execute(
          'SELECT id FROM credit_notes WHERE credit_note_number = ?',
          [bill.bill_number]
        );
        
        // If it doesn't exist, add it to the list
        if (existingCreditNote.length === 0) {
          creditNotesFromRos.push({
            id: `ros_${rosReceipt.id}_${bill.bill_number}`, // Unique ID for frontend
            creditNoteNumber: bill.bill_number,
            date: bill.bill_date,
            returnDate: bill.bill_date,
            receiverName: 'From ROS Receipt',
            receiverGstin: 'Unknown GSTIN',
            reason: 'EXPIRED GOODS',
            totalItems: 1,
            grossValue: Number(bill.amount) || 0,
            netValue: Number(bill.amount) || 0,
            fileName: rosReceipt.receipt_number,
            originalName: rosReceipt.receipt_number,
            items: [],
            createdAt: rosReceipt.created_at,
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
      creditNotes: creditNotesFromRos,
      count: creditNotesFromRos.length
    });

  } catch (error) {
    console.error('Error fetching credit notes from ROS receipts:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

module.exports = {
  uploadCreditNote,
  parseCreditNote,
  parseCreditNoteFromPath,
  getCreditNoteHistory,
  storeCreditNote,
  getAllCreditNotes,
  getCreditNoteDetails,
  updateCreditNoteStatus,
  getCreditNotesFromRosReceipts
};