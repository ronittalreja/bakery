const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/check-stock/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Get current stock for the specific product
    const [stockRows] = await db.execute(`
      SELECT 
        s.quantity as stock_quantity,
        COALESCE(SUM(si.quantity), 0) as sold_quantity,
        COALESCE(SUM(g.quantity), 0) as grm_quantity
      FROM stock s
      LEFT JOIN sale_items si ON s.id = si.batch_id AND si.item_type = 'product'
      LEFT JOIN grm_items g ON s.id = g.batch_id
      WHERE s.item_id = ? AND s.item_type = 'product'
      GROUP BY s.id, s.quantity
    `, [productId]);

    if (stockRows.length === 0) {
      return res.json({ success: true, stock: 0 });
    }

    // Calculate available stock
    let totalAvailable = 0;
    stockRows.forEach(row => {
      const available = row.stock_quantity - (row.sold_quantity || 0) - (row.grm_quantity || 0);
      totalAvailable += Math.max(0, available);
    });

    console.log(`🔍 Real-time stock check for product ${productId}: ${totalAvailable} available`);
    
    res.json({ 
      success: true, 
      stock: totalAvailable 
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
