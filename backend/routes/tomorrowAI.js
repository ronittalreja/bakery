// Tomorrow AI Routes
// API endpoints for Tomorrow AI demand forecasting system

const express = require('express');
const router = express.Router();
const { 
  syncSalesToTomorrowAI, 
  fullHistoricalSync, 
  getDailySalesData 
} = require('../controllers/tomorrowAIController');

// Sync sales data for a specific date
// POST /api/tomorrow-ai/sync
router.post('/sync', syncSalesToTomorrowAI);

// Full historical sync - syncs all historical data
// POST /api/tomorrow-ai/sync/historical
router.post('/sync/historical', fullHistoricalSync);

// Get daily sales data for inspection
// GET /api/tomorrow-ai/daily-sales
router.get('/daily-sales', getDailySalesData);

module.exports = router;
