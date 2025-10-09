// File: backend/routes/sales.js
const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const StockBatch = require('../models/StockBatch');
const db = require('../config/database');
const { recordSale, getSalesSummary, getSalesByDate, getSalesAnalytics, getMonthlySales, getMonthlySalesAnalytics, getYTDMTDComparison } = require('../controllers/salesController');

// Delegate POST to FEFO-enabled controller implementation
router.post('/', recordSale);

router.get('/:date', getSalesByDate);

router.get('/summary/:date', getSalesSummary);

router.get('/analytics/:date', getSalesAnalytics);

router.get('/monthly/:month', getMonthlySales);

router.get('/analytics/monthly/:month/:year?', getMonthlySalesAnalytics);

router.get('/ytd-mtd/:year', getYTDMTDComparison);

// The controller already provides a richer GET /:date; avoid duplicate definitions
module.exports = router;
