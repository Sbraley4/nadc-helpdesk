// server/controllers/reportController.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * GET /api/reports/ticket-volume
 * Ticket volume report grouped by day/week/month
 */
async function getTicketVolumeReport(req, res, next) {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const data = [];
    let totals = { created: 0, resolved: 0, closed: 0 };

    if (groupBy === 'month') {
      // Group by month
      let current = new Date(start.getFullYear(), start.getMonth(), 1);
      while (current <= end) {
        const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59, 999);
        const effectiveEnd = monthEnd > end ? end : monthEnd;

        const [created, resolved, closed] = await Promise.all([
          prisma.ticket.count({
            where: { createdAt: { gte: current, lte: effectiveEnd } },
          }),
          prisma.ticket.count({
            where: { resolvedAt: { gte: current, lte: effectiveEnd } },
          }),
          prisma.ticket.count({
            where: { closedAt: { gte: current, lte: effectiveEnd } },
          }),
        ]);

        data.push({
          date: current.toISOString().slice(0, 7), // YYYY-MM
          created,
          resolved,
          closed,
        });

        totals.created += created;
        totals.resolved += resolved;
        totals.closed += closed;

        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      }
    } else if (groupBy === 'week') {
      // Group by week
      let current = new Date(start);
      // Align to start of week (Sunday)
      current.setDate(current.getDate() - current.getDay());

      while (current <= end) {
        const weekEnd = new Date(current.getTime() + 6 * 24 * 60 * 60 * 1000);
        weekEnd.setHours(23, 59, 59, 999);
        const effectiveStart = current < start ? start : current;
        const effectiveEnd = weekEnd > end ? end : weekEnd;

        const [created, resolved, closed] = await Promise.all([
          prisma.ticket.count({
            where: { createdAt: { gte: effectiveStart, lte: effectiveEnd } },
          }),
          prisma.ticket.count({
            where: { resolvedAt: { gte: effectiveStart, lte: effectiveEnd } },
          }),
          prisma.ticket.count({
            where: { closedAt: { gte: effectiveStart, lte: effectiveEnd } },
          }),
        ]);

        data.push({
          date: current.toISOString().split('T')[0],
          created,
          resolved,
          closed,
        });

        totals.created += created;
        totals.resolved += resolved;
        totals.closed += closed;

        current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
    } else {
      // Group by day (default)
      let current = new Date(start);
      while (current <= end) {
        const dayEnd = new Date(current);
        dayEnd.setHours(23, 59, 59, 999);

        const [created, resolved, closed] = await Promise.all([
          prisma.ticket.count({
            where: { createdAt: { gte: current, lte: dayEnd } },
          }),
          prisma.ticket.count({
            where: { resolvedAt: { gte: current, lte: dayEnd } },
          }),
          prisma.ticket.count({
            where: { closedAt: { gte: current, lte: dayEnd } },
          }),
        ]);

        data.push({
          date: current.toISOString().split('T')[0],
          created,
          resolved,
          closed,
        });

        totals.created += created;
        totals.resolved += resolved;
        totals.closed += closed;

        current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    res.json({ data, totals });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reports/agent-performance
 * Agent performance metrics
 */
async function getAgentPerformanceReport(req, res, next) {
  try {
    const { startDate, endDate, agentId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Get agents to report on
    const agentWhere = agentId
      ? { id: agentId }
      : { isActive: true, role: { in: ['ADMIN', 'AGENT'] } };

    const agentsList = await prisma.user.findMany({
      where: agentWhere,
      select: { id: true, name: true },
    });

    const agents = await Promise.all(
      agentsList.map(async (agent) => {
        const ticketWhere = {
          assigneeId: agent.id,
          createdAt: { gte: start, lte: end },
        };

        const [
          ticketsAssigned,
          ticketsClosed,
          avgFirstResponse,
          avgResolution,
          slaBreachCount,
          totalTicketsForSla,
          hoursLogged,
          satisfactionPositive,
          satisfactionNegative,
        ] = await Promise.all([
          prisma.ticket.count({ where: ticketWhere }),
          prisma.ticket.count({
            where: { ...ticketWhere, status: 'CLOSED' },
          }),
          getAgentAvgFirstResponse(agent.id, start, end),
          getAgentAvgResolutionTime(agent.id, start, end),
          prisma.ticket.count({
            where: { ...ticketWhere, slaBreached: true },
          }),
          prisma.ticket.count({ where: ticketWhere }),
          getAgentTotalHours(agent.id, start, end),
          prisma.satisfactionRating.count({
            where: {
              ticket: { assigneeId: agent.id },
              ratedAt: { gte: start, lte: end },
              rating: 'POSITIVE',
            },
          }),
          prisma.satisfactionRating.count({
            where: {
              ticket: { assigneeId: agent.id },
              ratedAt: { gte: start, lte: end },
              rating: 'NEGATIVE',
            },
          }),
        ]);

        const slaCompliancePercent = totalTicketsForSla > 0
          ? Math.round(((totalTicketsForSla - slaBreachCount) / totalTicketsForSla) * 100)
          : 100;

        return {
          agentId: agent.id,
          agentName: agent.name,
          ticketsAssigned,
          ticketsClosed,
          avgFirstResponseHours: avgFirstResponse,
          avgResolutionHours: avgResolution,
          slaBreachCount,
          slaCompliancePercent,
          totalHoursLogged: hoursLogged,
          satisfactionPositive,
          satisfactionNegative,
        };
      })
    );

    res.json({ agents });
  } catch (error) {
    next(error);
  }
}

async function getAgentAvgFirstResponse(agentId, start, end) {
  const tickets = await prisma.ticket.findMany({
    where: {
      assigneeId: agentId,
      createdAt: { gte: start, lte: end },
      firstResponseAt: { not: null },
    },
    select: { createdAt: true, firstResponseAt: true },
  });

  if (tickets.length === 0) return null;

  const totalMs = tickets.reduce((sum, t) => {
    return sum + (t.firstResponseAt.getTime() - t.createdAt.getTime());
  }, 0);

  return Math.round((totalMs / tickets.length / (1000 * 60 * 60)) * 100) / 100;
}

async function getAgentAvgResolutionTime(agentId, start, end) {
  const tickets = await prisma.ticket.findMany({
    where: {
      assigneeId: agentId,
      createdAt: { gte: start, lte: end },
      resolvedAt: { not: null },
    },
    select: { createdAt: true, resolvedAt: true },
  });

  if (tickets.length === 0) return null;

  const totalMs = tickets.reduce((sum, t) => {
    return sum + (t.resolvedAt.getTime() - t.createdAt.getTime());
  }, 0);

  return Math.round((totalMs / tickets.length / (1000 * 60 * 60)) * 100) / 100;
}

async function getAgentTotalHours(agentId, start, end) {
  const result = await prisma.timeEntry.aggregate({
    where: {
      agentId,
      date: { gte: start, lte: end },
    },
    _sum: { hours: true, minutes: true },
  });

  const hours = result._sum.hours || 0;
  const minutes = result._sum.minutes || 0;
  return Math.round((hours + minutes / 60) * 100) / 100;
}

module.exports = {
  getTicketVolumeReport,
  getAgentPerformanceReport,
};
