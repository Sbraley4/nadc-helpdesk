const { PrismaClient } = require('@prisma/client');
const { addMonths, addYears, differenceInMonths, differenceInYears } = require('date-fns');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

// Maximum number of recurring occurrences to prevent runaway creation
const MAX_RECURRENCE_COUNT = 60;

/**
 * Calculate the total number of occurrences for a recurring series
 */
function calculateTotalOccurrences(startDate, frequency, untilDate) {
  if (frequency === 'MONTHLY') {
    return differenceInMonths(untilDate, startDate) + 1;
  } else if (frequency === 'YEARLY') {
    return differenceInYears(untilDate, startDate) + 1;
  }
  return 1;
}

/**
 * Generate recurring dates based on frequency
 * Handles month-length edge cases (e.g., Jan 31 -> Feb 28)
 * Generates up to MAX_RECURRENCE_COUNT + 1 dates to allow detection of overflow
 */
function generateRecurringDates(startDate, frequency, untilDate) {
  const dates = [new Date(startDate)];
  let currentDate = new Date(startDate);

  // Generate up to 61 dates (one past the cap) to detect overflow
  while (dates.length <= MAX_RECURRENCE_COUNT) {
    if (frequency === 'MONTHLY') {
      currentDate = addMonths(currentDate, 1);
    } else if (frequency === 'YEARLY') {
      currentDate = addYears(currentDate, 1);
    } else {
      break;
    }

    // Stop if we've passed the until date
    if (currentDate > untilDate) {
      break;
    }

    dates.push(new Date(currentDate));
  }

  return dates;
}

// Helper to transform event with flattened assignees
function transformEvent(event) {
  return {
    ...event,
    assignees: event.assignees?.map((a) => a.user) || [],
  };
}

