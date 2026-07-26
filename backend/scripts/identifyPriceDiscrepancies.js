const db = require('../config/database');

async function identifyPriceDiscrepancies() {
  try {
    console.log('=== Identifying Products with Price Discrepancies ===\n');

    // Query 1: Find products where latest invoice rate differs from current invoice_price
    console.log('Query 1: Products with price discrepancies between latest invoice and current product price');
    console.log('=====================================================================================================\n');
    
    const [discrepancies] = await db.execute(`
      SELECT 
        p.id as product_id,
        p.item_code,
        p.name as product_name,
        p.invoice_price as current_invoice_price,
        p.sale_price as current_sale_price,
        p.updated_at as product_last_updated,
        latest_invoice.latest_invoice_rate,
        latest_invoice.latest_invoice_date,
        latest_invoice.latest_invoice_number,
        latest_invoice.rate_difference,
        latest_invoice.percentage_difference
      FROM products p
      LEFT JOIN (
        SELECT 
          ii.item_code,
          ii.item_name,
          ii.rate as latest_invoice_rate,
          i.invoice_date as latest_invoice_date,
          i.invoice_number as latest_invoice_number,
          ii.rate - p.invoice_price as rate_difference,
          CASE 
            WHEN p.invoice_price = 0 THEN 0
            ELSE ((ii.rate - p.invoice_price) / p.invoice_price) * 100 
          END as percentage_difference,
          ROW_NUMBER() OVER (PARTITION BY ii.item_code ORDER BY i.invoice_date DESC, i.id DESC) as rn
        FROM invoice_items ii
        JOIN invoices i ON ii.invoice_id = i.id
        JOIN products p ON ii.item_code = p.item_code
      ) latest_invoice ON p.item_code = latest_invoice.item_code AND latest_invoice.rn = 1
      WHERE latest_invoice.rate_difference != 0
         OR latest_invoice.rate_difference IS NULL
      ORDER BY ABS(latest_invoice.percentage_difference) DESC
    `);

    console.log(`Found ${discrepancies.length} products with price discrepancies:\n`);
    discrepancies.forEach(d => {
      console.log(`Product: ${d.product_name} (${d.item_code})`);
      console.log(`  Current invoice_price: ${d.current_invoice_price}`);
      console.log(`  Current sale_price: ${d.current_sale_price}`);
      console.log(`  Latest invoice rate: ${d.latest_invoice_rate}`);
      console.log(`  Latest invoice date: ${d.latest_invoice_date}`);
      console.log(`  Latest invoice number: ${d.latest_invoice_number}`);
      console.log(`  Rate difference: ${d.rate_difference}`);
      console.log(`  Percentage difference: ${d.percentage_difference?.toFixed(2)}%`);
      console.log(`  Product last updated: ${d.product_last_updated}`);
      console.log('---');
    });

    // Query 2: Find products that haven't been updated recently despite having recent invoices
    console.log('\n\nQuery 2: Products with stale prices (not updated despite recent invoices)');
    console.log('========================================================================================\n');
    
    const [stalePrices] = await db.execute(`
      SELECT 
        p.id as product_id,
        p.item_code,
        p.name as product_name,
        p.invoice_price as current_invoice_price,
        p.sale_price as current_sale_price,
        p.updated_at as product_last_updated,
        latest_invoice.latest_invoice_date,
        latest_invoice.latest_invoice_number,
        DATEDIFF(latest_invoice.latest_invoice_date, p.updated_at) as days_since_price_update
      FROM products p
      JOIN (
        SELECT 
          ii.item_code,
          MAX(i.invoice_date) as latest_invoice_date,
          MAX(i.invoice_number) as latest_invoice_number
        FROM invoice_items ii
        JOIN invoices i ON ii.invoice_id = i.id
        GROUP BY ii.item_code
      ) latest_invoice ON p.item_code = latest_invoice.item_code
      WHERE DATEDIFF(latest_invoice.latest_invoice_date, p.updated_at) > 0
      ORDER BY DATEDIFF(latest_invoice.latest_invoice_date, p.updated_at) DESC
    `);

    console.log(`Found ${stalePrices.length} products with stale prices:\n`);
    stalePrices.forEach(s => {
      console.log(`Product: ${s.product_name} (${s.item_code})`);
      console.log(`  Current invoice_price: ${s.current_invoice_price}`);
      console.log(`  Current sale_price: ${s.current_sale_price}`);
      console.log(`  Latest invoice date: ${s.latest_invoice_date}`);
      console.log(`  Latest invoice number: ${s.latest_invoice_number}`);
      console.log(`  Product last updated: ${s.product_last_updated}`);
      console.log(`  Days since price update: ${s.days_since_price_update}`);
      console.log('---');
    });

    // Query 3: Get historical MRP from invoice items for a specific product
    console.log('\n\nQuery 3: Historical MRP changes for products with discrepancies');
    console.log('========================================================================\n');
    
    const itemCodes = discrepancies.map(d => d.item_code);
    
    for (const itemCode of itemCodes) {
      const [history] = await db.execute(`
        SELECT 
          ii.item_name,
          ii.rate as invoice_rate,
          i.invoice_date,
          i.invoice_number,
          ROW_NUMBER() OVER (PARTITION BY ii.item_code ORDER BY i.invoice_date ASC) as rn
        FROM invoice_items ii
        JOIN invoices i ON ii.invoice_id = i.id
        WHERE ii.item_code = ?
        ORDER BY i.invoice_date ASC
      `, [itemCode]);

      if (history.length > 1) {
        console.log(`\nPrice history for ${itemCode}:`);
        history.forEach(h => {
          console.log(`  ${h.invoice_date} (Invoice ${h.invoice_number}): ${h.invoice_rate}`);
        });
      }
    }

    console.log('\n\n=== Analysis Complete ===');
    console.log(`Total products with discrepancies: ${discrepancies.length}`);
    console.log(`Total products with stale prices: ${stalePrices.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error identifying price discrepancies:', error);
    process.exit(1);
  }
}

identifyPriceDiscrepancies();
