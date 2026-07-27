const express = require('express');
const db = require('../config/database');
const { getDemoData } = require('../middleware/demoMode');

const router = express.Router();

// Get Monthly Insights
const getMonthlyInsights = async (req, res) => {
  try {
    const { month } = req.params;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, error: 'Invalid month format. Use YYYY-MM' });
    }

    console.log(`Fetching insights for month: ${month}`);

    // Return demo data if demo user
    if (req.isDemo) {
      const demoSales = getDemoData('sales');
      const demoExpenses = getDemoData('expenses');
      
      const totalSales = demoSales.reduce((sum, sale) => sum + sale.total_amount, 0);
      const totalCost = totalSales * 0.6; // 60% cost
      const totalLoss = totalSales * 0.05; // 5% loss
      const totalExpenses = demoExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const totalProfit = totalSales - totalCost - totalLoss - totalExpenses;
      const totalMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

      const insightsData = {
        month,
        totalSales,
        productMRPTotal: totalSales * 0.8,
        decorationMRPTotal: totalSales * 0.2,
        productCostTotal: totalCost * 0.8,
        decorationCostTotal: totalCost * 0.2,
        totalCost,
        productProfit: totalSales * 0.8 - totalCost * 0.8,
        decorationProfit: totalSales * 0.2 - totalCost * 0.2,
        totalProfit,
        productMargin: 25,
        decorationMargin: 30,
        totalMargin,
        totalLoss,
        totalExpenses
      };

      return res.json({ success: true, data: insightsData });
    }

    // Get total sales from invoices for the month (cost price)
    const [salesData] = await db.execute(`
      SELECT 
        COALESCE(SUM(ii.total), 0) as totalSales,
        COUNT(DISTINCT i.id) as totalTransactions
      FROM invoices i
      JOIN invoice_items ii ON i.id = ii.invoice_id
      WHERE DATE_FORMAT(i.invoice_date, '%Y-%m') = ?
    `, [month]);

    // Get credit notes total for the month
    const [creditNotesData] = await db.execute(`
      SELECT 
        COALESCE(SUM(gross_value), 0) as totalCreditNotes
      FROM credit_notes
      WHERE DATE_FORMAT(date, '%Y-%m') = ?
    `, [month]);

    // Calculate MRP from invoice rates (rate * 1.33 rounded to nearest 5)
    const roundUpToNearest5 = (value) => {
      const remainder = value % 5;
      return remainder === 0 ? value : value + (5 - remainder);
    };
    
    const computeMrp = (invoicePrice) => {
      const increased = invoicePrice * 1.33; // +33%
      return roundUpToNearest5(Math.ceil(increased));
    };

    // Get all invoice items to calculate MRP totals
    const [invoiceItems] = await db.execute(`
      SELECT 
        ii.qty,
        ii.rate,
        ii.total
      FROM invoices i
      JOIN invoice_items ii ON i.id = ii.invoice_id
      WHERE DATE_FORMAT(i.invoice_date, '%Y-%m') = ?
    `, [month]);

    let productMRPTotal = 0;
    let decorationMRPTotal = 0;
    let productCostTotal = 0;
    let decorationCostTotal = 0;

    // For simplicity, assume all invoice items are products (decorations are tracked separately)
    // If you have decoration tracking in invoices, you'd need to filter by category
    invoiceItems.forEach(item => {
      const mrp = computeMrp(item.rate);
      const mrpTotal = mrp * item.qty;
      const costTotal = item.total; // invoice total is at cost price
      
      productMRPTotal += mrpTotal;
      productCostTotal += costTotal;
    });

    // Calculate net sales (MRP total - credit notes)
    const netSales = productMRPTotal - Number(creditNotesData[0].totalCreditNotes);

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

    // Get packing material expense from stock items used in the month
    // Try to get items with 'packing' in the name or category
    const [packingMaterialData] = await db.execute(`
      SELECT 
        COALESCE(SUM(ii.total), 0) as packingMaterialExpense
      FROM invoices i
      JOIN invoice_items ii ON i.id = ii.invoice_id
      WHERE DATE_FORMAT(i.invoice_date, '%Y-%m') = ?
      AND (LOWER(ii.name) LIKE '%packing%' OR LOWER(ii.item_code) LIKE '%pack%')
    `, [month]);

    const packingMaterialExpense = Number(packingMaterialData[0].packingMaterialExpense);
    const totalExpensesWithPacking = Number(expensesData[0].totalExpenses) + packingMaterialExpense;



    // Calculate profit and profit margin using net sales (MRP - credit notes)
    const totalSales = netSales; // Use net sales (MRP - credit notes)
    const totalCost = productCostTotal + decorationCostTotal; // Total cost from invoice totals
    const totalLoss = Number(lossData[0].totalLoss);
    const totalExpenses = totalExpensesWithPacking; // Use expenses including packing material
    
    // Calculate profit as per user formula: (Net Sales * 25%) - Loss - Expenses
    // Net Sales = MRP - Credit Notes
    // Profit = Net Sales * 0.25 - Loss - Expenses
    const totalProfit = (totalSales * 0.25) - totalLoss - totalExpenses;
    
    // Calculate profits
    const productProfit = (productMRPTotal * 0.25); // 25% margin on MRP
    const decorationProfit = (decorationMRPTotal * 0.30); // 30% margin on decorations
    
    // Calculate margins
    const productMargin = 25; // Fixed 25% margin
    const decorationMargin = 30; // Fixed 30% margin
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
      totalExpenses,
      packingMaterialExpense,
      manualExpenses: Number(expensesData[0].totalExpenses)
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
