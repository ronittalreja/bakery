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
    { id: 2001, product_id: 1001, quantity: 200, expiry_date: '2026-08-05', invoice_date: '2026-07-05', invoice_reference: 'DEMO-INV-001' },
    { id: 2002, product_id: 1002, quantity: 200, expiry_date: '2026-08-05', invoice_date: '2026-07-05', invoice_reference: 'DEMO-INV-002' },
    { id: 2003, product_id: 1003, quantity: 200, expiry_date: '2026-08-05', invoice_date: '2026-07-05', invoice_reference: 'DEMO-INV-003' },
    { id: 2004, product_id: 1004, quantity: 200, expiry_date: '2026-08-05', invoice_date: '2026-07-05', invoice_reference: 'DEMO-INV-004' },
    { id: 2005, product_id: 1005, quantity: 200, expiry_date: '2026-08-05', invoice_date: '2026-07-05', invoice_reference: 'DEMO-INV-005' },
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
  ],
  returns: [
    {
      id: 7001,
      product_id: 1001,
      quantity: 5,
      invoice_price: 500,
      return_date: '2026-07-05',
      type: 'GRM',
      loss_amount: 250,
      batch_id: 2001,
      expiry_date: '2026-08-05'
    },
    {
      id: 7002,
      product_id: 1002,
      quantity: 3,
      invoice_price: 400,
      return_date: '2026-07-05',
      type: 'GVN',
      loss_amount: 120,
      batch_id: 2002,
      expiry_date: '2026-08-05'
    },
    {
      id: 7003,
      product_id: 1003,
      quantity: 4,
      invoice_price: 150,
      return_date: '2026-07-04',
      type: 'GRM',
      loss_amount: 60,
      batch_id: 2003,
      expiry_date: '2026-08-05'
    }
  ],
  creditNotes: [
    {
      id: 1,
      credit_note_number: 'DEMO-CN-001',
      date: '2026-07-05',
      return_date: '2026-07-05',
      receiver_name: 'Demo Customer Pvt Ltd',
      receiver_gstin: 'DEMO123456ABCDE',
      reason: 'EXPIRED GOODS',
      total_items: 5,
      gross_value: 2500,
      net_value: 2125,
      file_name: 'demo-cn-001.pdf',
      original_name: 'demo-cn-001.pdf',
      items: [
        { 
          itemCode: 'DEMO001', 
          itemName: 'Demo Chocolate Cake', 
          hsnCode: '19059010',
          quantity: 2, 
          rate: 500, 
          rtd: 15.00,
          amount: 1000 
        },
        { 
          itemCode: 'DEMO002', 
          itemName: 'Demo Vanilla Cake', 
          hsnCode: '19059010',
          quantity: 3, 
          rate: 500, 
          rtd: 15.00,
          amount: 1500 
        }
      ],
      created_at: '2026-07-05',
      status: 'processed'
    },
    {
      id: 2,
      credit_note_number: 'DEMO-CN-002',
      date: '2026-07-10',
      return_date: '2026-07-10',
      receiver_name: 'Sample Bakery Supplies',
      receiver_gstin: 'SAMPLE98765ZYXWV',
      reason: 'QUALITY ISSUES',
      total_items: 3,
      gross_value: 1440,
      net_value: 1224,
      file_name: 'demo-cn-002.pdf',
      original_name: 'demo-cn-002.pdf',
      items: [
        { 
          itemCode: 'DEMO002', 
          itemName: 'Demo Vanilla Cake', 
          hsnCode: '19059010',
          quantity: 3, 
          rate: 480, 
          rtd: 15.00,
          amount: 1440 
        }
      ],
      created_at: '2026-07-10',
      status: 'processed'
    },
    {
      id: 3,
      credit_note_number: 'DEMO-CN-003',
      date: '2026-07-12',
      return_date: '2026-07-12',
      receiver_name: 'Sweet Delights Bakery',
      receiver_gstin: 'SWEET123456FGHIJ',
      reason: 'EXPIRED GOODS',
      total_items: 4,
      gross_value: 1800,
      net_value: 1530,
      file_name: 'demo-cn-003.pdf',
      original_name: 'demo-cn-003.pdf',
      items: [
        { 
          itemCode: 'DEMO003', 
          itemName: 'Demo Pastries', 
          hsnCode: '19059010',
          quantity: 10, 
          rate: 180, 
          rtd: 15.00,
          amount: 1800 
        }
      ],
      created_at: '2026-07-12',
      status: 'processed'
    },
    {
      id: 4,
      credit_note_number: 'DEMO-CN-004',
      date: '2026-07-15',
      return_date: '2026-07-15',
      receiver_name: 'City Bakery Store',
      receiver_gstin: 'CITY987654KLMNO',
      reason: 'DAMAGED GOODS',
      total_items: 6,
      gross_value: 2400,
      net_value: 2040,
      file_name: 'demo-cn-004.pdf',
      original_name: 'demo-cn-004.pdf',
      items: [
        { 
          itemCode: 'DEMO004', 
          itemName: 'Demo Cookies', 
          hsnCode: '19059010',
          quantity: 10, 
          rate: 240, 
          rtd: 15.00,
          amount: 2400 
        }
      ],
      created_at: '2026-07-15',
      status: 'processed'
    },
    {
      id: 5,
      credit_note_number: 'DEMO-CN-005',
      date: '2026-07-18',
      return_date: '2026-07-18',
      receiver_name: 'Fresh Bakes Ltd',
      receiver_gstin: 'FRESH567890PQRST',
      reason: 'EXPIRED GOODS',
      total_items: 8,
      gross_value: 1200,
      net_value: 1020,
      file_name: 'demo-cn-005.pdf',
      original_name: 'demo-cn-005.pdf',
      items: [
        { 
          itemCode: 'DEMO005', 
          itemName: 'Demo Bread', 
          hsnCode: '19059010',
          quantity: 20, 
          rate: 60, 
          rtd: 15.00,
          amount: 1200 
        }
      ],
      created_at: '2026-07-18',
      status: 'processed'
    },
    {
      id: 6,
      credit_note_number: 'DEMO-CN-006',
      date: '2026-07-20',
      return_date: '2026-07-20',
      receiver_name: 'Royal Bakery Supplies',
      receiver_gstin: 'ROYAL345678UVWXY',
      reason: 'QUALITY ISSUES',
      total_items: 7,
      gross_value: 3000,
      net_value: 2550,
      file_name: 'demo-cn-006.pdf',
      original_name: 'demo-cn-006.pdf',
      items: [
        { 
          itemCode: 'DEMO001', 
          itemName: 'Demo Chocolate Cake', 
          hsnCode: '19059010',
          quantity: 5, 
          rate: 600, 
          rtd: 15.00,
          amount: 3000 
        }
      ],
      created_at: '2026-07-20',
      status: 'processed'
    },
    {
      id: 7,
      credit_note_number: 'DEMO-CN-007',
      date: '2026-07-22',
      return_date: '2026-07-22',
      receiver_name: 'Metro Bakery Mart',
      receiver_gstin: 'METRO901234ZABCD',
      reason: 'EXPIRED GOODS',
      total_items: 5,
      gross_value: 2160,
      net_value: 1836,
      file_name: 'demo-cn-007.pdf',
      original_name: 'demo-cn-007.pdf',
      items: [
        { 
          itemCode: 'DEMO002', 
          itemName: 'Demo Vanilla Cake', 
          hsnCode: '19059010',
          quantity: 5, 
          rate: 432, 
          rtd: 15.00,
          amount: 2160 
        }
      ],
      created_at: '2026-07-22',
      status: 'processed'
    },
    {
      id: 8,
      credit_note_number: 'DEMO-CN-008',
      date: '2026-07-25',
      return_date: '2026-07-25',
      receiver_name: 'Grand Bakery Shop',
      receiver_gstin: 'GRAND789012EFGHI',
      reason: 'DAMAGED GOODS',
      total_items: 9,
      gross_value: 1620,
      net_value: 1377,
      file_name: 'demo-cn-008.pdf',
      original_name: 'demo-cn-008.pdf',
      items: [
        { 
          itemCode: 'DEMO003', 
          itemName: 'Demo Pastries', 
          hsnCode: '19059010',
          quantity: 9, 
          rate: 180, 
          rtd: 15.00,
          amount: 1620 
        }
      ],
      created_at: '2026-07-25',
      status: 'processed'
    },
    {
      id: 9,
      credit_note_number: 'DEMO-CN-009',
      date: '2026-07-28',
      return_date: '2026-07-28',
      receiver_name: 'Premium Bakery Inc',
      receiver_gstin: 'PREMIUM234567JKLM',
      reason: 'EXPIRED GOODS',
      total_items: 10,
      gross_value: 1920,
      net_value: 1632,
      file_name: 'demo-cn-009.pdf',
      original_name: 'demo-cn-009.pdf',
      items: [
        { 
          itemCode: 'DEMO004', 
          itemName: 'Demo Cookies', 
          hsnCode: '19059010',
          quantity: 8, 
          rate: 240, 
          rtd: 15.00,
          amount: 1920 
        }
      ],
      created_at: '2026-07-28',
      status: 'processed'
    },
    {
      id: 10,
      credit_note_number: 'DEMO-CN-010',
      date: '2026-07-30',
      return_date: '2026-07-30',
      receiver_name: 'Local Bakery Store',
      receiver_gstin: 'LOCAL678901MNOPQ',
      reason: 'QUALITY ISSUES',
      total_items: 12,
      gross_value: 1080,
      net_value: 918,
      file_name: 'demo-cn-010.pdf',
      original_name: 'demo-cn-010.pdf',
      items: [
        { 
          itemCode: 'DEMO005', 
          itemName: 'Demo Bread', 
          hsnCode: '19059010',
          quantity: 18, 
          rate: 60, 
          rtd: 15.00,
          amount: 1080 
        }
      ],
      created_at: '2026-07-30',
      status: 'processed'
    }
  ],
  payments: [
    {
      id: 1,
      invoice_number: 'DEMO-INV-001',
      invoice_date: '2026-07-05',
      customer_name: 'Demo Customer',
      total_amount: 5000,
      paid_amount: 3000,
      balance: 2000,
      payment_type: 'partial'
    },
    {
      id: 2,
      credit_note_number: 'DEMO-CN-001',
      credit_note_date: '2026-07-05',
      customer_name: 'Demo Customer Pvt Ltd',
      refund_amount: 2000,
      payment_type: 'refund'
    },
    {
      id: 3,
      ros_receipt_number: 'ROS-001',
      ros_date: '2026-07-05',
      customer_name: 'Demo Shop',
      total_amount: 3500,
      paid_amount: 3500,
      balance: 0,
      payment_type: 'full'
    }
  ],
  invoices: [
    {
      id: 1,
      invoice_number: 'DEMO-INV-001',
      invoice_date: '2026-07-05',
      store: 'Demo Bakery Store',
      total_amount: 5000,
      tax_amount: 900,
      discount_amount: 0,
      status: 'pending',
      customer_name: 'Demo Customer',
      customer_email: 'demo@customer.com',
      customer_phone: '9876543210',
      notes: 'Sample invoice for demo purposes',
      file_reference: 'demo-invoice-001.pdf',
      created_at: '2026-07-05',
      items: [
        {
          slNo: 1,
          itemCode: 'DEMO001',
          itemName: 'Demo Chocolate Cake',
          hsnCode: '19059010',
          qty: 5,
          uom: 'PCS',
          rate: 500,
          total: 2500
        },
        {
          slNo: 2,
          itemCode: 'DEMO002',
          itemName: 'Demo Vanilla Cake',
          hsnCode: '19059010',
          qty: 5,
          uom: 'PCS',
          rate: 500,
          total: 2500
        }
      ]
    },
    {
      id: 2,
      invoice_number: 'DEMO-INV-002',
      invoice_date: '2026-07-10',
      store: 'Demo Bakery Store',
      total_amount: 3600,
      tax_amount: 648,
      discount_amount: 0,
      status: 'cleared',
      customer_name: 'Sample Bakery Supplies',
      customer_email: 'sample@supplies.com',
      customer_phone: '9876543211',
      notes: 'Sample invoice 2 for demo purposes',
      file_reference: 'demo-invoice-002.pdf',
      created_at: '2026-07-10',
      items: [
        {
          slNo: 1,
          itemCode: 'DEMO003',
          itemName: 'Demo Pastries',
          hsnCode: '19059010',
          qty: 10,
          uom: 'PCS',
          rate: 180,
          total: 1800
        },
        {
          slNo: 2,
          itemCode: 'DEMO004',
          itemName: 'Demo Cookies',
          hsnCode: '19059010',
          qty: 10,
          uom: 'PCS',
          rate: 180,
          total: 1800
        }
      ]
    }
  ],
  rosReceipts: [
    {
      id: 1,
      receipt_number: 'ROS-001',
      receipt_date: '2026-07-05',
      received_from: 'Demo Shop',
      total_amount: 3500,
      payment_method: 'CASH',
      bills: [
        {
          doc_type: 'SR',
          bill_number: 'DEMO-INV-001',
          bill_date: '2026-07-05',
          amount: 3500
        }
      ],
      file_name: 'demo-ros-001.pdf',
      original_name: 'demo-ros-001.pdf',
      cloudinary_url: 'https://res.cloudinary.com/demo/raw/upload/v1234567890/ros/demo-ros-001.pdf',
      cloudinary_public_id: 'ros/demo-ros-001',
      created_at: '2026-07-05'
    },
    {
      id: 2,
      receipt_number: 'ROS-002',
      receipt_date: '2026-07-10',
      received_from: 'Sample Distributor',
      total_amount: 4248,
      payment_method: 'NEFT',
      bills: [
        {
          doc_type: 'SR',
          bill_number: 'DEMO-INV-002',
          bill_date: '2026-07-10',
          amount: 4248
        },
        {
          doc_type: 'CN',
          bill_number: 'DEMO-CN-002',
          bill_date: '2026-07-10',
          amount: -1224
        }
      ],
      file_name: 'demo-ros-002.pdf',
      original_name: 'demo-ros-002.pdf',
      cloudinary_url: 'https://res.cloudinary.com/demo/raw/upload/v1234567890/ros/demo-ros-002.pdf',
      cloudinary_public_id: 'ros/demo-ros-002',
      created_at: '2026-07-10'
    }
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
      total_amount: 0,
      payment_type: ['cash', 'card', 'upi'][Math.floor(Math.random() * 3)],
      staff_id: 0,
      product_mrp_total: 0,
      decoration_mrp_total: 0,
      product_cost_total: 0,
      decoration_cost_total: 0,
      total_cost: 0,
      items: []
    };
    
    // Add random items
    const numItems = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < numItems; j++) {
      const randomProduct = demoData.products[Math.floor(Math.random() * demoData.products.length)];
      const quantity = Math.floor(Math.random() * 5) + 1;
      const unitPrice = randomProduct.sale_price;
      const costPrice = randomProduct.invoice_price;
      
      const itemTotal = quantity * unitPrice;
      const itemCost = quantity * costPrice;
      
      sale.items.push({
        id: 6000 + i * 10 + j,
        sale_id: sale.id,
        item_id: randomProduct.id,
        batch_id: randomProduct.id,
        quantity: quantity,
        unit_price: unitPrice,
        total_price: itemTotal,
        name: randomProduct.name,
        item_code: randomProduct.item_code
      });
      
      sale.total_amount += itemTotal;
      sale.product_mrp_total += itemTotal;
      sale.product_cost_total += itemCost;
      sale.total_cost += itemCost;
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
