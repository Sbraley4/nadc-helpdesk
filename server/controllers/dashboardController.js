// server/controllers/dashboardController.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Format hours to "Xh Ym" string
 */
function formatHours(totalHours) {
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * GET /api/dashboard/stats
 * Returns all dashboard widget data
 */
async function getDashboardStats(req, res, next) {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run all queries in parallel
    const [
      ticketCounts,
      avgResponseData,
      avgResolutionData,
      ticketsByPriority,
      ticketsByStatus,
      ticketsByType,
      createdVsResolved,
      agentWorkload,
      topCompanies,
      recentActivity,
      satisfactionData,
      timeTrackedData,
      materialsData,
    ] = await Promise.all([
      // Ticket counts
      getTicketCounts(todayStart),
      // Avg response time (last 30 days)
      getAvgResponseTime(thirtyDaysAgo),
      // Avg resolution time (last 30 days)
      getAvgResolutionTime(thirtyDaysAgo),
      // Tickets by priority
      getTicketsByPriority(),
      // Tickets by status
      getTicketsByStatus(),
      // Tickets by type
      getTicketsByType(),
      // Created vs resolved (last 30 days)
      getCreatedVsResolved(thirtyDaysAgo),
      // Agent workload
      getAgentWorkload(monthStart),
      // Top companies
      getTopCompanies(),
      // Recent activity
      getRecentActivity(),
      // Satisfaction summary
      getSatisfactionSummary(),
      // Time tracked this month
      getTimeTrackedThisMonth(monthStart),
      // Materials this month
      getMaterialsThisMonth(monthStart),
    ]);

    res.json({
      ticketCounts,
      avgResponseTime: avgResponseData,
      avgResolutionTime: avgResolutionData,
      ticketsByPriority,
      ticketsByStatus,
      ticketsByType,
      createdVsResolved,
      agentWorkload,
      topCompanies,
      recentActivity,
      satisfactionSummary: satisfactionData,
      timeTrackedThisMonth: timeTrackedData,
      materialsThisMonth: materialsData,
    });
  } catch (error) {
    next(error);
  }
}

async function getTicketCounts(todayStart) {
  const now = new Date();

  const [total, open, pending, resolved, closed, overdue, slaBreached, createdToday, resolvedToday] =
    await Promise.all([
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: 'OPEN' } }),
      prisma.ticket.count({ where: { status: 'PENDING' } }),
      prisma.ticket.count({ where: { status: 'INVOICED' } }),
      prisma.ticket.count({ where: { status: 'CLOSED' } }),
      prisma.ticket.count({
        where: {
          dueDate: { lt: now },
          status: { notIn: ['CLOSED', 'INVOICED', 'POSTED'] },
        },
      }),
      prisma.ticket.count({ where: { slaBreached: true } }),
      prisma.ticket.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.ticket.count({
        where: {
          resolvedAt: { gte: todayStart },
        },
      }),
    ]);

  return { total, open, pending, resolved, closed, overdue, slaBreached, createdToday, resolvedToday };
}

async function getAvgResponseTime(since) {
  const tickets = await prisma.ticket.findMany({
    where: {
      firstResponseAt: { not: null },
      createdAt: { gte: since },
    },
    select: { createdAt: true, firstResponseAt: true },
  });

  if (tickets.length === 0) {
    return { hours: 0, formatted: '—' };
  }

  const totalMs = tickets.reduce((sum, t) => {
    return sum + (t.firstResponseAt.getTime() - t.createdAt.getTime());
  }, 0);

  const avgHours = totalMs / tickets.length / (1000 * 60 * 60);
  return { hours: Math.round(avgHours * 100) / 100, formatted: formatHours(avgHours) };
}

async function getAvgResolutionTime(since) {
  const tickets = await prisma.ticket.findMany({
    where: {
      resolvedAt: { not: null },
      createdAt: { gte: since },
    },
    select: { createdAt: true, resolvedAt: true },
  });

  if (tickets.length === 0) {
    return { hours: 0, formatted: '—' };
  }

  const totalMs = tickets.reduce((sum, t) => {
    return sum + (t.resolvedAt.getTime() - t.createdAt.getTime());
  }, 0);

  const avgHours = totalMs / tickets.length / (1000 * 60 * 60);
  return { hours: Math.round(avgHours * 100) / 100, formatted: formatHours(avgHours) };
}

async function getTicketsByPriority() {
  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const counts = await Promise.all(
    priorities.map(async (priority) => ({
      priority,
      count: await prisma.ticket.count({ where: { priority } }),
    }))
  );
  return counts;
}

