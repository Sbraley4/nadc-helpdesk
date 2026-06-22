const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

// Create a new calendar event
exports.createEvent = async (req, res) => {
  try {
    const { title, description, startTime, endTime, allDay, color, assigneeIds = [] } = req.body;

    if (!title || !startTime) {
      return res.status(400).json({ error: 'Title and start time are required' });
    }

    const event = await prisma.$transaction(async (tx) => {
      // Create the event
      const newEvent = await tx.calendarEvent.create({
        data: {
          title,
          description: description || null,
          startTime: new Date(startTime),
          endTime: endTime ? new Date(endTime) : null,
          allDay: allDay || false,
          color: color || null,
        },
      });

      // Create assignee associations
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

    // Fetch the full event with relations
    const fullEvent = await prisma.calendarEvent.findUnique({
      where: { id: event.id },
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

    res.status(201).json(transformEvent(fullEvent));
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
