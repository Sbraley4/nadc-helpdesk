const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Calculate duration in hours from startTime and endTime
function calculateDuration(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  let totalMinutes = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
  if (totalMinutes < 0) totalMinutes += 24 * 60; // Handle overnight
  return Math.round((totalMinutes / 60) * 100) / 100; // Round to 2 decimals
}

// GET /api/tickets/:ticketId/time-entries
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

    // Calculate total hours
    const totalHours = entries.reduce((sum, e) => sum + e.duration, 0);
    const totalFormatted = `${Math.floor(totalHours)}h ${Math.round((totalHours % 1) * 60)}m`;

    // Calculate per-agent breakdown
    const agentBreakdown = {};
    entries.forEach((entry) => {
      const agentName = entry.agent.name;
      if (!agentBreakdown[agentName]) {
        agentBreakdown[agentName] = 0;
      }
      agentBreakdown[agentName] += entry.duration;
    });

    res.json({
      entries,
      totalHours,
      totalFormatted,
      agentBreakdown,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/tickets/:ticketId/time-entries
async function createTimeEntry(req, res, next) {
  try {
    const { ticketId } = req.params;
    console.log('[DEBUG] Time entry req.body received:', JSON.stringify(req.body, null, 2));
    const { date, startTime, endTime, agentId, notes } = req.body;

    // Validate
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'Start time and end time are required' });
    }

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Calculate duration
    const duration = calculateDuration(startTime, endTime);
    if (duration <= 0) {
      return res.status(400).json({ error: 'Duration must be greater than 0' });
    }

    // Use provided agentId or current user
    const actualAgentId = agentId || req.user.id;

    const entry = await prisma.timeEntry.create({
      data: {
        ticketId,
        agentId: actualAgentId,
        date: new Date(date),
        startTime,
        endTime,
        duration,
        notes,
      },
      include: {
        agent: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // Create activity log
    const hours = Math.floor(duration);
    const minutes = Math.round((duration % 1) * 60);
    const timeLogged = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;

    await prisma.ticketActivity.create({
      data: {
        ticketId,
        type: 'time_logged',
        description: `Time logged: ${timeLogged} (${startTime} - ${endTime})`,
        userId: req.user.id,
        metadata: { startTime, endTime, duration, notes },
      },
    });

    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
}

// PUT /api/tickets/:ticketId/time-entries/:entryId
async function updateTimeEntry(req, res, next) {
  try {
    const { ticketId, entryId } = req.params;
    const { date, startTime, endTime, agentId, notes } = req.body;

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
    if (startTime !== undefined) updateData.startTime = startTime;
    if (endTime !== undefined) updateData.endTime = endTime;
    if (agentId !== undefined) updateData.agentId = agentId;
    if (notes !== undefined) updateData.notes = notes;

    // Recalculate duration if times changed
    const newStartTime = startTime !== undefined ? startTime : existing.startTime;
    const newEndTime = endTime !== undefined ? endTime : existing.endTime;
    updateData.duration = calculateDuration(newStartTime, newEndTime);

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

// DELETE /api/tickets/:ticketId/time-entries/:entryId
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
