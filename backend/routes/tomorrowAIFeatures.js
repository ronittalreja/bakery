// Tomorrow AI Features Routes
// API endpoints for feature generation and inspection

const express = require('express');
const router = express.Router();
const { 
  generateFeatures,
  getFeatureData
} = require('../controllers/tomorrowAIFeaturesController');

// Generate features for a date range
// POST /api/tomorrow-ai/features/generate
router.post('/generate', generateFeatures);

// Get feature data for inspection
// GET /api/tomorrow-ai/features
router.get('/', getFeatureData);

module.exports = router;
