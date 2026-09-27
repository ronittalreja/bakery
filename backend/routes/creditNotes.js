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

// Get total return charges (total loss) for a month
router.get('/total-loss', creditNoteController.getTotalReturnCharges);

// Get credit notes from ROS receipts that don't exist in credit_notes table
router.get('/from-ros-receipts', creditNoteController.getCreditNotesFromRosReceipts);

// Get credit notes from credit_notes table that appear in ROS receipts (AC/EC/CN)
router.get('/in-ros', creditNoteController.getCreditNotesInRos);

// Get credit notes NOT in ROS receipts (uploaded via CRDR API)
router.get('/not-in-ros', creditNoteController.getCreditNotesNotInRos);

// Get credit note details by ID
router.get('/:id', creditNoteController.getCreditNoteDetails);

// Update credit note status
router.patch('/:id/status', creditNoteController.updateCreditNoteStatus);

// Get credit note processing history
router.get('/history', creditNoteController.getCreditNoteHistory);

// Error handling middleware
router.use((err, req, res, next) => {
  console.error('Route error:', err.stack);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: err.message });
  }
  res.status(500).json({ success: false, error: 'Internal server error' });
});

module.exports = router;