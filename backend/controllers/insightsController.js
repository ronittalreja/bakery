const express = require('express');
const db = require('../config/database');

const router = express.Router();

// Get Monthly Insights
const getMonthlyInsights = async (req, res) => {
  try {
    const { month } = req.params;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, error: 'Invalid month format. Use YYYY-MM' });
    }

    console.log(`Fetching insights for month: ${month}`);

    // Get total sales and cost breakdown for the month using new cost tracking columns
    const [salesData] = await db.execute(`
      SELECT 
        COALESCE(SUM(s.total_amount), 0) as totalSales,
        COALESCE(SUM(s.product_mrp_total), 0) as productMRPTotal,
        COALESCE(SUM(s.decoration_mrp_total), 0) as decorationMRPTotal,
        COALESCE(SUM(s.product_cost_total), 0) as productCostTotal,
        COALESCE(SUM(s.decoration_cost_total), 0) as decorationCostTotal,
        COALESCE(SUM(s.total_cost), 0) as totalCost,
        COUNT(DISTINCT s.id) as totalTransactions
      FROM sales s
      WHERE DATE_FORMAT(s.sale_date, '%Y-%m') = ?
    `, [month]);

    // Get total loss (GRM + GVN returns)
    const [lossData] = await db.execute(`
      SELECT 
        COALESCE(SUM(r.loss_amount), 0) as totalLoss
      FROM returns r
      WHERE DATE_FORMAT(r.return_date, '%Y-%m') = ?
    `, [month]);

    // Get total expenses for the month
    const [expensesData] = await db.execute(`
      SELECT 
        COALESCE(SUM(e.amount), 0) as totalExpenses
      FROM expenses e
      WHERE DATE_FORMAT(e.expense_date, '%Y-%m') = ?
    `, [month]);



    // Calculate profit and profit margin using new cost tracking data
    const totalSales = Number(salesData[0].totalSales);
    const productMRPTotal = Number(salesData[0].productMRPTotal);
    const decorationMRPTotal = Number(salesData[0].decorationMRPTotal);
    const productCostTotal = Number(salesData[0].productCostTotal);
    const decorationCostTotal = Number(salesData[0].decorationCostTotal);
    const totalCost = Number(salesData[0].totalCost);
    const totalLoss = Number(lossData[0].totalLoss);
    const totalExpenses = Number(expensesData[0].totalExpenses);
    
    // Calculate profits
    const productProfit = productMRPTotal - productCostTotal;
    const decorationProfit = decorationMRPTotal - decorationCostTotal;
    const totalProfit = totalSales - totalCost - totalLoss - totalExpenses;
    
    // Calculate margins
    const productMargin = productMRPTotal > 0 ? (productProfit / productMRPTotal) * 100 : 0;
    const decorationMargin = decorationMRPTotal > 0 ? (decorationProfit / decorationMRPTotal) * 100 : 0;
    const totalMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

    const insightsData = {
      month,
      totalSales,
      productMRPTotal,
      decorationMRPTotal,
      productCostTotal,
      decorationCostTotal,
      totalCost,
      productProfit,
      decorationProfit,
      totalProfit,
      productMargin,
      decorationMargin,
      totalMargin,
      totalLoss,
      totalExpenses
    };

    console.log('Insights data calculated:', {
      totalSales,
      productMRPTotal,
      decorationMRPTotal,
      productCostTotal,
      decorationCostTotal,
      totalCost,
      productProfit,
      decorationProfit,
      totalProfit,
      productMargin: productMargin.toFixed(2) + '%',
      decorationMargin: decorationMargin.toFixed(2) + '%',
      totalMargin: totalMargin.toFixed(2) + '%',
      totalLoss,
      totalExpenses
    });

    res.json({
      success: true,
      data: insightsData
    });

  } catch (error) {
    console.error('Error fetching monthly insights:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch insights' });
  }
};

// Routes
router.get('/monthly/:month', getMonthlyInsights);

module.exports = { router, getMonthlyInsights };
