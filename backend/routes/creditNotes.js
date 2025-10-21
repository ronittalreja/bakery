// File: backend/routes/creditNotes.js
const express = require('express');
const router = express.Router();
const creditNoteController = require('../controllers/creditNoteController');
const auth = require('../middleware/auth');
const multer = require('multer');

// Apply authentication middleware to all routes
router.use(auth);

// Upload credit note file
router.post('/upload', creditNoteController.uploadCreditNote);

// Parse and process credit note
router.post('/parse', creditNoteController.parseCreditNote);

// Store parsed credit note
router.post('/store', creditNoteController.storeCreditNote);

// Get all credit notes with month filter
router.get('/', creditNoteController.getAllCreditNotes);

// Get credit note details by ID
router.get('/:id', creditNoteController.getCreditNoteDetails);

// Update credit note status
router.patch('/:id/status', creditNoteController.updateCreditNoteStatus);

// Get credit note processing history
router.get('/history', creditNoteController.getCreditNoteHistory);

// Get credit notes from ROS receipts that don't exist in credit_notes table
router.get('/from-ros-receipts', creditNoteController.getCreditNotesFromRosReceipts);

// Error handling middleware
router.use((err, req, res, next) => {
  console.error('Route error:', err.stack);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: err.message });
  }
  res.status(500).json({ success: false, error: 'Internal server error' });
});

module.exports = router;