// File: backend/routes/add-sales.js
const express = require('express');
const router = express.Router();
const StockBatch = require('../models/StockBatch');
const Sale = require('../models/Sale');
const db = require('../config/database');

// Get available stock for add sales (excluding already sold items, including GRM processed items)
router.get('/available-stock', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'Valid date is required' });
    }

    // Get available stock for the specific date
    const availableStock = await StockBatch.getAvailableStock({ date });
    
    // Get already sold items for that date to exclude them
    const [soldItems] = await db.execute(`
      SELECT si.product_id, si.batch_id, SUM(si.quantity) as sold_quantity
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      WHERE DATE(s.sale_date) = ?
      GROUP BY si.product_id, si.batch_id
    `, [date]);

    // Get GRM processed items for that date to include them
    const [grmProcessedItems] = await db.execute(`
      SELECT r.product_id, r.batch_id, r.quantity as grm_quantity
      FROM returns r
      WHERE r.type = 'GRM' AND r.return_date = ?
    `, [date]);

    // Create maps for quick lookup
    const soldMap = new Map();
    soldItems.forEach(item => {
      soldMap.set(`${item.product_id}-${item.batch_id}`, item.sold_quantity);
    });

    const grmMap = new Map();
    grmProcessedItems.forEach(item => {
      const key = `${item.product_id}-${item.batch_id}`;
      grmMap.set(key, (grmMap.get(key) || 0) + item.grm_quantity);
    });

    // Process available stock
    const processedStock = [];
    for (const stock of availableStock) {
      const key = `${stock.product_id}-${stock.id}`;
      const soldQty = soldMap.get(key) || 0;
      const grmQty = grmMap.get(key) || 0;
      
      // Calculate remaining quantity after sales
      const remainingQty = Math.max(0, stock.quantity - soldQty);
      
      // Add GRM quantity back if items were processed
      const availableQty = remainingQty + grmQty;
      
      if (availableQty > 0) {
        processedStock.push({
          ...stock,
          quantity: availableQty,
          original_quantity: stock.quantity,
          sold_quantity: soldQty,
          grm_quantity: grmQty,
          is_grm_restored: grmQty > 0
        });
      }
    }

    res.json({
      success: true,
      data: processedStock
    });
  } catch (error) {
    console.error('Error in get available stock for add sales:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Record sale with GRM reduction logic
router.post('/record', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { saleDate, items, paymentType, totalAmount } = req.body;
    const staffId = req.user?.id || 0;

    if (!saleDate || !items || !Array.isArray(items) || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Create sale record
    const saleResult = await Sale.create({
      saleDate,
      totalAmount,
      paymentType,
      staffId
    }, connection);

    const saleId = saleResult.saleId;

    // Process each item
    for (const item of items) {
      const { productId, quantity, batchId, unitPrice, totalPrice, name } = item;

      // Check if this is a GRM processed item
      const [grmCheck] = await connection.execute(`
        SELECT SUM(r.quantity) as total_grm_quantity
        FROM returns r
        WHERE r.type = 'GRM' AND r.product_id = ? AND r.batch_id = ? AND r.return_date = DATE(?)
      `, [productId, batchId, saleDate]);

      const totalGrmQuantity = Number(grmCheck[0]?.total_grm_quantity || 0);

      // Get available stock quantity
      const [stockCheck] = await connection.execute(`
        SELECT quantity
        FROM stock_batches
        WHERE id = ? AND product_id = ?
      `, [batchId, productId]);

      const availableStock = Number(stockCheck[0]?.quantity || 0);

      // Get already sold quantity for this batch on this date
      const [soldCheck] = await connection.execute(`
        SELECT SUM(si.quantity) as sold_quantity
        FROM sales s
        JOIN sale_items si ON s.id = si.sale_id
        WHERE si.batch_id = ? AND si.product_id = ? AND DATE(s.sale_date) = DATE(?)
      `, [batchId, productId, saleDate]);

      const soldQuantity = Number(soldCheck[0]?.sold_quantity || 0);

      // Calculate remaining stock after previous sales
      const remainingStock = availableStock - soldQuantity;

      // Determine if we need to reduce GRM and how much to deduct from stock
      let grmReduction = 0;
      let stockDeduction = quantity;

      if (totalGrmQuantity > 0) {
        // We have GRM processed items, reduce GRM first
        grmReduction = Math.min(quantity, totalGrmQuantity);
        stockDeduction = quantity - grmReduction;
      }

      // Validate stock availability
      if (stockDeduction > remainingStock) {
        await connection.rollback();
        return res.status(400).json({ 
          success: false, 
          error: `Insufficient stock for ${name}. Available: ${remainingStock}, Required: ${stockDeduction}` 
        });
      }

      // Create sale item record
      await Sale.createSaleItem({
        saleId,
        productId,
        batchId,
        quantity,
        unitPrice,
        totalPrice,
        name
      }, connection);

      // Reduce stock if needed
      if (stockDeduction > 0) {
        await StockBatch.deductQuantity(batchId, stockDeduction, connection);
      }

      // Reduce GRM if needed
      if (grmReduction > 0) {
        // Find and update GRM records
        const [grmRecords] = await connection.execute(`
          SELECT id, quantity
          FROM returns
          WHERE type = 'GRM' AND product_id = ? AND batch_id = ? AND return_date = DATE(?)
          ORDER BY id ASC
        `, [productId, batchId, saleDate]);

        let remainingReduction = grmReduction;
        for (const record of grmRecords) {
          if (remainingReduction <= 0) break;

          const reduction = Math.min(remainingReduction, record.quantity);
          await connection.execute(`
            UPDATE returns
            SET quantity = quantity - ?,
            loss_amount = loss_amount - (? * invoice_price * 0.15)
            WHERE id = ?
          `, [reduction, reduction, record.id]);

          // Delete record if quantity becomes 0
          await connection.execute(`
            DELETE FROM returns WHERE quantity <= 0 AND id = ?
          `, [record.id]);

          remainingReduction -= reduction;
        }
      }
    }

    await connection.commit();
    res.json({
      success: true,
      message: 'Sale recorded successfully',
      saleId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error in add sales record:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