async function getTicketsByStatus() {
  const statuses = ['OPEN', 'PENDING', 'INVOICED', 'POSTED', 'CLOSED'];
  const counts = await Promise.all(
    statuses.map(async (status) => ({
      status,
      count: await prisma.ticket.count({ where: { status } }),
    }))
  );
  return counts;
}

async function getTicketsByType() {
  const types = ['QUESTION', 'INCIDENT', 'PROBLEM', 'FEATURE_REQUEST'];
  const counts = await Promise.all(
    types.map(async (type) => ({
      type,
      count: await prisma.ticket.count({ where: { type } }),
    }))
  );
  return counts;
}

async function getCreatedVsResolved(since) {
  const days = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const [created, resolved] = await Promise.all([
      prisma.ticket.count({
        where: { createdAt: { gte: dayStart, lt: dayEnd } },
      }),
      prisma.ticket.count({
        where: { resolvedAt: { gte: dayStart, lt: dayEnd } },
      }),
    ]);

    days.push({
      date: dayStart.toISOString().split('T')[0],
      created,
      resolved,
    });
  }

  return days;
}

async function getAgentWorkload(monthStart) {
  const agents = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['ADMIN', 'AGENT'] } },
    select: { id: true, name: true, avatar: true },
  });

  const workload = await Promise.all(
    agents.map(async (agent) => {
      const [open, pending, resolvedThisMonth, avgResolution, hoursLogged] = await Promise.all([
        prisma.ticket.count({ where: { assigneeId: agent.id, status: 'OPEN' } }),
        prisma.ticket.count({ where: { assigneeId: agent.id, status: 'PENDING' } }),
        prisma.ticket.count({
          where: { assigneeId: agent.id, resolvedAt: { gte: monthStart } },
        }),
        getAgentAvgResolution(agent.id),
        getAgentHoursLogged(agent.id, monthStart),
      ]);

      return {
        agentId: agent.id,
        agentName: agent.name,
        agentAvatar: agent.avatar,
        open,
        pending,
        resolvedThisMonth,
        avgResolutionHours: avgResolution,
        hoursLogged,
      };
    })
  );

  return workload;
}

async function getAgentAvgResolution(agentId) {
  const tickets = await prisma.ticket.findMany({
    where: {
      assigneeId: agentId,
      resolvedAt: { not: null },
    },
    select: { createdAt: true, resolvedAt: true },
    take: 50,
    orderBy: { resolvedAt: 'desc' },
  });

  if (tickets.length === 0) return null;

  const totalMs = tickets.reduce((sum, t) => {
    return sum + (t.resolvedAt.getTime() - t.createdAt.getTime());
  }, 0);

  return Math.round((totalMs / tickets.length / (1000 * 60 * 60)) * 100) / 100;
}

async function getAgentHoursLogged(agentId, since) {
  const entries = await prisma.timeEntry.aggregate({
    where: { agentId, date: { gte: since } },
    _sum: { hours: true, minutes: true },
  });

  const hours = entries._sum.hours || 0;
  const minutes = entries._sum.minutes || 0;
  return Math.round((hours + minutes / 60) * 100) / 100;
}

async function getTopCompanies() {
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      _count: { select: { tickets: true } },
      tickets: {
        where: { status: { in: ['OPEN', 'PENDING'] } },
        select: { id: true },
      },
    },
    orderBy: { tickets: { _count: 'desc' } },
    take: 5,
  });

  return companies.map((c) => ({
    companyId: c.id,
    companyName: c.name,
    openTickets: c.tickets.length,
    totalTickets: c._count.tickets,
  }));
}

