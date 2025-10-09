const express = require('express');
const router = express.Router();
const { invoiceUpload } = require('../utils/cloudinary');
const {
  uploadInvoice,
  verifyInvoice,
  checkInvoice,
  getInvoicesByMonth,
  getInvoiceById,
  getInvoiceItems,
  updateInvoiceStatus,
  getInvoicesFromRosReceipts
} = require('../controllers/invoiceController');

// Upload invoice
router.post('/upload', invoiceUpload.single('file'), uploadInvoice);

// Verify invoice
router.post('/verify', verifyInvoice);

// Check invoice (preview)
router.post('/check', invoiceUpload.single('file'), checkInvoice);

// Get invoices by month (for payments page)
router.get('/', getInvoicesByMonth);

// Get invoice by ID (for payments page)
router.get('/:id', getInvoiceById);

// Get invoice items (for payments page)
router.get('/:id/items', getInvoiceItems);

// Update invoice status (for payments page)
router.patch('/:id/status', updateInvoiceStatus);

// Get invoices from ROS receipts that don't exist in invoices table
router.get('/from-ros-receipts', getInvoicesFromRosReceipts);

module.exports = router;