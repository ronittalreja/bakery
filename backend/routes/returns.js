// File: backend/routes/returns.js
const express = require('express');
const router = express.Router();
const returnsController = require('../controllers/returnsController');

router.get('/gvn', returnsController.getGvnDamages);
router.get('/grm', returnsController.getGrmReturns);
router.post('/grm', returnsController.processGrmReturn);
router.post('/gvn', returnsController.processGvnDamage);
router.get('/summary/:date', returnsController.getReturnsSummary);
router.get('/details/:date', returnsController.getReturnsDetails);
router.get('/processed-by-expiry/:date', returnsController.getProcessedReturnsByExpiry);
router.get('/items-by-expiry/:date', returnsController.getItemsByExpiryDate);
router.get('/processed-for-credit-note', returnsController.getProcessedReturnsForCreditNote);
router.put('/update-credit-status', returnsController.updateCreditStatus);
router.post('/process-credit-note', returnsController.processCreditNote);
router.get('/pending', returnsController.getPendingReturns);

module.exports = router;