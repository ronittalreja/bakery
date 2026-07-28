const Product = require('../models/Product');
const { getDemoData } = require('../middleware/demoMode');
const db = require('../config/database');

// Helper function to sync prices across all related tables
const syncProductPrices = async (productId, invoicePrice, salePrice) => {
  try {
    // Update stock batches with new prices
    await db.execute(
      'UPDATE stock_batches SET invoice_price = ?, sale_price = ? WHERE product_id = ?',
      [invoicePrice, salePrice, productId]
    );
    console.log(`✓ Synced prices for product ${productId} to stock_batches`);
    
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
    // Return demo data if demo user
    if (req.isDemo) {
      const demoProducts = getDemoData('products');
      return res.json({ success: true, products: demoProducts });
    }
    
    const products = await Product.findAll();
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findById(id);
    
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
      is_active: typeof isActive === 'boolean' ? (isActive ? 1 : 0) : undefined
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
  getProduct,
  getProductByItemCode,
  createProduct,
  updateProduct,
  deleteProduct
};