const express = require('express');
const router = express.Router();
const { getSalesReport, getProductSalesReport, getStockReport, getExpiredStockReport, getReturnsReport } = require('../controllers/reportsController');

router.get('/sales', getSalesReport); // ?startDate&endDate
router.get('/product-sales', getProductSalesReport); // ?startDate&endDate
router.get('/stock', getStockReport);
router.get('/expired', getExpiredStockReport); // ?days
router.get('/returns', getReturnsReport); // ?startDate&endDate

module.exports = router;