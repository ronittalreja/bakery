const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const StockBatch = require('../models/StockBatch');
const { updateDecorationStock, getDecorationForSale } = require('./decorationsController');
const db = require('../config/database');
const { getDemoData, demoData } = require('../middleware/demoMode');

// Record a Sale (supports FEFO allocation when batchId not provided)
const recordSale = async (req, res) => {
  const { 
    saleDate, 
    items, 
    paymentType, 
    totalAmount,
    productMRPTotal = 0,
    decorationMRPTotal = 0,
    productCostTotal = 0,
    decorationCostTotal = 0,
    totalCost = 0,
    isHistorical = false
  } = req.body;
  const staffId = req.user?.id || 0;

  // Handle demo user separately - use demo data instead of database
  if (req.isDemo) {
    try {
      console.log('Demo sale request:', { items, totalAmount, paymentType });
      
      // Validate required fields
      const amountNum = Number(totalAmount);
      if (
        !saleDate ||
        !Array.isArray(items) ||
        items.length === 0 ||
        !paymentType ||
        !Number.isFinite(amountNum)
      ) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      const allocatedItems = [];
      const decorationItems = [];

      for (const item of items) {
        if (!item.productId || !item.quantity) {
          return res.status(400).json({ success: false, error: 'Invalid item data: productId and quantity are required' });
        }

        // Check if this is a decoration item
        // First try to find by decoration id (numeric ID)
        let decoration = demoData.decorations.find(d => d.id === item.productId);
        
        // If not found, try to find by sku (string ID from frontend)
        if (!decoration) {
          decoration = demoData.decorations.find(d => d.sku === item.productId || d.sku === String(item.productId));
        }
        
        // If still not found, try to find by name
        if (!decoration && item.name) {
          decoration = demoData.decorations.find(d => d.name === item.name);
        }
        
        if (decoration) {
          // Handle decoration item
          if (decoration.stock_quantity < Number(item.quantity)) {
            return res.status(400).json({ 
              success: false, 
              error: `Insufficient stock for decoration ${decoration.name}. Available: ${decoration.stock_quantity}, Requested: ${item.quantity}` 
            });
          }
          
          const unitPrice = Number(item.unitPrice);
          const totalPrice = Number(item.totalPrice ?? unitPrice * Number(item.quantity));
          if (!unitPrice || totalPrice <= 0) {
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

        // Handle regular product items - validate against demo stock batches
        // First try to find by product_id (numeric ID)
        let stockBatch = demoData.stockBatches.find(sb => sb.product_id === item.productId);
        
        // If not found, try to find by item_code (string ID from frontend)
        if (!stockBatch) {
          const product = demoData.products.find(p => p.item_code === item.productId || p.id === item.productId);
          if (product) {
            stockBatch = demoData.stockBatches.find(sb => sb.product_id === product.id);
            console.log(`Found product by item_code/id: ${item.productId} -> product_id: ${product.id}`);
          }
        }
        
        // If still not found, try to find by batch ID (frontend might send batchId)
        if (!stockBatch) {
          stockBatch = demoData.stockBatches.find(sb => sb.id === item.productId || sb.id === Number(item.productId));
          if (stockBatch) {
            console.log(`Found stock batch by ID: ${item.productId} -> batch_id: ${stockBatch.id}`);
          }
        }
        
        // If still not found, try to find by product name
        if (!stockBatch && item.name) {
          const product = demoData.products.find(p => p.name === item.name);
          if (product) {
            stockBatch = demoData.stockBatches.find(sb => sb.product_id === product.id);
            console.log(`Found product by name: ${item.name} -> product_id: ${product.id}`);
          }
        }
        
        console.log(`Stock batch lookup for item ${item.productId}:`, {
          itemProductId: item.productId,
          itemName: item.name,
          foundStockBatch: stockBatch ? stockBatch.id : null,
          availableQuantity: stockBatch ? stockBatch.quantity : 0,
          requestedQuantity: Number(item.quantity)
        });
        
        if (!stockBatch) {
          return res.status(400).json({ success: false, error: `No stock found for product ${item.name || item.productId}` });
        }

        if (stockBatch.quantity < Number(item.quantity)) {
          return res.status(400).json({ 
            success: false, 
            error: `Insufficient stock for product ${item.name || item.productId}. Available: ${stockBatch.quantity}, Requested: ${item.quantity}` 
          });
        }

        const unitPrice = Number(item.unitPrice);
        const totalPrice = Number(item.totalPrice ?? unitPrice * Number(item.quantity));
        if (!unitPrice || totalPrice <= 0) {
          return res.status(400).json({ success: false, error: 'Invalid pricing for item' });
        }

        allocatedItems.push({
          productId: stockBatch.product_id,
          batchId: stockBatch.id,
          quantity: Number(item.quantity),
          unitPrice,
          totalPrice,
          name: item.name || ''
        });
      }

      // Create sale record in demo data
      let saleDateTime;
      if (isHistorical) {
        saleDateTime = new Date(saleDate).toISOString().slice(0, 19).replace('T', ' ');
      } else {
        saleDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
      }

      const newSaleId = 5000 + demoData.sales.length;
      const newSale = {
        id: newSaleId,
        sale_date: saleDateTime,
        total_amount: totalAmount,
        payment_type: paymentType,
        staff_id: staffId,
        product_mrp_total: productMRPTotal,
        decoration_mrp_total: decorationMRPTotal,
        product_cost_total: productCostTotal,
        decoration_cost_total: decorationCostTotal,
        total_cost: totalCost,
        items: []
      };

      // Add sale items and update demo stock
      for (const item of allocatedItems) {
        const newItemId = 6000 + demoData.sales.length * 10 + newSale.items.length;
        newSale.items.push({
          id: newItemId,
          sale_id: newSaleId,
          item_id: item.productId,
          batch_id: item.batchId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.totalPrice,
          name: item.name,
          item_type: 'product'
        });

        // Update demo stock batch quantity
        const stockBatch = demoData.stockBatches.find(sb => sb.id === item.batchId);
        if (stockBatch && !isHistorical) {
          stockBatch.quantity -= item.quantity;
          
          // Reset stock to 200 if it reaches 1 or below
          if (stockBatch.quantity <= 1) {
            stockBatch.quantity = 200;
            console.log(`Stock reset for product ${stockBatch.product_id} to 200`);
          }
        }
      }

      // Handle decoration items
      for (const item of decorationItems) {
        const newItemId = 6000 + demoData.sales.length * 10 + newSale.items.length;
        newSale.items.push({
          id: newItemId,
          sale_id: newSaleId,
          item_id: item.decorationId,
          batch_id: null,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.totalPrice,
          name: item.name,
          item_type: 'decoration'
        });

        // Update demo decoration stock
        const decoration = demoData.decorations.find(d => d.id === item.decorationId);
        if (decoration && !isHistorical) {
          decoration.stock_quantity -= item.quantity;
          
          // Reset decoration stock to 100 if it reaches 1 or below
          if (decoration.stock_quantity <= 1) {
            decoration.stock_quantity = 100;
            console.log(`Decoration stock reset for ${decoration.name} to 100`);
          }
        }
      }

      demoData.sales.push(newSale);
      return res.json({ success: true });
    } catch (error) {
      console.error('Demo sale error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to record demo sale' });
    }
  }

  // Regular database flow for non-demo users
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Initialize saleId to prevent undefined error
    let saleId = null;

    // Validate required fields (allow totalAmount = 0)
    const amountNum = Number(totalAmount);
    if (
      !saleDate ||
      !Array.isArray(items) ||
      items.length === 0 ||
      !paymentType ||
      !Number.isFinite(amountNum)
    ) {
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
        // For historical sales, skip stock validation since we're recording past sales
        if (!isHistorical) {
          const [batchRows] = await connection.execute(
            `SELECT id, quantity, expiry_date FROM stock_batches WHERE id = ? AND product_id = ? AND expiry_date > ?`,
            [item.batchId, item.productId, referenceDate]
          );
          if (!batchRows.length || Number(batchRows[0].quantity) < Number(item.quantity)) {
            await connection.rollback();
            return res.status(400).json({ 
              success: false, 
              error: `Insufficient stock for product ${item.name || item.productId} in selected batch. Available: ${batchRows[0]?.quantity || 0}, Requested: ${item.quantity}` 
            });
          }
        } else {
          // For historical sales, just verify the batch exists
          const [batchRows] = await connection.execute(
            `SELECT id, quantity, expiry_date FROM stock_batches WHERE id = ? AND product_id = ?`,
            [item.batchId, item.productId]
          );
          if (!batchRows.length) {
            await connection.rollback();
            return res.status(400).json({ 
              success: false, 
              error: `Batch ${item.batchId} not found for product ${item.name || item.productId}` 
            });
          }
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

      // No batchId: allocate across batches by earliest expiry (FEFO)
      if (isHistorical) {
        // For historical sales, just find any batch for this product
        const [batches] = await connection.execute(
          `SELECT id, quantity, expiry_date 
           FROM stock_batches 
           WHERE product_id = ?
           ORDER BY expiry_date ASC, invoice_date ASC, id ASC
           LIMIT 1`,
          [item.productId]
        );
        
        if (!batches.length) {
          await connection.rollback();
          return res.status(400).json({ success: false, error: `No stock found for product ${item.name || item.productId}` });
        }
        
        const batch = batches[0];
        const unitPrice = Number(item.unitPrice);
        const totalPrice = Number(item.totalPrice ?? unitPrice * Number(item.quantity));
        if (!unitPrice || totalPrice <= 0) {
          await connection.rollback();
          return res.status(400).json({ success: false, error: 'Invalid pricing for item' });
        }
        allocatedItems.push({
          productId: item.productId,
          batchId: batch.id,
          quantity: Number(item.quantity),
          unitPrice,
          totalPrice,
          name: item.name || ''
        });
        continue;
      } else {
        // Regular sales - use FEFO allocation
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
    // For historical sales, use the provided saleDate; for regular sales, use current time
    let saleDateTime;
    if (isHistorical) {
      // Frontend sends ISO string, convert to MySQL datetime format
      saleDateTime = new Date(saleDate).toISOString().slice(0, 19).replace('T', ' ');
    } else {
      saleDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
    
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
        saleDateTime,
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
    
    console.log('Sale result:', saleResult);
    console.log('Sale result insertId:', saleResult.insertId);
    saleId = saleResult.insertId;
    console.log('Assigned saleId:', saleId);
    
    if (!saleId) {
      await connection.rollback();
      return res.status(500).json({ success: false, error: 'Failed to create sale record' });
    }

    // Add sale items for regular products and update stock
    for (const item of allocatedItems) {
      // Add sale item for regular product
      await connection.execute(
        'INSERT INTO sale_items (sale_id, item_id, batch_id, quantity, unit_price, total_price, name, item_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [saleId, item.productId, item.batchId, item.quantity, item.unitPrice, item.totalPrice, item.name || '', 'product']
      );
      
      // Only update stock for current sales, not historical sales
      if (!isHistorical) {
        await connection.execute(
          'UPDATE stock_batches SET quantity = quantity - ? WHERE id = ?',
          [item.quantity, item.batchId]
        );
      }
    }

    // Handle decoration items separately (no batch_id for decorations)
    for (const item of decorationItems) {
      // Add sale item for decoration
      await connection.execute(
        'INSERT INTO sale_items (sale_id, item_id, batch_id, quantity, unit_price, total_price, name, item_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [saleId, item.decorationId, null, item.quantity, item.unitPrice, item.totalPrice, item.name || '', 'decoration']
      );
      
      // Update decoration stock directly in the same transaction (only for current sales)
      if (!isHistorical) {
        await connection.execute(
          'UPDATE decorations SET stock_quantity = stock_quantity - ? WHERE id = ?',
          [item.quantity, item.decorationId]
        );
      }
    }

    // Handle returns adjustment for historical sales
    if (isHistorical) {
      for (const item of allocatedItems) {
        // Check if this item exists in returns for the same date
        const saleDate = new Date(saleDateTime).toISOString().split('T')[0];
        const [returnRows] = await connection.execute(
          `SELECT id, quantity FROM returns 
           WHERE product_id = ? AND return_date = ? AND type IN ('GRM', 'GVN')
           ORDER BY id ASC`,
          [item.productId, saleDate]
        );

        if (returnRows.length > 0) {
          // Reduce the return quantity
          let remainingQuantity = item.quantity;
          for (const returnRow of returnRows) {
            if (remainingQuantity <= 0) break;
            
            const returnQuantity = Number(returnRow.quantity);
            const reduction = Math.min(remainingQuantity, returnQuantity);
            
            if (reduction >= returnQuantity) {
              // Remove the entire return record
              await connection.execute(
                'DELETE FROM returns WHERE id = ?',
                [returnRow.id]
              );
            } else {
              // Reduce the return quantity
              await connection.execute(
                'UPDATE returns SET quantity = quantity - ? WHERE id = ?',
                [reduction, returnRow.id]
              );
            }
            
            remainingQuantity -= reduction;
          }
        }
      }
    }
    }

    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    console.log('Error occurred, saleId value:', saleId);
    console.log('Error details:', error);
    await connection.rollback();
    res.status(500).json({ success: false, error: error.message || 'Failed to record sale' });
  } finally {
    connection.release();
  }
};

// Get Sales Summary for a specific date - calculated from invoices and credit notes
const getSalesSummary = async (req, res) => {
  try {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Return demo data if demo user
    if (req.isDemo) {
      const demoSales = getDemoData('sales');
      const filteredSales = demoSales.filter(sale => new Date(sale.sale_date).toISOString().split('T')[0] === date);
      
      const totalTransactions = filteredSales.length;
      const totalSales = filteredSales.reduce((sum, sale) => sum + sale.total_amount, 0);
      const totalItems = filteredSales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
      const cashSales = filteredSales.filter(s => s.payment_type === 'cash').reduce((sum, s) => sum + s.total_amount, 0);
      const upiSales = filteredSales.filter(s => s.payment_type === 'upi').reduce((sum, s) => sum + s.total_amount, 0);

      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res.json({
        success: true,
        summary: {
          totalTransactions,
          totalItems,
          totalSales,
          cashSales,
          upiSales
        }
      });
    }

    // Fetch invoices for the date
    const [invoices] = await db.execute(
      `SELECT id, total_amount FROM invoices 
       WHERE DATE(invoice_date) = ?`,
      [date]
    );

    // Fetch credit notes with return date matching the invoice date
    const [creditNotes] = await db.execute(
      `SELECT id, items FROM credit_notes 
       WHERE DATE(return_date) = ? OR DATE(date) = ?`,
      [date, date]
    );

    // Fetch all products to get categories and MRP (sale_price)
    const [products] = await db.execute(
      `SELECT id, item_code, name, category, sale_price FROM products WHERE is_active = 1`
    );

    // Create a map of product name to product info (for category and MRP)
    const productMap = new Map();
    products.forEach(p => {
      productMap.set(p.name, {
        category: p.category,
        mrp: p.sale_price,
        item_code: p.item_code
      });
    });

    // Check if we have invoices
    if (invoices.length === 0) {
      return res.json({
        success: true,
        summary: {
          totalTransactions: 0,
          totalItems: 0,
          totalSales: 0,
          cashSales: 0,
          upiSales: 0
        },
        message: `Sales not Available for ${date}`,
        reason: 'Invoice not available'
      });
    }

    // Calculate total sales from invoices minus credit notes
    let totalSales = 0;
    let totalItems = 0;
    let totalTransactions = 0;

    // Parse credit note items into a map for easy lookup
    const creditNoteItemsMap = new Map();
    creditNotes.forEach(cn => {
      let items;
      try {
        items = typeof cn.items === 'string' ? JSON.parse(cn.items) : cn.items;
        if (Array.isArray(items)) {
          items.forEach(item => {
            // Try multiple field names for matching
            const key = item.itemCode || item.description || item.item_name || item.name;
            if (key) {
              const existing = creditNoteItemsMap.get(key) || { quantity: 0 };
              creditNoteItemsMap.set(key, {
                quantity: existing.quantity + (item.quantity || 0),
                total: (existing.total || 0) + (item.total || 0)
              });
            }
          });
        }
      } catch (e) {
        console.warn(`Failed to parse credit note items for CN ${cn.id}:`, e);
      }
    });

    // Process each invoice
    for (const invoice of invoices) {
      // Fetch invoice items
      const [invoiceItems] = await db.execute(
        `SELECT item_name, qty, rate, total FROM invoice_items 
         WHERE invoice_id = ?`,
        [invoice.id]
      );

      let invoiceTotal = 0;
      let invoiceItemsSold = 0;

      // Calculate sold items (invoice items - credit note items)
      invoiceItems.forEach(item => {
        const key = item.item_name;
        const productInfo = productMap.get(key);
        
        // Skip items that don't exist in products or are in excluded categories
        if (!productInfo) {
          return;
        }
        
        if (productInfo.category === 'packing_material') {
          return;
        }
        
        // Try matching by name first, then by item_code
        let creditNoteItem = creditNoteItemsMap.get(key);
        if (!creditNoteItem && productInfo.item_code) {
          creditNoteItem = creditNoteItemsMap.get(productInfo.item_code);
        }
        
        const creditNoteQty = creditNoteItem ? creditNoteItem.quantity : 0;
        const soldQty = Math.max(0, item.qty - creditNoteQty);
        
        if (soldQty > 0) {
          // Compute MRP from invoice rate at time of sale (not current product MRP)
          // This ensures historical sales use the correct MRP for that time period
          const roundUpToNearest5 = (value) => {
            const remainder = value % 5;
            return remainder === 0 ? value : value + (5 - remainder);
          };
          
          const computeMrp = (invoicePrice) => {
            const increased = invoicePrice * 1.33; // +33%
            return roundUpToNearest5(Math.ceil(increased));
          };
          
          const mrp = computeMrp(item.rate);
          const soldTotal = mrp * soldQty;
          invoiceTotal += soldTotal;
          invoiceItemsSold += soldQty;
        }
      });

      if (invoiceItemsSold > 0) {
        totalSales += invoiceTotal;
        totalItems += invoiceItemsSold;
        totalTransactions += 1;
      }
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      success: true,
      summary: {
        totalTransactions,
        totalItems,
        totalSales,
        cashSales: 0, // Not available from invoices
        upiSales: 0   // Not available from invoices
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch summary' });
  }
};

// Get Sales by Date with detailed breakdown - calculated from invoices and credit notes
const getSalesByDate = async (req, res) => {
  try {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    console.log(`🔍 getSalesByDate called with date: ${date}`);

    // Return demo data if demo user
    if (req.isDemo) {
      const demoSales = getDemoData('sales');
      const filteredSales = demoSales.filter(sale => {
        const saleDate = new Date(sale.sale_date).toISOString().split('T')[0];
        return saleDate === date;
      });
      
      // Transform demo sales to match the expected format with item codes and decoration details
      const transformedSales = filteredSales.map(sale => {
        const itemsWithDetails = sale.items.map(item => {
          if (item.item_type === 'decoration') {
            const decoration = demoData.decorations.find(d => d.id === item.item_id);
            return {
              ...item,
              item_code: decoration?.sku || null,
              hsn_code: null,
              decoration_sku: decoration?.sku || null,
              decoration_category: decoration?.category || null,
              is_decoration: true
            };
          } else {
            const product = demoData.products.find(p => p.id === item.item_id);
            return {
              ...item,
              item_code: product?.item_code || null,
              hsn_code: product?.hsn_code || null,
              decoration_sku: null,
              decoration_category: null,
              is_decoration: false
            };
          }
        });
        
        return {
          ...sale,
          items: itemsWithDetails
        };
      });
      
      const summary = {
        totalQuantity: transformedSales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0),
        totalValue: transformedSales.reduce((sum, sale) => sum + sale.total_amount, 0),
        totalTransactions: transformedSales.length
      };

      return res.json({ success: true, data: transformedSales, summary });
    }

    // Fetch invoices for the date
    const [invoices] = await db.execute(
      `SELECT id, invoice_number, invoice_date, total_amount FROM invoices 
       WHERE DATE(invoice_date) = ?`,
      [date]
    );

    // Fetch credit notes with return date matching the invoice date
    const [creditNotes] = await db.execute(
      `SELECT id, credit_note_number, date, return_date, items FROM credit_notes 
       WHERE DATE(return_date) = ? OR DATE(date) = ?`,
      [date, date]
    );

    // Fetch all products to get categories and MRP (sale_price)
    const [products] = await db.execute(
      `SELECT id, item_code, name, category, sale_price FROM products WHERE is_active = 1`
    );

    // Create a map of product name to product info (for category and MRP)
    const productMap = new Map();
    products.forEach(p => {
      productMap.set(p.name, {
        category: p.category,
        mrp: p.sale_price,
        item_code: p.item_code
      });
    });

    // Check if we have invoices
    if (invoices.length === 0) {
      return res.json({ 
        success: true, 
        data: [], 
        summary: {
          totalQuantity: 0, 
          totalValue: 0,
          totalTransactions: 0
        },
        message: `Sales not Available for ${date}`,
        reason: 'Invoice not available'
      });
    }

    // Calculate sales from invoices minus credit notes
    const salesData = [];
    let totalQuantity = 0;
    let totalValue = 0;

    // Parse credit note items into a map for easy lookup
    const creditNoteItemsMap = new Map();
    console.log(`Found ${creditNotes.length} credit notes for date ${date}`);
    creditNotes.forEach(cn => {
      console.log(`Processing credit note ${cn.id}, date: ${cn.date}, return_date: ${cn.return_date}`);
      let items;
      try {
        items = typeof cn.items === 'string' ? JSON.parse(cn.items) : cn.items;
        console.log(`Credit note ${cn.id} items:`, items);
        if (Array.isArray(items)) {
          items.forEach(item => {
            // Try multiple field names for matching
            const key = item.itemCode || item.description || item.item_name || item.name;
            console.log(`Credit note item key: ${key}, item:`, item);
            if (key) {
              const existing = creditNoteItemsMap.get(key) || { quantity: 0 };
              creditNoteItemsMap.set(key, {
                quantity: existing.quantity + (item.quantity || 0),
                total: (existing.total || 0) + (item.total || 0)
              });
              console.log(`Credit note item: ${key}, qty: ${item.quantity}`);
            }
          });
        }
      } catch (e) {
        console.warn(`Failed to parse credit note items for CN ${cn.id}:`, e);
      }
    });

    console.log('Credit note items map:', Array.from(creditNoteItemsMap.entries()));

    // Process each invoice
    for (const invoice of invoices) {
      // Fetch invoice items
      const [invoiceItems] = await db.execute(
        `SELECT item_name, qty, rate, total FROM invoice_items 
         WHERE invoice_id = ?`,
        [invoice.id]
      );

      const saleItems = [];
      let invoiceTotal = 0;

      // Calculate sold items (invoice items - credit note items)
      invoiceItems.forEach(item => {
        const key = item.item_name;
        const productInfo = productMap.get(key);
        
        console.log(`Invoice item: ${key}, qty: ${item.qty}`);
        
        // Skip items that don't exist in products or are in excluded categories
        if (!productInfo) {
          console.log(`Skipping item ${key}: not found in products`);
          return;
        }
        
        if (productInfo.category === 'packing_material') {
          console.log(`Skipping item ${key}: category is ${productInfo.category}`);
          return;
        }
        
        // Try matching by name first, then by item_code
        let creditNoteItem = creditNoteItemsMap.get(key);
        if (!creditNoteItem && productInfo.item_code) {
          creditNoteItem = creditNoteItemsMap.get(productInfo.item_code);
          console.log(`Trying item_code match for ${key}: ${productInfo.item_code}`);
        }
        
        const creditNoteQty = creditNoteItem ? creditNoteItem.quantity : 0;
        console.log(`Credit note match for ${key}:`, creditNoteItem ? `qty ${creditNoteQty}` : 'none');
        
        const soldQty = Math.max(0, item.qty - creditNoteQty);
        console.log(`Sold qty for ${key}: ${item.qty} - ${creditNoteQty} = ${soldQty}`);
        
        if (soldQty > 0) {
          // Compute MRP from invoice rate at time of sale (not current product MRP)
          // This ensures historical sales use the correct MRP for that time period
          const roundUpToNearest5 = (value) => {
            const remainder = value % 5;
            return remainder === 0 ? value : value + (5 - remainder);
          };
          
          const computeMrp = (invoicePrice) => {
            const increased = invoicePrice * 1.33; // +33%
            return roundUpToNearest5(Math.ceil(increased));
          };
          
          const mrp = computeMrp(item.rate);
          const soldTotal = mrp * soldQty;
          console.log(`Using MRP computed from invoice rate: ${item.rate} -> ${mrp}`);
          
          saleItems.push({
            id: item.item_name,
            product_id: null,
            batch_id: null,
            quantity: soldQty,
            unit_price: mrp,
            total_price: soldTotal,
            name: item.item_name,
            item_code: null,
            hsn_code: null,
            decoration_sku: null,
            decoration_category: null,
            is_decoration: false
          });
          invoiceTotal += soldTotal;
          totalQuantity += soldQty;
        }
      });

      if (saleItems.length > 0) {
        salesData.push({
          id: invoice.id,
          sale_date: invoice.invoice_date,
          total_amount: invoiceTotal,
          payment_type: null, // Optional - can be added later
          items: saleItems
        });
        totalValue += invoiceTotal;
      }
    }

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
    console.error('Error in getSalesByDate:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch sales' });
  }
};

// Get Monthly Sales Data - calculated from invoices and credit notes
const getMonthlySales = async (req, res) => {
  try {
    const { month } = req.params;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, error: 'Invalid month format. Use YYYY-MM' });
    }

    // Return demo data if demo user
    if (req.isDemo) {
      const demoSales = getDemoData('sales');
      const demoProducts = getDemoData('products');
      
      const filteredSales = demoSales.filter(sale => {
        const saleMonth = new Date(sale.sale_date).toISOString().slice(0, 7);
        return saleMonth === month;
      });
      
      const salesMap = new Map();
      filteredSales.forEach(sale => {
        if (!salesMap.has(sale.id)) {
          salesMap.set(sale.id, {
            sale_id: sale.id,
            sale_date: sale.sale_date,
            total_amount: sale.total_amount,
            payment_type: sale.payment_type,
            items: []
          });
        }
        sale.items.forEach(item => {
          const product = demoProducts.find(p => p.id === item.item_id);
          salesMap.get(sale.id).items.push({
            item_id: item.item_id,
            product_id: item.item_id,
            batch_id: item.batch_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            name: item.name,
            item_type: 'product',
            item_code: product?.item_code || 'DEMO',
            hsn_code: product?.hsn_code || '19059010'
          });
        });
      });
      
      return res.json({ 
        success: true, 
        data: Array.from(salesMap.values()),
        summary: {
          totalQuantity: filteredSales.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.quantity, 0), 0),
          totalValue: filteredSales.reduce((sum, s) => sum + s.total_amount, 0),
          totalTransactions: filteredSales.length
        }
      });
    }

    // Fetch invoices for the month
    const [invoices] = await db.execute(
      `SELECT id, invoice_number, invoice_date, total_amount FROM invoices 
       WHERE DATE_FORMAT(invoice_date, '%Y-%m') = ?`,
      [month]
    );

    // Fetch credit notes with return date in the month
    const [creditNotes] = await db.execute(
      `SELECT id, credit_note_number, date, return_date, items FROM credit_notes 
       WHERE DATE_FORMAT(return_date, '%Y-%m') = ? OR DATE_FORMAT(date, '%Y-%m') = ?`,
      [month, month]
    );

    // Fetch all products to get categories and MRP (sale_price)
    const [products] = await db.execute(
      `SELECT id, item_code, name, category, sale_price FROM products WHERE is_active = 1`
    );

    // Create a map of product name to product info (for category and MRP)
    const productMap = new Map();
    products.forEach(p => {
      productMap.set(p.name, {
        category: p.category,
        mrp: p.sale_price,
        item_code: p.item_code
      });
    });

    if (invoices.length === 0) {
      return res.json({ 
        success: true, 
        data: [], 
        summary: {
          totalQuantity: 0, 
          totalValue: 0,
          totalTransactions: 0
        },
        message: `No invoices found for ${month}`
      });
    }

    // Parse credit note items into a map for easy lookup
    const creditNoteItemsMap = new Map();
    creditNotes.forEach(cn => {
      let items;
      try {
        items = typeof cn.items === 'string' ? JSON.parse(cn.items) : cn.items;
        if (Array.isArray(items)) {
          items.forEach(item => {
            const key = item.itemCode || item.description;
            if (key) {
              const existing = creditNoteItemsMap.get(key) || { quantity: 0 };
              creditNoteItemsMap.set(key, {
                quantity: existing.quantity + (item.quantity || 0),
                total: (existing.total || 0) + (item.total || 0)
              });
            }
          });
        }
      } catch (e) {
        console.warn(`Failed to parse credit note items for CN ${cn.id}:`, e);
      }
    });

    // Calculate sales from invoices minus credit notes
    const salesData = [];
    let totalQuantity = 0;
    let totalValue = 0;

    // Process each invoice
    for (const invoice of invoices) {
      try {
        // Fetch invoice items
        const [invoiceItems] = await db.execute(
          `SELECT item_name, qty, rate, total FROM invoice_items 
           WHERE invoice_id = ?`,
          [invoice.id]
        );

        const saleItems = [];
        let invoiceTotal = 0;

        // Calculate sold items (invoice items - credit note items)
        invoiceItems.forEach(item => {
          const key = item.item_name;
          const productInfo = productMap.get(key);
          
          // Skip items that don't exist in products or are in excluded categories
          if (!productInfo) {
            console.log(`Skipping item ${key}: not found in products`);
            return;
          }
          
          if (productInfo.category === 'packing_material') {
            console.log(`Skipping item ${key}: category is ${productInfo.category}`);
            return;
          }
          
          // Try matching by name first, then by item_code
          let creditNoteItem = creditNoteItemsMap.get(key);
          if (!creditNoteItem && productInfo.item_code) {
            creditNoteItem = creditNoteItemsMap.get(productInfo.item_code);
          }
          
          const creditNoteQty = creditNoteItem ? creditNoteItem.quantity : 0;
          const soldQty = Math.max(0, item.qty - creditNoteQty);
          
          if (soldQty > 0) {
            // Compute MRP from invoice rate at time of sale (not current product MRP)
            // This ensures historical sales use the correct MRP for that time period
            const roundUpToNearest5 = (value) => {
              const remainder = value % 5;
              return remainder === 0 ? value : value + (5 - remainder);
            };
            
            const computeMrp = (invoicePrice) => {
              const increased = invoicePrice * 1.33; // +33%
              return roundUpToNearest5(Math.ceil(increased));
            };
            
            const mrp = computeMrp(item.rate);
            const soldTotal = mrp * soldQty;
            
            saleItems.push({
              id: item.item_name,
              product_id: null,
              batch_id: null,
              quantity: soldQty,
              unit_price: mrp,
              total_price: soldTotal,
              name: item.item_name,
              item_code: null,
              hsn_code: null,
              decoration_sku: null,
              decoration_category: null,
              is_decoration: false
            });
            invoiceTotal += soldTotal;
            totalQuantity += soldQty;
          }
        });

        if (saleItems.length > 0) {
          salesData.push({
            id: invoice.id,
            sale_date: invoice.invoice_date,
            total_amount: invoiceTotal,
            payment_type: null,
            items: saleItems
          });
          totalValue += invoiceTotal;
        }
      } catch (error) {
        console.error(`Error processing invoice ${invoice.id}:`, error);
        // Continue with next invoice even if this one fails
      }
    }

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
    
    // Return demo data if demo user
    if (req.isDemo) {
      const demoSales = getDemoData('sales');
      const demoProducts = getDemoData('products');
      
      const filteredSales = demoSales.filter(sale => {
        const saleMonth = new Date(sale.sale_date).toISOString().slice(0, 7);
        return saleMonth === month;
      });
      
      const currentTotalTransactions = filteredSales.length;
      const currentTotalSales = filteredSales.reduce((sum, s) => sum + s.total_amount, 0);
      const currentTotalItems = filteredSales.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.quantity, 0), 0);
      
      // Calculate previous year data (mock)
      const previousTotalTransactions = Math.floor(currentTotalTransactions * 0.8);
      const previousTotalSales = Math.floor(currentTotalSales * 0.75);
      const previousTotalItems = Math.floor(currentTotalItems * 0.8);
      
      // Calculate last month data (mock)
      const lastMonthTotalTransactions = Math.floor(currentTotalTransactions * 0.9);
      const lastMonthTotalSales = Math.floor(currentTotalSales * 0.85);
      const lastMonthTotalItems = Math.floor(currentTotalItems * 0.9);
      
      // Calculate growth percentages
      const revenueGrowth = previousTotalSales > 0 ? ((currentTotalSales - previousTotalSales) / previousTotalSales * 100).toFixed(1) : 0;
      const transactionsGrowth = previousTotalTransactions > 0 ? ((currentTotalTransactions - previousTotalTransactions) / previousTotalTransactions * 100).toFixed(1) : 0;
      const itemsGrowth = previousTotalItems > 0 ? ((currentTotalItems - previousTotalItems) / previousTotalItems * 100).toFixed(1) : 0;
      
      const lastMonthRevenueGrowth = lastMonthTotalSales > 0 ? ((currentTotalSales - lastMonthTotalSales) / lastMonthTotalSales * 100).toFixed(1) : 0;
      const lastMonthTransactionsGrowth = lastMonthTotalTransactions > 0 ? ((currentTotalTransactions - lastMonthTotalTransactions) / lastMonthTotalTransactions * 100).toFixed(1) : 0;
      const lastMonthItemsGrowth = lastMonthTotalItems > 0 ? ((currentTotalItems - lastMonthTotalItems) / lastMonthTotalItems * 100).toFixed(1) : 0;
      
      // Get most sold items
      const itemStats = new Map();
      filteredSales.forEach(sale => {
        sale.items.forEach(item => {
          if (!itemStats.has(item.name)) {
            itemStats.set(item.name, {
              productName: item.name,
              itemCode: item.item_code || 'DEMO',
              totalQuantity: 0,
              totalRevenue: 0,
              transactionCount: 0
            });
          }
          const stat = itemStats.get(item.name);
          stat.totalQuantity += item.quantity;
          stat.totalRevenue += item.total_price;
          stat.transactionCount += 1;
        });
      });
      
      const mostSoldItems = Array.from(itemStats.values())
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 10);
      
      return res.json({
        success: true,
        data: {
          current: {
            month,
            totalTransactions: currentTotalTransactions,
            totalSales: currentTotalSales,
            totalItems: currentTotalItems
          },
          previous: {
            month: `${parseInt(month.split('-')[0]) - 1}-${month.split('-')[1]}`,
            totalTransactions: previousTotalTransactions,
            totalSales: previousTotalSales,
            totalItems: previousTotalItems
          },
          lastMonth: {
            month: lastMonthStr2 || month,
            totalTransactions: lastMonthTotalTransactions,
            totalSales: lastMonthTotalSales,
            totalItems: lastMonthTotalItems
          },
          growth: {
            revenue: parseFloat(revenueGrowth),
            transactions: parseFloat(transactionsGrowth),
            items: parseFloat(itemsGrowth)
          },
          lastMonthGrowth: {
            revenue: parseFloat(lastMonthRevenueGrowth),
            transactions: parseFloat(lastMonthTransactionsGrowth),
            items: parseFloat(lastMonthItemsGrowth)
          },
          mostSoldItems
        }
      });
    }
    
    // Default to previous year if year not provided
    const comparisonYear = year ? parseInt(year) : new Date().getFullYear() - 1;

    // Parse month correctly (month is in YYYY-MM format)
    const [currentYear, monthNum] = month.split('-');
    const currentDate = new Date(parseInt(currentYear), parseInt(monthNum) - 1, 1); // monthNum - 1 because JS months are 0-indexed
    
    // Create previous year month using the same month number as current
    const previousYearMonth = `${comparisonYear}-${monthNum}`;
    const previousYear = new Date(comparisonYear, parseInt(monthNum) - 1, 1);
    
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
    
    // Get current month sales summary from invoices (not sales table)
    // Get current month invoice items to calculate MRP-based sales
    const [currentInvoiceItems] = await db.execute(`
      SELECT 
        ii.qty,
        ii.rate,
        ii.total
      FROM invoices i
      JOIN invoice_items ii ON i.id = ii.invoice_id
      WHERE DATE_FORMAT(i.invoice_date, '%Y-%m') = ?
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

    let currentMRPTotal = 0;
    let currentCostTotal = 0;
    let currentTotalItems = 0;
    let currentTotalTransactions = 0;

    // Get transaction count
    const [currentTransCount] = await db.execute(`
      SELECT COUNT(DISTINCT i.id) as totalTransactions
      FROM invoices i
      WHERE DATE_FORMAT(i.invoice_date, '%Y-%m') = ?
    `, [month]);
    currentTotalTransactions = Number(currentTransCount[0].totalTransactions);

    // Calculate MRP totals from invoice items
    currentInvoiceItems.forEach(item => {
      const mrp = computeMrp(item.rate);
      const mrpTotal = mrp * item.qty;
      const costTotal = item.total; // invoice total is at cost price
      
      currentMRPTotal += mrpTotal;
      currentCostTotal += costTotal;
      currentTotalItems += item.qty;
    });

    // Get credit notes total for current month
    const [currentCreditNotes] = await db.execute(`
      SELECT 
        COALESCE(SUM(gross_value), 0) as totalCreditNotes
      FROM credit_notes
      WHERE DATE_FORMAT(date, '%Y-%m') = ?
    `, [month]);

    // Calculate net sales (MRP total - credit notes)
    const currentNetSales = currentMRPTotal - Number(currentCreditNotes[0].totalCreditNotes);

    // Get previous year invoice items to calculate MRP-based sales
    const [previousInvoiceItems] = await db.execute(`
      SELECT 
        ii.qty,
        ii.rate,
        ii.total
      FROM invoices i
      JOIN invoice_items ii ON i.id = ii.invoice_id
      WHERE DATE_FORMAT(i.invoice_date, '%Y-%m') = ?
    `, [previousYearMonth]);

    let previousMRPTotal = 0;
    let previousCostTotal = 0;
    let previousTotalItems = 0;
    let previousTotalTransactions = 0;

    // Get transaction count for previous year
    const [previousTransCount] = await db.execute(`
      SELECT COUNT(DISTINCT i.id) as totalTransactions
      FROM invoices i
      WHERE DATE_FORMAT(i.invoice_date, '%Y-%m') = ?
    `, [previousYearMonth]);
    previousTotalTransactions = Number(previousTransCount[0].totalTransactions);

    // Calculate MRP totals from invoice items for previous year
    previousInvoiceItems.forEach(item => {
      const mrp = computeMrp(item.rate);
      const mrpTotal = mrp * item.qty;
      const costTotal = item.total;
      
      previousMRPTotal += mrpTotal;
      previousCostTotal += costTotal;
      previousTotalItems += item.qty;
    });

    // Get credit notes total for previous year month
    const [previousCreditNotes] = await db.execute(`
      SELECT 
        COALESCE(SUM(gross_value), 0) as totalCreditNotes
      FROM credit_notes
      WHERE DATE_FORMAT(date, '%Y-%m') = ?
    `, [previousYearMonth]);

    // Calculate net sales for previous year (MRP total - credit notes)
    const previousNetSales = previousMRPTotal - Number(previousCreditNotes[0].totalCreditNotes);

    // Get last month invoice items to calculate MRP-based sales
    const [lastMonthInvoiceItems] = await db.execute(`
      SELECT 
        ii.qty,
        ii.rate,
        ii.total
      FROM invoices i
      JOIN invoice_items ii ON i.id = ii.invoice_id
      WHERE DATE_FORMAT(i.invoice_date, '%Y-%m') = ?
    `, [lastMonthStr2]);

    let lastMonthMRPTotal = 0;
    let lastMonthCostTotal = 0;
    let lastMonthTotalItems = 0;
    let lastMonthTotalTransactions = 0;

    // Get transaction count for last month
    const [lastMonthTransCount] = await db.execute(`
      SELECT COUNT(DISTINCT i.id) as totalTransactions
      FROM invoices i
      WHERE DATE_FORMAT(i.invoice_date, '%Y-%m') = ?
    `, [lastMonthStr2]);
    lastMonthTotalTransactions = Number(lastMonthTransCount[0].totalTransactions);

    // Calculate MRP totals from invoice items for last month
    lastMonthInvoiceItems.forEach(item => {
      const mrp = computeMrp(item.rate);
      const mrpTotal = mrp * item.qty;
      const costTotal = item.total;
      
      lastMonthMRPTotal += mrpTotal;
      lastMonthCostTotal += costTotal;
      lastMonthTotalItems += item.qty;
    });

    // Get credit notes total for last month
    const [lastMonthCreditNotes] = await db.execute(`
      SELECT 
        COALESCE(SUM(gross_value), 0) as totalCreditNotes
      FROM credit_notes
      WHERE DATE_FORMAT(date, '%Y-%m') = ?
    `, [lastMonthStr2]);

    // Calculate net sales for last month (MRP total - credit notes)
    const lastMonthNetSales = lastMonthMRPTotal - Number(lastMonthCreditNotes[0].totalCreditNotes);
    
    // Debug: Check what months have data
    const [availableMonths] = await db.execute(`
      SELECT DISTINCT DATE_FORMAT(sale_date, '%Y-%m') as month
      FROM sales 
      ORDER BY month DESC
      LIMIT 12
    `);

    // Get most sold items for current month from invoices
    const [mostSoldItems] = await db.execute(`
      SELECT 
        ii.item_name as productName,
        ii.item_code,
        SUM(ii.qty) as totalQuantity,
        SUM(ii.total) as totalRevenue,
        COUNT(DISTINCT i.id) as transactionCount
      FROM invoices i
      JOIN invoice_items ii ON i.id = ii.invoice_id
      WHERE DATE_FORMAT(i.invoice_date, '%Y-%m') = ?
      GROUP BY ii.item_name, ii.item_code
      ORDER BY totalQuantity DESC
      LIMIT 10
    `, [month]);

    // Calculate growth percentages using net sales
    const revenueGrowth = previousNetSales > 0 
      ? ((currentNetSales - previousNetSales) / previousNetSales) * 100 
      : currentNetSales > 0 ? 100 : 0; // If previous is 0 but current has data, show 100% growth
    
    const transactionGrowth = previousTotalTransactions > 0 
      ? ((currentTotalTransactions - previousTotalTransactions) / previousTotalTransactions) * 100 
      : currentTotalTransactions > 0 ? 100 : 0;
    
    const itemsGrowth = previousTotalItems > 0 
      ? ((currentTotalItems - previousTotalItems) / previousTotalItems) * 100 
      : currentTotalItems > 0 ? 100 : 0;

    const lastMonthRevenueGrowth = lastMonthNetSales > 0 
      ? ((currentNetSales - lastMonthNetSales) / lastMonthNetSales) * 100 
      : currentNetSales > 0 ? 100 : 0;
    
    const lastMonthTransactionGrowth = lastMonthTotalTransactions > 0 
      ? ((currentTotalTransactions - lastMonthTotalTransactions) / lastMonthTotalTransactions) * 100 
      : currentTotalTransactions > 0 ? 100 : 0;
    
    const lastMonthItemsGrowth = lastMonthTotalItems > 0 
      ? ((currentTotalItems - lastMonthTotalItems) / lastMonthTotalItems) * 100 
      : currentTotalItems > 0 ? 100 : 0;

    res.json({
      success: true,
      data: {
        current: {
          month: month,
          totalTransactions: currentTotalTransactions,
          totalSales: currentNetSales,
          totalItems: currentTotalItems
        },
        previous: {
          month: previousYearMonth,
          totalTransactions: previousTotalTransactions,
          totalSales: previousNetSales,
          totalItems: previousTotalItems
        },
        lastMonth: {
          month: lastMonthStr2,
          totalTransactions: lastMonthTotalTransactions,
          totalSales: lastMonthNetSales,
          totalItems: lastMonthTotalItems
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

    // YTD from invoices - calculate MRP-based sales
    const [ytdInvoiceItems] = await db.execute(`
      SELECT 
        ii.qty,
        ii.rate,
        ii.total
      FROM invoices i
      JOIN invoice_items ii ON i.id = ii.invoice_id
      WHERE DATE(i.invoice_date) BETWEEN ? AND ? AND YEAR(i.invoice_date) = ?
    `, [ytdStartDate, ytdEndDate, currentYear]);

    // Calculate MRP from invoice rates (rate * 1.33 rounded to nearest 5)
    const roundUpToNearest5 = (value) => {
      const remainder = value % 5;
      return remainder === 0 ? value : value + (5 - remainder);
    };
    
    const computeMrp = (invoicePrice) => {
      const increased = invoicePrice * 1.33; // +33%
      return roundUpToNearest5(Math.ceil(increased));
    };

    let ytdMRPTotal = 0;
    let ytdTotalTransactions = 0;
    let ytdTotalItems = 0;

    // Get transaction count for YTD
    const [ytdTransCount] = await db.execute(`
      SELECT COUNT(DISTINCT i.id) as totalTransactions
      FROM invoices i
      WHERE DATE(i.invoice_date) BETWEEN ? AND ? AND YEAR(i.invoice_date) = ?
    `, [ytdStartDate, ytdEndDate, currentYear]);
    ytdTotalTransactions = Number(ytdTransCount[0].totalTransactions);

    // Calculate MRP totals from invoice items for YTD
    ytdInvoiceItems.forEach(item => {
      const mrp = computeMrp(item.rate);
      const mrpTotal = mrp * item.qty;
      ytdMRPTotal += mrpTotal;
      ytdTotalItems += item.qty;
    });
    
    // Get credit notes for YTD
    const [creditNotesYTD] = await db.execute(`
      SELECT COALESCE(SUM(gross_value), 0) as totalCreditNotes
      FROM credit_notes
      WHERE DATE(date) BETWEEN ? AND ? AND YEAR(date) = ?
    `, [ytdStartDate, ytdEndDate, currentYear]);
    
    const currentYTDNetSales = ytdMRPTotal - Number(creditNotesYTD[0].totalCreditNotes);
    
    // MTD - calculate MRP-based sales
    const [mtdInvoiceItems] = await db.execute(`
      SELECT 
        ii.qty,
        ii.rate,
        ii.total
      FROM invoices i
      JOIN invoice_items ii ON i.id = ii.invoice_id
      WHERE DATE(i.invoice_date) BETWEEN ? AND ? AND YEAR(i.invoice_date) = ?
    `, [mtdStartDate, mtdEndDate, currentYear]);

    let mtdMRPTotal = 0;
    let mtdTotalTransactions = 0;
    let mtdTotalItems = 0;

    // Get transaction count for MTD
    const [mtdTransCount] = await db.execute(`
      SELECT COUNT(DISTINCT i.id) as totalTransactions
      FROM invoices i
      WHERE DATE(i.invoice_date) BETWEEN ? AND ? AND YEAR(i.invoice_date) = ?
    `, [mtdStartDate, mtdEndDate, currentYear]);
    mtdTotalTransactions = Number(mtdTransCount[0].totalTransactions);

    // Calculate MRP totals from invoice items for MTD
    mtdInvoiceItems.forEach(item => {
      const mrp = computeMrp(item.rate);
      const mrpTotal = mrp * item.qty;
      mtdMRPTotal += mrpTotal;
      mtdTotalItems += item.qty;
    });
    
    // Get credit notes for MTD
    const [creditNotesMTD] = await db.execute(`
      SELECT COALESCE(SUM(gross_value), 0) as totalCreditNotes
      FROM credit_notes
      WHERE DATE(date) BETWEEN ? AND ? AND YEAR(date) = ?
    `, [mtdStartDate, mtdEndDate, currentYear]);
    
    const currentMTDNetSales = mtdMRPTotal - Number(creditNotesMTD[0].totalCreditNotes);

    // Previous year YTD - calculate MRP-based sales
    const [prevYtdInvoiceItems] = await db.execute(`
      SELECT 
        ii.qty,
        ii.rate,
        ii.total
      FROM invoices i
      JOIN invoice_items ii ON i.id = ii.invoice_id
      WHERE DATE(i.invoice_date) BETWEEN ? AND ? AND YEAR(i.invoice_date) = ?
    `, [prevYtdStartDate, prevYtdEndDate, previousYear]);

    let prevYtdMRPTotal = 0;
    let prevYtdTotalTransactions = 0;
    let prevYtdTotalItems = 0;

    // Get transaction count for previous year YTD
    const [prevYtdTransCount] = await db.execute(`
      SELECT COUNT(DISTINCT i.id) as totalTransactions
      FROM invoices i
      WHERE DATE(i.invoice_date) BETWEEN ? AND ? AND YEAR(i.invoice_date) = ?
    `, [prevYtdStartDate, prevYtdEndDate, previousYear]);
    prevYtdTotalTransactions = Number(prevYtdTransCount[0].totalTransactions);

    // Calculate MRP totals from invoice items for previous year YTD
    prevYtdInvoiceItems.forEach(item => {
      const mrp = computeMrp(item.rate);
      const mrpTotal = mrp * item.qty;
      prevYtdMRPTotal += mrpTotal;
      prevYtdTotalItems += item.qty;
    });
    
    // Get credit notes for previous year YTD
    const [creditNotesPrevYTD] = await db.execute(`
      SELECT COALESCE(SUM(gross_value), 0) as totalCreditNotes
      FROM credit_notes
      WHERE DATE(date) BETWEEN ? AND ? AND YEAR(date) = ?
    `, [prevYtdStartDate, prevYtdEndDate, previousYear]);
    
    const previousYTDNetSales = prevYtdMRPTotal - Number(creditNotesPrevYTD[0].totalCreditNotes);

    // Previous year MTD - calculate MRP-based sales
    const [prevMtdInvoiceItems] = await db.execute(`
      SELECT 
        ii.qty,
        ii.rate,
        ii.total
      FROM invoices i
      JOIN invoice_items ii ON i.id = ii.invoice_id
      WHERE DATE(i.invoice_date) BETWEEN ? AND ? AND YEAR(i.invoice_date) = ?
    `, [prevMtdStartDate, prevMtdEndDate, previousYear]);

    let prevMtdMRPTotal = 0;
    let prevMtdTotalTransactions = 0;
    let prevMtdTotalItems = 0;

    // Get transaction count for previous year MTD
    const [prevMtdTransCount] = await db.execute(`
      SELECT COUNT(DISTINCT i.id) as totalTransactions
      FROM invoices i
      WHERE DATE(i.invoice_date) BETWEEN ? AND ? AND YEAR(i.invoice_date) = ?
    `, [prevMtdStartDate, prevMtdEndDate, previousYear]);
    prevMtdTotalTransactions = Number(prevMtdTransCount[0].totalTransactions);

    // Calculate MRP totals from invoice items for previous year MTD
    prevMtdInvoiceItems.forEach(item => {
      const mrp = computeMrp(item.rate);
      const mrpTotal = mrp * item.qty;
      prevMtdMRPTotal += mrpTotal;
      prevMtdTotalItems += item.qty;
    });
    
    // Get credit notes for previous year MTD
    const [creditNotesPrevMTD] = await db.execute(`
      SELECT COALESCE(SUM(gross_value), 0) as totalCreditNotes
      FROM credit_notes
      WHERE DATE(date) BETWEEN ? AND ? AND YEAR(date) = ?
    `, [prevMtdStartDate, prevMtdEndDate, previousYear]);
    
    const previousMTDNetSales = prevMtdMRPTotal - Number(creditNotesPrevMTD[0].totalCreditNotes);

    // Populate actual response with correct item totals and net sales (MRP-based)
    const fixedYtdCurrent = {
      totalTransactions: ytdTotalTransactions,
      totalSales: currentYTDNetSales,
      totalItems: ytdTotalItems,
      totalCost: 0,
    };
    const fixedMtdCurrent = {
      totalTransactions: mtdTotalTransactions,
      totalSales: currentMTDNetSales,
      totalItems: mtdTotalItems,
      totalCost: 0,
    };
    const fixedYtdPrevious = {
      totalTransactions: prevYtdTotalTransactions,
      totalSales: previousYTDNetSales,
      totalItems: prevYtdTotalItems,
      totalCost: 0,
    };
    const fixedMtdPrevious = {
      totalTransactions: prevMtdTotalTransactions,
      totalSales: previousMTDNetSales,
      totalItems: prevMtdTotalItems,
      totalCost: 0,
    };

    // Calculate growth percentages using net sales
    const ytdRevenueGrowth = previousYTDNetSales > 0 
      ? ((currentYTDNetSales - previousYTDNetSales) / previousYTDNetSales) * 100 
      : currentYTDNetSales > 0 ? 100 : 0;
    
    const ytdTransactionGrowth = prevYtdTotalTransactions > 0 
      ? ((ytdTotalTransactions - prevYtdTotalTransactions) / prevYtdTotalTransactions) * 100 
      : ytdTotalTransactions > 0 ? 100 : 0;
    
    const ytdItemsGrowth = prevYtdTotalItems > 0 
      ? ((ytdTotalItems - prevYtdTotalItems) / prevYtdTotalItems) * 100 
      : ytdTotalItems > 0 ? 100 : 0;

    const mtdRevenueGrowth = previousMTDNetSales > 0 
      ? ((currentMTDNetSales - previousMTDNetSales) / previousMTDNetSales) * 100 
      : currentMTDNetSales > 0 ? 100 : 0;
    
    const mtdTransactionGrowth = prevMtdTotalTransactions > 0 
      ? ((mtdTotalTransactions - prevMtdTotalTransactions) / prevMtdTotalTransactions) * 100 
      : mtdTotalTransactions > 0 ? 100 : 0;
    
    const mtdItemsGrowth = prevMtdTotalItems > 0 
      ? ((mtdTotalItems - prevMtdTotalItems) / prevMtdTotalItems) * 100 
      : mtdTotalItems > 0 ? 100 : 0;

    res.json({
      success: true,
      data: {
        currentYear,
        previousYear,
        ytd: {
          current: fixedYtdCurrent,
          previous: fixedYtdPrevious,
          growth: {
            revenue: Math.round(ytdRevenueGrowth * 100) / 100,
            transactions: Math.round(ytdTransactionGrowth * 100) / 100,
            items: Math.round(ytdItemsGrowth * 100) / 100
          }
        },
        mtd: {
          current: fixedMtdCurrent,
          previous: fixedMtdPrevious,
          growth: {
            revenue: Math.round(mtdRevenueGrowth * 100) / 100,
            transactions: Math.round(mtdTransactionGrowth * 100) / 100,
            items: Math.round(mtdItemsGrowth * 100) / 100
          }
        }
      }
    });

  } catch (error) {
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
router.get('/summary-accurate/:month', async (req, res) => {
  try {
    const { month } = req.params; // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, error: 'Invalid month format' });
    }
    const [rows] = await db.execute(
      `SELECT COUNT(*) as totalTransactions, COALESCE(SUM(total_amount), 0) as totalSales FROM sales WHERE YEAR(sale_date) = ? AND MONTH(sale_date) = ?`,
      [month.slice(0, 4), month.slice(5, 7)]
    );
    res.json({ success: true, ...rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
router.get('/:date', getSalesByDate);

module.exports = { router, recordSale, getSalesSummary, getSalesByDate, getSalesAnalytics, getMonthlySales, getMonthlySalesAnalytics, getYTDMTDComparison };
