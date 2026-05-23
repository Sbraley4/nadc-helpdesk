const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Format total time as "Xh Ym"
function formatTime(totalHours, totalMinutes) {
  const hours = totalHours + Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

// GET /api/tickets/:ticketId/time
async function getTimeEntries(req, res, next) {
  try {
    const { ticketId } = req.params;

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const entries = await prisma.timeEntry.findMany({
      where: { ticketId },
      include: {
        agent: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Calculate totals
    const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
    const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
    const totalFormatted = formatTime(totalHours, totalMinutes);

    res.json({
      entries,
      totalHours,
      totalMinutes,
      totalFormatted,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/tickets/:ticketId/time
async function createTimeEntry(req, res, next) {
  try {
    const { ticketId } = req.params;
    const { date, hours = 0, minutes = 0, description } = req.body;

    // Validate
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    if (hours + minutes <= 0) {
      return res.status(400).json({ error: 'Time must be greater than 0' });
    }

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const entry = await prisma.timeEntry.create({
      data: {
        ticketId,
        agentId: req.user.id,
        date: new Date(date),
        hours: parseInt(hours, 10),
        minutes: parseInt(minutes, 10),
        description,
      },
      include: {
        agent: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // Create activity log
    const timeLogged = formatTime(parseInt(hours, 10), parseInt(minutes, 10));
    const activityDesc = description
      ? `Time logged: ${timeLogged} — ${description}`
      : `Time logged: ${timeLogged}`;

    await prisma.ticketActivity.create({
      data: {
        ticketId,
        type: 'time_logged',
        description: activityDesc,
        userId: req.user.id,
        metadata: { hours, minutes, description },
      },
    });

    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
}

// PUT /api/tickets/:ticketId/time/:entryId
async function updateTimeEntry(req, res, next) {
  try {
    const { ticketId, entryId } = req.params;
    const { date, hours, minutes, description } = req.body;

    // Find existing entry
    const existing = await prisma.timeEntry.findUnique({
      where: { id: entryId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Time entry not found' });
    }

    if (existing.ticketId !== ticketId) {
      return res.status(400).json({ error: 'Entry does not belong to this ticket' });
    }

    // Only owner or ADMIN can edit
    if (existing.agentId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to edit this entry' });
    }

    const updateData = {};
    if (date !== undefined) updateData.date = new Date(date);
    if (hours !== undefined) updateData.hours = parseInt(hours, 10);
    if (minutes !== undefined) updateData.minutes = parseInt(minutes, 10);
    if (description !== undefined) updateData.description = description;

    const entry = await prisma.timeEntry.update({
      where: { id: entryId },
      data: updateData,
      include: {
        agent: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    res.json(entry);
  } catch (error) {
    next(error);
  }
}

// DELETE /api/tickets/:ticketId/time/:entryId
async function deleteTimeEntry(req, res, next) {
  try {
    const { ticketId, entryId } = req.params;

    // Find existing entry
    const existing = await prisma.timeEntry.findUnique({
      where: { id: entryId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Time entry not found' });
    }

    if (existing.ticketId !== ticketId) {
      return res.status(400).json({ error: 'Entry does not belong to this ticket' });
    }

    // Only owner or ADMIN can delete
    if (existing.agentId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to delete this entry' });
    }

    await prisma.timeEntry.delete({
      where: { id: entryId },
    });

    res.json({ message: 'Time entry deleted' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTimeEntries,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
};
