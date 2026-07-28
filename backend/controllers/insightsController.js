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
    
    // Get all invoices and items for the month with category
    const [invoicesData] = await db.execute(`
      SELECT 
        i.id,
        i.invoice_date,
        ii.qty,
        ii.rate,
        ii.total,
        ii.item_code,
        p.name,
        p.category,
        p.invoice_price,
        p.sale_price
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
    let productInvoiceTotal = 0; // Total invoice cost for products
    let decorationInvoiceTotal = 0; // Total invoice cost for decorations
    let productMRPTotal = 0;
    let decorationMRPTotal = 0;
    let productCostTotal = 0;
    let decorationCostTotal = 0;

    // Process invoice items in JS
    invoicesData.forEach(item => {
      const costTotal = Number(item.total) || 0;
      
      const category = item.category || '';
      const isDecoration = category.toLowerCase().includes('decoration');
      
      if (isDecoration) {
        // For decorations, use actual sale_price (MRP) and invoice_price (Cost) from products
        const salePrice = Number(item.sale_price) || 0;
        const invoicePrice = Number(item.invoice_price) || Number(item.rate) || 0;
        const qty = Number(item.qty) || 0;
        
        decorationInvoiceTotal += costTotal;
        decorationMRPTotal += salePrice * qty;
        decorationCostTotal += invoicePrice * qty;
      } else {
        // For products, use actual sale_price (MRP) and invoice_price (Cost) from products
        const salePrice = Number(item.sale_price) || 0;
        const invoicePrice = Number(item.invoice_price) || Number(item.rate) || 0;
        const qty = Number(item.qty) || 0;
        
        productInvoiceTotal += costTotal;
        productMRPTotal += salePrice * qty;
        productCostTotal += invoicePrice * qty;
      }
    });

    // Calculate credit notes total (returns)
    const totalReturns = creditNotesData.reduce((sum, cn) => sum + Number(cn.gross_value), 0);

    // Calculate net revenue and net cost (after deducting returns proportionally)
    const totalInvoiceMRP = productMRPTotal + decorationMRPTotal;
    const totalInvoiceCost = productCostTotal + decorationCostTotal;
    
    // Deduct returns proportionally from MRP and cost
    const returnRatio = totalInvoiceMRP > 0 ? totalReturns / totalInvoiceMRP : 0;
    const netRevenue = totalInvoiceMRP - totalReturns;
    const netCost = totalInvoiceCost - (totalInvoiceCost * returnRatio);

    // Calculate total expenses in JS (includes automated RETURN LOSS)
    const totalExpenses = expensesData.reduce((sum, e) => sum + Number(e.amount), 0);

    // Calculate profit: Net Revenue - Net Cost - Expenses
    const totalProfit = netRevenue - netCost - totalExpenses;
    
    // Calculate product profit: Product MRP - Product Cost
    const productProfit = productMRPTotal - productCostTotal;
    
    // Calculate decoration profit: Decoration MRP - Decoration Cost
    const decorationProfit = decorationMRPTotal - decorationCostTotal;
    
    // Calculate margins
    const productMargin = productMRPTotal > 0 ? (productProfit / productMRPTotal) * 100 : 0;
    const decorationMargin = decorationMRPTotal > 0 ? (decorationProfit / decorationMRPTotal) * 100 : 0;
    const totalMargin = netRevenue > 0 ? (totalProfit / netRevenue) * 100 : 0;

    const insightsData = {
      month,
      netRevenue,
      netCost,
      productMRPTotal,
      decorationMRPTotal,
      productCostTotal,
      decorationCostTotal,
      productProfit,
      decorationProfit,
      totalProfit,
      productMargin,
      decorationMargin,
      totalMargin,
      totalExpenses
    };

    console.log('Insights data calculated:', {
      netRevenue,
      netCost,
      productMRPTotal,
      decorationMRPTotal,
      productCostTotal,
      decorationCostTotal,
      productProfit,
      decorationProfit,
      totalProfit,
      productMargin: productMargin.toFixed(2) + '%',
      decorationMargin: decorationMargin.toFixed(2) + '%',
      totalMargin: totalMargin.toFixed(2) + '%',
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
