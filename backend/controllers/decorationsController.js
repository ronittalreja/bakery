const Decoration = require('../models/Decoration');
const db = require('../config/database');

const getAllDecorations = async (req, res) => {
  try {
    const decorations = await Decoration.findAll();
    res.json({ success: true, decorations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getDecoration = async (req, res) => {
  try {
    const { id } = req.params;
    
    const decoration = await Decoration.findById(id);
    
    if (!decoration) {
      return res.status(404).json({ error: 'Decoration not found' });
    }
    
    res.json({ success: true, decoration });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getDecorationBySkuOrName = async (req, res) => {
  try {
    const { identifier } = req.params;
    
    const decoration = await Decoration.findBySkuOrName(identifier, identifier);
    
    if (!decoration) {
      return res.status(404).json({ error: 'Decoration not found' });
    }
    
    res.json({ success: true, decoration });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createDecoration = async (req, res) => {
  try {
    const { sku, name, category, price, costPrice, stock, image } = req.body;
    
    const decoration = await Decoration.create({
      sku,
      name,
      category,
      cost: costPrice || 0,
      sale_price: price,
      stock_quantity: stock,
      image_url: image
    });
    
    res.json({ success: true, decoration });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateDecoration = async (req, res) => {
  try {
    const { id } = req.params;
    const { sku, name, category, price, costPrice, stock, image } = req.body;
    
    const decoration = await Decoration.update(id, {
      sku,
      name,
      category,
      cost: costPrice || 0,
      sale_price: price,
      stock_quantity: stock,
      image_url: image
    });
    
    if (!decoration) {
      return res.status(404).json({ error: 'Decoration not found' });
    }
    
    res.json({ success: true, decoration });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteDecoration = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await Decoration.delete(id);
    
    if (!result) {
      return res.status(404).json({ error: 'Decoration not found' });
    }
    
    res.json({ success: true, message: 'Decoration deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update decoration stock when items are sold
const updateDecorationStock = async (decorationId, quantitySold) => {
  try {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      
      // Check current stock
      const [rows] = await connection.execute(
        'SELECT stock_quantity FROM decorations WHERE id = ? AND is_active = 1',
        [decorationId]
      );
      
      if (!rows.length) {
        throw new Error('Decoration not found');
      }
      
      const currentStock = rows[0].stock_quantity;
      if (currentStock < quantitySold) {
        throw new Error('Insufficient stock for decoration');
      }
      
      // Update stock
      await connection.execute(
        'UPDATE decorations SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [quantitySold, decorationId]
      );
      
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating decoration stock:', error);
    throw error;
  }
};

// Get decoration by ID for stock checking
const getDecorationForSale = async (decorationId) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, sku, name, category, sale_price, stock_quantity, image_url FROM decorations WHERE id = ? AND is_active = 1',
      [decorationId]
    );
    
    if (!rows.length) {
      return null;
    }
    
    return {
      id: rows[0].id,
      sku: rows[0].sku,
      name: rows[0].name,
      category: rows[0].category,
      sale_price: rows[0].sale_price,
      stock_quantity: rows[0].stock_quantity,
      image_url: rows[0].image_url
    };
  } catch (error) {
    console.error('Error fetching decoration for sale:', error);
    throw error;
  }
};

module.exports = {
  getAllDecorations,
  getDecoration,
  getDecorationBySkuOrName,
  createDecoration,
  updateDecoration,
  deleteDecoration,
  updateDecorationStock,
  getDecorationForSale
};