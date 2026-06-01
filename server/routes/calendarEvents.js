const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const calendarEventsController = require('../controllers/calendarEventsController');

// All routes require authentication
router.use(requireAuth);

// GET /api/calendar-events - Get all calendar events (optionally filtered)
router.get('/', calendarEventsController.getEvents);

// GET /api/calendar-events/:id - Get a single calendar event
router.get('/:id', calendarEventsController.getEvent);

// POST /api/calendar-events - Create a new calendar event
router.post('/', calendarEventsController.createEvent);

// PUT /api/calendar-events/:id - Update a calendar event
router.put('/:id', calendarEventsController.updateEvent);

// DELETE /api/calendar-events/:id - Delete a calendar event
router.delete('/:id', calendarEventsController.deleteEvent);

module.exports = router;