async function getRecentActivity() {
  const activities = await prisma.ticketActivity.findMany({
    include: {
      user: { select: { id: true, name: true, avatar: true } },
      ticket: { select: { id: true, ticketNumber: true, subject: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return activities.map((a) => ({
    id: a.id,
    type: a.type,
    description: a.description,
    ticketId: a.ticket.id,
    ticketNumber: a.ticket.ticketNumber,
    ticketSubject: a.ticket.subject,
    user: a.user,
    createdAt: a.createdAt,
  }));
}

async function getSatisfactionSummary() {
  const [total, positive, negative] = await Promise.all([
    prisma.satisfactionRating.count(),
    prisma.satisfactionRating.count({ where: { rating: 'POSITIVE' } }),
    prisma.satisfactionRating.count({ where: { rating: 'NEGATIVE' } }),
  ]);

  return {
    total,
    positive,
    negative,
    positivePercent: total > 0 ? Math.round((positive / total) * 100) : null,
  };
}

async function getTimeTrackedThisMonth(monthStart) {
  const result = await prisma.timeEntry.aggregate({
    where: { date: { gte: monthStart } },
    _sum: { hours: true, minutes: true },
  });

  const totalHours = result._sum.hours || 0;
  const totalMinutes = result._sum.minutes || 0;
  const adjustedHours = totalHours + Math.floor(totalMinutes / 60);
  const adjustedMinutes = totalMinutes % 60;

  return {
    totalHours: adjustedHours,
    totalMinutes: adjustedMinutes,
    formatted: formatHours(adjustedHours + adjustedMinutes / 60),
  };
}

async function getMaterialsThisMonth(monthStart) {
  const result = await prisma.materialEntry.aggregate({
    where: { createdAt: { gte: monthStart } },
    _sum: { totalCost: true },
  });

  const totalCost = result._sum.totalCost || 0;

  return {
    totalCost,
    formatted: `$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  };
}

/**
 * GET /api/dashboard/trends
 * Returns trend data for specified period
 */
async function getDashboardTrends(req, res, next) {
  try {
    const { period = '30d' } = req.query;

    let days;
    switch (period) {
      case '7d':
        days = 7;
        break;
      case '90d':
        days = 90;
        break;
      default:
        days = 30;
    }

    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const [createdVsResolved, avgResponseTrend, slaComplianceRate] = await Promise.all([
      getTrendCreatedVsResolved(since, days),
      getAvgResponseTrend(since, days),
      getSlaComplianceTrend(since, days),
    ]);

    res.json({
      createdVsResolved,
      avgResponseTrend,
      slaComplianceRate,
    });
  } catch (error) {
    next(error);
  }
}

async function getTrendCreatedVsResolved(since, days) {
  const result = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const [created, resolved] = await Promise.all([
      prisma.ticket.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } }),
      prisma.ticket.count({ where: { resolvedAt: { gte: dayStart, lt: dayEnd } } }),
    ]);

    result.push({
      date: dayStart.toISOString().split('T')[0],
      created,
      resolved,
    });
  }

  return result;
}

async function getAvgResponseTrend(since, days) {
  const result = [];
  const now = new Date();

  // Group by week if > 30 days
  const groupByWeek = days > 30;
  const interval = groupByWeek ? 7 : 1;

  for (let i = Math.floor(days / interval) - 1; i >= 0; i--) {
    const endDate = new Date(now.getTime() - i * interval * 24 * 60 * 60 * 1000);
    const startDate = new Date(endDate.getTime() - interval * 24 * 60 * 60 * 1000);

    const tickets = await prisma.ticket.findMany({
      where: {
        firstResponseAt: { not: null },
        createdAt: { gte: startDate, lt: endDate },
      },
      select: { createdAt: true, firstResponseAt: true },
    });

    let avgHours = 0;
    if (tickets.length > 0) {
      const totalMs = tickets.reduce((sum, t) => {
        return sum + (t.firstResponseAt.getTime() - t.createdAt.getTime());
      }, 0);
      avgHours = totalMs / tickets.length / (1000 * 60 * 60);
    }

    result.push({
      date: startDate.toISOString().split('T')[0],
      avgHours: Math.round(avgHours * 100) / 100,
    });
  }

  return result;
}

async function getSlaComplianceTrend(since, days) {
  const result = [];
  const now = new Date();

  const groupByWeek = days > 30;
  const interval = groupByWeek ? 7 : 1;

  for (let i = Math.floor(days / interval) - 1; i >= 0; i--) {
    const endDate = new Date(now.getTime() - i * interval * 24 * 60 * 60 * 1000);
    const startDate = new Date(endDate.getTime() - interval * 24 * 60 * 60 * 1000);

    const [total, breached] = await Promise.all([
      prisma.ticket.count({
        where: { createdAt: { gte: startDate, lt: endDate } },
      }),
      prisma.ticket.count({
        where: {
          createdAt: { gte: startDate, lt: endDate },
          slaBreached: true,
        },
      }),
    ]);

    const compliant = total - breached;
    const compliantPercent = total > 0 ? Math.round((compliant / total) * 100) : 100;

    result.push({
      date: startDate.toISOString().split('T')[0],
      compliantPercent,
    });
  }

  return result;
}

module.exports = {
  getDashboardStats,
  getDashboardTrends,
  formatHours,
};
