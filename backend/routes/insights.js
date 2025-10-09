const express = require('express');
const router = express.Router();
const { getMonthlyInsights } = require('../controllers/insightsController');

// Routes
router.get('/monthly/:month', getMonthlyInsights);

module.exports = router;

