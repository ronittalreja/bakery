const StockBatch = require('../models/StockBatch');
const db = require('../config/database');


const getStock = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    // Fetch all non-expired stock (expiry_date >= today)
    const [rows] = await db.execute(
      `SELECT 
        sb.id,
        sb.product_id,
        sb.quantity,
        sb.expiry_date,
        sb.invoice_date,
        sb.invoice_reference,
        p.item_code,
        p.name,
        p.hsn_code,
        p.invoice_price,
        p.sale_price,
        p.grm_value,
        p.image_url,
        COALESCE(
          sb.quantity - 
          COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.batch_id = sb.id), 0) -
          COALESCE((SELECT SUM(r.quantity) FROM returns r WHERE r.batch_id = sb.id), 0),
          0
        ) AS available_quantity
      FROM stock_batches sb
      JOIN products p ON sb.product_id = p.id
      WHERE sb.expiry_date > ? AND p.is_active = 1
      HAVING available_quantity > 0
      ORDER BY p.name`,
      [targetDate]
    );

    res.json({
      success: true,
      data: rows.map(row => ({
        id: row.id,
        product_id: row.product_id,
        quantity: Number(row.available_quantity),
        expiry_date: row.expiry_date,
        invoice_date: row.invoice_date,
        invoice_reference: row.invoice_reference,
        item_code: row.item_code,
        name: row.name,
        hsn_code: row.hsn_code || '',
        invoice_price: Number(row.invoice_price),
        sale_price: Number(row.sale_price),
        grm_value: Number(row.grm_value || 0),
        image_url: row.image_url || '/placeholder.svg'
      }))
    });
  } catch (error) {
    console.error('Error in getStock:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};


const updateStockQuantity = async (req, res) => {
  try {
    const { batchId, quantity, expiryDate, reason } = req.body;
    
    if (!batchId || quantity === undefined || quantity < 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Batch ID and valid quantity (>= 0) are required' 
      });
    }

    // Check if batch exists
    const [batch] = await db.execute('SELECT * FROM stock_batches WHERE id = ?', [batchId]);
    if (batch.length === 0) {
      return res.status(404).json({ success: false, error: 'Stock batch not found' });
    }

    // Prepare update fields
    const updateFields = ['quantity = ?'];
    const updateValues = [quantity];
    
    // Add expiry date update if provided
    if (expiryDate) {
      updateFields.push('expiry_date = ?');
      // Convert datetime string to date format (YYYY-MM-DD)
      const formattedDate = new Date(expiryDate).toISOString().split('T')[0];
      updateValues.push(formattedDate);
    }
    
    updateValues.push(batchId);

    // Update quantity and optionally expiry date
    await db.execute(
      `UPDATE stock_batches SET ${updateFields.join(', ')} WHERE id = ?`, 
      updateValues
    );

    // No need for separate logging table - just update the stock_batches directly

    res.json({ 
      success: true, 
      message: 'Stock updated successfully',
      data: {
        batchId,
        oldQuantity: batch[0].quantity,
        newQuantity: quantity,
        oldExpiryDate: batch[0].expiry_date,
        newExpiryDate: expiryDate || batch[0].expiry_date
      }
    });
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({ success: false, error: 'Failed to update stock: ' + error.message });
  }
};

// Get low stock alerts
const getLowStockAlerts = async (req, res) => {
  try {
    const { threshold = 10 } = req.query;
    
    const query = `
      SELECT 
        sb.id,
        sb.product_id,
        p.name,
        p.item_code,
        SUM(COALESCE(
          sb.quantity - 
          COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.batch_id = sb.id), 0) -
          COALESCE((SELECT SUM(r.quantity) FROM returns r WHERE r.batch_id = sb.id), 0),
          0
        )) AS total_available
      FROM stock_batches sb
      JOIN products p ON sb.product_id = p.id
      WHERE p.is_active = 1 AND sb.expiry_date > CURDATE()
      GROUP BY sb.product_id, p.name, p.item_code
      HAVING total_available <= ? AND total_available > 0
      ORDER BY total_available ASC
    `;
    
    const [rows] = await db.execute(query, [threshold]);
    
    res.json({
      success: true,
      alerts: rows.map(row => ({
        product_id: row.product_id,
        name: row.name,
        item_code: row.item_code,
        available_quantity: Number(row.total_available),
        threshold: Number(threshold)
      }))
    });
  } catch (error) {
    console.error('Get low stock alerts error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch low stock alerts: ' + error.message });
  }
};

const addStockBatch = async (req, res) => {
  try {
    const { productId, quantity, invoiceDate, invoiceReference } = req.body;
    
    if (!productId || !quantity || !invoiceDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'Product ID, quantity, and invoice date are required' 
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Quantity must be greater than 0' 
      });
    }

    // Get product details to calculate expiry date
    const [product] = await db.execute('SELECT * FROM products WHERE id = ?', [productId]);
    if (product.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const productData = product[0];
    let expiryDate = null;

    // Calculate expiry date based on shelf life
    if (productData.shelf_life_days && productData.shelf_life_days > 0) {
      const invoiceDateObj = new Date(invoiceDate);
      invoiceDateObj.setDate(invoiceDateObj.getDate() + productData.shelf_life_days);
      expiryDate = invoiceDateObj.toISOString().split('T')[0];
    }

    // Create stock batch
    const batchId = await StockBatch.create({
      productId,
      quantity,
      expiryDate,
      invoiceDate,
      invoiceReference: invoiceReference || null
    });

    res.json({ 
      success: true, 
      message: 'Stock batch added successfully',
      data: { batchId }
    });
  } catch (error) {
    console.error('Add stock batch error:', error);
    res.status(500).json({ success: false, error: 'Failed to add stock batch: ' + error.message });
  }
};

const deleteStockBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    
    if (!batchId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Batch ID is required' 
      });
    }

    // Check if batch exists
    const [batch] = await db.execute('SELECT * FROM stock_batches WHERE id = ?', [batchId]);
    if (batch.length === 0) {
      return res.status(404).json({ success: false, error: 'Stock batch not found' });
    }

    // Check if batch has any sales or returns
    const [sales] = await db.execute(
      'SELECT COUNT(*) as count FROM sale_items WHERE batch_id = ?', 
      [batchId]
    );
    const [returns] = await db.execute(
      'SELECT COUNT(*) as count FROM returns WHERE batch_id = ?', 
      [batchId]
    );

    if (sales[0].count > 0 || returns[0].count > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete batch with existing sales or returns. Use stock adjustment instead.' 
      });
    }

    // Delete the batch
    await db.execute('DELETE FROM stock_batches WHERE id = ?', [batchId]);

    res.json({ 
      success: true, 
      message: 'Stock batch deleted successfully'
    });
  } catch (error) {
    console.error('Delete stock batch error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete stock batch: ' + error.message });
  }
};

module.exports = { 
  getStock, 
  updateStockQuantity, 
  getLowStockAlerts,
  addStockBatch,
  deleteStockBatch
};
