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

    // 5. Map item names to ml_group_id using product_master and aliases
    // Check aliases first for renamed items, then product_master
    let recordsInserted = 0;
    let skippedProducts = 0;
    let aliasMatches = 0;

    for (const [itemName, netQty] of netSalesMap) {
      let mlGroupId = null;

      // First check if item name has an alias (join with product_master to get ml_group_id)
      const [aliases] = await connection.execute(
        `SELECT pm.ml_group_id 
         FROM tomorrow_ai_product_aliases pa
         JOIN tomorrow_ai_product_master pm ON pa.product_id = pm.product_id
         WHERE pa.historical_item_code = ? OR pa.historical_name = ?`,
        [itemName, itemName]
      );

      if (aliases.length > 0) {
        mlGroupId = aliases[0].ml_group_id;
        aliasMatches++;
      } else {
        // Check if product exists in product_master
        const [existingProducts] = await connection.execute(
          `SELECT ml_group_id FROM tomorrow_ai_product_master WHERE name = ?`,
          [itemName]
        );

        if (existingProducts.length > 0) {
          mlGroupId = existingProducts[0].ml_group_id;
        }
      }

      // Skip if product doesn't exist in master or has no alias
      if (!mlGroupId) {
        skippedProducts++;
        continue;
      }

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

    console.log(`Sync: ${recordsInserted} inserted, ${aliasMatches} matched via aliases, ${skippedProducts} skipped (not in product_master)`);

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
 * Resumes from where it left off if interrupted
 * Uses bulk operations for speed (minutes instead of hours)
 */
async function fullHistoricalSync(req, res) {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    console.log('Starting full historical sync (bulk mode)...');

    // Get all invoice dates
    const [dates] = await connection.execute(
      `SELECT DISTINCT DATE(invoice_date) as sale_date
       FROM invoices
       WHERE invoice_date IS NOT NULL
       ORDER BY sale_date DESC`
    );

    console.log(`Found ${dates.length} unique dates to sync`);

    // Get count of total synced dates
    const [countResult] = await connection.execute(
      `SELECT COUNT(DISTINCT sale_date) as count
       FROM tomorrow_ai_daily_sales`
    );
    console.log('Total synced dates count:', countResult[0].count);

    let datesToSync;
    let fullSyncedDateSet = new Set();

    // If table is empty, we need to sync all dates
    if (countResult[0].count === 0) {
      console.log('tomorrow_ai_daily_sales table is empty, syncing all dates');
      datesToSync = dates;
    } else {
      // Get ALL synced dates for proper comparison
      const [allSyncedDates] = await connection.execute(
        `SELECT DISTINCT sale_date FROM tomorrow_ai_daily_sales`
      );

      allSyncedDates.forEach(d => {
        let dateStr;
        if (d.sale_date instanceof Date) {
          dateStr = d.sale_date.toISOString().split('T')[0];
        } else if (typeof d.sale_date === 'string') {
          dateStr = d.sale_date.split(' ')[0];
        } else {
          dateStr = String(d.sale_date);
        }
        fullSyncedDateSet.add(dateStr);
      });

      console.log(`Found ${fullSyncedDateSet.size} total dates already synced`);
      console.log('Synced dates sample:', Array.from(fullSyncedDateSet).slice(0, 5));

      // Filter out already synced dates
      datesToSync = dates.filter(
        d => {
          const dateStr = d.sale_date instanceof Date
            ? d.sale_date.toISOString().split('T')[0]
            : String(d.sale_date).split(' ')[0];
          return !fullSyncedDateSet.has(dateStr);
        }
      );
    }

    console.log(`Need to sync ${datesToSync.length} dates`);

    if (datesToSync.length === 0) {
      await connection.commit();
      return res.json({
        success: true,
        message: 'All dates already synced',
        data: {
          datesProcessed: 0,
          totalRecords: 0,
          skippedProducts: 0,
          aliasMatches: 0,
          alreadySynced: fullSyncedDateSet?.size || 0
        }
      });
    }

    // BULK SYNC: Fetch all data at once
    console.log('Fetching all invoice items in bulk...');
    const dateStrings = datesToSync.map(d => {
      const dateStr = d.sale_date instanceof Date
        ? d.sale_date.toISOString().split('T')[0]
        : String(d.sale_date).split(' ')[0];
      return dateStr;
    });

    const placeholders = dateStrings.map(() => '?').join(',');
    const [invoiceItems] = await connection.execute(
      `SELECT
        DATE(i.invoice_date) as sale_date,
        ii.item_name,
        ii.qty
       FROM invoices i
       JOIN invoice_items ii ON i.id = ii.invoice_id
       WHERE DATE(i.invoice_date) IN (${placeholders})`,
      dateStrings
    );

    console.log(`Fetched ${invoiceItems.length} invoice items`);

    // Fetch all credit notes for these dates
    console.log('Fetching all credit notes in bulk...');
    const [creditNotes] = await connection.execute(
      `SELECT id, items, DATE(return_date) as return_date, DATE(date) as cn_date
       FROM credit_notes
       WHERE DATE(return_date) IN (${placeholders}) OR DATE(date) IN (${placeholders})`,
      [...dateStrings, ...dateStrings]
    );

    console.log(`Fetched ${creditNotes.length} credit notes`);

    // Parse all credit notes
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

    // Calculate net sales by date
    const netSalesByDate = new Map();
    for (const invoiceItem of invoiceItems) {
      const dateStr = invoiceItem.sale_date instanceof Date
        ? invoiceItem.sale_date.toISOString().split('T')[0]
        : String(invoiceItem.sale_date).split(' ')[0];
      const itemName = invoiceItem.item_name;
      const invoiceQty = invoiceItem.qty;

      if (!netSalesByDate.has(dateStr)) {
        netSalesByDate.set(dateStr, new Map());
      }

      const creditNoteItem = creditNoteMap.get(itemName);
      const creditNoteQty = creditNoteItem ? creditNoteItem.quantity : 0;
      const netQty = Math.max(0, invoiceQty - creditNoteQty);

      if (netQty > 0) {
        netSalesByDate.get(dateStr).set(itemName, netQty);
      }
    }

    // Get all aliases and products in bulk
    console.log('Fetching product mappings in bulk...');
    const [aliases] = await connection.execute(
      `SELECT
        pa.historical_item_code,
        pa.historical_name,
        pm.ml_group_id
       FROM tomorrow_ai_product_aliases pa
       JOIN tomorrow_ai_product_master pm ON pa.product_id = pm.product_id`
    );

    const [products] = await connection.execute(
      `SELECT name, ml_group_id FROM tomorrow_ai_product_master`
    );

    // Build lookup maps
    const aliasMap = new Map();
    aliases.forEach(a => {
      aliasMap.set(a.historical_item_code, a.ml_group_id);
      aliasMap.set(a.historical_name, a.ml_group_id);
    });

    const productMap = new Map();
    products.forEach(p => {
      productMap.set(p.name, p.ml_group_id);
    });

    console.log(`Loaded ${aliases.length} aliases, ${products.length} products`);

    // Prepare bulk insert
    const bulkInserts = [];
    let skippedProducts = 0;
    let aliasMatches = 0;

    for (const [dateStr, salesMap] of netSalesByDate) {
      for (const [itemName, netQty] of salesMap) {
        let mlGroupId = null;

        // Check aliases first
        if (aliasMap.has(itemName)) {
          mlGroupId = aliasMap.get(itemName);
          aliasMatches++;
        } else if (productMap.has(itemName)) {
          mlGroupId = productMap.get(itemName);
        }

        if (mlGroupId) {
          bulkInserts.push([dateStr, mlGroupId, netQty, 1]); // 1 for is_shop_open
        } else {
          skippedProducts++;
        }
      }
    }

    console.log(`Prepared ${bulkInserts.length} records for bulk insert`);

    // Bulk insert in batches of 1000
    const batchSize = 1000;
    let insertedCount = 0;

    for (let i = 0; i < bulkInserts.length; i += batchSize) {
      const batch = bulkInserts.slice(i, i + batchSize);
      const values = batch.map(() => '(?, ?, ?, ?)').join(',');
      const flatParams = batch.flat();

      await connection.execute(
        `INSERT INTO tomorrow_ai_daily_sales (sale_date, ml_group_id, actual_sales, is_shop_open)
         VALUES ${values}
         ON DUPLICATE KEY UPDATE
         actual_sales = VALUES(actual_sales)`,
        flatParams
      );

      insertedCount += batch.length;
      console.log(`Bulk insert progress: ${insertedCount}/${bulkInserts.length} records`);
    }

    await connection.commit();

    console.log(`✓ Bulk sync completed: ${insertedCount} records, ${aliasMatches} matched via aliases, ${skippedProducts} skipped`);

    res.json({
      success: true,
      message: 'Bulk historical sync completed',
      data: {
        datesProcessed: datesToSync.length,
        totalRecords: insertedCount,
        skippedProducts,
        aliasMatches,
        alreadySynced: countResult[0].count
      }
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error in bulk historical sync:', error);
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

  // Insert to daily_sales with alias lookup
  let recordsInserted = 0;
  let skippedProducts = 0;
  let aliasMatches = 0;

  for (const [itemName, netQty] of netSalesMap) {
    let mlGroupId = null;

    // First check if item name has an alias (join with product_master to get ml_group_id)
    const [aliases] = await connection.execute(
      `SELECT pm.ml_group_id 
       FROM tomorrow_ai_product_aliases pa
       JOIN tomorrow_ai_product_master pm ON pa.product_id = pm.product_id
       WHERE pa.historical_item_code = ? OR pa.historical_name = ?`,
      [itemName, itemName]
    );

    if (aliases.length > 0) {
      mlGroupId = aliases[0].ml_group_id;
      aliasMatches++;
    } else {
      // Check if product exists in product_master
      const [existingProducts] = await connection.execute(
        `SELECT ml_group_id FROM tomorrow_ai_product_master WHERE name = ?`,
        [itemName]
      );

      if (existingProducts.length > 0) {
        mlGroupId = existingProducts[0].ml_group_id;
      }
    }

    // Skip if product doesn't exist in master or has no alias
    if (!mlGroupId) {
      skippedProducts++;
      continue;
    }

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

  console.log(`Sync for ${syncDate}: ${recordsInserted} inserted, ${aliasMatches} matched via aliases, ${skippedProducts} skipped`);
  return { recordsInserted, skippedProducts, aliasMatches };
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

/**
 * Get sync progress
 * Returns the latest sync log entry to show current progress
 */
async function getSyncProgress(req, res) {
  try {
    const [logs] = await db.execute(`
      SELECT
        sync_date,
        sync_type,
        records_processed,
        status,
        error_message,
        started_at,
        completed_at
      FROM tomorrow_ai_sync_log
      ORDER BY started_at DESC
      LIMIT 1
    `);

    if (logs.length === 0) {
      return res.json({
        success: true,
        data: null
      });
    }

    const latestLog = logs[0];
    const isRunning = latestLog.status === 'SUCCESS' && !latestLog.completed_at;

    res.json({
      success: true,
      data: {
        ...latestLog,
        is_running: isRunning
      }
    });

  } catch (error) {
    console.error('Error fetching sync progress:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  syncSalesToTomorrowAI,
  fullHistoricalSync,
  getDailySalesData,
  getSyncProgress
};
