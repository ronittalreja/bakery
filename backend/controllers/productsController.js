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
    const { store_id: queryStoreId } = req.query;
    const storeId = queryStoreId || req.store_id || req.user?.store_id;
    
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
    const connection = await db.getConnection();

    // Get all products from all stores (existing in products table)
    const [existingProducts] = await connection.query(`
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
        s.store_name,
        'existing' as source
      FROM products p
      LEFT JOIN stores s ON p.store_id = s.id
      ORDER BY p.store_id, p.name
    `);

    // Get all unique product names from invoice_items across all stores
    const [invoiceItems] = await connection.query(`
      SELECT DISTINCT
        ii.product_name,
        ii.product_code,
        ii.unit_price,
        i.store_id,
        s.store_name,
        COUNT(DISTINCT i.id) as invoice_count,
        SUM(ii.quantity) as total_quantity,
        MIN(i.invoice_date) as first_seen,
        MAX(i.invoice_date) as last_seen
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      LEFT JOIN stores s ON i.store_id = s.id
      WHERE i.invoice_date IS NOT NULL
      GROUP BY ii.product_name, ii.product_code, ii.unit_price, i.store_id, s.store_name
      ORDER BY i.store_id, ii.product_name
    `);

    // Get all existing product names and codes to find unmapped items
    const [mappedItems] = await connection.query(`
      SELECT name, item_code FROM products
    `);

    const mappedSet = new Set();
    mappedItems.forEach(item => {
      mappedSet.add(item.name);
      if (item.item_code) mappedSet.add(item.item_code);
    });

    // Filter invoice items that are not in products table
    const unmappedItems = invoiceItems.filter(item => {
      return !mappedSet.has(item.product_name) && !mappedSet.has(item.product_code);
    });

    // Format unmapped items to match the product structure
    const formattedUnmapped = unmappedItems.map(item => ({
      id: null,
      item_code: item.product_code || 'PENDING',
      name: item.product_name,
      hsn_code: '19059010',
      invoice_price: item.unit_price,
      sale_price: item.unit_price, // Use invoice price as default
      grm_value: 0,
      is_active: '0',
      category: 'uncategorized',
      shelf_life_days: null,
      store_id: item.store_id,
      store_name: item.store_name,
      source: 'unmapped',
      invoice_count: item.invoice_count,
      total_quantity: item.total_quantity,
      first_seen: item.first_seen,
      last_seen: item.last_seen
    }));

    // Combine existing products and unmapped items
    const allProducts = [...existingProducts, ...formattedUnmapped];

    connection.release();

    res.json(allProducts);
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

const syncUnmappedProduct = async (req, res) => {
  let connection;
  try {
    const { productName, productCode, storeId, unitPrice } = req.body;

    if (!productName || !storeId) {
      return res.status(400).json({ error: 'productName and storeId are required' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Generate item code if not provided
    const itemCode = productCode || productName.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 50);

    // Infer category and shelf life
    const inferred = Product.inferCategoryAndShelfLife(itemCode);
    const category = inferred.category || 'uncategorized';
    const shelfLifeDays = inferred.shelf_life_days || null;

    // Calculate sale price (apply margin to invoice price)
    const salePrice = unitPrice * 1.2; // 20% margin
    const grmValue = 0;

    // Insert new product
    const [result] = await connection.execute(
      'INSERT INTO products (name, item_code, hsn_code, invoice_price, sale_price, grm_value, category, shelf_life_days, store_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
      [productName, itemCode, '19059010', unitPrice, salePrice, grmValue, category, shelfLifeDays, storeId]
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Product synced successfully',
      product: {
        id: result.insertId,
        item_code: itemCode,
        name: productName,
        store_id: storeId
      }
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error syncing unmapped product:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
};

const syncAllUnmappedProducts = async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Get all unmapped items from invoice_items
    const [invoiceItems] = await connection.query(`
      SELECT DISTINCT
        ii.product_name,
        ii.product_code,
        ii.unit_price,
        i.store_id
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE i.invoice_date IS NOT NULL
    `);

    // Get all existing product names and codes
    const [mappedItems] = await connection.query(`
      SELECT name, item_code FROM products
    `);

    const mappedSet = new Set();
    mappedItems.forEach(item => {
      mappedSet.add(item.name);
      if (item.item_code) mappedSet.add(item.item_code);
    });

    // Filter unmapped items
    const unmappedItems = invoiceItems.filter(item => {
      return !mappedSet.has(item.product_name) && !mappedSet.has(item.product_code);
    });

    let syncedCount = 0;
    const errors = [];

    // Sync each unmapped item
    for (const item of unmappedItems) {
      try {
        const itemCode = item.product_code || item.product_name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 50);
        const inferred = Product.inferCategoryAndShelfLife(itemCode);
        const category = inferred.category || 'uncategorized';
        const shelfLifeDays = inferred.shelf_life_days || null;
        const salePrice = item.unit_price * 1.2;
        const grmValue = 0;

        await connection.execute(
          'INSERT INTO products (name, item_code, hsn_code, invoice_price, sale_price, grm_value, category, shelf_life_days, store_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
          [item.product_name, itemCode, '19059010', item.unit_price, salePrice, grmValue, category, shelfLifeDays, item.store_id]
        );

        syncedCount++;
      } catch (err) {
        errors.push({ item: item.product_name, error: err.message });
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: `Synced ${syncedCount} products successfully`,
      syncedCount,
      totalUnmapped: unmappedItems.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error syncing all unmapped products:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  getAllProducts,
  getMasterProducts,
  getProduct,
  getProductByItemCode,
  createProduct,
  updateProduct,
  deleteProduct,
  syncUnmappedProduct,
  syncAllUnmappedProducts
};