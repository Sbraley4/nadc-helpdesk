const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// GET /api/calendar
// Returns tickets and time entries for a date range
async function getCalendarTickets(req, res, next) {
  try {
    const { start, end, assigneeId } = req.query;

    // Validate required params
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    // Build where clause for tickets
    const ticketWhere = {
      dueDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (assigneeId) {
      ticketWhere.assigneeId = assigneeId;
    }

    // Fetch tickets with due dates in range
    const tickets = await prisma.ticket.findMany({
      where: ticketWhere,
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
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
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
    const timeByDate = {};
    for (const entry of timeEntries) {
      const dateKey = entry.date.toISOString().split('T')[0];
      if (!timeByDate[dateKey]) {
        timeByDate[dateKey] = {
          totalHours: 0,
          totalMinutes: 0,
          entries: [],
        };
      }
      timeByDate[dateKey].totalHours += entry.hours;
      timeByDate[dateKey].totalMinutes += entry.minutes;
      timeByDate[dateKey].entries.push(entry);
    }

    // Normalize minutes (convert excess minutes to hours)
    for (const dateKey of Object.keys(timeByDate)) {
      const day = timeByDate[dateKey];
      day.totalHours += Math.floor(day.totalMinutes / 60);
      day.totalMinutes = day.totalMinutes % 60;
    }

    // Format tickets for calendar
    const formattedTickets = tickets.map((ticket) => ({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      dueDate: ticket.dueDate,
      assignee: ticket.assignee,
      additionalAssignees: ticket.additionalAssignees?.map((ta) => ta.user) || [],
      requester: ticket.requester,
      company: ticket.company,
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
async function getWorkloadSummary(req, res, next) {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

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

    // For each agent, get their open/pending tickets
    const workload = await Promise.all(
      agents.map(async (agent) => {
        const [tickets, timeEntries] = await Promise.all([
          prisma.ticket.findMany({
            where: {
              assigneeId: agent.id,
              status: { in: ['OPEN', 'PENDING'] },
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
              hours: true,
              minutes: true,
            },
          }),
        ]);

        const totalHours = (timeEntries._sum.hours || 0) +
          Math.floor((timeEntries._sum.minutes || 0) / 60);

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

    // Get unassigned tickets
    const unassignedTickets = await prisma.ticket.findMany({
      where: {
        assigneeId: null,
        status: { in: ['OPEN', 'PENDING'] },
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
