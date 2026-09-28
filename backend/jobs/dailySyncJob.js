// Daily Sync Job
// Automatically syncs yesterday's invoice/CRDR data to Tomorrow AI tables
// Runs daily at 2 AM

const db = require('../config/database');

async function dailySyncJob() {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    console.log('Starting daily sync job...');

    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const syncDate = yesterday.toISOString().split('T')[0];

    console.log(`Syncing data for: ${syncDate}`);

    // Fetch invoice items for yesterday
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

    console.log(`Found ${invoiceItems.length} invoice items`);

    // Fetch credit notes for yesterday
    const [creditNotes] = await connection.execute(
      `SELECT id, items
       FROM credit_notes
       WHERE DATE(return_date) = ? OR DATE(date) = ?`,
      [syncDate, syncDate]
    );

    console.log(`Found ${creditNotes.length} credit notes`);

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
        console.warn(`Failed to parse credit note items for CN ${cn.id}:`, e);
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
    for (const [itemName, netQty] of netSalesMap) {
      const [existingProducts] = await connection.execute(
        `SELECT ml_group_id FROM tomorrow_ai_product_master WHERE name = ?`,
        [itemName]
      );

      let mlGroupId = itemName;
      if (existingProducts.length > 0) {
        mlGroupId = existingProducts[0].ml_group_id;
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

    // Log the sync
    await connection.execute(
      `INSERT INTO tomorrow_ai_sync_log 
       (sync_date, sync_type, records_processed, status, completed_at)
       VALUES (?, 'INCREMENTAL', ?, 'SUCCESS', NOW())`,
      [syncDate, recordsInserted]
    );

    await connection.commit();

    console.log(`✓ Daily sync completed: ${recordsInserted} records`);

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error in daily sync job:', error);
    
    if (connection) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const syncDate = yesterday.toISOString().split('T')[0];
      
      await connection.execute(
        `INSERT INTO tomorrow_ai_sync_log 
         (sync_date, sync_type, records_processed, status, error_message, completed_at)
         VALUES (?, 'INCREMENTAL', 0, 'FAILED', ?, NOW())`,
        [syncDate, error.message]
      );
    }
  } finally {
    if (connection) connection.release();
  }
}

// Export for use in server.js or cron job
module.exports = { dailySyncJob };

// If run directly, execute the job
if (require.main === module) {
  dailySyncJob().then(() => {
    console.log('Daily sync job completed');
    process.exit(0);
  }).catch((error) => {
    console.error('Daily sync job failed:', error);
    process.exit(1);
  });
}
