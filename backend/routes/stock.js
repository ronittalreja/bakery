// File: backend/routes/stock.js
const express = require('express');
const router = express.Router();
const { getStock, updateStockQuantity, addStockBatch, deleteStockBatch } = require('../controllers/stockController');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const StockBatch = require('../models/StockBatch');
const { v4: uuidv4 } = require('uuid');

router.get('/', async (req, res) => {
  try {
    const { date, productId, expired, group } = req.query;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'Invalid date format' });
    }

    console.log("Received /api/stock request with date:", date, "productId:", productId, "expired:", expired, "group:", group);

    if (group && String(group).toLowerCase() === 'product') {
      const rows = await StockBatch.getAggregatedAvailableStockByProduct({ date });
      const totalQuantity = rows.reduce((sum, r) => sum + Number(r.total_available || 0), 0);
      const totalValue = rows.reduce((sum, r) => sum + Number(r.total_available || 0) * Number(r.sale_price || 0), 0);
      return res.json({ success: true, data: rows, totalQuantity, totalValue });
    }

    const stock = await StockBatch.getAvailableStock({ date, productId, expired: String(expired).toLowerCase() === 'true' });
    console.log("Stock query result:", JSON.stringify(stock, null, 2));

    if (!stock.length) {
      console.warn("No stock found for date:", date, "productId:", productId, "expired:", expired);
      return res.json({ success: true, data: [], totalQuantity: 0, totalValue: 0 });
    }

    const totalQuantity = stock.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalValue = stock.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.sale_price || 0), 0);

    res.json({ 
      success: true, 
      data: stock, 
      totalQuantity, 
      totalValue 
    });
  } catch (error) {
    console.error('Error in GET /api/stock:', error.message, error.stack);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch stock' });
  }
});

router.put('/update', auth, updateStockQuantity);
router.post('/add-batch', auth, addStockBatch);
router.delete('/batch/:batchId', auth, deleteStockBatch);

// Aggregated available stock per product for Record Sale page
router.get('/aggregated', async (req, res) => {
  try {
    const { date } = req.query;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'Invalid date format' });
    }

    const rows = await StockBatch.getAggregatedAvailableStockByProduct({ date });

    const totalQuantity = rows.reduce((sum, r) => sum + Number(r.total_available || 0), 0);
    const totalValue = rows.reduce((sum, r) => sum + Number(r.total_available || 0) * Number(r.sale_price || 0), 0);

    res.json({ success: true, data: rows, totalQuantity, totalValue });
  } catch (error) {
    console.error('Error in GET /api/stock/aggregated:', error.message);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch aggregated stock' });
  }
});
router.post('/add-cake', async (req, res) => {
  try {
    const { name, invoice_price, grm_value, sale_price, quantity, date, item_code } = req.body;
    const inferred = Product.inferCategoryAndShelfLife(item_code);
    const product = await Product.create({
      name,
      item_code,
      invoice_price,
      sale_price,
      grm_value,
      hsn_code: '19059010',
      image_url: '/special-cake.jpg',
      category: inferred.category,
      shelf_life_days: inferred.shelf_life_days
    });

    const shelfLifeDays = Number(product.shelf_life_days || inferred.shelf_life_days || 0);
    const invDate = new Date(date);
    let expiryDate;
    if (!shelfLifeDays) {
      expiryDate = '2099-12-31';
    } else {
      const exp = new Date(invDate);
      exp.setDate(exp.getDate() + shelfLifeDays);
      expiryDate = exp.toISOString().split('T')[0];
    }
    const batchData = {
      productId: product.id,
      quantity,
      expiryDate,
      invoiceDate: date,
      invoiceReference: `CAKE-${product.id}`
    };
    const batchId = await StockBatch.create(batchData);
    res.status(201).json({ success: true, product_id: product.id, batch_id: batchId });
  } catch (error) {
    console.error('Error in add-cake route:', error);
    res.status(500).json({ error: error.message });
  }
});



router.get('/items', async (req, res) => {
  try {
    const { date } = req.query;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'Invalid date format' });
    }

    console.log("Received /api/invoices/items request with date:", date);

    let query = `
      SELECT ii.id, ii.invoice_id, ii.product_id, ii.item_code, ii.item_name, ii.hsn_code, ii.qty, ii.rate, ii.total, ii.uom
      FROM invoice_items ii
      WHERE ii.qty > 0
    `;
    const params = [];

    if (date) {
      query += ' AND ii.invoice_date <= ?';
      params.push(date);
    }

    console.log("Executing invoice items query:", query, "with params:", params);
    const [rows] = await db.query(query, params);
    console.log("Invoice items query result:", JSON.stringify(rows, null, 2));

    if (!rows.length) {
      console.warn("No invoice items found for date:", date);
      return res.json({ success: true, data: [], totalQuantity: 0, totalValue: 0 });
    }

    const totalQuantity = rows.reduce((sum, item) => sum + Number(item.qty), 0);
    const totalValue = rows.reduce((sum, item) => sum + Number(item.qty) * Number(item.rate), 0);

    res.json({ 
      success: true, 
      data: rows, 
      totalQuantity, 
      totalValue 
    });
  } catch (error) {
    console.error('Error in GET /api/invoices/items:', error.message, error.stack);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch invoice items' });
  }
});
module.exports = router;
