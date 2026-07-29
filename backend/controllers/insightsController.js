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
    // Use invoice item rates (historical prices) and current product sale prices for MRP
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

    // Calculate total return charges (total loss) from credit notes for the month
    const [creditNotesItemsData] = await db.execute(`
      SELECT items
      FROM credit_notes
      WHERE DATE_FORMAT(COALESCE(return_date, date), '%Y-%m') = ?
    `, [month]);

    let totalReturnCharges = 0;
    for (const row of creditNotesItemsData) {
      try {
        const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
        if (Array.isArray(items)) {
          const noteLoss = items.reduce((sum, item) => {
            const rtdPercentage = item.rtd || 0;
            return sum + ((item.total * rtdPercentage) / 100);
          }, 0);
          totalReturnCharges += noteLoss;
        }
      } catch (e) {
        console.warn(`Error parsing items for credit note:`, e);
      }
    }

    // Calculate total packing material costs from invoices for the month
    const [invoicesForPacking] = await db.execute(`
      SELECT id
      FROM invoices
      WHERE DATE_FORMAT(invoice_date, '%Y-%m') = ?
    `, [month]);

    let totalPackingMaterialCost = 0;
    for (const invoice of invoicesForPacking) {
      try {
        const [items] = await db.execute(`
          SELECT p.category, ii.total
          FROM invoice_items ii
          LEFT JOIN products p ON ii.item_code = p.item_code
          WHERE ii.invoice_id = ?
        `, [invoice.id]);

        const packingCost = items.reduce((sum, item) => {
          const category = item.category?.toLowerCase();
          if (category === 'packing_material' || category === 'packaging' || category === 'packing') {
            return sum + Number(item.total || 0);
          }
          return sum;
        }, 0);

        totalPackingMaterialCost += packingCost;
      } catch (e) {
        console.warn(`Error getting items for invoice ${invoice.id}:`, e);
      }
    }

    // Calculate total expenses in JS (includes manual expenses + auto-generated return charges + packing material)
    const manualExpensesTotal = expensesData.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalExpenses = manualExpensesTotal + totalReturnCharges + totalPackingMaterialCost;

    // Calculate MRP from invoice rates - use 25% margin if sale_price not available
    const computeMrp = (invoicePrice) => {
      return invoicePrice * 1.25; // 25% margin
    };

    // Calculate totals using JS
    let productInvoiceTotal = 0; // Total invoice cost for products
    let decorationInvoiceTotal = 0; // Total invoice cost for decorations
    let productMRPTotal = 0;
    let decorationMRPTotal = 0;
    let productCostTotal = 0;
    let decorationCostTotal = 0;

    // Process invoice items in JS using historical rates from invoice_items and actual sale prices from products
    invoicesData.forEach(item => {
      const costTotal = Number(item.total) || 0;
      const qty = Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;
      const salePrice = Number(item.sale_price) || 0;
      
      const category = item.category || '';
      const isDecoration = category.toLowerCase().includes('decoration');
      
      // Use actual sale_price from products table for MRP (represents actual margin set in manage products)
      // If sale_price not available, use 25% margin (cost * 1.25)
      const actualMrp = salePrice > 0 ? salePrice : computeMrp(rate);
      
      if (isDecoration) {
        // For decorations, use historical rate as cost and actual/computed MRP
        decorationInvoiceTotal += costTotal;
        decorationMRPTotal += actualMrp * qty;
        decorationCostTotal += rate * qty;
      } else {
        // For products, use historical rate as cost and actual sale price (actual margin)
        productInvoiceTotal += costTotal;
        productMRPTotal += actualMrp * qty;
        productCostTotal += rate * qty;
      }
    });

    // Calculate credit notes total (returns - cost of returned stock)
    const totalReturnsCost = creditNotesData.reduce((sum, cn) => sum + Number(cn.gross_value), 0);

    // Net cost = Total invoice cost - Returns cost
    const totalInvoiceMRP = productMRPTotal + decorationMRPTotal;
    const totalInvoiceCost = productCostTotal + decorationCostTotal;
    
    // Deduct returns cost from total cost (you bear loss on returned stock)
    const netCost = totalInvoiceCost - totalReturnsCost;
    
    // For revenue, deduct returns proportionally based on MRP
    const returnRatio = totalInvoiceMRP > 0 ? totalReturnsCost / totalInvoiceCost : 0;
    const netRevenue = totalInvoiceMRP - (totalInvoiceMRP * returnRatio);

    // For individual product/decoration margins, deduct returns proportionally
    const productReturnRatio = productCostTotal > 0 ? totalReturnsCost * (productCostTotal / totalInvoiceCost) / productCostTotal : 0;
    const decorationReturnRatio = decorationCostTotal > 0 ? totalReturnsCost * (decorationCostTotal / totalInvoiceCost) / decorationCostTotal : 0;
    
    const netProductCost = productCostTotal - (productCostTotal * productReturnRatio);
    const netDecorationCost = decorationCostTotal - (decorationCostTotal * decorationReturnRatio);
    const netProductMRP = productMRPTotal - (productMRPTotal * productReturnRatio);
    const netDecorationMRP = decorationMRPTotal - (decorationMRPTotal * decorationReturnRatio);

    // Calculate profit: Net Revenue - Net Cost - Expenses (includes auto-generated return charges and packing material)
    const totalProfit = netRevenue - netCost - totalExpenses;
    
    // Calculate product profit: Net Product MRP - Net Product Cost
    const productProfit = netProductMRP - netProductCost;
    
    // Calculate decoration profit: Net Decoration MRP - Net Decoration Cost
    const decorationProfit = netDecorationMRP - netDecorationCost;
    
    // Calculate margins
    const productMargin = productMRPTotal > 0 ? (productProfit / productMRPTotal) * 100 : 0;
    const decorationMargin = decorationMRPTotal > 0 ? (decorationProfit / decorationMRPTotal) * 100 : 0;
    const totalMargin = netRevenue > 0 ? (totalProfit / netRevenue) * 100 : 0;

    const insightsData = {
      month,
      netRevenue,
      netCost,
      productMRPTotal: netProductMRP,
      decorationMRPTotal: netDecorationMRP,
      productCostTotal: netProductCost,
      decorationCostTotal: netDecorationCost,
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