// Get all calendar events (optionally filtered by date range)
exports.getEvents = async (req, res) => {
  try {
    const { startDate, endDate, assigneeId } = req.query;

    const where = {};

    // Filter by date range - must handle events that overlap the range:
    // - startTime is within range, OR
    // - endTime is within range, OR
    // - event spans the entire range (starts before, ends after)
    if (startDate && endDate) {
      const rangeStart = new Date(startDate);
      const rangeEnd = new Date(endDate);
      where.OR = [
        {
          startTime: {
            gte: rangeStart,
            lte: rangeEnd,
          },
        },
        {
          endTime: {
            gte: rangeStart,
            lte: rangeEnd,
          },
        },
        {
          AND: [
            { startTime: { lt: rangeStart } },
            { endTime: { gt: rangeEnd } },
          ],
        },
      ];
    } else if (startDate) {
      // Only start date provided - get events that start on or after
      where.startTime = { gte: new Date(startDate) };
    } else if (endDate) {
      // Only end date provided - get events that start on or before
      where.startTime = { lte: new Date(endDate) };
    }

    // Filter by assignee (check if any assignee matches)
    if (assigneeId) {
      where.assignees = {
        some: {
          userId: assigneeId,
        },
      };
    }

    const events = await prisma.calendarEvent.findMany({
      where,
      include: {
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    res.json(events.map(transformEvent));
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
};

// Get a single calendar event by ID
exports.getEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await prisma.calendarEvent.findUnique({
      where: { id },
      include: {
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }

    res.json(transformEvent(event));
  } catch (error) {
    console.error('Error fetching calendar event:', error);
    res.status(500).json({ error: 'Failed to fetch calendar event' });
  }
};

// Create a new calendar event (with optional recurring support)
exports.createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      startTime,
      endTime,
      allDay,
      color,
      assigneeIds = [],
      repeatFrequency = null, // 'MONTHLY' | 'YEARLY' | null
      repeatUntil = null, // ISO date string
    } = req.body;

    if (!title || !startTime) {
      return res.status(400).json({ error: 'Title and start time are required' });
    }

    const startDateTime = new Date(startTime);
    const endDateTime = endTime ? new Date(endTime) : null;
    const duration = endDateTime ? endDateTime.getTime() - startDateTime.getTime() : null;

    // Handle non-recurring event (existing behavior)
    if (!repeatFrequency) {
      const event = await prisma.$transaction(async (tx) => {
        const newEvent = await tx.calendarEvent.create({
          data: {
            title,
            description: description || null,
            startTime: startDateTime,
            endTime: endDateTime,
            allDay: allDay || false,
            color: color || null,
            recurrenceGroupId: null,
          },
        });

        if (assigneeIds.length > 0) {
          await tx.calendarEventAssignee.createMany({
            data: assigneeIds.map((userId) => ({
              eventId: newEvent.id,
              userId,
            })),
          });
        }

        return newEvent;
      });

      const fullEvent = await prisma.calendarEvent.findUnique({
        where: { id: event.id },
        include: {
          assignees: {
            include: {
              user: { select: { id: true, name: true, color: true } },
            },
          },
        },
      });

      return res.status(201).json(transformEvent(fullEvent));
    }

    // Handle recurring event
    if (!repeatUntil) {
      return res.status(400).json({ error: 'repeatUntil is required when repeatFrequency is set' });
    }

    if (!['MONTHLY', 'YEARLY'].includes(repeatFrequency)) {
      return res.status(400).json({ error: 'repeatFrequency must be MONTHLY or YEARLY' });
    }

    const untilDate = new Date(repeatUntil);
    const recurringDates = generateRecurringDates(startDateTime, repeatFrequency, untilDate);

    // Check if we would exceed the limit
    if (recurringDates.length > MAX_RECURRENCE_COUNT) {
      // Calculate the actual total for an accurate error message
      const actualCount = calculateTotalOccurrences(startDateTime, repeatFrequency, untilDate);
      return res.status(400).json({
        error: `Recurring series would create ${actualCount} events, which exceeds the maximum of ${MAX_RECURRENCE_COUNT}. Please choose a shorter date range.`,
      });
    }

    const recurrenceGroupId = uuidv4();

    const events = await prisma.$transaction(async (tx) => {
      const createdEvents = [];

      for (const occurrenceStart of recurringDates) {
        const occurrenceEnd = duration
          ? new Date(occurrenceStart.getTime() + duration)
          : null;

        const newEvent = await tx.calendarEvent.create({
          data: {
            title,
            description: description || null,
            startTime: occurrenceStart,
            endTime: occurrenceEnd,
            allDay: allDay || false,
            color: color || null,
            recurrenceGroupId,
          },
        });

        if (assigneeIds.length > 0) {
          await tx.calendarEventAssignee.createMany({
            data: assigneeIds.map((userId) => ({
              eventId: newEvent.id,
              userId,
            })),
          });
        }

        createdEvents.push(newEvent);
      }

      return createdEvents;
    });

    // Fetch the first event with full relations to return
    const fullEvent = await prisma.calendarEvent.findUnique({
      where: { id: events[0].id },
      include: {
        assignees: {
          include: {
            user: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    res.status(201).json({
      ...transformEvent(fullEvent),
      createdCount: events.length,
      recurrenceGroupId,
    });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
};

// Update a calendar event
exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, startTime, endTime, allDay, color, assigneeIds } = req.body;

    // Check if event exists
    const existing = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }

    await prisma.$transaction(async (tx) => {
      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (startTime !== undefined) updateData.startTime = new Date(startTime);
      if (endTime !== undefined) updateData.endTime = endTime ? new Date(endTime) : null;
      if (allDay !== undefined) updateData.allDay = allDay;
      if (color !== undefined) updateData.color = color;

      // Update the event
      if (Object.keys(updateData).length > 0) {
        await tx.calendarEvent.update({
          where: { id },
          data: updateData,
        });
      }

      // Handle assignee updates
      if (assigneeIds !== undefined) {
        // Delete existing assignees
        await tx.calendarEventAssignee.deleteMany({
          where: { eventId: id },
        });

        // Create new assignee associations
        if (assigneeIds.length > 0) {
          await tx.calendarEventAssignee.createMany({
            data: assigneeIds.map((userId) => ({
              eventId: id,
              userId,
            })),
          });
        }
      }
    });

    // Fetch the updated event
    const event = await prisma.calendarEvent.findUnique({
      where: { id },
      include: {
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
    });

    res.json(transformEvent(event));
  } catch (error) {
    console.error('Error updating calendar event:', error);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
};

// Delete a calendar event
exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if event exists
    const existing = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }

    // Delete assignees first (cascade should handle this, but be explicit)
    await prisma.calendarEventAssignee.deleteMany({ where: { eventId: id } });
    await prisma.calendarEvent.delete({ where: { id } });

    res.json({ message: 'Calendar event deleted successfully' });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
};
