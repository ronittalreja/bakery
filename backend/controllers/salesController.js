const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const StockBatch = require('../models/StockBatch');
const { updateDecorationStock, getDecorationForSale } = require('./decorationsController');
const db = require('../config/database');

// Record a Sale (supports FEFO allocation when batchId not provided)
const recordSale = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { 
      saleDate, 
      items, 
      paymentType, 
      totalAmount,
      productMRPTotal = 0,
      decorationMRPTotal = 0,
      productCostTotal = 0,
      decorationCostTotal = 0,
      totalCost = 0
    } = req.body;
    const staffId = req.user?.id || 0;

    // Validate required fields
    if (!saleDate || !items || !Array.isArray(items) || items.length === 0 || !paymentType || !totalAmount) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Prepare allocation list using FEFO (earliest expiry first) when batchId not provided
    const referenceDate = new Date(saleDate).toISOString().split('T')[0];
    const allocatedItems = [];
    const decorationItems = [];

    for (const item of items) {
      if (!item.productId || !item.quantity) {
        await connection.rollback();
        return res.status(400).json({ success: false, error: 'Invalid item data: productId and quantity are required' });
      }

      // Check if this is a decoration item
      const decoration = await getDecorationForSale(item.productId);
      if (decoration) {
        // Handle decoration item
        if (decoration.stock_quantity < Number(item.quantity)) {
          await connection.rollback();
          return res.status(400).json({ 
            success: false, 
            error: `Insufficient stock for decoration ${decoration.name}. Available: ${decoration.stock_quantity}, Requested: ${item.quantity}` 
          });
        }
        
        const unitPrice = Number(item.unitPrice);
        const totalPrice = Number(item.totalPrice ?? unitPrice * Number(item.quantity));
        if (!unitPrice || totalPrice <= 0) {
          await connection.rollback();
          return res.status(400).json({ success: false, error: 'Invalid pricing for decoration item' });
        }
        
        decorationItems.push({
          decorationId: item.productId,
          quantity: Number(item.quantity),
          unitPrice,
          totalPrice,
          name: decoration.name
        });
        continue;
      }

      // Handle regular product items
      // If batchId provided, validate availability in that batch only
      if (item.batchId) {
      const [batchRows] = await connection.execute(
          'SELECT id, quantity, expiry_date FROM stock_batches WHERE id = ? AND product_id = ? AND expiry_date > ?',
          [item.batchId, item.productId, referenceDate]
        );
        if (!batchRows.length || Number(batchRows[0].quantity) < Number(item.quantity)) {
          await connection.rollback();
          return res.status(400).json({ 
            success: false, 
            error: `Insufficient stock for product ${item.name || item.productId} in selected batch. Available: ${batchRows[0]?.quantity || 0}, Requested: ${item.quantity}` 
          });
        }
        const unitPrice = Number(item.unitPrice);
        const totalPrice = Number(item.totalPrice ?? unitPrice * Number(item.quantity));
        if (!unitPrice || totalPrice <= 0) {
          await connection.rollback();
          return res.status(400).json({ success: false, error: 'Invalid pricing for item with specified batch' });
        }
        allocatedItems.push({
          productId: item.productId,
          batchId: item.batchId,
          quantity: Number(item.quantity),
          unitPrice,
          totalPrice,
          name: item.name || ''
        });
        continue;
      }

      // No batchId: allocate across unexpired batches by earliest expiry (FEFO)
      const [batches] = await connection.execute(
        `SELECT id, quantity, expiry_date 
         FROM stock_batches 
         WHERE product_id = ? AND quantity > 0 AND expiry_date > ?
         ORDER BY expiry_date ASC, invoice_date ASC, id ASC`,
        [item.productId, referenceDate]
      );

      let remaining = Number(item.quantity);
      if (!batches.length) {
        await connection.rollback();
        return res.status(400).json({ success: false, error: `No unexpired stock available for product ${item.name || item.productId}` });
      }

      const unitPrice = Number(item.unitPrice);
      if (!unitPrice || unitPrice <= 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, error: 'unitPrice is required when batchId is not specified' });
      }

      for (const batch of batches) {
        if (remaining <= 0) break;
        const available = Number(batch.quantity);
        if (available <= 0) continue;
        const useQty = Math.min(available, remaining);
        allocatedItems.push({
          productId: item.productId,
          batchId: batch.id,
          quantity: useQty,
          unitPrice,
          totalPrice: Number((unitPrice * useQty).toFixed(2)),
          name: item.name || ''
        });
        remaining -= useQty;
      }

      if (remaining > 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, error: `Insufficient unexpired stock for product ${item.name || item.productId}. Missing: ${remaining}` });
      }
    }

    // Create sale record with cost tracking - use MySQL compatible datetime format
    const currentDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const [saleResult] = await connection.execute(
      `INSERT INTO sales (
        sale_date, 
        total_amount, 
        payment_type, 
        staff_id,
        product_mrp_total,
        decoration_mrp_total,
        product_cost_total,
        decoration_cost_total,
        total_cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        currentDateTime,
        totalAmount,
        paymentType,
        staffId,
        productMRPTotal,
        decorationMRPTotal,
        productCostTotal,
        decorationCostTotal,
        totalCost
      ]
    );
    const saleId = saleResult.insertId;

    // Add sale items for regular products and update stock
    for (const item of allocatedItems) {
      // Add sale item for regular product
      await connection.execute(
        'INSERT INTO sale_items (sale_id, item_id, batch_id, quantity, unit_price, total_price, name, item_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [saleId, item.productId, item.batchId, item.quantity, item.unitPrice, item.totalPrice, item.name || '', 'product']
      );
      
      // Update stock batch quantity
      await connection.execute(
        'UPDATE stock_batches SET quantity = quantity - ? WHERE id = ?',
        [item.quantity, item.batchId]
      );
    }

    // Handle decoration items separately (no batch_id for decorations)
    for (const item of decorationItems) {
      // Add sale item for decoration
      await connection.execute(
        'INSERT INTO sale_items (sale_id, item_id, batch_id, quantity, unit_price, total_price, name, item_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [saleId, item.decorationId, null, item.quantity, item.unitPrice, item.totalPrice, item.name || '', 'decoration']
      );
      
      // Update decoration stock directly in the same transaction
      await connection.execute(
        'UPDATE decorations SET stock_quantity = stock_quantity - ? WHERE id = ? AND is_active = 1',
        [item.quantity, item.decorationId]
      );
    }

    await connection.commit();
    res.json({ success: true, saleId });
  } catch (error) {
    await connection.rollback();
    console.error('Error recording sale:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to record sale' });
  } finally {
    connection.release();
  }
};

// Get Sales Summary for a specific date
const getSalesSummary = async (req, res) => {
  try {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const [summaryRows] = await db.execute(
      `SELECT 
        COUNT(*) AS totalTransactions, 
        SUM(total_amount) AS totalSales,
        SUM(CASE WHEN payment_type = 'cash' THEN total_amount ELSE 0 END) AS cashSales,
        SUM(CASE WHEN payment_type = 'upi' THEN total_amount ELSE 0 END) AS upiSales
      FROM sales 
      WHERE DATE(sale_date) = ?`,
      [date]
    );

    const [itemsRows] = await db.execute(
      `SELECT SUM(quantity) AS totalItems 
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE DATE(s.sale_date) = ?`,
      [date]
    );

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      success: true,
      summary: {
        totalTransactions: Number(summaryRows[0].totalTransactions) || 0,
        totalItems: Number(itemsRows[0].totalItems) || 0,
        totalSales: Number(summaryRows[0].totalSales) || 0,
        cashSales: Number(summaryRows[0].cashSales) || 0,
        upiSales: Number(summaryRows[0].upiSales) || 0
      }
    });
  } catch (error) {
    console.error('Error fetching sales summary:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch summary' });
  }
};

// Get Sales by Date with detailed breakdown
const getSalesByDate = async (req, res) => {
  try {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const query = `
      SELECT
        s.id as sale_id,
        s.sale_date,
        s.total_amount,
        s.payment_type,
        si.id as item_id,
        si.item_id as product_id,
        si.batch_id,
        si.quantity, 
        si.unit_price, 
        si.total_price, 
        si.name,
        si.item_type,
        p.item_code,
        p.hsn_code,
        d.sku as decoration_sku,
        d.category as decoration_category
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN products p ON si.item_id = p.id AND si.item_type = 'product'
      LEFT JOIN decorations d ON si.item_id = d.id AND si.item_type = 'decoration'
      WHERE DATE(s.sale_date) = ?
      ORDER BY s.id DESC, si.id ASC
    `;
    
    const [rows] = await db.execute(query, [date]);

    if (!rows.length) {
      return res.json({ 
        success: true, 
        data: [], 
        summary: {
          totalQuantity: 0, 
          totalValue: 0,
          totalTransactions: 0
        }
      });
    }

    // Group by sales
    const salesMap = new Map();
    rows.forEach(row => {
      if (!salesMap.has(row.sale_id)) {
        salesMap.set(row.sale_id, {
          id: row.sale_id,
          sale_date: row.sale_date,
          total_amount: row.total_amount,
          payment_type: row.payment_type,
          items: []
        });
      }
      
      salesMap.get(row.sale_id).items.push({
        id: row.item_id,
        product_id: row.product_id,
        batch_id: row.batch_id,
        quantity: row.quantity,
        unit_price: row.unit_price,
        total_price: row.total_price,
        name: row.name,
        item_code: row.item_code,
        hsn_code: row.hsn_code,
        decoration_sku: row.decoration_sku,
        decoration_category: row.decoration_category,
        is_decoration: !row.batch_id && row.decoration_sku
      });
    });

    const salesData = Array.from(salesMap.values());
    const totalQuantity = rows.reduce((sum, item) => sum + Number(item.quantity), 0);
    const totalValue = rows.reduce((sum, item) => sum + Number(item.total_price), 0);

    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    res.json({ 
      success: true, 
      data: salesData,
      summary: {
        totalQuantity, 
        totalValue,
        totalTransactions: salesData.length
      }
    });
  } catch (error) {
    console.error('Error fetching sales by date:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch sales' });
  }
};

// Get Monthly Sales Data
const getMonthlySales = async (req, res) => {
  try {
    const { month } = req.params;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, error: 'Invalid month format. Use YYYY-MM' });
    }

    const query = `
      SELECT
        s.id as sale_id,
        s.sale_date,
        s.total_amount,
        s.payment_type,
        si.id as item_id,
        si.item_id as product_id,
        si.batch_id,
        si.quantity, 
        si.unit_price, 
        si.total_price, 
        si.name,
        si.item_type,
        p.item_code,
        p.hsn_code,
        d.sku as decoration_sku,
        d.category as decoration_category
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN products p ON si.item_id = p.id AND si.item_type = 'product'
      LEFT JOIN decorations d ON si.item_id = d.id AND si.item_type = 'decoration'
      WHERE DATE_FORMAT(s.sale_date, '%Y-%m') = ?
      ORDER BY s.id DESC, si.id ASC
    `;
    
    const [rows] = await db.execute(query, [month]);

    if (!rows.length) {
      return res.json({ 
        success: true, 
        data: [], 
        summary: {
          totalQuantity: 0, 
          totalValue: 0,
          totalTransactions: 0
        }
      });
    }

    // Group by sales
    const salesMap = new Map();
    rows.forEach(row => {
      if (!salesMap.has(row.sale_id)) {
        salesMap.set(row.sale_id, {
          id: row.sale_id,
          sale_date: row.sale_date,
          total_amount: row.total_amount,
          payment_type: row.payment_type,
          items: []
        });
      }
      
      salesMap.get(row.sale_id).items.push({
        id: row.item_id,
        product_id: row.product_id,
        batch_id: row.batch_id,
        quantity: row.quantity,
        unit_price: row.unit_price,
        total_price: row.total_price,
        name: row.name,
        item_code: row.item_code,
        hsn_code: row.hsn_code,
        decoration_sku: row.decoration_sku,
        decoration_category: row.decoration_category,
        is_decoration: !row.batch_id && row.decoration_sku
      });
    });

    const salesData = Array.from(salesMap.values());
    const totalQuantity = rows.reduce((sum, item) => sum + Number(item.quantity), 0);
    const totalValue = rows.reduce((sum, item) => sum + Number(item.total_price), 0);

    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    res.json({ 
      success: true, 
      data: salesData,
      summary: {
        totalQuantity, 
        totalValue,
        totalTransactions: salesData.length
      }
    });
  } catch (error) {
    console.error('Error fetching monthly sales:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch monthly sales' });
  }
};

// Get Monthly Sales Analytics with Last Month and Year Comparison
const getMonthlySalesAnalytics = async (req, res) => {
  try {
    const { month, year } = req.params;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, error: 'Invalid month format. Use YYYY-MM' });
    }
    
    // Default to previous year if year not provided
    const comparisonYear = year ? parseInt(year) : new Date().getFullYear() - 1;

    // Parse month correctly (month is in YYYY-MM format)
    const [currentYear, monthNum] = month.split('-');
    const currentDate = new Date(parseInt(currentYear), parseInt(monthNum) - 1, 1); // monthNum - 1 because JS months are 0-indexed
    console.log(`Current month: ${month}, Parsed year: ${currentYear}, monthNum: ${monthNum}, Current date: ${currentDate}, Month index: ${currentDate.getMonth()}`);
    
    // Create previous year month using the same month number as current
    const previousYearMonth = `${comparisonYear}-${monthNum}`;
    const previousYear = new Date(comparisonYear, parseInt(monthNum) - 1, 1);
    
    console.log(`Comparing ${month} with ${previousYearMonth} (year: ${comparisonYear})`);
    console.log(`Previous year date: ${previousYear}`);
    console.log(`Previous year month index: ${previousYear.getMonth()}`);
    console.log(`Previous year month name: ${previousYear.toLocaleDateString('en-US', { month: 'long' })}`);
    
    // Calculate last month properly - handle year rollover
    let lastMonthYear = currentDate.getFullYear();
    let lastMonthIndex = currentDate.getMonth() - 1;
    
    if (lastMonthIndex < 0) {
      lastMonthIndex = 11; // December
      lastMonthYear = lastMonthYear - 1;
    }
    
    const lastMonth = new Date(lastMonthYear, lastMonthIndex, 1);
    const lastMonthStr = lastMonth.toISOString().slice(0, 7);
    
    // Debug: Let's also try a simpler approach
    const currentYear2 = parseInt(month.split('-')[0]);
    const currentMonthNum = parseInt(month.split('-')[1]);
    let lastMonthYear2 = currentYear2;
    let lastMonthNum2 = currentMonthNum - 1;
    
    if (lastMonthNum2 < 1) {
      lastMonthNum2 = 12;
      lastMonthYear2 = currentYear2 - 1;
    }
    
    const lastMonthStr2 = `${lastMonthYear2}-${lastMonthNum2.toString().padStart(2, '0')}`;
    console.log(`Alternative last month calculation: ${lastMonthStr2}`);
    console.log(`Using lastMonthStr2 for query: ${lastMonthStr2}`);
    
    console.log(`Current month: ${month}`);
    console.log(`Last month calculated: ${lastMonthStr}`);
    console.log(`Last month date object: ${lastMonth}`);
    console.log(`Last month year: ${lastMonthYear}, month index: ${lastMonthIndex}`);

    // Get current month sales summary
    const [currentSummary] = await db.execute(`
      SELECT 
        COUNT(DISTINCT s.id) as totalTransactions,
        COALESCE(SUM(s.total_amount), 0) as totalSales,
        COALESCE(SUM(si.quantity), 0) as totalItems
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE DATE_FORMAT(s.sale_date, '%Y-%m') = ?
    `, [month]);

    // Get previous year sales summary
    const [previousSummary] = await db.execute(`
      SELECT 
        COUNT(DISTINCT s.id) as totalTransactions,
        COALESCE(SUM(s.total_amount), 0) as totalSales,
        COALESCE(SUM(si.quantity), 0) as totalItems
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE DATE_FORMAT(s.sale_date, '%Y-%m') = ?
    `, [previousYearMonth]);

    // Get last month sales summary - use the simpler calculation
    console.log(`Querying last month data for: ${lastMonthStr2}`);
    const [lastMonthSummary] = await db.execute(`
      SELECT 
        COUNT(DISTINCT s.id) as totalTransactions,
        COALESCE(SUM(s.total_amount), 0) as totalSales,
        COALESCE(SUM(si.quantity), 0) as totalItems
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE DATE_FORMAT(s.sale_date, '%Y-%m') = ?
    `, [lastMonthStr2]);
    
    console.log(`Last month query result:`, lastMonthSummary[0]);
    
    // Debug: Check what months have data
    const [availableMonths] = await db.execute(`
      SELECT DISTINCT DATE_FORMAT(sale_date, '%Y-%m') as month
      FROM sales 
      ORDER BY month DESC
      LIMIT 12
    `);
    console.log('Available months in database:', availableMonths);

    // Get most sold items for current month
    const [mostSoldItems] = await db.execute(`
      SELECT 
        si.name as productName,
        p.item_code,
        SUM(si.quantity) as totalQuantity,
        SUM(si.total_price) as totalRevenue,
        COUNT(DISTINCT s.id) as transactionCount
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN products p ON si.item_id = p.id AND si.item_type = 'product'
      WHERE DATE_FORMAT(s.sale_date, '%Y-%m') = ?
      GROUP BY si.name, p.item_code
      ORDER BY totalQuantity DESC
      LIMIT 10
    `, [month]);

    // Calculate growth percentages
    const current = currentSummary[0];
    const previous = previousSummary[0];
    const lastMonthData = lastMonthSummary[0];
    
    console.log('Current data:', current);
    console.log('Previous data:', previous);
    console.log('Last month data:', lastMonthData);
    console.log('Last month string:', lastMonthStr);
    
    const revenueGrowth = previous.totalSales > 0 
      ? ((current.totalSales - previous.totalSales) / previous.totalSales) * 100 
      : current.totalSales > 0 ? 100 : 0; // If previous is 0 but current has data, show 100% growth
    
    const transactionGrowth = previous.totalTransactions > 0 
      ? ((current.totalTransactions - previous.totalTransactions) / previous.totalTransactions) * 100 
      : current.totalTransactions > 0 ? 100 : 0;
    
    const itemsGrowth = previous.totalItems > 0 
      ? ((current.totalItems - previous.totalItems) / previous.totalItems) * 100 
      : current.totalItems > 0 ? 100 : 0;

    const lastMonthRevenueGrowth = lastMonthData.totalSales > 0 
      ? ((current.totalSales - lastMonthData.totalSales) / lastMonthData.totalSales) * 100 
      : current.totalSales > 0 ? 100 : 0;
    
    const lastMonthTransactionGrowth = lastMonthData.totalTransactions > 0 
      ? ((current.totalTransactions - lastMonthData.totalTransactions) / lastMonthData.totalTransactions) * 100 
      : current.totalTransactions > 0 ? 100 : 0;
    
    const lastMonthItemsGrowth = lastMonthData.totalItems > 0 
      ? ((current.totalItems - lastMonthData.totalItems) / lastMonthData.totalItems) * 100 
      : current.totalItems > 0 ? 100 : 0;

    res.json({
      success: true,
      data: {
        current: {
          month: month,
          totalTransactions: Number(current.totalTransactions),
          totalSales: Number(current.totalSales),
          totalItems: Number(current.totalItems)
        },
        previous: {
          month: previousYearMonth,
          totalTransactions: Number(previous.totalTransactions),
          totalSales: Number(previous.totalSales),
          totalItems: Number(previous.totalItems)
        },
        lastMonth: {
          month: lastMonthStr,
          totalTransactions: Number(lastMonthData.totalTransactions),
          totalSales: Number(lastMonthData.totalSales),
          totalItems: Number(lastMonthData.totalItems)
        },
        growth: {
          revenue: Math.round(revenueGrowth * 100) / 100,
          transactions: Math.round(transactionGrowth * 100) / 100,
          items: Math.round(itemsGrowth * 100) / 100
        },
        lastMonthGrowth: {
          revenue: Math.round(lastMonthRevenueGrowth * 100) / 100,
          transactions: Math.round(lastMonthTransactionGrowth * 100) / 100,
          items: Math.round(lastMonthItemsGrowth * 100) / 100
        },
        mostSoldItems: mostSoldItems.map(item => ({
          productName: item.productName,
          itemCode: item.item_code,
          totalQuantity: Number(item.totalQuantity),
          totalRevenue: Number(item.totalRevenue),
          transactionCount: Number(item.transactionCount)
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching monthly sales analytics:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch analytics' });
  }
};

// Get Previous Year Sales Comparison and Most Sold Items
const getSalesAnalytics = async (req, res) => {
  try {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const currentDate = new Date(date);
    const previousYear = new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), currentDate.getDate());
    const previousYearStr = previousYear.toISOString().split('T')[0];

    // Get current year sales summary
    const [currentSummary] = await db.execute(`
      SELECT 
        COUNT(DISTINCT s.id) as totalTransactions,
        COALESCE(SUM(s.total_amount), 0) as totalSales,
        COALESCE(SUM(si.quantity), 0) as totalItems
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE DATE(s.sale_date) = ?
    `, [date]);

    // Get previous year sales summary
    const [previousSummary] = await db.execute(`
      SELECT 
        COUNT(DISTINCT s.id) as totalTransactions,
        COALESCE(SUM(s.total_amount), 0) as totalSales,
        COALESCE(SUM(si.quantity), 0) as totalItems
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE DATE(s.sale_date) = ?
    `, [previousYearStr]);

    // Get most sold items for current month
    const currentMonth = currentDate.toISOString().slice(0, 7); // YYYY-MM format
    const [mostSoldItems] = await db.execute(`
      SELECT 
        si.name as productName,
        p.item_code,
        SUM(si.quantity) as totalQuantity,
        SUM(si.total_price) as totalRevenue,
        COUNT(DISTINCT s.id) as transactionCount
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN products p ON si.item_id = p.id AND si.item_type = 'product'
      WHERE DATE_FORMAT(s.sale_date, '%Y-%m') = ?
      GROUP BY si.name, p.item_code
      ORDER BY totalQuantity DESC
      LIMIT 10
    `, [currentMonth]);

    // Calculate growth percentages
    const current = currentSummary[0];
    const previous = previousSummary[0];
    
    const revenueGrowth = previous.totalSales > 0 
      ? ((current.totalSales - previous.totalSales) / previous.totalSales) * 100 
      : 0;
    
    const transactionGrowth = previous.totalTransactions > 0 
      ? ((current.totalTransactions - previous.totalTransactions) / previous.totalTransactions) * 100 
      : 0;
    
    const itemsGrowth = previous.totalItems > 0 
      ? ((current.totalItems - previous.totalItems) / previous.totalItems) * 100 
      : 0;

    res.json({
      success: true,
      data: {
        current: {
          date: date,
          totalTransactions: Number(current.totalTransactions),
          totalSales: Number(current.totalSales),
          totalItems: Number(current.totalItems)
        },
        previous: {
          date: previousYearStr,
          totalTransactions: Number(previous.totalTransactions),
          totalSales: Number(previous.totalSales),
          totalItems: Number(previous.totalItems)
        },
        growth: {
          revenue: Math.round(revenueGrowth * 100) / 100,
          transactions: Math.round(transactionGrowth * 100) / 100,
          items: Math.round(itemsGrowth * 100) / 100
        },
        mostSoldItems: mostSoldItems.map(item => ({
          productName: item.productName,
          itemCode: item.item_code,
          totalQuantity: Number(item.totalQuantity),
          totalRevenue: Number(item.totalRevenue),
          transactionCount: Number(item.transactionCount)
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching sales analytics:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch analytics' });
  }
};

// Get YTD and MTD Sales Comparison
const getYTDMTDComparison = async (req, res) => {
  try {
    const { year } = req.params;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();
    const previousYear = currentYear - 1;
    
    // Use current date for YTD and MTD calculations
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentDay = currentDate.getDate();
    
    console.log('Using current date:', currentDate.toISOString(), 'Month:', currentMonth, 'Day:', currentDay);
    
    // YTD: January 1st of current year to today
    const ytdStartDate = `${currentYear}-01-01`;
    const ytdEndDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${currentDay.toString().padStart(2, '0')}`;
    
    // MTD: First day of current month to today
    const mtdStartDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
    const mtdEndDate = ytdEndDate;
    
    // Previous year YTD: Same period last year (Jan 1 to same day last year)
    const prevYtdStartDate = `${previousYear}-01-01`;
    const prevYtdEndDate = `${previousYear}-${currentMonth.toString().padStart(2, '0')}-${currentDay.toString().padStart(2, '0')}`;
    
    // Previous year MTD: Same month last year (same day of month last year)
    const prevMtdStartDate = `${previousYear}-${currentMonth.toString().padStart(2, '0')}-01`;
    const prevMtdEndDate = `${previousYear}-${currentMonth.toString().padStart(2, '0')}-${currentDay.toString().padStart(2, '0')}`;

    console.log('YTD MTD Comparison dates:', {
      currentDate: currentDate.toISOString(),
      ytdStartDate, ytdEndDate,
      mtdStartDate, mtdEndDate,
      prevYtdStartDate, prevYtdEndDate,
      prevMtdStartDate, prevMtdEndDate
    });

    // Get current YTD sales
    const [currentYTD] = await db.execute(`
      SELECT 
        COUNT(DISTINCT s.id) as totalTransactions,
        COALESCE(SUM(s.total_amount), 0) as totalSales,
        COALESCE(SUM(si.quantity), 0) as totalItems,
        COALESCE(SUM(s.total_cost), 0) as totalCost
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE DATE(s.sale_date) BETWEEN ? AND ? AND YEAR(s.sale_date) = ?
    `, [ytdStartDate, ytdEndDate, currentYear]);

    // Get current MTD sales
    const [currentMTD] = await db.execute(`
      SELECT 
        COUNT(DISTINCT s.id) as totalTransactions,
        COALESCE(SUM(s.total_amount), 0) as totalSales,
        COALESCE(SUM(si.quantity), 0) as totalItems,
        COALESCE(SUM(s.total_cost), 0) as totalCost
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE DATE(s.sale_date) BETWEEN ? AND ? AND YEAR(s.sale_date) = ?
    `, [mtdStartDate, mtdEndDate, currentYear]);

    // Get previous year YTD sales
    const [previousYTD] = await db.execute(`
      SELECT 
        COUNT(DISTINCT s.id) as totalTransactions,
        COALESCE(SUM(s.total_amount), 0) as totalSales,
        COALESCE(SUM(si.quantity), 0) as totalItems,
        COALESCE(SUM(s.total_cost), 0) as totalCost
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE DATE(s.sale_date) BETWEEN ? AND ? AND YEAR(s.sale_date) = ?
    `, [prevYtdStartDate, prevYtdEndDate, previousYear]);

    // Get previous year MTD sales
    const [previousMTD] = await db.execute(`
      SELECT 
        COUNT(DISTINCT s.id) as totalTransactions,
        COALESCE(SUM(s.total_amount), 0) as totalSales,
        COALESCE(SUM(si.quantity), 0) as totalItems,
        COALESCE(SUM(s.total_cost), 0) as totalCost
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE DATE(s.sale_date) BETWEEN ? AND ? AND YEAR(s.sale_date) = ?
    `, [prevMtdStartDate, prevMtdEndDate, previousYear]);

    // Calculate growth percentages
    const ytdRevenueGrowth = previousYTD[0].totalSales > 0 
      ? ((currentYTD[0].totalSales - previousYTD[0].totalSales) / previousYTD[0].totalSales) * 100 
      : currentYTD[0].totalSales > 0 ? 100 : 0;
    
    const ytdTransactionGrowth = previousYTD[0].totalTransactions > 0 
      ? ((currentYTD[0].totalTransactions - previousYTD[0].totalTransactions) / previousYTD[0].totalTransactions) * 100 
      : currentYTD[0].totalTransactions > 0 ? 100 : 0;
    
    const ytdItemsGrowth = previousYTD[0].totalItems > 0 
      ? ((currentYTD[0].totalItems - previousYTD[0].totalItems) / previousYTD[0].totalItems) * 100 
      : currentYTD[0].totalItems > 0 ? 100 : 0;

    const mtdRevenueGrowth = previousMTD[0].totalSales > 0 
      ? ((currentMTD[0].totalSales - previousMTD[0].totalSales) / previousMTD[0].totalSales) * 100 
      : currentMTD[0].totalSales > 0 ? 100 : 0;
    
    const mtdTransactionGrowth = previousMTD[0].totalTransactions > 0 
      ? ((currentMTD[0].totalTransactions - previousMTD[0].totalTransactions) / previousMTD[0].totalTransactions) * 100 
      : currentMTD[0].totalTransactions > 0 ? 100 : 0;
    
    const mtdItemsGrowth = previousMTD[0].totalItems > 0 
      ? ((currentMTD[0].totalItems - previousMTD[0].totalItems) / previousMTD[0].totalItems) * 100 
      : currentMTD[0].totalItems > 0 ? 100 : 0;

    res.json({
      success: true,
      data: {
        currentYear,
        previousYear,
        ytd: {
          current: {
            totalTransactions: Number(currentYTD[0].totalTransactions),
            totalSales: Number(currentYTD[0].totalSales),
            totalItems: Number(currentYTD[0].totalItems),
            totalCost: Number(currentYTD[0].totalCost)
          },
          previous: {
            totalTransactions: Number(previousYTD[0].totalTransactions),
            totalSales: Number(previousYTD[0].totalSales),
            totalItems: Number(previousYTD[0].totalItems),
            totalCost: Number(previousYTD[0].totalCost)
          },
          growth: {
            revenue: Math.round(ytdRevenueGrowth * 100) / 100,
            transactions: Math.round(ytdTransactionGrowth * 100) / 100,
            items: Math.round(ytdItemsGrowth * 100) / 100
          }
        },
        mtd: {
          current: {
            totalTransactions: Number(currentMTD[0].totalTransactions),
            totalSales: Number(currentMTD[0].totalSales),
            totalItems: Number(currentMTD[0].totalItems),
            totalCost: Number(currentMTD[0].totalCost)
          },
          previous: {
            totalTransactions: Number(previousMTD[0].totalTransactions),
            totalSales: Number(previousMTD[0].totalSales),
            totalItems: Number(previousMTD[0].totalItems),
            totalCost: Number(previousMTD[0].totalCost)
          },
          growth: {
            revenue: Math.round(mtdRevenueGrowth * 100) / 100,
            transactions: Math.round(mtdTransactionGrowth * 100) / 100,
            items: Math.round(mtdItemsGrowth * 100) / 100
          }
        }
      }
    });

  } catch (error) {
    console.error('Error fetching YTD MTD comparison:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch YTD MTD comparison' });
  }
};

// Routes
router.post('/', recordSale);
router.get('/summary/:date', getSalesSummary);
router.get('/analytics/:date', getSalesAnalytics);
router.get('/monthly/:month', getMonthlySales);
router.get('/analytics/monthly/:month/:year', getMonthlySalesAnalytics);
router.get('/ytd-mtd/:year', getYTDMTDComparison);
router.get('/:date', getSalesByDate);

module.exports = { router, recordSale, getSalesSummary, getSalesByDate, getSalesAnalytics, getMonthlySales, getMonthlySalesAnalytics, getYTDMTDComparison };
