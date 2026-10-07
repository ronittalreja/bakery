const Product = require('../models/Product');
const { getDemoData } = require('../middleware/demoMode');
const db = require('../config/database');

// Helper function to sync prices across all related tables
const syncProductPrices = async (productId, invoicePrice, salePrice) => {
  try {
    // Note: stock_batches table doesn't have invoice_price/sale_price columns
    // Prices are stored in products table and used dynamically
    // Note: We don't update invoice_items as they should preserve historical prices
    // Note: We don't update sale_items as they should preserve historical prices
    return true;
  } catch (error) {
    console.error('Error syncing product prices:', error);
    return false;
  }
};

const getAllProducts = async (req, res) => {
  try {
    const storeId = req.store_id || req.user?.store_id;
    
    // Return demo data if demo user
    if (req.isDemo) {
      const demoProducts = getDemoData('products');
      return res.json({ success: true, products: demoProducts });
    }
    
    const products = await Product.findAll(storeId);
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMasterProducts = async (req, res) => {
  try {
    // Get all products from all stores (no store_id filter)
    const connection = await db.getConnection();
    
    const [rows] = await connection.query(`
      SELECT 
        p.id,
        p.item_code,
        p.name,
        p.hsn_code,
        p.invoice_price,
        p.sale_price,
        p.grm_value,
        p.is_active,
        p.category,
        p.shelf_life_days,
        p.store_id,
        s.store_name
      FROM products p
      LEFT JOIN stores s ON p.store_id = s.id
      ORDER BY p.store_id, p.name
    `);
    
    connection.release();
    
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const storeId = req.store_id || req.user?.store_id;
    
    const product = await Product.findById(id, storeId);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProductByItemCode = async (req, res) => {
  try {
    const { itemCode } = req.params;
    
    const product = await Product.findByItemCodeOrName(itemCode, itemCode);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const storeId = req.store_id || req.user?.store_id || 1;
    const { name, itemCode, hsnCode, description, category, shelfLifeDays, invoicePrice, salePrice, grmValue, imageUrl, isActive } = req.body;
    
    // Map incoming camelCase to DB snake_case
    const product = await Product.create({
      name,
      item_code: itemCode,
      hsn_code: hsnCode,
      description,
      category,
      shelf_life_days: shelfLifeDays,
      invoice_price: invoicePrice,
      sale_price: salePrice,
      grm_value: grmValue,
      image_url: imageUrl,
      is_active: typeof isActive === 'boolean' ? (isActive ? 1 : 0) : undefined,
      store_id: storeId
    });
    
    // Sync prices to stock batches (for any existing batches)
    if (invoicePrice !== undefined && salePrice !== undefined) {
      await syncProductPrices(product.id, invoicePrice, salePrice);
    }
    
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, itemCode, hsnCode, description, category, shelfLifeDays, invoicePrice, salePrice, grmValue, imageUrl, isActive } = req.body;
    
    const product = await Product.update(id, {
      name,
      item_code: itemCode,
      hsn_code: hsnCode,
      description,
      category,
      shelf_life_days: shelfLifeDays,
      invoice_price: invoicePrice,
      sale_price: salePrice,
      grm_value: grmValue,
      image_url: imageUrl,
      is_active: typeof isActive === 'boolean' ? (isActive ? 1 : 0) : undefined
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Sync prices to stock batches
    if (invoicePrice !== undefined && salePrice !== undefined) {
      await syncProductPrices(id, invoicePrice, salePrice);
    }
    
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await Product.delete(id);
    
    if (!result) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAllProducts,
  getMasterProducts,
  getProduct,
  getProductByItemCode,
  createProduct,
  updateProduct,
  deleteProduct
};