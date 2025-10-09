const Product = require('../models/Product');

const getAllProducts = async (req, res) => {
  try {
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