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
      WHERE event_date >= ? AND status = 'approved'
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
    const query = `SELECT id, event_name, event_type, event_date, year, description FROM tomorrow_ai_events WHERE event_date >= ? AND status = 'approved' ORDER BY event_date ASC LIMIT ${safeLimitInt}`;
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
 * Handles fixed-date events (same date each year) and dynamic-date events (different dates)
 */
async function getEventForecast(req, res) {
  try {
    const { eventId, eventName, year } = req.query;
    const storeId = req.user?.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'User store_id not found' });
    }

    if (!eventId && !eventName) {
      return res.status(400).json({ success: false, error: 'eventId or eventName required' });
    }

    const currentYear = new Date().getFullYear();
    const targetYear = year ? parseInt(year) : currentYear;

    // Get ALL events with same name, year, and store_id
    const [allEvents] = await db.execute(`
      SELECT * FROM tomorrow_ai_events 
      WHERE event_name = ? AND year = ? AND store_id = ?
    `, [eventName, targetYear, storeId]);

    if (allEvents.length === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const event = allEvents[0];
    const eventDates = allEvents.map(e => new Date(e.event_date));
    const isFixedDate = event.is_fixed_date === 1 || event.is_fixed_date === true;

    console.log(`Event: ${event.event_name}, is_fixed_date: ${isFixedDate}, store_id: ${storeId}, event_dates: ${eventDates.map(d => d.toISOString().split('T')[0]).join(', ')}`);

    // Calculate dynamic year window (current-1, current-2, current-3)
    const historicalYears = [targetYear - 1, targetYear - 2, targetYear - 3];

    // Get DISPLAY products that are mapped/approved
    // Use alias table to resolve to canonical products
    // If a product is aliased (historical_item_code), use the target product
    // Group by the resolved product_id to ensure one row per canonical product
    const [products] = await db.execute(`
      SELECT
        MIN(pm.product_id) as product_id,
        MAX(pm.name) as name,
        pm.ml_group_id
      FROM tomorrow_ai_product_master pm
      WHERE pm.item_type = 'DISPLAY' 
        AND pm.active = TRUE 
        AND pm.mapping_status = 'approved'
        AND pm.ml_group_id IS NOT NULL
      GROUP BY pm.ml_group_id
      ORDER BY MAX(name) ASC
    `);

    console.log(`Fetching forecast for ${products.length} products, event: ${event.event_name}, years: [${targetYear}, ...historicalYears]`);

    // Optimized: Get all historical sales in a single query
    const mlGroupIds = products.map(p => p.ml_group_id).filter(id => id != null);
    const allYears = [targetYear, ...historicalYears];

    let historicalSales = [];
    if (mlGroupIds.length > 0) {
      const placeholders = mlGroupIds.map(() => '?').join(',');
      const yearPlaceholders = allYears.map(() => '?').join(',');

      // Build date ranges for each year based on event type
      // For target year, use ALL selected event dates
      // For historical years, fetch events with same name and use their dates
      
      let dateConditions = [];
      
      // For target year - use all selected event dates
      if (eventDates.length > 0) {
        const targetYearDateConditions = eventDates.map(eventDate => {
          const startDate = new Date(eventDate);
          startDate.setDate(startDate.getDate() - 1); // 1 day before
          const endDate = new Date(eventDate);
          return `(YEAR(ds.sale_date) = ${targetYear} AND ds.sale_date BETWEEN '${startDate.toISOString().split('T')[0]}' AND '${endDate.toISOString().split('T')[0]}')`;
        }).join(' OR ');
        dateConditions.push(targetYearDateConditions);
      }
      
      // For historical years - fetch events with same name and use their dates
      for (const historicalYear of historicalYears) {
        const [historicalEvents] = await db.execute(`
          SELECT event_date FROM tomorrow_ai_events 
          WHERE event_name = ? AND year = ? AND store_id = ?
        `, [event.event_name, historicalYear, storeId]);
        
        if (historicalEvents.length > 0) {
          const historicalDateConditions = historicalEvents.map(e => {
            const eventDate = new Date(e.event_date);
            const startDate = new Date(eventDate);
            startDate.setDate(startDate.getDate() - 1);
            const endDate = new Date(eventDate);
            return `(YEAR(ds.sale_date) = ${historicalYear} AND ds.sale_date BETWEEN '${startDate.toISOString().split('T')[0]}' AND '${endDate.toISOString().split('T')[0]}')`;
          }).join(' OR ');
          dateConditions.push(historicalDateConditions);
        } else if (isFixedDate && eventDates.length > 0) {
          // For fixed events, if no event exists for historical year, use same month/day from target year
          const historicalDateConditions = eventDates.map(eventDate => {
            const startDate = new Date(eventDate);
            startDate.setFullYear(historicalYear);
            startDate.setDate(startDate.getDate() - 1);
            const endDate = new Date(eventDate);
            endDate.setFullYear(historicalYear);
            return `(YEAR(ds.sale_date) = ${historicalYear} AND ds.sale_date BETWEEN '${startDate.toISOString().split('T')[0]}' AND '${endDate.toISOString().split('T')[0]}')`;
          }).join(' OR ');
          dateConditions.push(historicalDateConditions);
          console.log(`No event found for ${historicalYear}, using fixed date pattern from target year`);
        }
      }

      const finalDateCondition = dateConditions.length > 0 ? dateConditions.join(' OR ') : '1=0';

      [historicalSales] = await db.execute(`
        SELECT
          ds.ml_group_id,
          ds.sale_date,
          ds.actual_sales,
          YEAR(ds.sale_date) as event_year
        FROM tomorrow_ai_daily_sales ds
        WHERE ds.ml_group_id IN (${placeholders}) AND ds.store_id = ?
          AND (${finalDateCondition})
        ORDER BY ds.sale_date ASC
      `, [...mlGroupIds, storeId]);
    }

    console.log(`Found ${historicalSales.length} historical sales records`);

    // Group by ml_group_id and year
    const salesByGroupAndYear = {};
    historicalSales.forEach(sale => {
      const key = `${sale.ml_group_id}_${sale.event_year}`;
      if (!salesByGroupAndYear[key]) {
        salesByGroupAndYear[key] = 0;
      }
      salesByGroupAndYear[key] += sale.actual_sales;
    });

    const forecasts = [];

    for (const product of products) {
      // Get sales for this product by year
      const salesByYear = {};
      historicalYears.forEach(y => {
        const key = `${product.ml_group_id}_${y}`;
        salesByYear[y] = salesByGroupAndYear[key] || 0;
      });

      // Calculate prediction (simple average of historical years)
      const historicalValues = historicalYears.map(y => salesByYear[y]).filter(v => v !== undefined && v > 0);
      const prediction = historicalValues.length > 0
        ? Math.round(historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length)
        : 0;

      // Skip if all historical years have zero sales
      if (historicalValues.length === 0) {
        continue;
      }

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
    const { eventId, eventName, year, mlGroupId } = req.query;
    const storeId = req.user?.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'User store_id not found' });
    }

    if (!eventId && !eventName) {
      return res.status(400).json({ success: false, error: 'eventId or eventName required' });
    }

    if (!mlGroupId) {
      return res.status(400).json({ success: false, error: 'mlGroupId required' });
    }

    // Get event - handle undefined parameters (events are global)
    let query, params;
    if (eventId && eventName && year) {
      query = `SELECT * FROM tomorrow_ai_events WHERE event_name = ? AND year = ?`;
      params = [eventName, year];
    } else if (eventId && eventName) {
      query = `SELECT * FROM tomorrow_ai_events WHERE (id = ? OR event_name = ?)`;
      params = [eventId, eventName];
    } else if (eventId) {
      query = `SELECT * FROM tomorrow_ai_events WHERE id = ?`;
      params = [eventId];
    } else if (eventName && year) {
      query = `SELECT * FROM tomorrow_ai_events WHERE event_name = ? AND year = ?`;
      params = [eventName, year];
    } else {
      query = `SELECT * FROM tomorrow_ai_events WHERE event_name = ?`;
      params = [eventName];
    }

    const [events] = await db.execute(query, params);
    
    if (events.length === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    
    const event = events[0];
    
    // Get sales pattern around the event (7 days before to event day) - filter by store_id
    const [patternData] = await db.execute(`
      SELECT 
        ds.sale_date,
        ds.actual_sales,
        DATEDIFF(ds.sale_date, e.event_date) as days_to_event
      FROM tomorrow_ai_daily_sales ds
      CROSS JOIN tomorrow_ai_events e
      WHERE ds.ml_group_id = ?
          AND ds.store_id = ?
          AND e.event_name = ?
          AND e.year = ?
          AND ds.sale_date BETWEEN DATE_SUB(e.event_date, INTERVAL 7 DAY) AND e.event_date
      ORDER BY e.year ASC, days_to_event ASC
    `, [mlGroupId, storeId, event.event_name, event.year]);
    
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

/**
 * Get all events for management
 */
async function getAllEvents(req, res) {
  try {
    const [events] = await db.execute(`
      SELECT id, event_name, event_type, event_date, year, description, status
      FROM tomorrow_ai_events
      ORDER BY event_date ASC
    `);

    res.json({ success: true, data: events });
  } catch (error) {
    console.error('Error getting all events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Update event status (approve/reject)
 */
async function updateEventStatus(req, res) {
  try {
    const { eventId } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    await db.execute(`
      UPDATE tomorrow_ai_events
      SET status = ?
      WHERE id = ?
    `, [status, eventId]);

    res.json({ success: true, message: 'Event status updated' });
  } catch (error) {
    console.error('Error updating event status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Create a new event
 */
async function createEvent(req, res) {
  try {
    const { event_name, event_type, event_date, year, description, status } = req.body;

    if (!event_name || !event_type || !event_date || !year) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Convert ISO date string to YYYY-MM-DD format if needed
    const formattedDate = event_date.includes('T') ? event_date.split('T')[0] : event_date;

    const storeId = req.user?.store_id || 1;
    const isFixed = event_type === 'fixed';

    // For fixed events, create entries for multiple years
    if (isFixed) {
      // Extract month and day from the provided date
      const dateObj = new Date(formattedDate);
      const month = dateObj.getMonth() + 1; // 1-12
      const day = dateObj.getDate();

      // Create events for current year and next 10 years (to cover all foreseeable years)
      const startYear = parseInt(year);
      const yearsToCreate = [];
      for (let i = 0; i <= 10; i++) {
        yearsToCreate.push(startYear + i);
      }

      const insertedIds = [];
      for (const targetYear of yearsToCreate) {
        // Format the date for this year (YYYY-MM-DD)
        const yearDate = `${targetYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const [result] = await db.execute(`
          INSERT INTO tomorrow_ai_events (event_name, event_type, event_date, year, description, status, is_fixed_date, store_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [event_name, event_type, yearDate, targetYear, description, status || 'approved', true, storeId]);

        insertedIds.push(result.insertId);
      }

      res.json({ success: true, data: { ids: insertedIds, years: yearsToCreate } });
    } else {
      // For non-fixed events, create single event for the specified year
      const [result] = await db.execute(`
        INSERT INTO tomorrow_ai_events (event_name, event_type, event_date, year, description, status, is_fixed_date, store_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [event_name, event_type, formattedDate, year, description, status || 'approved', false, storeId]);

      res.json({ success: true, data: { id: result.insertId } });
    }
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Delete an event
 */
async function deleteEvent(req, res) {
  try {
    const { eventId } = req.params;

    // Get the event details first to find all related events
    const [events] = await db.execute(`
      SELECT event_name, year, store_id
      FROM tomorrow_ai_events
      WHERE id = ?
    `, [eventId]);

    if (events.length === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const event = events[0];

    // Delete ALL events with the same name, year, and store_id
    await db.execute(`
      DELETE FROM tomorrow_ai_events
      WHERE event_name = ? AND year = ? AND store_id = ?
    `, [event.event_name, event.year, event.store_id]);

    res.json({ success: true, message: 'Event deleted' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Update event dates (for multi-date selection)
 */
async function updateEventDates(req, res) {
  try {
    const { eventId } = req.params;
    const { dates } = req.body;

    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid dates array' });
    }

    // Get the event details first
    const [events] = await db.execute(`
      SELECT event_name, event_type, year, description, status, is_fixed_date, store_id
      FROM tomorrow_ai_events
      WHERE id = ?
    `, [eventId]);

    if (events.length === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const event = events[0];

    // Delete ALL events with the same name, year, and store_id to avoid duplicates
    await db.execute(`
      DELETE FROM tomorrow_ai_events
      WHERE event_name = ? AND year = ? AND store_id = ?
    `, [event.event_name, event.year, event.store_id]);

    // Create new events for each selected date
    for (const date of dates) {
      // Convert ISO date string to YYYY-MM-DD format if needed
      const formattedDate = date.includes('T') ? date.split('T')[0] : date;
      
      await db.execute(`
        INSERT INTO tomorrow_ai_events (event_name, event_type, event_date, year, description, status, is_fixed_date, store_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [event.event_name, event.event_type, formattedDate, event.year, event.description, event.status, false, event.store_id]);
    }

    res.json({ success: true, message: 'Event dates updated' });
  } catch (error) {
    console.error('Error updating event dates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getNextEvent,
  getUpcomingEvents,
  getEventForecast,
  getEventPattern,
  getAllEvents,
  updateEventStatus,
  createEvent,
  deleteEvent,
  updateEventDates
};
