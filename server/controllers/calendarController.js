const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// GET /api/calendar
// Returns ticket schedules and time entries for a date range
// Now fetches from TicketSchedule table for multi-day scheduling support
async function getCalendarTickets(req, res, next) {
  try {
    const { start, end, assigneeId } = req.query;

    // Validate required params
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    // Build where clause for ticket schedules
    // A schedule is in range if:
    // - scheduledStart is within range, OR
    // - scheduledEnd is within range, OR
    // - schedule spans the entire range (start before, end after)
    const scheduleWhere = {
      OR: [
        {
          scheduledStart: {
            gte: startDate,
            lte: endDate,
          },
        },
        {
          scheduledEnd: {
            gte: startDate,
            lte: endDate,
          },
        },
        {
          AND: [
            { scheduledStart: { lt: startDate } },
            { scheduledEnd: { gt: endDate } },
          ],
        },
      ],
    };

    // If filtering by assignee, add ticket relation filter
    if (assigneeId) {
      scheduleWhere.ticket = {
        OR: [
          { assigneeId: assigneeId },
          { additionalAssignees: { some: { userId: assigneeId } } },
        ],
      };
    }

    // Fetch ticket schedules with full ticket data
    const schedules = await prisma.ticketSchedule.findMany({
      where: scheduleWhere,
      include: {
        ticket: {
          include: {
            assignee: {
              select: { id: true, name: true, avatar: true, color: true },
            },
            additionalAssignees: {
              include: {
                user: {
                  select: { id: true, name: true, avatar: true, color: true },
                },
              },
            },
            requester: {
              select: { id: true, name: true },
            },
            company: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: [{ scheduledStart: 'asc' }],
    });

    // Build where clause for time entries
    const timeWhere = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (assigneeId) {
      timeWhere.agentId = assigneeId;
    }

    // Fetch time entries in range
    const timeEntries = await prisma.timeEntry.findMany({
      where: timeWhere,
      include: {
        agent: {
          select: { id: true, name: true, avatar: true },
        },
        ticket: {
          select: { id: true, ticketNumber: true, subject: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Group time entries by date
    // Note: entry.duration is stored as Float in hours (e.g., 3.5 = 3h 30m)
    const timeByDate = {};
    for (const entry of timeEntries) {
      const dateKey = entry.date.toISOString().split('T')[0];
      if (!timeByDate[dateKey]) {
        timeByDate[dateKey] = {
          totalDuration: 0, // Accumulated duration in hours
          totalHours: 0,
          totalMinutes: 0,
          entries: [],
        };
      }
      timeByDate[dateKey].totalDuration += entry.duration || 0;
      timeByDate[dateKey].entries.push(entry);
    }

    // Convert decimal hours to hours + minutes for API compatibility
    for (const dateKey of Object.keys(timeByDate)) {
      const day = timeByDate[dateKey];
      day.totalHours = Math.floor(day.totalDuration);
      day.totalMinutes = Math.round((day.totalDuration - day.totalHours) * 60);
    }

    // Format schedule entries for calendar
    // Each schedule entry appears as a separate item on the calendar
    // A ticket with 2 schedules will appear twice
    const formattedTickets = schedules.map((schedule) => ({
      // Schedule-specific fields
      scheduleId: schedule.id,
      scheduledStart: schedule.scheduledStart,
      scheduledEnd: schedule.scheduledEnd,
      isAllDay: schedule.isAllDay,
      // Legacy fields for backwards compatibility with frontend
      dueDate: schedule.scheduledStart,
      // Ticket data (flattened)
      id: schedule.ticket.id,
      ticketNumber: schedule.ticket.ticketNumber,
      subject: schedule.ticket.subject,
      status: schedule.ticket.status,
      priority: schedule.ticket.priority,
      assignee: schedule.ticket.assignee,
      additionalAssignees: schedule.ticket.additionalAssignees?.map((ta) => ta.user) || [],
      requester: schedule.ticket.requester,
      company: schedule.ticket.company,
    }));

    res.json({
      tickets: formattedTickets,
      timeByDate,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/calendar/workload
// Returns workload summary by agent for a date range
// Only includes tickets that have a TicketSchedule entry within the date range
async function getWorkloadSummary(req, res, next) {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    // Build schedule date filter - a schedule is in range if:
    // - scheduledStart is within range, OR
    // - scheduledEnd is within range, OR
    // - schedule spans the entire range (start before, end after)
    const scheduleInRange = {
      OR: [
        {
          scheduledStart: {
            gte: startDate,
            lte: endDate,
          },
        },
        {
          scheduledEnd: {
            gte: startDate,
            lte: endDate,
          },
        },
        {
          AND: [
            { scheduledStart: { lt: startDate } },
            { scheduledEnd: { gt: endDate } },
          ],
        },
      ],
    };

    // Get all agents (including ADMIN role)
    const agents = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'AGENT'] },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        availability: true,
      },
    });

    // For each agent, get their tickets that have schedules in the date range
    const workload = await Promise.all(
      agents.map(async (agent) => {
        const [tickets, timeEntries] = await Promise.all([
          prisma.ticket.findMany({
            where: {
              assigneeId: agent.id,
              status: { in: ['OPEN', 'PENDING'] },
              schedules: {
                some: scheduleInRange,
              },
            },
            select: {
              id: true,
              ticketNumber: true,
              subject: true,
              status: true,
              priority: true,
              dueDate: true,
              requester: {
                select: { id: true, name: true },
              },
              schedules: {
                where: scheduleInRange,
                select: {
                  id: true,
                  scheduledStart: true,
                  scheduledEnd: true,
                  isAllDay: true,
                },
                orderBy: { scheduledStart: 'asc' },
              },
            },
            orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
          }),
          prisma.timeEntry.aggregate({
            where: {
              agentId: agent.id,
              date: {
                gte: startDate,
                lte: endDate,
              },
            },
            _sum: {
              duration: true,
            },
          }),
        ]);

        // duration is stored as Float in hours (e.g., 3.5 = 3h 30m)
        const totalHours = Math.floor(timeEntries._sum.duration || 0);

        return {
          agentId: agent.id,
          agent,
          tickets: tickets.map(t => ({
            ...t,
            contact: t.requester, // Frontend expects 'contact' not 'requester'
          })),
          ticketCount: tickets.length,
          totalHours,
        };
      })
    );

    // Get unassigned tickets that have schedules in the date range
    const unassignedTickets = await prisma.ticket.findMany({
      where: {
        assigneeId: null,
        status: { in: ['OPEN', 'PENDING'] },
        schedules: {
          some: scheduleInRange,
        },
      },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        status: true,
        priority: true,
        dueDate: true,
        requester: {
          select: { id: true, name: true },
        },
        schedules: {
          where: scheduleInRange,
          select: {
            id: true,
            scheduledStart: true,
            scheduledEnd: true,
            isAllDay: true,
          },
          orderBy: { scheduledStart: 'asc' },
        },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });

    // Always add unassigned column
    workload.push({
      agentId: null,
      agent: null,
      tickets: unassignedTickets.map(t => ({
        ...t,
        contact: t.requester,
      })),
      ticketCount: unassignedTickets.length,
      totalHours: 0,
    });

    res.json({ workload });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCalendarTickets,
  getWorkloadSummary,
};
