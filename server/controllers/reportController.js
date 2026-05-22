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

/**
 * GET /api/reports/sla-compliance
 * SLA compliance breakdown
 */
async function getSLAComplianceReport(req, res, next) {
  try {
    const { startDate, endDate, priority } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const baseWhere = {
      createdAt: { gte: start, lte: end },
      ...(priority && { priority }),
    };

    // Overall compliance
    const [totalTickets, breachedTickets] = await Promise.all([
      prisma.ticket.count({ where: baseWhere }),
      prisma.ticket.count({ where: { ...baseWhere, slaBreached: true } }),
    ]);

    const compliant = totalTickets - breachedTickets;
    const compliancePercent = totalTickets > 0
      ? Math.round((compliant / totalTickets) * 100)
      : 100;

    // By priority
    const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    const byPriority = await Promise.all(
      priorities.map(async (p) => {
        const [total, breached] = await Promise.all([
          prisma.ticket.count({
            where: { createdAt: { gte: start, lte: end }, priority: p },
          }),
          prisma.ticket.count({
            where: { createdAt: { gte: start, lte: end }, priority: p, slaBreached: true },
          }),
        ]);

        return {
          priority: p,
          compliant: total - breached,
          breached,
          compliancePercent: total > 0 ? Math.round(((total - breached) / total) * 100) : 100,
        };
      })
    );

    // Breached tickets list
    const breachedTicketsList = await prisma.ticket.findMany({
      where: { ...baseWhere, slaBreached: true },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        priority: true,
        createdAt: true,
        assignee: { select: { name: true } },
        activities: {
          where: { type: 'SLA_BREACHED' },
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const breachedTicketsFormatted = breachedTicketsList.map((t) => ({
      ticketId: t.id,
      ticketNumber: t.ticketNumber,
      subject: t.subject,
      priority: t.priority,
      assigneeName: t.assignee?.name || 'Unassigned',
      createdAt: t.createdAt,
      breachedAt: t.activities[0]?.createdAt || null,
    }));

    res.json({
      overall: {
        compliant,
        breached: breachedTickets,
        compliancePercent,
      },
      byPriority,
      breachedTickets: breachedTicketsFormatted,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reports/time-materials
 * Time and materials report
 */
async function getTimeAndMaterialsReport(req, res, next) {
  try {
    const { startDate, endDate, agentId, companyId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const timeWhere = {
      date: { gte: start, lte: end },
      ...(agentId && { agentId }),
      ...(companyId && { ticket: { companyId } }),
    };

    const materialWhere = {
      createdAt: { gte: start, lte: end },
      ...(agentId && { agentId }),
      ...(companyId && { ticket: { companyId } }),
    };

    // Time entries
    const timeEntries = await prisma.timeEntry.findMany({
      where: timeWhere,
      include: {
        agent: { select: { name: true } },
        ticket: {
          select: { ticketNumber: true, company: { select: { name: true } } },
        },
      },
    });

    // Aggregate time
    const totalTimeResult = await prisma.timeEntry.aggregate({
      where: timeWhere,
      _sum: { hours: true, minutes: true },
    });

    const totalHours = totalTimeResult._sum.hours || 0;
    const totalMinutes = totalTimeResult._sum.minutes || 0;

    // Time by agent
    const timeByAgentMap = {};
    for (const entry of timeEntries) {
      const name = entry.agent.name;
      if (!timeByAgentMap[name]) {
        timeByAgentMap[name] = { hours: 0, minutes: 0 };
      }
      timeByAgentMap[name].hours += entry.hours;
      timeByAgentMap[name].minutes += entry.minutes;
    }
    const timeByAgent = Object.entries(timeByAgentMap).map(([agentName, t]) => ({
      agentName,
      hours: t.hours + Math.floor(t.minutes / 60),
      minutes: t.minutes % 60,
    }));

    // Time by company
    const timeByCompanyMap = {};
    for (const entry of timeEntries) {
      const name = entry.ticket.company?.name || 'No Company';
      if (!timeByCompanyMap[name]) {
        timeByCompanyMap[name] = { hours: 0, minutes: 0 };
      }
      timeByCompanyMap[name].hours += entry.hours;
      timeByCompanyMap[name].minutes += entry.minutes;
    }
    const timeByCompany = Object.entries(timeByCompanyMap).map(([companyName, t]) => ({
      companyName,
      hours: t.hours + Math.floor(t.minutes / 60),
      minutes: t.minutes % 60,
    }));

    // Time by day
    const timeByDayMap = {};
    for (const entry of timeEntries) {
      const day = entry.date.toISOString().split('T')[0];
      if (!timeByDayMap[day]) {
        timeByDayMap[day] = { hours: 0, minutes: 0 };
      }
      timeByDayMap[day].hours += entry.hours;
      timeByDayMap[day].minutes += entry.minutes;
    }
    const timeByDay = Object.entries(timeByDayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, t]) => ({
        date,
        hours: t.hours + Math.floor(t.minutes / 60),
        minutes: t.minutes % 60,
      }));

    // Material entries
    const materialEntries = await prisma.materialEntry.findMany({
      where: materialWhere,
      include: {
        agent: { select: { name: true } },
        ticket: {
          select: { ticketNumber: true, company: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalMaterialCost = materialEntries.reduce((sum, m) => sum + m.totalCost, 0);

    // Materials by agent
    const matByAgentMap = {};
    for (const entry of materialEntries) {
      const name = entry.agent.name;
      if (!matByAgentMap[name]) matByAgentMap[name] = 0;
      matByAgentMap[name] += entry.totalCost;
    }
    const materialsByAgent = Object.entries(matByAgentMap).map(([agentName, totalCost]) => ({
      agentName,
      totalCost,
    }));

    // Materials by company
    const matByCompanyMap = {};
    for (const entry of materialEntries) {
      const name = entry.ticket.company?.name || 'No Company';
      if (!matByCompanyMap[name]) matByCompanyMap[name] = 0;
      matByCompanyMap[name] += entry.totalCost;
    }
    const materialsByCompany = Object.entries(matByCompanyMap).map(([companyName, totalCost]) => ({
      companyName,
      totalCost,
    }));

    // Material entries formatted
    const materialEntriesFormatted = materialEntries.map((m) => ({
      itemName: m.itemName,
      quantity: m.quantity,
      unitCost: m.unitCost,
      totalCost: m.totalCost,
      agentName: m.agent.name,
      companyName: m.ticket.company?.name || 'No Company',
      ticketNumber: m.ticket.ticketNumber,
      date: m.createdAt.toISOString().split('T')[0],
    }));

    res.json({
      timeEntries: {
        totalHours: totalHours + Math.floor(totalMinutes / 60),
        totalMinutes: totalMinutes % 60,
        formatted: formatTimeHM(totalHours, totalMinutes),
        byAgent: timeByAgent,
        byCompany: timeByCompany,
        byDay: timeByDay,
      },
      materials: {
        totalCost: totalMaterialCost,
        byAgent: materialsByAgent,
        byCompany: materialsByCompany,
        entries: materialEntriesFormatted,
      },
    });
  } catch (error) {
    next(error);
  }
}

function formatTimeHM(hours, minutes) {
  const totalH = hours + Math.floor(minutes / 60);
  const totalM = minutes % 60;
  if (totalH === 0) return `${totalM}m`;
  if (totalM === 0) return `${totalH}h`;
  return `${totalH}h ${totalM}m`;
}

/**
 * GET /api/reports/export
 * Export report as CSV
 */
async function exportReport(req, res, next) {
  try {
    const { type, startDate, endDate, format = 'csv' } = req.query;

    if (!type || !startDate || !endDate) {
      return res.status(400).json({ error: 'type, startDate, and endDate are required' });
    }

    if (format !== 'csv') {
      return res.status(400).json({ error: 'Only CSV format is supported' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    let csvContent = '';
    const filename = `${type}-${startDate}-to-${endDate}.csv`;

    switch (type) {
      case 'ticket-volume':
        csvContent = await generateTicketVolumeCsv(start, end);
        break;
      case 'agent-performance':
        csvContent = await generateAgentPerformanceCsv(start, end);
        break;
      case 'sla-compliance':
        csvContent = await generateSlaComplianceCsv(start, end);
        break;
      case 'time-materials':
        csvContent = await generateTimeMaterialsCsv(start, end);
        break;
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    next(error);
  }
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function arrayToCsv(headers, rows) {
  const headerLine = headers.map(escapeCsvValue).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvValue).join(','));
  return [headerLine, ...dataLines].join('\n');
}

async function generateTicketVolumeCsv(start, end) {
  const tickets = await prisma.ticket.findMany({
    where: { createdAt: { gte: start, lte: end } },
    select: {
      ticketNumber: true,
      subject: true,
      status: true,
      priority: true,
      createdAt: true,
      resolvedAt: true,
      closedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const headers = ['Ticket #', 'Subject', 'Status', 'Priority', 'Created', 'Resolved', 'Closed'];
  const rows = tickets.map((t) => [
    t.ticketNumber,
    t.subject,
    t.status,
    t.priority,
    t.createdAt.toISOString(),
    t.resolvedAt?.toISOString() || '',
    t.closedAt?.toISOString() || '',
  ]);

  return arrayToCsv(headers, rows);
}

async function generateAgentPerformanceCsv(start, end) {
  const agents = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['ADMIN', 'AGENT'] } },
    select: { id: true, name: true },
  });

  const headers = [
    'Agent', 'Tickets Assigned', 'Tickets Closed',
    'Avg First Response (hrs)', 'Avg Resolution (hrs)',
    'SLA Breaches', 'Hours Logged'
  ];

  const rows = await Promise.all(
    agents.map(async (agent) => {
      const assigned = await prisma.ticket.count({
        where: { assigneeId: agent.id, createdAt: { gte: start, lte: end } },
      });
      const closed = await prisma.ticket.count({
        where: { assigneeId: agent.id, createdAt: { gte: start, lte: end }, status: 'CLOSED' },
      });
      const avgFirst = await getAgentAvgFirstResponse(agent.id, start, end);
      const avgRes = await getAgentAvgResolutionTime(agent.id, start, end);
      const breaches = await prisma.ticket.count({
        where: { assigneeId: agent.id, createdAt: { gte: start, lte: end }, slaBreached: true },
      });
      const hours = await getAgentTotalHours(agent.id, start, end);

      return [
        agent.name,
        assigned,
        closed,
        avgFirst || 'N/A',
        avgRes || 'N/A',
        breaches,
        hours,
      ];
    })
  );

  return arrayToCsv(headers, rows);
}

async function generateSlaComplianceCsv(start, end) {
  const tickets = await prisma.ticket.findMany({
    where: { createdAt: { gte: start, lte: end }, slaBreached: true },
    select: {
      ticketNumber: true,
      subject: true,
      priority: true,
      createdAt: true,
      assignee: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const headers = ['Ticket #', 'Subject', 'Priority', 'Assignee', 'Created'];
  const rows = tickets.map((t) => [
    t.ticketNumber,
    t.subject,
    t.priority,
    t.assignee?.name || 'Unassigned',
    t.createdAt.toISOString(),
  ]);

  return arrayToCsv(headers, rows);
}

async function generateTimeMaterialsCsv(start, end) {
  const timeEntries = await prisma.timeEntry.findMany({
    where: { date: { gte: start, lte: end } },
    include: {
      agent: { select: { name: true } },
      ticket: { select: { ticketNumber: true } },
    },
    orderBy: { date: 'asc' },
  });

  const materialEntries = await prisma.materialEntry.findMany({
    where: { createdAt: { gte: start, lte: end } },
    include: {
      agent: { select: { name: true } },
      ticket: { select: { ticketNumber: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Time section
  let csv = 'TIME ENTRIES\n';
  csv += 'Date,Ticket #,Agent,Hours,Minutes,Description\n';
  for (const t of timeEntries) {
    csv += [
      t.date.toISOString().split('T')[0],
      t.ticket.ticketNumber,
      escapeCsvValue(t.agent.name),
      t.hours,
      t.minutes,
      escapeCsvValue(t.description || ''),
    ].join(',') + '\n';
  }

  csv += '\nMATERIAL ENTRIES\n';
  csv += 'Date,Ticket #,Agent,Item,Quantity,Unit Cost,Total Cost\n';
  for (const m of materialEntries) {
    csv += [
      m.createdAt.toISOString().split('T')[0],
      m.ticket.ticketNumber,
      escapeCsvValue(m.agent.name),
      escapeCsvValue(m.itemName),
      m.quantity,
      m.unitCost,
      m.totalCost,
    ].join(',') + '\n';
  }

  return csv;
}

module.exports = {
  getTicketVolumeReport,
  getAgentPerformanceReport,
  getSLAComplianceReport,
  getTimeAndMaterialsReport,
  exportReport,
};
