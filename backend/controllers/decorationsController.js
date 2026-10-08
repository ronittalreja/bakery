const Decoration = require('../models/Decoration');
const db = require('../config/database');
const { getDemoData, demoData } = require('../middleware/demoMode');

const getAllDecorations = async (req, res) => {
  try {
    const { store_id: queryStoreId } = req.query;
    const storeId = queryStoreId || req.user?.store_id;
    
    // Return demo data if demo user
    if (req.isDemo) {
      const demoDecorations = getDemoData('decorations');
      return res.json({ success: true, decorations: demoDecorations });
    }
    
    const decorations = await Decoration.findAll(storeId);
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
    const storeId = req.user?.store_id;
    
    const decoration = await Decoration.create({
      sku,
      name,
      category,
      cost: costPrice || 0,
      sale_price: price,
      stock_quantity: stock,
      image_url: image,
      store_id: storeId
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
const getDecorationForSale = async (decorationId, isDemo = false) => {
  try {
    // Return demo data if demo user
    if (isDemo) {
      const decoration = demoData.decorations.find(d => d.id === decorationId);
      if (!decoration) {
        return null;
      }
      return {
        id: decoration.id,
        sku: decoration.sku,
        name: decoration.name,
        category: decoration.category,
        sale_price: decoration.sale_price,
        stock_quantity: decoration.stock_quantity,
        image_url: decoration.image_url
      };
    }

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

const getDecorationsForAddSales = async (req, res) => {
  try {
    const { date } = req.query;
    const storeId = req.user?.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'User store_id not found' });
    }
    
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'Valid date is required' });
    }

    // Get all active decorations - filter by store_id
    const [decorations] = await db.execute(
      'SELECT id, sku, name, category, sale_price, stock_quantity, image_url FROM decorations WHERE is_active = 1 AND store_id = ?',
      [storeId]
    );

    // For each decoration, calculate available stock considering sales on that date
    const decorationsWithAvailability = await Promise.all(
      decorations.map(async (decoration) => {
        // Get total sold quantity for this decoration on the specific date - filter by store_id
        const [soldData] = await db.execute(`
          SELECT SUM(si.quantity) as sold_quantity
          FROM sales s
          JOIN sale_items si ON s.id = si.sale_id
          WHERE si.item_id = ? AND DATE(s.sale_date) = ? AND s.store_id = ?
        `, [decoration.id, date, storeId]);

        const soldQuantity = Number(soldData[0]?.sold_quantity || 0);
        const availableQuantity = Math.max(0, decoration.stock_quantity - soldQuantity);

        return {
          ...decoration,
          stock_quantity: availableQuantity,
          original_stock: decoration.stock_quantity,
          sold_quantity: soldQuantity
        };
      })
    );

    // Filter decorations that have available stock
    const availableDecorations = decorationsWithAvailability.filter(
      d => d.stock_quantity > 0
    );

    res.json({
      success: true,
      decorations: availableDecorations
    });
  } catch (error) {
    console.error('Error in getDecorationsForAddSales:', error);
    res.status(500).json({ success: false, error: error.message });
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
  getDecorationForSale,
  getDecorationsForAddSales
};