const express = require('express');
const multer = require('multer');
const path = require('path');
const rosReceiptController = require('../controllers/rosReceiptController');
const auth = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'Uploads/ROSReceipts/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'ros-receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Apply authentication middleware to all routes
router.use(auth);

// Get all ROS receipts
router.get('/', rosReceiptController.getAllRosReceipts);

// Get ROS receipt by ID
router.get('/:id', rosReceiptController.getRosReceiptById);

// Upload ROS receipt
router.post('/upload', upload.single('rosReceipt'), rosReceiptController.uploadRosReceipt);

// Preview ROS receipt
router.post('/preview', upload.single('rosReceipt'), rosReceiptController.previewRosReceipt);

module.exports = router;
