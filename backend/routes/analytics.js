const express = require('express');
const router = express.Router();
const { getOverallAnalytics } = require('../controllers/analyticsController');

router.get('/overall', getOverallAnalytics);

module.exports = router;
