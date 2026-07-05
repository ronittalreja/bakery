// File: backend/middleware/demoMode.js

// Demo data - mock data for demo mode
const demoData = {
  products: [
    { id: 1001, item_code: 'DEMO001', name: 'Demo Chocolate Cake', hsn_code: '19059010', invoice_price: 500, sale_price: 600, grm_value: 250, category: 'Cakes', is_active: 1, image_url: null },
    { id: 1002, item_code: 'DEMO002', name: 'Demo Vanilla Cake', hsn_code: '19059010', invoice_price: 400, sale_price: 480, grm_value: 200, category: 'Cakes', is_active: 1, image_url: null },
    { id: 1003, item_code: 'DEMO003', name: 'Demo Pastries', hsn_code: '19059010', invoice_price: 150, sale_price: 180, grm_value: 75, category: 'Pastries', is_active: 1, image_url: null },
    { id: 1004, item_code: 'DEMO004', name: 'Demo Cookies', hsn_code: '19059010', invoice_price: 200, sale_price: 240, grm_value: 100, category: 'Cookies', is_active: 1, image_url: null },
    { id: 1005, item_code: 'DEMO005', name: 'Demo Bread', hsn_code: '19059010', invoice_price: 50, sale_price: 60, grm_value: 25, category: 'Bread', is_active: 1, image_url: null },
  ],
  stockBatches: [
    { id: 2001, product_id: 1001, quantity: 50, expiry_date: '2026-08-05', invoice_date: '2026-07-05', invoice_reference: 'DEMO-INV-001' },
    { id: 2002, product_id: 1002, quantity: 40, expiry_date: '2026-08-05', invoice_date: '2026-07-05', invoice_reference: 'DEMO-INV-002' },
    { id: 2003, product_id: 1003, quantity: 30, expiry_date: '2026-08-05', invoice_date: '2026-07-05', invoice_reference: 'DEMO-INV-003' },
    { id: 2004, product_id: 1004, quantity: 25, expiry_date: '2026-08-05', invoice_date: '2026-07-05', invoice_reference: 'DEMO-INV-004' },
    { id: 2005, product_id: 1005, quantity: 100, expiry_date: '2026-08-05', invoice_date: '2026-07-05', invoice_reference: 'DEMO-INV-005' },
  ],
  decorations: [
    { id: 3001, sku: 'DECO001', name: 'Demo Ribbon', category: 'Ribbons', cost: 50, sale_price: 80, stock_quantity: 100, is_active: 1 },
    { id: 3002, sku: 'DECO002', name: 'Demo Candle', category: 'Candles', cost: 30, sale_price: 50, stock_quantity: 150, is_active: 1 },
    { id: 3003, sku: 'DECO003', name: 'Demo Box', category: 'Boxes', cost: 40, sale_price: 60, stock_quantity: 200, is_active: 1 },
  ],
  sales: [],
  expenses: [
    { id: 4001, expense_date: '2026-07-05', category: 'Utilities', description: 'Demo electricity bill', amount: 5000, staff_id: 0 },
    { id: 4002, expense_date: '2026-07-04', category: 'Supplies', description: 'Demo flour purchase', amount: 3000, staff_id: 0 },
  ]
};

// Generate demo sales for last 7 days
const generateDemoSales = () => {
  const sales = [];
  const today = new Date();
  
  for (let i = 0; i < 7; i++) {
    const saleDate = new Date(today);
    saleDate.setDate(saleDate.getDate() - i);
    const saleDateTime = saleDate.toISOString().slice(0, 16).replace('T', ' ');
    
    const sale = {
      id: 5000 + i,
      sale_date: saleDateTime,
      total_amount: Math.floor(Math.random() * 5000) + 1000,
      payment_type: ['cash', 'card', 'upi'][Math.floor(Math.random() * 3)],
      staff_id: 0,
      items: []
    };
    
    // Add random items
    const numItems = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < numItems; j++) {
      const randomProduct = demoData.products[Math.floor(Math.random() * demoData.products.length)];
      const quantity = Math.floor(Math.random() * 5) + 1;
      const unitPrice = 100 + Math.floor(Math.random() * 200);
      
      sale.items.push({
        id: 6000 + i * 10 + j,
        sale_id: sale.id,
        item_id: randomProduct.id,
        batch_id: randomProduct.id,
        quantity: quantity,
        unit_price: unitPrice,
        total_price: quantity * unitPrice,
        name: randomProduct.name
      });
    }
    
    sales.push(sale);
  }
  
  return sales;
};

// Middleware to add demo mode flag to request
const demoModeMiddleware = (req, res, next) => {
  const isDemo = req.user?.isDemo || false;
  req.isDemo = isDemo;
  next();
};

// Helper function to get demo data
const getDemoData = (dataType) => {
  if (dataType === 'sales' && demoData.sales.length === 0) {
    demoData.sales = generateDemoSales();
  }
  return demoData[dataType] || [];
};

module.exports = { demoModeMiddleware, getDemoData, demoData };
