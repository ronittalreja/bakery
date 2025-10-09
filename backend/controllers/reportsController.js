const Sale = require('../models/Sale');
const Return = require('../models/Return');
const Damage = require('../models/Damage');
const StockBatch = require('../models/StockBatch');
const db = require('../config/database');

const getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'date' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'Start date and end date are required' });
    }

    let query = `
      SELECT 
        DATE(s.sale_date) as sale_date,
        COUNT(DISTINCT s.id) as total_transactions,
        SUM(s.total_amount) as total_sales,
        SUM(CASE WHEN s.payment_type = 'cash' THEN s.total_amount ELSE 0 END) as cash_sales,
        SUM(CASE WHEN s.payment_type = 'upi' THEN s.total_amount ELSE 0 END) as upi_sales,
        SUM(si.quantity) as total_items
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      WHERE DATE(s.sale_date) BETWEEN ? AND ?
    `;

    if (groupBy === 'date') {
      query += ' GROUP BY DATE(s.sale_date) ORDER BY sale_date DESC';
    } else if (groupBy === 'payment') {
      query = query.replace('DATE(s.sale_date) as sale_date,', 's.payment_type,') + 
              ' GROUP BY s.payment_type ORDER BY total_sales DESC';
    }

    const [rows] = await db.execute(query, [startDate, endDate]);
    
    // Calculate totals
    const totals = rows.reduce((acc, row) => ({
      totalTransactions: acc.totalTransactions + Number(row.total_transactions),
      totalSales: acc.totalSales + Number(row.total_sales),
      cashSales: acc.cashSales + Number(row.cash_sales),
      upiSales: acc.upiSales + Number(row.upi_sales),
      totalItems: acc.totalItems + Number(row.total_items)
    }), { totalTransactions: 0, totalSales: 0, cashSales: 0, upiSales: 0, totalItems: 0 });

    res.json({ 
      success: true, 
      report: rows.map(row => ({
        ...row,
        total_transactions: Number(row.total_transactions),
        total_sales: Number(row.total_sales),
        cash_sales: Number(row.cash_sales),
        upi_sales: Number(row.upi_sales),
        total_items: Number(row.total_items)
      })),
      summary: totals,
      period: { startDate, endDate }
    });
  } catch (error) {
    console.error('Error in getSalesReport:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getProductSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, productId } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'Start date and end date are required' });
    }

    let query = `
      SELECT 
        p.id as product_id,
        p.name,
        p.item_code,
        p.sale_price,
        SUM(si.quantity) as total_quantity,
        SUM(si.total_price) as total_sales,
        AVG(si.unit_price) as avg_price,
        COUNT(DISTINCT s.id) as transaction_count
      FROM sale_items si
      JOIN products p ON si.item_id = p.id AND si.item_type = 'product'
      JOIN sales s ON si.sale_id = s.id
      WHERE DATE(s.sale_date) BETWEEN ? AND ?
    `;
    
    let params = [startDate, endDate];
    
    if (productId) {
      query += ' AND p.id = ?';
      params.push(productId);
    }
    
    query += ' GROUP BY p.id, p.name, p.item_code, p.sale_price ORDER BY total_sales DESC';

    const [rows] = await db.execute(query, params);
    
    const totals = rows.reduce((acc, row) => ({
      totalQuantity: acc.totalQuantity + Number(row.total_quantity),
      totalSales: acc.totalSales + Number(row.total_sales),
      totalTransactions: acc.totalTransactions + Number(row.transaction_count)
    }), { totalQuantity: 0, totalSales: 0, totalTransactions: 0 });

    res.json({ 
      success: true, 
      report: rows.map(row => ({
        product_id: row.product_id,
        name: row.name,
        item_code: row.item_code,
        sale_price: Number(row.sale_price),
        total_quantity: Number(row.total_quantity),
        total_sales: Number(row.total_sales),
        avg_price: Number(row.avg_price),
        transaction_count: Number(row.transaction_count)
      })),
      summary: totals,
      period: { startDate, endDate }
    });
  } catch (error) {
    console.error('Error in getProductSalesReport:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getStockReport = async (req, res) => {
  try {
    const { includeExpired = false, lowStockThreshold = 10 } = req.query;
    
    let query = `
      SELECT 
        sb.id,
        sb.product_id,
        p.name,
        p.item_code,
        p.invoice_price,
        p.sale_price,
        sb.expiry_date,
        sb.invoice_date,
        sb.invoice_reference,
        COALESCE(
          sb.quantity - 
          COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.batch_id = sb.id), 0) -
          COALESCE((SELECT SUM(r.quantity) FROM returns r WHERE r.batch_id = sb.id), 0),
          0
        ) AS available_quantity,
        sb.quantity as original_quantity
      FROM stock_batches sb
      JOIN products p ON sb.product_id = p.id
      WHERE p.is_active = 1
    `;
    
    if (includeExpired !== 'true') {
      query += ' AND sb.expiry_date > CURDATE()';
    }
    
    query += ' HAVING available_quantity > 0 ORDER BY sb.expiry_date ASC, p.name ASC';

    const [rows] = await db.execute(query);
    
    const stockData = rows.map(row => ({
      ...row,
      available_quantity: Number(row.available_quantity),
      original_quantity: Number(row.original_quantity),
      invoice_price: Number(row.invoice_price),
      sale_price: Number(row.sale_price),
      stock_value: Number((row.available_quantity * row.invoice_price).toFixed(2)),
      is_low_stock: Number(row.available_quantity) <= Number(lowStockThreshold),
      is_expired: new Date(row.expiry_date) < new Date()
    }));

    const summary = stockData.reduce((acc, item) => ({
      totalBatches: acc.totalBatches + 1,
      totalQuantity: acc.totalQuantity + item.available_quantity,
      totalValue: acc.totalValue + item.stock_value,
      lowStockItems: acc.lowStockItems + (item.is_low_stock ? 1 : 0),
      expiredItems: acc.expiredItems + (item.is_expired ? 1 : 0)
    }), { totalBatches: 0, totalQuantity: 0, totalValue: 0, lowStockItems: 0, expiredItems: 0 });

    res.json({ 
      success: true, 
      report: stockData,
      summary: {
        ...summary,
        totalValue: Number(summary.totalValue.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Error in getStockReport:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getExpiredStockReport = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + parseInt(days));
    const targetDateStr = targetDate.toISOString().split('T')[0];
    
    const query = `
      SELECT 
        sb.id,
        sb.product_id,
        p.name,
        p.item_code,
        p.invoice_price,
        sb.expiry_date,
        sb.invoice_date,
        sb.invoice_reference,
        COALESCE(
          sb.quantity - 
          COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.batch_id = sb.id), 0) -
          COALESCE((SELECT SUM(r.quantity) FROM returns r WHERE r.batch_id = sb.id), 0),
          0
        ) AS available_quantity,
        DATEDIFF(sb.expiry_date, CURDATE()) as days_to_expiry
      FROM stock_batches sb
      JOIN products p ON sb.product_id = p.id
      WHERE p.is_active = 1 AND sb.expiry_date <= ?
      HAVING available_quantity > 0 
      ORDER BY sb.expiry_date ASC
    `;

    const [rows] = await db.execute(query, [targetDateStr]);
    
    const expiredStock = rows.map(row => ({
      ...row,
      available_quantity: Number(row.available_quantity),
      invoice_price: Number(row.invoice_price),
      days_to_expiry: Number(row.days_to_expiry),
      potential_loss: Number((row.available_quantity * row.invoice_price * 0.15).toFixed(2)),
      status: row.days_to_expiry < 0 ? 'expired' : row.days_to_expiry === 0 ? 'expires_today' : 'expires_soon'
    }));

    const summary = expiredStock.reduce((acc, item) => ({
      totalItems: acc.totalItems + 1,
      totalQuantity: acc.totalQuantity + item.available_quantity,
      totalPotentialLoss: acc.totalPotentialLoss + item.potential_loss,
      expiredCount: acc.expiredCount + (item.status === 'expired' ? 1 : 0),
      expiresTodayCount: acc.expiresTodayCount + (item.status === 'expires_today' ? 1 : 0),
      expiresSoonCount: acc.expiresSoonCount + (item.status === 'expires_soon' ? 1 : 0)
    }), { 
      totalItems: 0, 
      totalQuantity: 0, 
      totalPotentialLoss: 0, 
      expiredCount: 0, 
      expiresTodayCount: 0, 
      expiresSoonCount: 0 
    });

    res.json({ 
      success: true, 
      report: expiredStock,
      summary: {
        ...summary,
        totalPotentialLoss: Number(summary.totalPotentialLoss.toFixed(2))
      },
      parameters: { days: parseInt(days), targetDate: targetDateStr }
    });
  } catch (error) {
    console.error('Error in getExpiredStockReport:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getReturnsReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'Start date and end date are required' });
    }

    // Get GRM returns
    const [grmRows] = await db.execute(`
      SELECT 
        DATE(r.return_date) as return_date,
        COUNT(*) as total_returns,
        SUM(r.quantity) as total_quantity,
        SUM(r.loss_amount) as total_loss,
        p.name,
        p.item_code,
        r.product_id
      FROM returns r
      JOIN products p ON r.product_id = p.id
      WHERE r.type = 'GRM' AND DATE(r.return_date) BETWEEN ? AND ?
      GROUP BY DATE(r.return_date), r.product_id, p.name, p.item_code
      ORDER BY return_date DESC, total_loss DESC
    `, [startDate, endDate]);

    // Get GVN damages
    const [gvnRows] = await db.execute(`
      SELECT 
        DATE(r.return_date) as damage_date,
        COUNT(*) as total_damages,
        SUM(r.quantity) as total_quantity,
        p.name,
        p.item_code,
        r.product_id
      FROM returns r
      JOIN products p ON r.product_id = p.id
      WHERE r.type = 'GVN' AND DATE(r.return_date) BETWEEN ? AND ?
      GROUP BY DATE(r.return_date), r.product_id, p.name, p.item_code
      ORDER BY damage_date DESC, total_quantity DESC
    `, [startDate, endDate]);

    const grmSummary = grmRows.reduce((acc, row) => ({
      totalReturns: acc.totalReturns + Number(row.total_returns),
      totalQuantity: acc.totalQuantity + Number(row.total_quantity),
      totalLoss: acc.totalLoss + Number(row.total_loss)
    }), { totalReturns: 0, totalQuantity: 0, totalLoss: 0 });

    const gvnSummary = gvnRows.reduce((acc, row) => ({
      totalDamages: acc.totalDamages + Number(row.total_damages),
      totalQuantity: acc.totalQuantity + Number(row.total_quantity)
    }), { totalDamages: 0, totalQuantity: 0 });

    res.json({ 
      success: true, 
      grm: {
        data: grmRows.map(row => ({
          ...row,
          total_returns: Number(row.total_returns),
          total_quantity: Number(row.total_quantity),
          total_loss: Number(row.total_loss)
        })),
        summary: grmSummary
      },
      gvn: {
        data: gvnRows.map(row => ({
          ...row,
          total_damages: Number(row.total_damages),
          total_quantity: Number(row.total_quantity)
        })),
        summary: gvnSummary
      },
      period: { startDate, endDate }
    });
  } catch (error) {
    console.error('Error in getReturnsReport:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getSalesReport,
  getProductSalesReport,
  getStockReport,
  getExpiredStockReport,
  getReturnsReport
} 