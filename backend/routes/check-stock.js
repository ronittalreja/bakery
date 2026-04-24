const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/check-stock/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Simple stock query - just get basic stock quantity
    const [stockRows] = await db.execute(`
      SELECT s.quantity as stock_quantity
      FROM stock s
      WHERE s.item_id = ? AND s.item_type = 'product'
    `, [productId]);

    if (stockRows.length === 0) {
      console.log(`🔍 No stock found for product ${productId}: 0 available`);
      return res.json({ success: true, stock: 0 });
    }

    // Calculate total stock (sum of all batches)
    let totalStock = 0;
    stockRows.forEach(row => {
      totalStock += row.stock_quantity || 0;
    });

    console.log(`🔍 Real-time stock check for product ${productId}: ${totalStock} available`);
    
    res.json({ 
      success: true, 
      stock: totalStock 
    });
    
  } catch (error) {
    console.error('Error checking stock:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check stock' 
    });
  }
});

module.exports = router;
