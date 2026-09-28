// Tomorrow AI Model Controller
// Handles ML model training and prediction generation

const db = require('../config/database');

/**
 * Train ML model with historical data
 * Uses a simple regression approach for demand forecasting
 */
async function trainModel(req, res) {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    console.log(`Training model with data from ${startDate} to ${endDate}`);

    // Get all DISPLAY products
    const [displayProducts] = await db.execute(`
      SELECT DISTINCT ml_group_id, name
      FROM tomorrow_ai_product_master
      WHERE item_type = 'DISPLAY' AND active = TRUE
    `);

    console.log(`Training models for ${displayProducts.length} products`);

    const modelResults = [];

    for (const product of displayProducts) {
      const mlGroupId = product.ml_group_id;
      const result = await trainProductModel(mlGroupId, startDate, endDate);
      modelResults.push({
        ml_group_id: mlGroupId,
        product_name: product.name,
        ...result
      });
    }

    console.log(`✓ Model training completed for ${modelResults.length} products`);

    res.json({
      success: true,
      message: 'Model training completed',
      data: {
        modelsTrained: modelResults.length,
        results: modelResults
      }
    });

  } catch (error) {
    console.error('Error training model:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Train model for a single product
 */
async function trainProductModel(mlGroupId, startDate, endDate) {
  try {
    // Get feature data for this product
    const [features] = await db.execute(`
      SELECT 
        date,
        ml_group_id,
        target,
        day_of_week,
        is_weekend,
        day_of_month,
        month,
        week_of_year,
        sales_1_day_ago,
        sales_7_days_ago,
        sales_14_days_ago,
        sales_28_days_ago,
        rolling_avg_7,
        rolling_avg_14,
        rolling_avg_28,
        sales_same_date_prev_year,
        sales_same_date_2_years_ago,
        event_name,
        is_event_day,
        days_to_event,
        days_after_event
      FROM tomorrow_ai_features
      WHERE ml_group_id = ? 
        AND date BETWEEN ? AND ?
        AND target IS NOT NULL
      ORDER BY date ASC
    `, [mlGroupId, startDate, endDate]);

    if (features.length < 30) {
      return {
        status: 'skipped',
        reason: 'Insufficient data (need at least 30 records)',
        records: features.length
      };
    }

    // Simple linear regression model
    // For production, this should be replaced with Random Forest or XGBoost
    const model = trainLinearRegression(features);

    return {
      status: 'success',
      records: features.length,
      model: model
    };

  } catch (error) {
    console.error(`Error training model for ${mlGroupId}:`, error);
    return {
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Simple linear regression training
 * This is a placeholder - should be replaced with proper ML library
 */
function trainLinearRegression(features) {
  // Extract features and target
  const X = features.map(f => [
    f.day_of_week / 7,
    f.is_weekend,
    f.day_of_month / 31,
    f.month / 12,
    f.rolling_avg_7 || 0,
    f.rolling_avg_14 || 0,
    f.rolling_avg_28 || 0,
    f.is_event_day,
    f.days_to_event !== null ? f.days_to_event / 30 : 0
  ]);

  const y = features.map(f => f.target);

  // Simple average model (baseline)
  // In production, use proper regression
  const avgSales = y.reduce((a, b) => a + b, 0) / y.length;
  const avgRolling7 = features.reduce((a, b) => a + (b.rolling_avg_7 || 0), 0) / features.length;

  return {
    type: 'baseline_average',
    parameters: {
      avgSales: Math.round(avgSales),
      avgRolling7: Math.round(avgRolling7)
    }
  };
}

/**
 * Generate prediction for tomorrow
 */
async function generatePrediction(req, res) {
  try {
    const { predictionDate } = req.body;
    const targetDate = predictionDate || new Date().toISOString().split('T')[0];

    console.log(`Generating predictions for ${targetDate}`);

    // Get all DISPLAY products
    const [displayProducts] = await db.execute(`
      SELECT DISTINCT ml_group_id, product_id, name
      FROM tomorrow_ai_product_master
      WHERE item_type = 'DISPLAY' AND active = TRUE
    `);

    const predictions = [];

    for (const product of displayProducts) {
      const prediction = await predictForProduct(product, targetDate);
      predictions.push(prediction);
    }

    // Save predictions to database
    for (const pred of predictions) {
      await db.execute(`
        INSERT INTO tomorrow_ai_predictions 
        (prediction_date, product_id, ml_group_id, predicted_demand, recommended_order, model_version)
        VALUES (?, ?, ?, ?, ?, 'v1.0')
        ON DUPLICATE KEY UPDATE
        predicted_demand = VALUES(predicted_demand),
        recommended_order = VALUES(recommended_order),
        prediction_generated_at = CURRENT_TIMESTAMP
      `, [
        targetDate,
        pred.product_id,
        pred.ml_group_id,
        pred.predicted_demand,
        pred.recommended_order
      ]);
    }

    console.log(`✓ Generated ${predictions.length} predictions for ${targetDate}`);

    res.json({
      success: true,
      message: 'Predictions generated successfully',
      data: {
        predictionDate: targetDate,
        predictions: predictions
      }
    });

  } catch (error) {
    console.error('Error generating predictions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Predict for a single product
 */
async function predictForProduct(product, targetDate) {
  try {
    const mlGroupId = product.ml_group_id;
    const productId = product.product_id;

    // Get recent sales for this product
    const [recentSales] = await db.execute(`
      SELECT actual_sales
      FROM tomorrow_ai_daily_sales
      WHERE ml_group_id = ? AND sale_date < ?
      ORDER BY sale_date DESC
      LIMIT 7
    `, [mlGroupId, targetDate]);

    // Calculate rolling average
    const sales = recentSales.map(s => s.actual_sales);
    const avgSales = sales.length > 0 
      ? Math.round(sales.reduce((a, b) => a + b, 0) / sales.length)
      : 0;

    // Simple prediction: use rolling average with small buffer
    const predictedDemand = avgSales;
    const recommendedOrder = Math.ceil(predictedDemand * 1.1); // 10% safety buffer

    return {
      product_id: productId,
      ml_group_id: mlGroupId,
      product_name: product.name,
      predicted_demand: predictedDemand,
      recommended_order: recommendedOrder
    };

  } catch (error) {
    console.error(`Error predicting for ${product.ml_group_id}:`, error);
    return {
      product_id: product.product_id,
      ml_group_id: product.ml_group_id,
      product_name: product.name,
      predicted_demand: 0,
      recommended_order: 0,
      error: error.message
    };
  }
}

/**
 * Get predictions for a date
 */
async function getPredictions(req, res) {
  try {
    const { predictionDate } = req.query;
    const targetDate = predictionDate || new Date().toISOString().split('T')[0];

    const [predictions] = await db.execute(`
      SELECT 
        p.prediction_date,
        p.product_id,
        p.ml_group_id,
        pm.name as product_name,
        p.predicted_demand,
        p.recommended_order,
        p.model_version,
        p.prediction_generated_at,
        p.actual_sales
      FROM tomorrow_ai_predictions p
      JOIN tomorrow_ai_product_master pm ON p.ml_group_id = pm.ml_group_id
      WHERE p.prediction_date = ?
      ORDER BY p.recommended_order DESC
    `, [targetDate]);

    res.json({
      success: true,
      data: predictions
    });

  } catch (error) {
    console.error('Error fetching predictions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  trainModel,
  generatePrediction,
  getPredictions
};
