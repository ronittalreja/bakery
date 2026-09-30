// Tomorrow AI Product Management Controller
// Handles ML group ID mapping and product classification management

const db = require('../config/database');

/**
 * Add mapping_status column to tomorrow_ai_product_master if not exists
 */
async function ensureMappingStatusColumn() {
  try {
    const [columns] = await db.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'tomorrow_ai_product_master'
      AND COLUMN_NAME = 'mapping_status'
    `);

    if (columns.length === 0) {
      await db.execute(`
        ALTER TABLE tomorrow_ai_product_master
        ADD COLUMN mapping_status ENUM('pending', 'approved', 'notforuse') DEFAULT 'pending'
      `);
      console.log('Added mapping_status column to tomorrow_ai_product_master');
    }
  } catch (error) {
    console.error('Error ensuring mapping_status column:', error);
  }
}

/**
 * Get all products with ML group info
 */
async function getProducts(req, res) {
  try {
    await ensureMappingStatusColumn();

    const { itemType, status } = req.query;

    let query = `
      SELECT
        pm.id,
        pm.product_id,
        pm.name,
        pm.category,
        pm.price,
        pm.item_type,
        pm.ml_group_id,
        pm.active,
        pm.mapping_status,
        COUNT(DISTINCT pa.id) as alias_count
      FROM tomorrow_ai_product_master pm
      LEFT JOIN tomorrow_ai_product_aliases pa ON pm.product_id = pa.product_id
      WHERE 1=1
    `;

    const params = [];

    if (itemType) {
      query += ` AND pm.item_type = ?`;
      params.push(itemType);
    }

    if (status) {
      query += ` AND pm.mapping_status = ?`;
      params.push(status);
    }

    query += ` GROUP BY pm.id ORDER BY pm.name ASC`;

    const [products] = await db.execute(query, params);

    // Auto-assign notforuse for packaging material and special order
    for (const product of products) {
      if (!product.mapping_status || product.mapping_status === 'pending') {
        if (product.item_type === 'PACKAGING_MATERIAL' || product.item_type === 'SPECIAL_ORDER') {
          await db.execute(`
            UPDATE tomorrow_ai_product_master
            SET mapping_status = 'notforuse'
            WHERE product_id = ?
          `, [product.product_id]);
          product.mapping_status = 'notforuse';
        }
      }
    }

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Update product ML group ID
 */
async function updateProductMLGroup(req, res) {
  try {
    const { productId, mlGroupId } = req.body;

    if (!productId || !mlGroupId) {
      return res.status(400).json({
        success: false,
        error: 'productId and mlGroupId are required'
      });
    }

    await db.execute(`
      UPDATE tomorrow_ai_product_master
      SET ml_group_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE product_id = ?
    `, [mlGroupId, productId]);

    res.json({
      success: true,
      message: 'ML group ID updated successfully'
    });
  } catch (error) {
    console.error('Error updating ML group ID:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Update product item type
 */
async function updateProductItemType(req, res) {
  try {
    const { productId, itemType } = req.body;

    if (!productId || !itemType) {
      return res.status(400).json({
        success: false,
        error: 'productId and itemType are required'
      });
    }

    const validTypes = ['DISPLAY', 'SPECIAL_ORDER', 'PACKING_MATERIAL', 'OTHER'];
    if (!validTypes.includes(itemType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid itemType. Must be one of: ${validTypes.join(', ')}`
      });
    }

    await db.execute(`
      UPDATE tomorrow_ai_product_master
      SET item_type = ?, updated_at = CURRENT_TIMESTAMP
      WHERE product_id = ?
    `, [itemType, productId]);

    res.json({
      success: true,
      message: 'Item type updated successfully'
    });
  } catch (error) {
    console.error('Error updating item type:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get product aliases
 */
async function getProductAliases(req, res) {
  try {
    const { productId } = req.params;

    const [aliases] = await db.execute(`
      SELECT 
        pa.id,
        pa.product_id,
        pa.historical_item_code,
        pa.historical_name,
        pa.effective_from,
        pa.effective_to,
        pm.name as current_product_name
      FROM tomorrow_ai_product_aliases pa
      JOIN tomorrow_ai_product_master pm ON pa.product_id = pm.product_id
      WHERE pa.product_id = ?
      ORDER BY pa.effective_from DESC
    `, [productId]);

    res.json({
      success: true,
      data: aliases
    });
  } catch (error) {
    console.error('Error fetching product aliases:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Add product alias
 */
async function addProductAlias(req, res) {
  try {
    const { productId, historicalItemCode, historicalName, effectiveFrom, effectiveTo } = req.body;

    if (!productId || !historicalItemCode) {
      return res.status(400).json({
        success: false,
        error: 'productId and historicalItemCode are required'
      });
    }

    await db.execute(`
      INSERT INTO tomorrow_ai_product_aliases 
      (product_id, historical_item_code, historical_name, effective_from, effective_to)
      VALUES (?, ?, ?, ?, ?)
    `, [productId, historicalItemCode, historicalName, effectiveFrom, effectiveTo]);

    res.json({
      success: true,
      message: 'Product alias added successfully'
    });
  } catch (error) {
    console.error('Error adding product alias:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Delete product alias
 */
async function deleteProductAlias(req, res) {
  try {
    const { aliasId } = req.params;

    await db.execute(`
      DELETE FROM tomorrow_ai_product_aliases
      WHERE id = ?
    `, [aliasId]);

    res.json({
      success: true,
      message: 'Product alias deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product alias:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get ML group summary
 * Shows which products share the same ML group
 */
async function getMLGroupSummary(req, res) {
  try {
    const [summary] = await db.execute(`
      SELECT
        ml_group_id,
        COUNT(*) as product_count,
        GROUP_CONCAT(name ORDER BY name SEPARATOR ', ') as products
      FROM tomorrow_ai_product_master
      WHERE active = TRUE
      GROUP BY ml_group_id
      HAVING product_count > 1
      ORDER BY product_count DESC, ml_group_id ASC
    `);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching ML group summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get validation report
 * Shows unmapped historical items and their sales volume
 */
async function getValidationReport(req, res) {
  try {
    // Get all unique item names from invoices
    const [invoiceItems] = await db.execute(`
      SELECT DISTINCT ii.item_name
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE i.invoice_date IS NOT NULL
      ORDER BY ii.item_name ASC
    `);

    // Get all mapped items (product master + aliases)
    const [mappedItems] = await db.execute(`
      SELECT name FROM tomorrow_ai_product_master
      UNION
      SELECT historical_item_code FROM tomorrow_ai_product_aliases
      UNION
      SELECT historical_name FROM tomorrow_ai_product_aliases
    `);

    const mappedSet = new Set(mappedItems.map(m => m.name || m.historical_item_code || m.historical_name));

    // Find unmapped items
    const unmappedItems = invoiceItems.filter(item => !mappedSet.has(item.item_name));

    // Get sales volume for unmapped items
    const unmappedNames = unmappedItems.map(i => i.item_name);
    let salesVolume = [];

    if (unmappedNames.length > 0) {
      const placeholders = unmappedNames.map(() => '?').join(',');
      [salesVolume] = await db.execute(`
        SELECT
          ii.item_name,
          SUM(ii.qty) as total_qty,
          COUNT(DISTINCT i.id) as invoice_count,
          MIN(i.invoice_date) as first_seen,
          MAX(i.invoice_date) as last_seen
        FROM invoice_items ii
        JOIN invoices i ON ii.invoice_id = i.id
        WHERE ii.item_name IN (${placeholders})
        GROUP BY ii.item_name
        ORDER BY total_qty DESC
      `, unmappedNames);
    }

    // Get potential duplicate/conflicting mappings
    const [conflicts] = await db.execute(`
      SELECT
        historical_item_code,
        historical_name,
        COUNT(*) as mapping_count,
        GROUP_CONCAT(product_id ORDER BY product_id SEPARATOR ', ') as mapped_to
      FROM tomorrow_ai_product_aliases
      GROUP BY historical_item_code, historical_name
      HAVING mapping_count > 1
    `);

    // Get ML group statistics
    const [mlStats] = await db.execute(`
      SELECT
        COUNT(DISTINCT ml_group_id) as total_groups,
        COUNT(*) as total_products,
        SUM(CASE WHEN ml_group_id IS NOT NULL THEN 1 ELSE 0 END) as with_ml_group,
        SUM(CASE WHEN ml_group_id IS NULL THEN 1 ELSE 0 END) as without_ml_group
      FROM tomorrow_ai_product_master
      WHERE active = TRUE
    `);

    res.json({
      success: true,
      data: {
        summary: {
          total_invoice_items: invoiceItems.length,
          mapped_items: mappedSet.size,
          unmapped_items: unmappedItems.length,
          mapping_conflicts: conflicts.length,
          ml_groups: mlStats[0]
        },
        unmapped_items: salesVolume,
        conflicts: conflicts
      }
    });
  } catch (error) {
    console.error('Error generating validation report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Approve product mapping
 */
async function approveProduct(req, res) {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'productId is required'
      });
    }

    await db.execute(`
      UPDATE tomorrow_ai_product_master
      SET mapping_status = 'approved', updated_at = CURRENT_TIMESTAMP
      WHERE product_id = ?
    `, [productId]);

    res.json({
      success: true,
      message: 'Product approved successfully'
    });
  } catch (error) {
    console.error('Error approving product:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Mark product as not for use
 */
async function markNotForUse(req, res) {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'productId is required'
      });
    }

    await db.execute(`
      UPDATE tomorrow_ai_product_master
      SET mapping_status = 'notforuse', updated_at = CURRENT_TIMESTAMP
      WHERE product_id = ?
    `, [productId]);

    res.json({
      success: true,
      message: 'Product marked as not for use'
    });
  } catch (error) {
    console.error('Error marking product as not for use:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Add alias and approve both products
 */
async function addAliasAndApprove(req, res) {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const { targetProductId, sourceProductIds } = req.body;

    if (!targetProductId || !sourceProductIds || !Array.isArray(sourceProductIds)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: 'targetProductId and sourceProductIds array are required'
      });
    }

    if (sourceProductIds.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: 'At least one source product ID is required'
      });
    }

    // Get source product details
    const placeholders = sourceProductIds.map(() => '?').join(',');
    const [sourceProducts] = await connection.execute(
      `SELECT name, product_id FROM tomorrow_ai_product_master WHERE product_id IN (${placeholders})`,
      sourceProductIds
    );

    if (sourceProducts.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: 'Source products not found'
      });
    }

    // Add alias mappings for each source product
    for (const sourceProduct of sourceProducts) {
      await connection.execute(`
        INSERT INTO tomorrow_ai_product_aliases
        (product_id, historical_item_code, historical_name, effective_from)
        VALUES (?, ?, ?, CURRENT_DATE)
      `, [targetProductId, sourceProduct.product_id, sourceProduct.name]);
    }

    // Approve all products (target + all sources)
    const allProductIds = [targetProductId, ...sourceProductIds];
    const allPlaceholders = allProductIds.map(() => '?').join(',');
    await connection.execute(`
      UPDATE tomorrow_ai_product_master
      SET mapping_status = 'approved', updated_at = CURRENT_TIMESTAMP
      WHERE product_id IN (${allPlaceholders})
    `, allProductIds);

    await connection.commit();

    res.json({
      success: true,
      message: `Alias added for ${sourceProducts.length} products and all approved`
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error adding alias and approving:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Add unmapped item to product master
 */
async function addUnmappedItem(req, res) {
  try {
    const { itemName, category, itemType, mappingStatus } = req.body;

    if (!itemName) {
      return res.status(400).json({
        success: false,
        error: 'itemName is required'
      });
    }

    // Generate a product ID from the item name
    const productId = itemName.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 50);

    // Check if product already exists
    const [existing] = await db.execute(
      `SELECT product_id FROM tomorrow_ai_product_master WHERE product_id = ? OR name = ?`,
      [productId, itemName]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Product already exists'
      });
    }

    // Insert new product
    await db.execute(`
      INSERT INTO tomorrow_ai_product_master
      (product_id, name, category, item_type, ml_group_id, mapping_status, active)
      VALUES (?, ?, ?, ?, 0, ?, TRUE)
    `, [productId, itemName, category || 'uncategorized', itemType || 'DISPLAY', mappingStatus || 'pending']);

    res.json({
      success: true,
      message: 'Product added successfully',
      data: { productId }
    });
  } catch (error) {
    console.error('Error adding unmapped item:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  getProducts,
  updateProductMLGroup,
  updateProductItemType,
  getProductAliases,
  addProductAlias,
  deleteProductAlias,
  getMLGroupSummary,
  getValidationReport,
  approveProduct,
  markNotForUse,
  addAliasAndApprove,
  addUnmappedItem
};
