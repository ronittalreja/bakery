// Tomorrow AI Event Routes
// API endpoints for event-based demand forecasting

const express = require('express');
const router = express.Router();
const {
  getNextEvent,
  getUpcomingEvents,
  getEventForecast,
  getEventPattern,
  getAllEvents,
  updateEventStatus
} = require('../controllers/tomorrowAIEventController');

// Get next upcoming event
// GET /api/tomorrow-ai/events/next
router.get('/next', getNextEvent);

// Get upcoming events
// GET /api/tomorrow-ai/events/upcoming
router.get('/upcoming', getUpcomingEvents);

// Get event forecast with historical comparison
// GET /api/tomorrow-ai/events/forecast
router.get('/forecast', getEventForecast);

// Get 7-day event pattern for a product
// GET /api/tomorrow-ai/events/pattern
router.get('/pattern', getEventPattern);

// Get all events for management
// GET /api/tomorrow-ai/events/all
router.get('/all', getAllEvents);

// Update event status (approve/reject)
// PUT /api/tomorrow-ai/events/:eventId/status
router.put('/:eventId/status', updateEventStatus);

module.exports = router;
