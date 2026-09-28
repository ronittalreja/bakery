// Tomorrow AI Model Routes
// API endpoints for ML model training and prediction

const express = require('express');
const router = express.Router();
const { 
  trainModel,
  generatePrediction,
  getPredictions
} = require('../controllers/tomorrowAIModelController');

// Train ML model with historical data
// POST /api/tomorrow-ai/model/train
router.post('/train', trainModel);

// Generate predictions for a date
// POST /api/tomorrow-ai/model/predict
router.post('/predict', generatePrediction);

// Get predictions for a date
// GET /api/tomorrow-ai/model/predictions
router.get('/predictions', getPredictions);

module.exports = router;
