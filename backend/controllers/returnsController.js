const Return = require('../models/Return');
const Damage = require('../models/Damage');
const StockBatch = require('../models/StockBatch');
const db = require('../config/database');

const getGrmReturns = async (req, res) => {
  try {
    const { date } = req.query;
    const toLocalYMD = (d) => {
      const dt = new Date(d);
      const year = dt.getFullYear();
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const targetDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toLocalYMD(new Date());

    // Get items that expire exactly today (only items expiring today can be processed)
    const today = new Date(targetDate);
    const todayStr = today.toISOString().split('T')[0];

    const [rows] = await db.execute(
      `SELECT 
        sb.id as batch_id,
        sb.product_id,
        sb.quantity as batch_quantity,
        -- Effective expiry based on current product shelf life
        CASE 
          WHEN p.shelf_life_days IS NOT NULL AND p.shelf_life_days >= 0 THEN DATE_ADD(sb.invoice_date, INTERVAL p.shelf_life_days DAY)
          ELSE sb.expiry_date
        END AS expiry_date,
        sb.invoice_date,
        sb.invoice_reference,
        p.name,
        p.item_code,
        p.category,
        p.shelf_life_days,
        p.invoice_price,
        p.hsn_code,
        p.image_url,
        COALESCE(
          sb.quantity - 
          COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.batch_id = sb.id), 0) -
          COALESCE((SELECT SUM(r.quantity) FROM returns r WHERE r.batch_id = sb.id), 0),
          0
        ) AS available_quantity
      FROM stock_batches sb
      JOIN products p ON sb.product_id = p.id
      WHERE p.is_active = 1
        AND (p.shelf_life_days IS NULL OR p.shelf_life_days > 0)
        AND DATE(
          CASE 
            WHEN p.shelf_life_days IS NOT NULL AND p.shelf_life_days >= 0 THEN DATE_ADD(sb.invoice_date, INTERVAL p.shelf_life_days DAY)
            ELSE sb.expiry_date
          END
        ) = ?
      HAVING available_quantity > 0
      ORDER BY p.name`,
      [todayStr]
    );

    // Also get already processed returns for the target date
    const [processedReturns] = await db.execute(
      `SELECT 
        r.id,
        r.product_id,
        r.batch_id,
        r.quantity,
        r.return_date,
        r.invoice_price,
        r.loss_amount,
        p.name,
        p.item_code,
        p.hsn_code,
        p.image_url,
        sb.expiry_date,
        sb.invoice_date,
        sb.invoice_reference
      FROM returns r
      JOIN products p ON r.product_id = p.id
      JOIN stock_batches sb ON r.batch_id = sb.id
      WHERE r.type = 'GRM' AND r.return_date = ?`,
      [targetDate]
    );

    res.json({
      success: true,
      grmItems: rows.map(row => ({
        id: row.batch_id,
        product_id: row.product_id,
        name: row.name,
        item_code: row.item_code,
        category: row.category,
        shelf_life_days: row.shelf_life_days,
        quantity: Number(row.available_quantity),
        invoice_price: Number(row.invoice_price),
        image_url: row.image_url || '/placeholder.svg',
        hsn_code: row.hsn_code || '',
        grm_value: Number((row.available_quantity * row.invoice_price * 0.15).toFixed(2)),
        expiry_date: row.expiry_date,
        invoice_date: row.invoice_date,
        invoice_reference: row.invoice_reference
      })),
      processed: processedReturns.map(row => ({
        id: row.id,
        product_id: row.product_id,
        batch_id: row.batch_id,
        name: row.name,
        item_code: row.item_code,
        quantity: Number(row.quantity),
        invoice_price: Number(row.invoice_price),
        loss_amount: Number(row.loss_amount),
        return_date: row.return_date,
        image_url: row.image_url || '/placeholder.svg',
        hsn_code: row.hsn_code || '',
        expiry_date: row.expiry_date,
        invoice_date: row.invoice_date,
        invoice_reference: row.invoice_reference
      }))
    });
  } catch (error) {
    console.error('Error in getGrmReturns:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const processGrmReturn = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { returnDate, items } = req.body;
    const staffId = req.user?.id;

    if (!returnDate || !items || !Array.isArray(items) || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'Return date and items are required' });
    }

    let totalLoss = 0;
    const processedItems = [];

    for (const item of items) {
      const { productId, batchId, quantity, invoicePrice } = item;

      if (!productId || !batchId || !quantity || !invoicePrice) {
        await connection.rollback();
        return res.status(400).json({ success: false, error: 'Invalid item data' });
      }

      // Check if sufficient stock is available
      const [stockCheck] = await connection.execute(
        `SELECT 
          sb.quantity - 
          COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.batch_id = sb.id), 0) -
          COALESCE((SELECT SUM(r.quantity) FROM returns r WHERE r.batch_id = sb.id), 0) AS available
        FROM stock_batches sb WHERE sb.id = ?`,
        [batchId]
      );

      if (!stockCheck.length || stockCheck[0].available < quantity) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for batch ${batchId}. Available: ${stockCheck[0]?.available || 0}`,
        });
      }

      // Calculate loss amount (15% of invoice price for GRM returns)
      const lossAmount = Number((quantity * invoicePrice * 0.15).toFixed(2));
      const rtd = 15.00; // RTD for GRM returns

      // Insert return record
      const [returnResult] = await connection.execute(
        'INSERT INTO returns (return_date, type, product_id, batch_id, quantity, invoice_price, loss_amount, rtd, staff_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [returnDate, 'GRM', productId, batchId, quantity, invoicePrice, lossAmount, rtd, staffId]
      );

      totalLoss += lossAmount;
      processedItems.push({
        returnId: returnResult.insertId,
        productId,
        batchId,
        quantity,
        lossAmount,
      });
    }

    await connection.commit();
    res.json({
      success: true,
      message: 'GRM returns processed successfully',
      summary: {
        totalItems: processedItems.length,
        totalQuantity: processedItems.reduce((sum, item) => sum + item.quantity, 0),
        totalLoss: Number(totalLoss.toFixed(2)),
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error in processGrmReturn:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
};

const getGvnDamages = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    // Get stock received today that can be marked as damaged
    const [availableStock] = await db.execute(
      `SELECT 
        sb.id as batch_id,
        sb.product_id,
        sb.quantity as batch_quantity,
        CASE 
          WHEN p.shelf_life_days IS NOT NULL AND p.shelf_life_days >= 0 THEN DATE_ADD(sb.invoice_date, INTERVAL p.shelf_life_days DAY)
          ELSE sb.expiry_date
        END AS expiry_date,
        sb.invoice_date,
        sb.invoice_reference,
        p.name,
        p.item_code,
        p.category,
        p.shelf_life_days,
        p.invoice_price,
        p.hsn_code,
        p.image_url,
        COALESCE(
          sb.quantity - 
          COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.batch_id = sb.id), 0) -
          COALESCE((SELECT SUM(r.quantity) FROM returns r WHERE r.batch_id = sb.id), 0),
          0
        ) AS available_quantity
      FROM stock_batches sb
      JOIN products p ON sb.product_id = p.id
      WHERE sb.invoice_date = ? AND p.is_active = 1
      HAVING available_quantity > 0
      ORDER BY p.name`,
      [targetDate]
    );

    // Get already processed damages for the target date
    const [processedDamages] = await db.execute(
      `SELECT 
        r.id,
        r.product_id,
        r.batch_id,
        r.quantity,
        r.return_date as damage_date,
        r.invoice_price,
        p.name,
        p.item_code,
        p.hsn_code,
        p.image_url,
        sb.expiry_date,
        sb.invoice_date,
        sb.invoice_reference
      FROM returns r
      JOIN products p ON r.product_id = p.id
      JOIN stock_batches sb ON r.batch_id = sb.id
      WHERE r.type = 'GVN' AND r.return_date = ?`,
      [targetDate]
    );

    res.json({
      success: true,
      gvnItems: availableStock.map(row => ({
        id: row.batch_id,
        product_id: row.product_id,
        name: row.name,
        item_code: row.item_code,
        category: row.category,
        shelf_life_days: row.shelf_life_days,
        quantity: Number(row.available_quantity),
        invoice_price: Number(row.invoice_price),
        image_url: row.image_url || '/placeholder.svg',
        hsn_code: row.hsn_code || '',
        expiry_date: row.expiry_date,
        invoice_date: row.invoice_date,
        invoice_reference: row.invoice_reference
      })),
      processed: processedDamages.map(row => ({
        id: row.id,
        product_id: row.product_id,
        batch_id: row.batch_id,
        name: row.name,
        item_code: row.item_code,
        quantity: Number(row.quantity),
        invoice_price: Number(row.invoice_price),
        damage_date: row.damage_date,
        image_url: row.image_url || '/placeholder.svg',
        hsn_code: row.hsn_code || '',
        expiry_date: row.expiry_date,
        invoice_date: row.invoice_date,
        invoice_reference: row.invoice_reference
      }))
    });
  } catch (error) {
    console.error('Error in getGvnDamages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const processGvnDamage = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { damageDate, items } = req.body;
    const staffId = req.user?.id;

    if (!damageDate || !items || !Array.isArray(items) || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'Damage date and items are required' });
    }

    const processedItems = [];

    for (const item of items) {
      const { productId, batchId, quantity, invoicePrice } = item;

      if (!productId || !batchId || !quantity || !invoicePrice) {
        await connection.rollback();
        return res.status(400).json({ success: false, error: 'Invalid item data' });
      }

      // Check if sufficient stock is available
      const [stockCheck] = await connection.execute(
        `SELECT 
          sb.quantity - 
          COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.batch_id = sb.id), 0) -
          COALESCE((SELECT SUM(r.quantity) FROM returns r WHERE r.batch_id = sb.id), 0) AS available
        FROM stock_batches sb WHERE sb.id = ?`,
        [batchId]
      );

      if (!stockCheck.length || stockCheck[0].available < quantity) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for batch ${batchId}. Available: ${stockCheck[0]?.available || 0}`,
        });
      }

      // Insert damage record (GVN has 0 loss amount and 0 RTD)
      const rtd = 0.00; // RTD for GVN returns
      const [damageResult] = await connection.execute(
        'INSERT INTO returns (return_date, type, product_id, batch_id, quantity, invoice_price, loss_amount, rtd, staff_id) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
        [damageDate, 'GVN', productId, batchId, quantity, invoicePrice, rtd, staffId]
      );

      processedItems.push({
        damageId: damageResult.insertId,
        productId,
        batchId,
        quantity,
      });
    }

    await connection.commit();
    res.json({
      success: true,
      message: 'GVN damages processed successfully',
      summary: {
        totalItems: processedItems.length,
        totalQuantity: processedItems.reduce((sum, item) => sum + item.quantity, 0),
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error in processGvnDamage:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
};

const getReturnsSummary = async (req, res) => {
  try {
    const { date } = req.params;
    const targetDate = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    // Get GRM returns summary
    const [grmSummary] = await db.execute(
      `SELECT 
        COUNT(*) AS totalReturns, 
        SUM(quantity) AS totalQuantity, 
        SUM(loss_amount) AS totalLoss
      FROM returns
      WHERE type = 'GRM' AND return_date = ?`,
      [targetDate]
    );

    // Get GVN damages summary
    const [gvnSummary] = await db.execute(
      `SELECT 
        COUNT(*) AS totalDamages, 
        SUM(quantity) AS totalQuantity
      FROM returns
      WHERE type = 'GVN' AND return_date = ?`,
      [targetDate]
    );

    res.json({
      success: true,
      date: targetDate,
      grm: {
        totalReturns: Number(grmSummary[0].totalReturns) || 0,
        totalQuantity: Number(grmSummary[0].totalQuantity) || 0,
        totalLoss: Number(grmSummary[0].totalLoss) || 0
      },
      gvn: {
        totalDamages: Number(gvnSummary[0].totalDamages) || 0,
        totalQuantity: Number(gvnSummary[0].totalQuantity) || 0
      }
    });
  } catch (error) {
    console.error('Error in getReturnsSummary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getReturnsDetails = async (req, res) => {
  try {
    const { date } = req.params;
    const targetDate = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    // Get detailed GRM returns
    const [grmReturns] = await db.execute(
      `SELECT 
        r.id,
        r.return_date as date,
        r.quantity,
        r.loss_amount as lossAmount,
        p.name as productName,
        p.item_code,
        p.category,
        p.image_url,
        sb.invoice_reference,
        sb.invoice_date,
        sb.expiry_date
      FROM returns r
      JOIN products p ON r.product_id = p.id
      JOIN stock_batches sb ON r.batch_id = sb.id
      WHERE r.type = 'GRM' AND r.return_date = ?
      ORDER BY r.id DESC`,
      [targetDate]
    );

    // Get detailed GVN damages
    const [gvnDamages] = await db.execute(
      `SELECT 
        r.id,
        r.return_date as date,
        r.quantity,
        r.loss_amount as lossAmount,
        p.name as productName,
        p.item_code,
        p.category,
        p.image_url,
        sb.invoice_reference,
        sb.invoice_date
      FROM returns r
      JOIN products p ON r.product_id = p.id
      JOIN stock_batches sb ON r.batch_id = sb.id
      WHERE r.type = 'GVN' AND r.return_date = ?
      ORDER BY r.id DESC`,
      [targetDate]
    );

    res.json({
      success: true,
      date: targetDate,
      grm: grmReturns.map(row => ({
        id: String(row.id),
        date: row.date,
        productName: row.productName,
        quantity: Number(row.quantity),
        reason: 'GRM Return',
        lossAmount: Number(row.lossAmount),
        itemCode: row.item_code,
        category: row.category,
        imageUrl: row.image_url || '/placeholder.svg',
        invoiceReference: row.invoice_reference,
        invoiceDate: row.invoice_date,
        expiryDate: row.expiry_date
      })),
      gvn: gvnDamages.map(row => ({
        id: String(row.id),
        date: row.date,
        productName: row.productName,
        quantity: Number(row.quantity),
        reason: 'GVN Damage',
        lossAmount: Number(row.lossAmount),
        itemCode: row.item_code,
        category: row.category,
        imageUrl: row.image_url || '/placeholder.svg',
        invoiceReference: row.invoice_reference,
        invoiceDate: row.invoice_date
      }))
    });
  } catch (error) {
    console.error('Error in getReturnsDetails:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getProcessedReturnsByExpiry = async (req, res) => {
  try {
    const { date } = req.params;
    const targetDate = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    // Get GRM returns where items had expiry_date = targetDate (regardless of when processed)
    const [grmReturns] = await db.execute(
      `SELECT 
        r.id,
        r.return_date as date,
        r.quantity,
        r.loss_amount as lossAmount,
        r.credit_status,
        p.name as productName,
        p.item_code,
        p.category,
        p.image_url,
        sb.invoice_reference,
        sb.invoice_date,
        sb.expiry_date
      FROM returns r
      JOIN products p ON r.product_id = p.id
      JOIN stock_batches sb ON r.batch_id = sb.id
      WHERE r.type = 'GRM' AND DATE(sb.expiry_date) = ?
      ORDER BY r.id DESC`,
      [targetDate]
    );

    // Get GVN damages processed on targetDate (same as before)
    const [gvnDamages] = await db.execute(
      `SELECT 
        r.id,
        r.return_date as date,
        r.quantity,
        r.loss_amount as lossAmount,
        r.invoice_price as rate,
        r.credit_status,
        p.name as productName,
        p.item_code,
        p.category,
        p.image_url,
        sb.invoice_reference,
        sb.invoice_date
      FROM returns r
      JOIN products p ON r.product_id = p.id
      JOIN stock_batches sb ON r.batch_id = sb.id
      WHERE r.type = 'GVN' AND r.return_date = ?
      ORDER BY r.id DESC`,
      [targetDate]
    );

    res.json({
      success: true,
      date: targetDate,
      grm: grmReturns.map(row => ({
        id: String(row.id),
        date: row.date,
        productName: row.productName,
        quantity: Number(row.quantity),
        reason: 'GRM Return',
        lossAmount: Number(row.lossAmount),
        itemCode: row.item_code,
        category: row.category,
        imageUrl: row.image_url || '/placeholder.svg',
        invoiceReference: row.invoice_reference,
        invoiceDate: row.invoice_date,
        expiryDate: row.expiry_date,
        credit_status: row.credit_status || 'pending'
      })),
      gvn: gvnDamages.map(row => ({
        id: String(row.id),
        date: row.date,
        productName: row.productName,
        quantity: Number(row.quantity),
        reason: 'GVN Damage',
        lossAmount: Number(row.lossAmount),
        rate: Number(row.rate),
        itemCode: row.item_code,
        category: row.category,
        imageUrl: row.image_url || '/placeholder.svg',
        invoiceReference: row.invoice_reference,
        invoiceDate: row.invoice_date,
        credit_status: row.credit_status || 'pending'
      }))
    });
  } catch (error) {
    console.error('Error in getProcessedReturnsByExpiry:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getItemsByExpiryDate = async (req, res) => {
  try {
    const { date } = req.params;
    const targetDate = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    // Get all items (stock batches) that expire on the target date
    const [itemsWithExpiry] = await db.execute(
      `SELECT 
        sb.id as batch_id,
        sb.product_id,
        sb.quantity as batch_quantity,
        sb.expiry_date,
        sb.invoice_date,
        sb.invoice_reference,
        p.name as productName,
        p.item_code,
        p.category,
        p.image_url,
        p.invoice_price,
        COALESCE(
          sb.quantity - 
          COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.batch_id = sb.id), 0) -
          COALESCE((SELECT SUM(r.quantity) FROM returns r WHERE r.batch_id = sb.id), 0),
          0
        ) AS available_quantity
      FROM stock_batches sb
      JOIN products p ON sb.product_id = p.id
      WHERE DATE(sb.expiry_date) = ? AND p.is_active = 1
      ORDER BY p.name`,
      [targetDate]
    );

    res.json({
      success: true,
      date: targetDate,
      items: itemsWithExpiry.map(row => ({
        id: String(row.batch_id),
        productName: row.productName,
        availableQuantity: Number(row.available_quantity),
        batchQuantity: Number(row.batch_quantity),
        expiryDate: row.expiry_date,
        invoiceDate: row.invoice_date,
        invoiceReference: row.invoice_reference,
        itemCode: row.item_code,
        category: row.category,
        imageUrl: row.image_url || '/placeholder.svg',
        invoicePrice: Number(row.invoice_price)
      }))
    });
  } catch (error) {
    console.error('Error in getItemsByExpiryDate:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get processed returns for credit note comparison
const getProcessedReturnsForCreditNote = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    // Get all processed returns (both GRM and GVN) for the specific date
    const [processedReturns] = await db.execute(
      `SELECT 
        r.id,
        r.return_date,
        r.type,
        r.quantity,
        r.invoice_price,
        r.loss_amount,
        r.rtd,
        r.product_id,
        r.batch_id,
        p.name as product_name,
        p.item_code,
        p.hsn_code,
        p.category,
        p.image_url,
        sb.expiry_date,
        sb.invoice_date,
        sb.invoice_reference,
        'pending' as credit_status
      FROM returns r
      JOIN products p ON r.product_id = p.id
      JOIN stock_batches sb ON r.batch_id = sb.id
      WHERE r.return_date = ?
      ORDER BY r.type, p.name`,
      [targetDate]
    );

    res.json({
      success: true,
      date: targetDate,
      processedReturns: processedReturns.map(row => ({
        id: String(row.id),
        returnDate: row.return_date,
        type: row.type,
        productName: row.product_name,
        itemCode: row.item_code,
        quantity: Number(row.quantity),
        invoicePrice: Number(row.invoice_price),
        lossAmount: Number(row.loss_amount),
        rtd: Number(row.rtd),
        productId: String(row.product_id),
        batchId: String(row.batch_id),
        hsnCode: row.hsn_code || '',
        category: row.category,
        imageUrl: row.image_url || '/placeholder.svg',
        expiryDate: row.expiry_date,
        invoiceDate: row.invoice_date,
        invoiceReference: row.invoice_reference,
        creditStatus: row.credit_status
      }))
    });
  } catch (error) {
    console.error('Error in getProcessedReturnsForCreditNote:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update credit status for processed returns
const updateCreditStatus = async (req, res) => {
  try {
    const { returnIds, status } = req.body;
    
    if (!returnIds || !Array.isArray(returnIds) || returnIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Return IDs are required' });
    }
    
    if (!status || !['pending', 'received'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be pending or received' });
    }

    // Update credit status for multiple returns
    const placeholders = returnIds.map(() => '?').join(',');
    const [result] = await db.execute(
      `UPDATE returns SET credit_status = ? WHERE id IN (${placeholders})`,
      [status, ...returnIds]
    );

    res.json({
      success: true,
      message: `Credit status updated to ${status} for ${result.affectedRows} returns`,
      affectedRows: result.affectedRows
    });
  } catch (error) {
    console.error('Error in updateCreditStatus:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Process credit note and match with returns
const processCreditNote = async (req, res) => {
  try {
    const { creditNoteData, date } = req.body;
    
    if (!creditNoteData || !Array.isArray(creditNoteData) || creditNoteData.length === 0) {
      return res.status(400).json({ success: false, error: 'Credit note data is required' });
    }
    
    if (!date) {
      return res.status(400).json({ success: false, error: 'Date is required' });
    }

    const targetDate = new Date(date).toISOString().split('T')[0];

    // Get processed returns for the date range (we'll filter by item-specific dates)
    const [processedReturns] = await db.execute(
      `SELECT 
        r.id,
        r.return_date,
        r.type,
        r.quantity,
        r.invoice_price,
        r.loss_amount,
        r.rtd,
        p.item_code,
        sb.expiry_date
      FROM returns r
      JOIN products p ON r.product_id = p.id
      LEFT JOIN stock_batches sb ON r.stock_batch_id = sb.id
      WHERE r.credit_status = 'pending'
      ORDER BY p.item_code`
    );

    const matches = [];
    const unmatchedCreditItems = [];
    const unmatchedReturns = [...processedReturns];

    // Match credit note items with processed returns
    for (const creditItem of creditNoteData) {
      const { itemCode, quantity, rtd, returnDate } = creditItem;
      
      // Find matching return based on item code, RTD, and date
      const matchingReturnIndex = unmatchedReturns.findIndex(returnItem => {
        const itemCodeMatch = returnItem.item_code === itemCode;
        const rtdMatch = Math.abs(returnItem.rtd - rtd) < 0.01; // Allow small floating point differences
        
        // For GRM (rtd = 15.00), match by expiry_date
        // For GVN (rtd = 0.00), match by return_date
        let dateMatch = false;
        if (rtd === 15.00) {
          // GRM: match expiry_date with returnDate
          const expiryDate = returnItem.expiry_date ? new Date(returnItem.expiry_date).toISOString().split('T')[0] : null;
          dateMatch = expiryDate === returnDate;
        } else {
          // GVN: match return_date with returnDate
          const returnDateFormatted = new Date(returnItem.return_date).toISOString().split('T')[0];
          dateMatch = returnDateFormatted === returnDate;
        }
        
        return itemCodeMatch && rtdMatch && dateMatch;
      });
      
      if (matchingReturnIndex !== -1) {
        const matchingReturn = unmatchedReturns[matchingReturnIndex];
        
        // Check if quantities match
        if (matchingReturn.quantity === quantity) {
          matches.push({
            returnId: matchingReturn.id,
            itemCode,
            quantity,
            rtd,
            type: matchingReturn.type,
            status: 'perfect_match'
          });
          unmatchedReturns.splice(matchingReturnIndex, 1); // Remove from unmatched
        } else {
          matches.push({
            returnId: matchingReturn.id,
            itemCode,
            creditQuantity: quantity,
            returnQuantity: matchingReturn.quantity,
            rtd,
            type: matchingReturn.type,
            status: 'quantity_mismatch'
          });
          unmatchedReturns.splice(matchingReturnIndex, 1); // Remove from unmatched
        }
      } else {
        unmatchedCreditItems.push({
          itemCode,
          quantity,
          rtd,
          status: 'no_matching_return'
        });
      }
    }

    // Update credit status for perfect matches
    const perfectMatchIds = matches
      .filter(match => match.status === 'perfect_match')
      .map(match => match.returnId);

    if (perfectMatchIds.length > 0) {
      const placeholders = perfectMatchIds.map(() => '?').join(',');
      await db.execute(
        `UPDATE returns SET credit_status = 'received' WHERE id IN (${placeholders})`,
        perfectMatchIds
      );
    }

    res.json({
      success: true,
      message: `Credit note processed for ${targetDate}`,
      summary: {
        totalCreditItems: creditNoteData.length,
        perfectMatches: matches.filter(m => m.status === 'perfect_match').length,
        quantityMismatches: matches.filter(m => m.status === 'quantity_mismatch').length,
        unmatchedCreditItems: unmatchedCreditItems.length,
        unmatchedReturns: unmatchedReturns.length,
        statusUpdated: perfectMatchIds.length
      },
      matches,
      unmatchedCreditItems,
      unmatchedReturns: unmatchedReturns.map(item => ({
        id: item.id,
        itemCode: item.item_code,
        quantity: item.quantity,
        rtd: item.rtd,
        type: item.type
      }))
    });
  } catch (error) {
    console.error('Error in processCreditNote:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getPendingReturns = async (req, res) => {
  try {
    const { month } = req.query;
    
    console.log(`Backend received month parameter: ${month}`);
    
    if (!month) {
      return res.status(400).json({ 
        success: false, 
        error: 'Month parameter is required (YYYY-MM format)' 
      });
    }

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid month format. Use YYYY-MM format' 
      });
    }

    // Get all pending returns for the specified month
    const [grmReturns] = await db.execute(`
      SELECT 
        r.id,
        r.return_date as date,
        r.quantity,
        r.loss_amount as lossAmount,
        r.credit_status,
        p.name as productName,
        p.item_code,
        p.category,
        p.image_url,
        sb.invoice_reference,
        sb.invoice_date,
        sb.expiry_date,
        r.rtd
      FROM returns r
      JOIN products p ON r.product_id = p.id
      JOIN stock_batches sb ON r.batch_id = sb.id
      WHERE r.type = 'GRM' 
        AND r.credit_status = 'pending'
        AND DATE_FORMAT(r.return_date, '%Y-%m') = ?
      ORDER BY r.return_date DESC, r.id DESC
    `, [month]);

    const [gvnDamages] = await db.execute(`
      SELECT 
        r.id,
        r.return_date as date,
        r.quantity,
        r.loss_amount as lossAmount,
        r.invoice_price as rate,
        r.credit_status,
        p.name as productName,
        p.item_code,
        p.category,
        p.image_url,
        sb.invoice_reference,
        sb.invoice_date,
        r.rtd
      FROM returns r
      JOIN products p ON r.product_id = p.id
      JOIN stock_batches sb ON r.batch_id = sb.id
      WHERE r.type = 'GVN' 
        AND r.credit_status = 'pending'
        AND DATE_FORMAT(r.return_date, '%Y-%m') = ?
      ORDER BY r.return_date DESC, r.id DESC
    `, [month]);

    // Group and aggregate items to remove duplicates
    const groupItems = (items) => {
      const grouped = items.reduce((acc, item) => {
        const key = `${item.productName}_${item.date}`;
        if (acc[key]) {
          acc[key].quantity += item.quantity;
          acc[key].lossAmount += item.lossAmount;
          if (item.rate) acc[key].rate += item.rate;
        } else {
          acc[key] = { ...item };
        }
        return acc;
      }, {});
      return Object.values(grouped);
    };

    const groupedGrm = groupItems(grmReturns);
    const groupedGvn = groupItems(gvnDamages);

    console.log(`Found ${grmReturns.length} GRM returns and ${gvnDamages.length} GVN returns for month ${month}`);
    console.log(`After grouping: ${groupedGrm.length} GRM and ${groupedGvn.length} GVN`);

    res.json({
      success: true,
      data: {
        grm: groupedGrm.map(row => ({
          id: row.id,
          date: row.date,
          quantity: row.quantity,
          lossAmount: row.lossAmount,
          credit_status: row.credit_status || 'pending',
          productName: row.productName,
          itemCode: row.item_code,
          category: row.category,
          imageUrl: row.image_url,
          invoiceReference: row.invoice_reference,
          invoiceDate: row.invoice_date,
          expiryDate: row.expiry_date,
          rtd: row.rtd
        })),
        gvn: groupedGvn.map(row => ({
          id: row.id,
          date: row.date,
          quantity: row.quantity,
          lossAmount: row.lossAmount,
          rate: row.rate,
          credit_status: row.credit_status || 'pending',
          productName: row.productName,
          itemCode: row.item_code,
          category: row.category,
          imageUrl: row.image_url,
          invoiceReference: row.invoice_reference,
          invoiceDate: row.invoice_date,
          rtd: row.rtd
        }))
      },
      month,
      totalPending: groupedGrm.length + groupedGvn.length
    });

  } catch (error) {
    console.error('Error fetching pending returns:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch pending returns' 
    });
  }
};

module.exports = {
  getGrmReturns,
  processGrmReturn,
  getGvnDamages,
  processGvnDamage,
  getReturnsSummary,
  getReturnsDetails,
  getProcessedReturnsByExpiry,
  getItemsByExpiryDate,
  getProcessedReturnsForCreditNote,
  updateCreditStatus,
  processCreditNote,
  getPendingReturns,
};