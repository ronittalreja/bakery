// Tomorrow AI Controller
// Handles data sync from invoice/CRDR to Tomorrow AI tables
// Does NOT modify existing invoice/CRDR tables

const db = require('../config/database');

/**
 * Sync invoice/CRDR data to Tomorrow AI daily_sales table
 * This reads from existing tables and writes to separate Tomorrow AI tables
 */
async function syncSalesToTomorrowAI(req, res) {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const { date } = req.body;
    const syncDate = date || new Date().toISOString().split('T')[0];

    console.log(`Starting sync for date: ${syncDate}`);

    // 1. Fetch invoice items for the date from existing invoices table
    const [invoiceItems] = await connection.execute(
      `SELECT 
        DATE(i.invoice_date) as sale_date,
        ii.item_name,
        ii.qty,
        i.id as invoice_id
       FROM invoices i
       JOIN invoice_items ii ON i.id = ii.invoice_id
       WHERE DATE(i.invoice_date) = ?`,
      [syncDate]
    );

    console.log(`Found ${invoiceItems.length} invoice items for ${syncDate}`);

    // 2. Fetch credit notes for the date from existing credit_notes table
    const [creditNotes] = await connection.execute(
      `SELECT 
        id,
        items,
        DATE(return_date) as return_date,
        DATE(date) as cn_date
       FROM credit_notes
       WHERE DATE(return_date) = ? OR DATE(date) = ?`,
      [syncDate, syncDate]
    );

    console.log(`Found ${creditNotes.length} credit notes for ${syncDate}`);

    // 3. Parse credit note items and create a map for deduction
    const creditNoteMap = new Map();
    for (const cn of creditNotes) {
      try {
        const items = typeof cn.items === 'string' ? JSON.parse(cn.items) : cn.items;
        if (Array.isArray(items)) {
          for (const item of items) {
            const key = item.itemCode || item.description || item.item_name || item.name;
            if (key) {
              const existing = creditNoteMap.get(key) || { quantity: 0 };
              creditNoteMap.set(key, {
                quantity: existing.quantity + (item.quantity || 0)
              });
            }
          }
        }
      } catch (e) {
        console.warn(`Failed to parse credit note items for CN ${cn.id}:`, e);
      }
    }

    // 4. Calculate net sales (invoice - credit notes)
    const netSalesMap = new Map();
    for (const invoiceItem of invoiceItems) {
      const itemName = invoiceItem.item_name;
      const invoiceQty = invoiceItem.qty;
      
      // Try to match credit note by item name
      const creditNoteItem = creditNoteMap.get(itemName);
      const creditNoteQty = creditNoteItem ? creditNoteItem.quantity : 0;
      
      const netQty = Math.max(0, invoiceQty - creditNoteQty);
      
      if (netQty > 0) {
        netSalesMap.set(itemName, netQty);
      }
    }

    console.log(`Calculated net sales for ${netSalesMap.size} unique items`);

    // 5. Map item names to ml_group_id using product_master table
    // Only insert records for products that exist in product_master
    let recordsInserted = 0;
    let skippedProducts = 0;
    for (const [itemName, netQty] of netSalesMap) {
      // Check if product exists in product_master
      const [existingProducts] = await connection.execute(
        `SELECT ml_group_id FROM tomorrow_ai_product_master WHERE name = ?`,
        [itemName]
      );

      // Skip if product doesn't exist in master (foreign key constraint)
      if (existingProducts.length === 0) {
        skippedProducts++;
        continue;
      }

      const mlGroupId = existingProducts[0].ml_group_id;

      // Insert or update daily_sales
      await connection.execute(
        `INSERT INTO tomorrow_ai_daily_sales 
         (sale_date, ml_group_id, actual_sales, is_shop_open)
         VALUES (?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE
         actual_sales = VALUES(actual_sales),
         updated_at = CURRENT_TIMESTAMP`,
        [syncDate, mlGroupId, netQty]
      );
      recordsInserted++;
    }

    console.log(`Skipped ${skippedProducts} products not in product_master`);

    // 6. Log the sync
    await connection.execute(
      `INSERT INTO tomorrow_ai_sync_log 
       (sync_date, sync_type, records_processed, status, completed_at)
       VALUES (?, 'INCREMENTAL', ?, 'SUCCESS', NOW())`,
      [syncDate, recordsInserted]
    );

    await connection.commit();

    console.log(`✓ Sync completed: ${recordsInserted} records processed`);

    res.json({
      success: true,
      message: 'Sales data synced to Tomorrow AI successfully',
      data: {
        date: syncDate,
        recordsProcessed: recordsInserted,
        invoiceItems: invoiceItems.length,
        creditNotes: creditNotes.length
      }
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error syncing sales to Tomorrow AI:', error);
    
    // Log the failure
    if (connection) {
      await connection.execute(
        `INSERT INTO tomorrow_ai_sync_log 
         (sync_date, sync_type, records_processed, status, error_message, completed_at)
         VALUES (?, 'INCREMENTAL', 0, 'FAILED', ?, NOW())`,
        [syncDate || new Date().toISOString().split('T')[0], error.message]
      );
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Full historical sync - syncs all historical invoice/CRDR data
 * This should be run once to populate initial data
 */
async function fullHistoricalSync(req, res) {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    console.log('Starting full historical sync...');

    // Get all invoice dates
    const [dates] = await connection.execute(
      `SELECT DISTINCT DATE(invoice_date) as sale_date 
       FROM invoices 
       WHERE invoice_date IS NOT NULL
       ORDER BY sale_date DESC`
    );

    console.log(`Found ${dates.length} unique dates to sync`);

    let totalRecords = 0;
    let skippedProducts = 0;
    let processedCount = 0;

    for (const dateObj of dates) {
      const syncDate = dateObj.sale_date.toISOString().split('T')[0];
      
      // Sync each date
      const syncResponse = await syncSingleDate(connection, syncDate);
      totalRecords += syncResponse.recordsInserted;
      skippedProducts += syncResponse.skippedProducts || 0;
      processedCount++;

      // Log progress every 50 dates
      if (processedCount % 50 === 0) {
        console.log(`Progress: ${processedCount}/${dates.length} dates processed, ${totalRecords} records`);
      }
    }

    await connection.commit();

    console.log(`✓ Full historical sync completed: ${totalRecords} total records, ${skippedProducts} skipped`);

    res.json({
      success: true,
      message: 'Full historical sync completed',
      data: {
        datesProcessed: dates.length,
        totalRecords,
        skippedProducts
      }
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error in full historical sync:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Helper function to sync a single date
 */
async function syncSingleDate(connection, syncDate) {
  // Fetch invoice items
  const [invoiceItems] = await connection.execute(
    `SELECT 
      DATE(i.invoice_date) as sale_date,
      ii.item_name,
      ii.qty
     FROM invoices i
     JOIN invoice_items ii ON i.id = ii.invoice_id
     WHERE DATE(i.invoice_date) = ?`,
    [syncDate]
  );

  // Fetch credit notes
  const [creditNotes] = await connection.execute(
    `SELECT id, items
     FROM credit_notes
     WHERE DATE(return_date) = ? OR DATE(date) = ?`,
    [syncDate, syncDate]
  );

  // Parse credit notes
  const creditNoteMap = new Map();
  for (const cn of creditNotes) {
    try {
      const items = typeof cn.items === 'string' ? JSON.parse(cn.items) : cn.items;
      if (Array.isArray(items)) {
        for (const item of items) {
          const key = item.itemCode || item.description || item.item_name || item.name;
          if (key) {
            const existing = creditNoteMap.get(key) || { quantity: 0 };
            creditNoteMap.set(key, {
              quantity: existing.quantity + (item.quantity || 0)
            });
          }
        }
      }
    } catch (e) {
      // Skip invalid credit notes
    }
  }

  // Calculate net sales
  const netSalesMap = new Map();
  for (const invoiceItem of invoiceItems) {
    const itemName = invoiceItem.item_name;
    const invoiceQty = invoiceItem.qty;
    const creditNoteItem = creditNoteMap.get(itemName);
    const creditNoteQty = creditNoteItem ? creditNoteItem.quantity : 0;
    const netQty = Math.max(0, invoiceQty - creditNoteQty);
    
    if (netQty > 0) {
      netSalesMap.set(itemName, netQty);
    }
  }

  // Insert to daily_sales
  let recordsInserted = 0;
  let skippedProducts = 0;
  for (const [itemName, netQty] of netSalesMap) {
    const [existingProducts] = await connection.execute(
      `SELECT ml_group_id FROM tomorrow_ai_product_master WHERE name = ?`,
      [itemName]
    );

    // Skip if product doesn't exist in master (foreign key constraint)
    if (existingProducts.length === 0) {
      skippedProducts++;
      continue;
    }

    const mlGroupId = existingProducts[0].ml_group_id;

    await connection.execute(
      `INSERT INTO tomorrow_ai_daily_sales 
       (sale_date, ml_group_id, actual_sales, is_shop_open)
       VALUES (?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE
       actual_sales = VALUES(actual_sales),
       updated_at = CURRENT_TIMESTAMP`,
      [syncDate, mlGroupId, netQty]
    );
    recordsInserted++;
  }

  console.log(`Sync for ${syncDate}: ${recordsInserted} inserted, ${skippedProducts} skipped (not in product_master)`);
  return { recordsInserted, skippedProducts };
}

/**
 * Get daily sales data for inspection
 * This allows verification that data is being interpreted correctly
 */
async function getDailySalesData(req, res) {
  try {
    const { startDate, endDate, mlGroupId } = req.query;

    let query = `
      SELECT 
        ds.sale_date,
        ds.ml_group_id,
        pm.name as product_name,
        ds.actual_sales,
        ds.is_shop_open,
        e.event_name,
        DATEDIFF(e.event_date, ds.sale_date) as days_to_event
      FROM tomorrow_ai_daily_sales ds
      LEFT JOIN tomorrow_ai_product_master pm ON ds.ml_group_id = pm.ml_group_id
      LEFT JOIN tomorrow_ai_events e ON ds.sale_date = e.event_date
      WHERE 1=1
    `;

    const params = [];

    if (startDate) {
      query += ` AND ds.sale_date >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND ds.sale_date <= ?`;
      params.push(endDate);
    }

    if (mlGroupId) {
      query += ` AND ds.ml_group_id = ?`;
      params.push(mlGroupId);
    }

    query += ` ORDER BY ds.sale_date DESC, ds.ml_group_id ASC`;

    const [rows] = await db.execute(query, params);

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('Error fetching daily sales data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  syncSalesToTomorrowAI,
  fullHistoricalSync,
  getDailySalesData
};
