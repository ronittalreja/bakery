const db = require('../config/database');
const { processImageUrl } = require('../utils/imageUtils');

class Product {
  static inferCategoryAndShelfLife(itemCode) {
    if (!itemCode || typeof itemCode !== 'string' || itemCode.length < 2) {
      return { category: undefined, shelf_life_days: undefined };
    }
    const prefix = itemCode.substring(0, 2).toUpperCase();
    const threeDay = new Set(['OG', 'DG', 'OO', 'OP', 'OS', 'OF', 'OB']);
    const ninetyDay = new Set(['OZ', 'OY', 'IO']);
    if (threeDay.has(prefix)) {
      const map = {
        OG: 'cakes', DG: 'cakes', OO: 'cakes', OP: 'pastries', OS: 'savouries', OF: 'savouries', OB: 'breads'
      };
      return { category: map[prefix] || 'cakes', shelf_life_days: 3 };
    }
    if (prefix === 'ID') {
      return { category: 'packing_material', shelf_life_days: 0 };
    }
    if (ninetyDay.has(prefix)) {
      const map = { OZ: 'cookies', OY: 'assorted_cakes', IO: 'others' };
      return { category: map[prefix] || 'others', shelf_life_days: 90 };
    }
    return { category: undefined, shelf_life_days: undefined };
  }
  static async findAll() {
    const [rows] = await db.execute('SELECT * FROM products WHERE is_active = 1');
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.execute('SELECT * FROM products WHERE id = ?', [id]);
    return rows[0];
  }

  static async create(data) {
    try {
      const salePrice = data.sale_price || (data.invoice_price * 1.33);
      const grmValue = data.grm_value || (data.invoice_price * 0.15);
      const itemCode = data.item_code || `ITEM-${Date.now()}`;
      const imageUrl = processImageUrl(data.image_url) || '/placeholder.svg';

      // Auto category/shelf life from item code if not provided
      const inferred = this.inferCategoryAndShelfLife(itemCode);
      const category = data.category || inferred.category || null;
      const shelfLifeDays = data.shelf_life_days != null ? data.shelf_life_days : inferred.shelf_life_days;
      
      const [result] = await db.execute(
        'INSERT INTO products (item_code, name, invoice_price, sale_price, grm_value, hsn_code, image_url, category, shelf_life_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [itemCode, data.name, data.invoice_price, salePrice, grmValue, data.hsn_code || '19059010', imageUrl, category, shelfLifeDays]
      );
      return this.findById(result.insertId);
    } catch (error) {
      console.error('Error in Product.create:', error);
      throw error;
    }
  }

  static async update(id, data) {
    try {
      // Normalize and whitelist fields to avoid invalid column updates
      const normalized = {
        item_code: data.item_code,
        name: data.name,
        hsn_code: data.hsn_code,
        description: data.description,
        category: data.category,
        invoice_price: data.invoice_price,
        sale_price: data.sale_price,
        grm_value: data.grm_value,
        image_url: processImageUrl(data.image_url),
        is_active: data.is_active,
        shelf_life_days: data.shelf_life_days
      };

      if (normalized.invoice_price && !normalized.sale_price) {
        normalized.sale_price = normalized.invoice_price * 1.33;
      }
      // If category/shelf life not provided but item_code updated, infer
      if ((normalized.category == null || normalized.shelf_life_days == null) && normalized.item_code) {
        const inferred = this.inferCategoryAndShelfLife(normalized.item_code);
        if (normalized.category == null && inferred.category) normalized.category = inferred.category;
        if (normalized.shelf_life_days == null && inferred.shelf_life_days != null) normalized.shelf_life_days = inferred.shelf_life_days;
      }

      if (normalized.invoice_price && !normalized.grm_value) {
        normalized.grm_value = normalized.invoice_price * 0.15;
      }

      // Remove undefined fields
      Object.keys(normalized).forEach((key) => normalized[key] === undefined && delete normalized[key]);

      if (Object.keys(normalized).length === 0) {
        return this.findById(id);
      }

      // Build dynamic SET clause
      const setClause = Object.keys(normalized).map((k) => `${k} = ?`).join(', ');
      const values = Object.values(normalized);
      await db.execute(`UPDATE products SET ${setClause} WHERE id = ?`, [...values, id]);
      return this.findById(id);
    } catch (error) {
      console.error('Error in Product.update:', error);
      throw error;
    }
  }

  static async delete(id) {
    await db.execute('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
    return true;
  }

  static async findByItemCodeOrName(itemCode, name) {
    const [rows] = await db.execute('SELECT * FROM products WHERE item_code = ? OR name = ?', [itemCode, name]);
    return rows[0];
  }
}

module.exports = Product;