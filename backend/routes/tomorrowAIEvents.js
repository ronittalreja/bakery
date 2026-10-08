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
  updateEventStatus,
  createEvent,
  deleteEvent,
  updateEventDates
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

// Create a new event
// POST /api/tomorrow-ai/events
router.post('/', createEvent);

// Delete an event
// DELETE /api/tomorrow-ai/events/:eventId
router.delete('/:eventId', deleteEvent);

// Update event status (approve/reject)
// PUT /api/tomorrow-ai/events/:eventId/status
router.put('/:eventId/status', updateEventStatus);

// Update event dates (multi-date selection)
// PUT /api/tomorrow-ai/events/:eventId/dates
router.put('/:eventId/dates', updateEventDates);

module.exports = router;
