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

    // Fetch all raw data with simple queries, then calculate in JS
    
    // Get all invoices and items for the month
    const [invoicesData] = await db.execute(`
      SELECT 
        i.id,
        i.invoice_date,
        ii.qty,
        ii.rate,
        ii.total,
        ii.item_code,
        p.name
      FROM invoices i
      JOIN invoice_items ii ON i.id = ii.invoice_id
      LEFT JOIN products p ON ii.item_code = p.item_code
      WHERE DATE_FORMAT(i.invoice_date, '%Y-%m') = ?
    `, [month]);

    // Get all credit notes for the month
    const [creditNotesData] = await db.execute(`
      SELECT gross_value, date
      FROM credit_notes
      WHERE DATE_FORMAT(date, '%Y-%m') = ?
    `, [month]);

    // Get all returns for the month
    const [returnsData] = await db.execute(`
      SELECT loss_amount, return_date
      FROM returns
      WHERE DATE_FORMAT(return_date, '%Y-%m') = ?
    `, [month]);

    // Get all expenses for the month
    const [expensesData] = await db.execute(`
      SELECT amount, expense_date
      FROM expenses
      WHERE DATE_FORMAT(expense_date, '%Y-%m') = ?
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

    // Calculate totals using JS
    let productMRPTotal = 0;
    let decorationMRPTotal = 0;
    let productCostTotal = 0;
    let decorationCostTotal = 0;
    let packingMaterialExpense = 0;

    // Process invoice items in JS
    invoicesData.forEach(item => {
      const mrp = computeMrp(item.rate);
      const mrpTotal = mrp * item.qty;
      const costTotal = item.total;
      
      productMRPTotal += mrpTotal;
      productCostTotal += costTotal;

      // Check if packing material (use item_code if name not available)
      const itemName = item.name || item.item_code || '';
      if (itemName.toLowerCase().includes('packing')) {
        packingMaterialExpense += costTotal;
      }
    });

    // Calculate credit notes total in JS
    const totalCreditNotes = creditNotesData.reduce((sum, cn) => sum + Number(cn.gross_value), 0);

    // Calculate net sales (MRP total - credit notes)
    const netSales = productMRPTotal - totalCreditNotes;

    // Calculate total loss in JS
    const totalLoss = returnsData.reduce((sum, r) => sum + Number(r.loss_amount), 0);

    // Calculate total expenses in JS
    const manualExpenses = expensesData.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalExpenses = manualExpenses + packingMaterialExpense;

    // Calculate profit and profit margin using net sales (MRP - credit notes)
    const totalSales = netSales; // Use net sales (MRP - credit notes)
    const totalCost = productCostTotal; // Total cost from invoice totals (all items at cost price)
    
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
      manualExpenses
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
