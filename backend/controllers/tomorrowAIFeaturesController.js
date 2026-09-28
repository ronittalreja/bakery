// Tomorrow AI Feature Generation Controller
// Generates features for ML training from daily sales data

const db = require('../config/database');

/**
 * Generate features for a specific date range
 */
async function generateFeatures(req, res) {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    console.log(`Generating features from ${startDate} to ${endDate}`);

    // Get all DISPLAY items
    const [displayProducts] = await db.execute(`
      SELECT DISTINCT ml_group_id, name
      FROM tomorrow_ai_product_master
      WHERE item_type = 'DISPLAY' AND active = TRUE
    `);

    console.log(`Found ${displayProducts.length} DISPLAY products`);

    let featuresGenerated = 0;
    const featureData = [];

    for (const product of displayProducts) {
      const mlGroupId = product.ml_group_id;
      
      // Generate features for each date in range
      const dates = getDateRange(startDate, endDate);
      
      for (const date of dates) {
        const features = await generateFeaturesForDate(date, mlGroupId);
        if (features) {
          featuresGenerated++;
          featureData.push(features);
        }
      }
    }

    console.log(`✓ Generated ${featuresGenerated} feature records`);

    res.json({
      success: true,
      message: 'Features generated successfully',
      data: {
        featuresGenerated,
        sample: featureData.slice(0, 5) // Return first 5 as sample
      }
    });

  } catch (error) {
    console.error('Error generating features:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Generate features for a specific date and ML group
 */
async function generateFeaturesForDate(date, mlGroupId) {
  try {
    // Get actual sales for this date
    const [salesData] = await db.execute(`
      SELECT actual_sales, is_shop_open
      FROM tomorrow_ai_daily_sales
      WHERE sale_date = ? AND ml_group_id = ?
    `, [date, mlGroupId]);

    const actualSales = salesData.length > 0 ? salesData[0].actual_sales : null;
    const isShopOpen = salesData.length > 0 ? salesData[0].is_shop_open : true;

    // Calendar features
    const dateObj = new Date(date);
    const calendarFeatures = {
      day_of_week: dateObj.getDay(), // 0 = Sunday, 6 = Saturday
      is_weekend: dateObj.getDay() === 0 || dateObj.getDay() === 6 ? 1 : 0,
      day_of_month: dateObj.getDate(),
      month: dateObj.getMonth() + 1, // 1-12
      week_of_year: getWeekNumber(dateObj)
    };

    // Recent sales features (lag features)
    const recentFeatures = await getRecentSalesFeatures(date, mlGroupId);

    // Historical same-date sales
    const historicalFeatures = await getHistoricalSameDateFeatures(date, mlGroupId);

    // Event features
    const eventFeatures = await getEventFeatures(date);

    // Combine all features
    const features = {
      date,
      ml_group_id: mlGroupId,
      target: actualSales, // This is what we want to predict
      is_shop_open: isShopOpen ? 1 : 0,
      ...calendarFeatures,
      ...recentFeatures,
      ...historicalFeatures,
      ...eventFeatures
    };

    return features;

  } catch (error) {
    console.error(`Error generating features for ${date}, ${mlGroupId}:`, error);
    return null;
  }
}

/**
 * Get recent sales features (lag and rolling averages)
 */
async function getRecentSalesFeatures(date, mlGroupId) {
  const features = {};

  // Sales 1 day ago
  const [sales1d] = await db.execute(`
    SELECT actual_sales
    FROM tomorrow_ai_daily_sales
    WHERE sale_date < ? AND ml_group_id = ?
    ORDER BY sale_date DESC
    LIMIT 1
  `, [date, mlGroupId]);
  features.sales_1_day_ago = sales1d.length > 0 ? sales1d[0].actual_sales : null;

  // Sales 7 days ago
  const [sales7d] = await db.execute(`
    SELECT actual_sales
    FROM tomorrow_ai_daily_sales
    WHERE sale_date < ? AND ml_group_id = ?
    ORDER BY sale_date DESC
    LIMIT 1 OFFSET 6
  `, [date, mlGroupId]);
  features.sales_7_days_ago = sales7d.length > 0 ? sales7d[0].actual_sales : null;

  // Sales 14 days ago
  const [sales14d] = await db.execute(`
    SELECT actual_sales
    FROM tomorrow_ai_daily_sales
    WHERE sale_date < ? AND ml_group_id = ?
    ORDER BY sale_date DESC
    LIMIT 1 OFFSET 13
  `, [date, mlGroupId]);
  features.sales_14_days_ago = sales14d.length > 0 ? sales14d[0].actual_sales : null;

  // Sales 28 days ago
  const [sales28d] = await db.execute(`
    SELECT actual_sales
    FROM tomorrow_ai_daily_sales
    WHERE sale_date < ? AND ml_group_id = ?
    ORDER BY sale_date DESC
    LIMIT 1 OFFSET 27
  `, [date, mlGroupId]);
  features.sales_28_days_ago = sales28d.length > 0 ? sales28d[0].actual_sales : null;

  // Rolling averages
  features.rolling_avg_7 = await getRollingAverage(date, mlGroupId, 7);
  features.rolling_avg_14 = await getRollingAverage(date, mlGroupId, 14);
  features.rolling_avg_28 = await getRollingAverage(date, mlGroupId, 28);

  return features;
}

/**
 * Get rolling average for last N days
 */
async function getRollingAverage(date, mlGroupId, days) {
  const [result] = await db.execute(`
    SELECT AVG(actual_sales) as avg_sales
    FROM tomorrow_ai_daily_sales
    WHERE sale_date < ? AND ml_group_id = ?
    ORDER BY sale_date DESC
    LIMIT ?
  `, [date, mlGroupId, days]);

  return result[0].avg_sales !== null ? Math.round(result[0].avg_sales * 100) / 100 : null;
}

/**
 * Get historical same-date sales (previous years)
 */
async function getHistoricalSameDateFeatures(date, mlGroupId) {
  const features = {};
  const dateObj = new Date(date);
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  const currentYear = dateObj.getFullYear();

  // Same date in previous year
  const [salesPrevYear] = await db.execute(`
    SELECT actual_sales
    FROM tomorrow_ai_daily_sales
    WHERE MONTH(sale_date) = ? AND DAY(sale_date) = ? 
      AND YEAR(sale_date) = ? AND ml_group_id = ?
  `, [month, day, currentYear - 1, mlGroupId]);
  features.sales_same_date_prev_year = salesPrevYear.length > 0 ? salesPrevYear[0].actual_sales : null;

  // Same date 2 years ago
  const [sales2YearsAgo] = await db.execute(`
    SELECT actual_sales
    FROM tomorrow_ai_daily_sales
    WHERE MONTH(sale_date) = ? AND DAY(sale_date) = ? 
      AND YEAR(sale_date) = ? AND ml_group_id = ?
  `, [month, day, currentYear - 2, mlGroupId]);
  features.sales_same_date_2_years_ago = sales2YearsAgo.length > 0 ? sales2YearsAgo[0].actual_sales : null;

  return features;
}

/**
 * Get event features
 */
async function getEventFeatures(date) {
  const features = {};

  // Find nearest event (within 30 days)
  const [events] = await db.execute(`
    SELECT 
      event_name,
      event_date,
      DATEDIFF(event_date, ?) as days_diff
    FROM tomorrow_ai_events
    WHERE ABS(DATEDIFF(event_date, ?)) <= 30
    ORDER BY ABS(DATEDIFF(event_date, ?)) ASC
    LIMIT 1
  `, [date, date, date]);

  if (events.length > 0) {
    const event = events[0];
    features.event_name = event.event_name;
    features.is_event_day = event.days_diff === 0 ? 1 : 0;
    features.days_to_event = event.days_diff >= 0 ? event.days_diff : null;
    features.days_after_event = event.days_diff < 0 ? Math.abs(event.days_diff) : null;
  } else {
    features.event_name = null;
    features.is_event_day = 0;
    features.days_to_event = null;
    features.days_after_event = null;
  }

  return features;
}

/**
 * Get date range array
 */
function getDateRange(startDate, endDate) {
  const dates = [];
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Get week number (ISO 8601)
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

/**
 * Get feature data for inspection
 * This allows verification that features are being generated correctly
 */
async function getFeatureData(req, res) {
  try {
    const { startDate, endDate, mlGroupId } = req.query;

    // Generate features on the fly for inspection
    const displayProducts = mlGroupId 
      ? [{ ml_group_id: mlGroupId }]
      : await db.execute(`
          SELECT DISTINCT ml_group_id
          FROM tomorrow_ai_product_master
          WHERE item_type = 'DISPLAY' AND active = TRUE
          LIMIT 10
        `);

    const dates = startDate && endDate 
      ? getDateRange(startDate, endDate)
      : getDateRange(
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          new Date().toISOString().split('T')[0]
        );

    const featureData = [];
    
    for (const product of displayProducts) {
      const groupId = product.ml_group_id;
      for (const date of dates) {
        const features = await generateFeaturesForDate(date, groupId);
        if (features) {
          featureData.push(features);
        }
      }
    }

    res.json({
      success: true,
      data: featureData
    });

  } catch (error) {
    console.error('Error fetching feature data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  generateFeatures,
  getFeatureData
};
