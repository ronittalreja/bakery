// Tomorrow AI Event Controller
// Handles event-based demand forecasting

const db = require('../config/database');

/**
 * Get next upcoming event
 */
async function getNextEvent(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const [events] = await db.execute(`
      SELECT 
        id,
        event_name,
        event_type,
        event_date,
        year,
        description
      FROM tomorrow_ai_events
      WHERE event_date >= ?
      ORDER BY event_date ASC
      LIMIT 1
    `, [today]);
    
    if (events.length === 0) {
      return res.json({ success: true, data: null });
    }
    
    const event = events[0];
    const eventDate = new Date(event.event_date);
    const todayDate = new Date(today);
    const daysToGo = Math.ceil((eventDate - todayDate) / (1000 * 60 * 60 * 24));
    
    res.json({
      success: true,
      data: {
        ...event,
        days_to_go: daysToGo
      }
    });
    
  } catch (error) {
    console.error('Error getting next event:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get upcoming events
 */
async function getUpcomingEvents(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const safeLimit = isNaN(limit) ? 10 : limit;

    if (!today) {
      return res.status(400).json({ success: false, error: 'Invalid date' });
    }

    console.log('getUpcomingEvents - today:', today, 'limit:', safeLimit);

    // Use hardcoded LIMIT to avoid parameter binding issues
    const safeLimitInt = Math.min(Math.max(safeLimit, 1), 100); // Clamp between 1 and 100
    const query = `SELECT id, event_name, event_type, event_date, year, description FROM tomorrow_ai_events WHERE event_date >= ? ORDER BY event_date ASC LIMIT ${safeLimitInt}`;
    const [events] = await db.execute(query, [String(today)]);

    const eventsWithDays = events.map(event => {
      const eventDate = new Date(event.event_date);
      const todayDate = new Date(today);
      const daysToGo = Math.ceil((eventDate - todayDate) / (1000 * 60 * 60 * 24));
      return {
        ...event,
        days_to_go: daysToGo
      };
    });

    res.json({ success: true, data: eventsWithDays });

  } catch (error) {
    console.error('Error getting upcoming events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get event forecast with historical comparison
 * Uses dynamic year window: current year (prediction) and previous 3 years
 */
async function getEventForecast(req, res) {
  try {
    const { eventId, eventName, year } = req.query;

    if (!eventId && !eventName) {
      return res.status(400).json({ success: false, error: 'eventId or eventName required' });
    }

    // Get event details - handle undefined parameters
    let query, params;
    if (eventId && eventName) {
      query = `SELECT * FROM tomorrow_ai_events WHERE id = ? OR event_name = ?`;
      params = [eventId, eventName];
    } else if (eventId) {
      query = `SELECT * FROM tomorrow_ai_events WHERE id = ?`;
      params = [eventId];
    } else {
      query = `SELECT * FROM tomorrow_ai_events WHERE event_name = ?`;
      params = [eventName];
    }

    const [events] = await db.execute(query, params);

    if (events.length === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const event = events[0];
    const currentYear = new Date().getFullYear();
    const targetYear = year || event.year || currentYear || currentYear;

    // Calculate dynamic year window (current-1, current-2, current-3)
    const historicalYears = [targetYear - 1, targetYear - 2, targetYear - 3];

    // Get DISPLAY products
    const [products] = await db.execute(`
      SELECT
        product_id,
        name,
        ml_group_id
      FROM tomorrow_ai_product_master
      WHERE item_type = 'DISPLAY' AND active = TRUE
      ORDER BY name ASC
    `);

    const forecasts = [];

    for (const product of products) {
      // Get historical sales for this event across years
      const [historicalSales] = await db.execute(`
        SELECT
          ds.sale_date,
          ds.actual_sales,
          e.year as event_year
        FROM tomorrow_ai_daily_sales ds
        JOIN tomorrow_ai_events e ON
          DATE_ADD(e.event_date, INTERVAL (YEAR(ds.sale_date) - e.year) YEAR) = ds.sale_date
        WHERE ds.ml_group_id = ?
          AND e.event_name = ?
          AND e.year IN (?, ?, ?, ?)
          AND ds.sale_date BETWEEN DATE_SUB(?, INTERVAL 7 DAY) AND DATE_ADD(?, INTERVAL 1 DAY)
        ORDER BY ds.sale_date ASC
      `, [product.ml_group_id, event.event_name, targetYear, ...historicalYears, event.event_date, event.event_date]);

      // Group by year
      const salesByYear = {};
      historicalSales.forEach(sale => {
        if (!salesByYear[sale.event_year]) {
          salesByYear[sale.event_year] = 0;
        }
        salesByYear[sale.event_year] += sale.actual_sales;
      });

      // Calculate prediction (simple average of historical years)
      const historicalValues = historicalYears.map(y => salesByYear[y]).filter(v => v !== undefined && v > 0);
      const prediction = historicalValues.length > 0
        ? Math.round(historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length)
        : 0;

      // Recommended order (10% buffer)
      const recommendedOrder = Math.ceil(prediction * 1.1);

      // Build dynamic historical object
      const historical = {};
      historical[targetYear] = salesByYear[targetYear] || null;
      historicalYears.forEach(y => {
        historical[y] = salesByYear[y] || null;
      });

      forecasts.push({
        product_id: product.product_id,
        product_name: product.name,
        ml_group_id: product.ml_group_id,
        prediction: prediction,
        recommended_order: recommendedOrder,
        historical: historical
      });
    }

    res.json({
      success: true,
      data: {
        event: event,
        forecasts: forecasts,
        year_window: {
          prediction_year: targetYear,
          historical_years: historicalYears
        }
      }
    });

  } catch (error) {
    console.error('Error getting event forecast:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get 7-day event pattern for a product
 */
async function getEventPattern(req, res) {
  try {
    const { eventId, eventName, mlGroupId } = req.query;

    if (!eventId && !eventName) {
      return res.status(400).json({ success: false, error: 'eventId or eventName required' });
    }

    if (!mlGroupId) {
      return res.status(400).json({ success: false, error: 'mlGroupId required' });
    }

    // Get event - handle undefined parameters
    let query, params;
    if (eventId && eventName) {
      query = `SELECT * FROM tomorrow_ai_events WHERE id = ? OR event_name = ?`;
      params = [eventId, eventName];
    } else if (eventId) {
      query = `SELECT * FROM tomorrow_ai_events WHERE id = ?`;
      params = [eventId];
    } else {
      query = `SELECT * FROM tomorrow_ai_events WHERE event_name = ?`;
      params = [eventName];
    }

    const [events] = await db.execute(query, params);
    
    if (events.length === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    
    const event = events[0];
    
    // Get sales pattern around the event (7 days before to event day)
    const [patternData] = await db.execute(`
      SELECT 
        ds.sale_date,
        ds.actual_sales,
        DATEDIFF(ds.sale_date, e.event_date) as days_to_event
      FROM tomorrow_ai_daily_sales ds
      CROSS JOIN tomorrow_ai_events e
      WHERE ds.ml_group_id = ?
          AND e.event_name = ?
          AND ds.sale_date BETWEEN DATE_SUB(e.event_date, INTERVAL 7 DAY) AND e.event_date
          AND e.year = YEAR(ds.sale_date)
      ORDER BY e.year ASC, days_to_event ASC
    `, [mlGroupId, event.event_name]);
    
    // Group by days_to_event and average across years
    const patternByDay = {};
    for (let i = -7; i <= 0; i++) {
      patternByDay[i] = [];
    }
    
    patternData.forEach(row => {
      const day = row.days_to_event;
      if (patternByDay[day] !== undefined) {
        patternByDay[day].push(row.actual_sales);
      }
    });
    
    const averagedPattern = {};
    for (let i = -7; i <= 0; i++) {
      const values = patternByDay[i];
      if (values.length > 0) {
        averagedPattern[i] = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
      } else {
        averagedPattern[i] = null;
      }
    }
    
    res.json({
      success: true,
      data: {
        event: event,
        pattern: averagedPattern
      }
    });
    
  } catch (error) {
    console.error('Error getting event pattern:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getNextEvent,
  getUpcomingEvents,
  getEventForecast,
  getEventPattern
};
