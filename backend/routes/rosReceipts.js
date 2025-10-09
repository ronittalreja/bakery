const express = require('express');
const rosReceiptController = require('../controllers/rosReceiptController');
const auth = require('../middleware/auth');
const { rosReceiptUpload } = require('../utils/cloudinary');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// Get all ROS receipts
router.get('/', rosReceiptController.getAllRosReceipts);

// Get ROS receipt by ID
router.get('/:id', rosReceiptController.getRosReceiptById);

// Upload ROS receipt
router.post('/upload', rosReceiptUpload.single('rosReceipt'), rosReceiptController.uploadRosReceipt);

// Preview ROS receipt
router.post('/preview', rosReceiptUpload.single('rosReceipt'), rosReceiptController.previewRosReceipt);

module.exports = router;
