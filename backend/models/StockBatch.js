const db = require('../config/database');

class StockBatch {
  static async create(batchData, connection = db) {
    try {
      const [result] = await connection.execute(
        'INSERT INTO stock_batches (product_id, quantity, expiry_date, invoice_date, invoice_reference) VALUES (?, ?, ?, ?, ?)',
        [
          batchData.productId,
          batchData.quantity,
          batchData.expiryDate,
          batchData.invoiceDate,
          batchData.invoiceReference
        ]
      );
      return result.insertId;
    } catch (error) {
      console.error('Error in StockBatch.create:', error);
      throw error;
    }
  }

  static async findByProductId(productId, connection = db) {
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM stock_batches WHERE product_id = ? AND quantity > 0 ORDER BY invoice_date ASC',
        [productId]
      );
      return rows;
    } catch (error) {
      console.error('Error in StockBatch.findByProductId:', error);
      throw error;
    }
  }

  static async deductQuantity(batchId, quantity, connection = db) {
    try {
      const [result] = await connection.execute(
        'UPDATE stock_batches SET quantity = quantity - ? WHERE id = ? AND quantity >= ?',
        [quantity, batchId, quantity]
      );
      if (result.affectedRows === 0) {
        throw new Error('Insufficient stock or invalid batch ID');
      }
    } catch (error) {
      console.error('Error in StockBatch.deductQuantity:', error);
      throw error;
    }
  }

  static async getAvailableStock({ date, productId } = {}, connection = db) {
    try {
      // Reference date defaults to today; used only for expiry filtering
      const referenceDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : new Date().toISOString().split('T')[0];

      // Build query that aggregates all batches (across all invoice dates) and computes available quantity
      let query = `
        SELECT 
          sb.id,
          sb.product_id,
          -- Compute effective expiry based on current product shelf life; fallback to stored expiry
          CASE 
            WHEN p.shelf_life_days IS NOT NULL AND p.shelf_life_days >= 0 THEN DATE_ADD(sb.invoice_date, INTERVAL p.shelf_life_days DAY)
            ELSE sb.expiry_date
          END AS expiry_date,
          sb.invoice_date,
          sb.invoice_reference,
          p.item_code,
          p.name,
          p.hsn_code,
          p.invoice_price,
          p.sale_price,
          p.grm_value,
          p.image_url,
          p.category,
          p.shelf_life_days,
          COALESCE(
            sb.quantity - 
            COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.batch_id = sb.id), 0) -
            COALESCE((SELECT SUM(r.quantity) FROM returns r WHERE r.batch_id = sb.id), 0),
            0
          ) AS quantity
        FROM stock_batches sb
        JOIN products p ON sb.product_id = p.id
        WHERE p.is_active = 1
      `;

      const params = [];

      // Apply product filter if provided
      if (productId) {
        query += ' AND sb.product_id = ?';
        params.push(productId);
      }

      // Filter by expiry status: default to unexpired (>= referenceDate)
      // Caller can pass expired=true via routes; we read it at the route and decide which branch here by using a placeholder comment
      // Since this method signature doesn't include expired, detect via a special flag in productId object form if provided from route
      // Better approach: check if an "expired" boolean was passed in the first arg
      const expired = typeof arguments[0] === 'object' && arguments[0] && 'expired' in arguments[0]
        ? arguments[0].expired
        : false;

      if (expired) {
        query += ' AND (CASE WHEN p.shelf_life_days IS NOT NULL AND p.shelf_life_days >= 0 THEN DATE_ADD(sb.invoice_date, INTERVAL p.shelf_life_days DAY) ELSE sb.expiry_date END) <= ?';
      } else {
        query += ' AND (CASE WHEN p.shelf_life_days IS NOT NULL AND p.shelf_life_days >= 0 THEN DATE_ADD(sb.invoice_date, INTERVAL p.shelf_life_days DAY) ELSE sb.expiry_date END) > ?';
      }
      params.push(referenceDate);

      // Only return batches with positive available quantity
      query += ' HAVING quantity > 0 ORDER BY p.name';

      const [rows] = await connection.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Error in StockBatch.getAvailableStock:', error);
      throw error;
    }
  }

  static async getAggregatedAvailableStockByProduct({ date } = {}, connection = db) {
    try {
      const referenceDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : new Date().toISOString().split('T')[0];

      const query = `
        SELECT 
          p.id AS product_id,
          p.name,
          p.item_code,
          p.hsn_code,
          p.invoice_price,
          p.sale_price,
          p.grm_value,
          p.image_url,
          p.category,
          p.shelf_life_days,
          SUM(COALESCE(
            sb.quantity - 
            COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.batch_id = sb.id), 0) -
            COALESCE((SELECT SUM(r.quantity) FROM returns r WHERE r.batch_id = sb.id), 0),
            0
          )) AS total_available,
          MIN(CASE 
                WHEN (sb.quantity - 
                      COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.batch_id = sb.id), 0) -
                      COALESCE((SELECT SUM(r.quantity) FROM returns r WHERE r.batch_id = sb.id), 0)) > 0
                THEN (CASE WHEN p.shelf_life_days IS NOT NULL AND p.shelf_life_days >= 0 THEN DATE_ADD(sb.invoice_date, INTERVAL p.shelf_life_days DAY) ELSE sb.expiry_date END)
              END) AS next_expiry
        FROM stock_batches sb
        JOIN products p ON sb.product_id = p.id
        WHERE p.is_active = 1 AND (CASE WHEN p.shelf_life_days IS NOT NULL AND p.shelf_life_days >= 0 THEN DATE_ADD(sb.invoice_date, INTERVAL p.shelf_life_days DAY) ELSE sb.expiry_date END) > ?
        GROUP BY p.id, p.name, p.item_code, p.hsn_code, p.invoice_price, p.sale_price, p.grm_value, p.image_url, p.category, p.shelf_life_days
        HAVING total_available > 0
        ORDER BY p.name ASC`;

      const [rows] = await connection.execute(query, [referenceDate]);
      return rows.map(row => ({
        product_id: row.product_id,
        name: row.name,
        item_code: row.item_code,
        hsn_code: row.hsn_code,
        invoice_price: Number(row.invoice_price),
        sale_price: Number(row.sale_price),
        grm_value: Number(row.grm_value || 0),
        image_url: row.image_url,
        category: row.category,
        shelf_life_days: row.shelf_life_days != null ? Number(row.shelf_life_days) : null,
        total_available: Number(row.total_available),
        next_expiry: row.next_expiry
      }));
    } catch (error) {
      console.error('Error in StockBatch.getAggregatedAvailableStockByProduct:', error);
      throw error;
    }
  }
}

module.exports = StockBatch;