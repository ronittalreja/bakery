// Populate Tomorrow AI Product Master
// Reads existing products and classifies them for ML forecasting

const db = require('../config/database');

async function populateProductMaster() {
  try {
    console.log('Starting product master population...');

    // Fetch all existing products
    const [products] = await db.execute(`
      SELECT 
        id as product_id,
        name,
        category,
        sale_price as price,
        item_code
      FROM products
      WHERE is_active = 1
    `);

    console.log(`Found ${products.length} active products`);

    let inserted = 0;
    let updated = 0;

    for (const product of products) {
      // Determine item_type based on category/name patterns
      const itemType = classifyItemType(product.name, product.category);
      
      // Generate initial ml_group_id (can be refined later)
      const mlGroupId = generateMLGroupId(product.name, product.item_code);

      // Insert or update product_master
      await db.execute(`
        INSERT INTO tomorrow_ai_product_master 
        (product_id, name, category, price, item_type, ml_group_id, active)
        VALUES (?, ?, ?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        category = VALUES(category),
        price = VALUES(price),
        item_type = VALUES(item_type),
        ml_group_id = VALUES(ml_group_id),
        updated_at = CURRENT_TIMESTAMP
      `, [
        product.product_id,
        product.name,
        product.category,
        product.price,
        itemType,
        mlGroupId
      ]);

      if (product.item_code) {
        // Add to product_aliases for historical mapping
        await db.execute(`
          INSERT INTO tomorrow_ai_product_aliases 
          (product_id, historical_item_code, historical_name)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
          historical_name = VALUES(historical_name)
        `, [
          product.product_id,
          product.item_code,
          product.name
        ]);
      }

      inserted++;
    }

    console.log(`✓ Product master populated: ${inserted} products processed`);
    console.log('Classification summary:');
    
    const [summary] = await db.execute(`
      SELECT item_type, COUNT(*) as count 
      FROM tomorrow_ai_product_master 
      GROUP BY item_type
    `);
    
    summary.forEach(row => {
      console.log(`  ${row.item_type}: ${row.count} products`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error populating product master:', error);
    process.exit(1);
  }
}

/**
 * Classify item type based on product name and category
 */
function classifyItemType(name, category) {
  const nameLower = name.toLowerCase();
  const categoryLower = category ? category.toLowerCase() : '';

  // Packing materials
  if (nameLower.includes('box') || 
      nameLower.includes('packing') || 
      nameLower.includes('wrap') ||
      nameLower.includes('tray') ||
      nameLower.includes('ribbon') ||
      nameLower.includes('board') ||
      categoryLower.includes('packing')) {
    return 'PACKING_MATERIAL';
  }

  // Special orders (customized, special, customer-specific)
  if (nameLower.includes('custom') || 
      nameLower.includes('special') ||
      nameLower.includes('order') ||
      nameLower.includes('personalized') ||
      nameLower.includes('photo') ||
      nameLower.includes('message')) {
    return 'SPECIAL_ORDER';
  }

  // Default to DISPLAY for regular cakes, pastries, etc.
  return 'DISPLAY';
}

/**
 * Generate ML group ID
 * For now, use a normalized version of the product name
 * This can be refined later with manual mapping
 */
function generateMLGroupId(name, itemCode) {
  // Remove special characters and spaces, convert to uppercase
  const normalized = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 50); // Limit to 50 chars
  
  return normalized;
}

populateProductMaster();
