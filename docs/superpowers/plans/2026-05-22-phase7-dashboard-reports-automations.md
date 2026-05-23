# Phase 7: Dashboard, Reports, Automations & Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build analytics dashboard, reports with CSV export, automation rules engine, and complete settings management.

**Architecture:** Backend-first approach - build all API endpoints first, then frontend. Automation engine is a service that evaluates conditions and executes actions. Settings cache reduces DB calls.

**Tech Stack:** Express.js, Prisma, React, Recharts, React Query, Tailwind CSS

---

## File Structure

### Backend Files to Create
- `server/utils/settingsCache.js` - In-memory settings cache with 5-min TTL
- `server/controllers/dashboardController.js` - Dashboard stats and trends
- `server/controllers/reportController.js` - 4 report types + CSV export
- `server/controllers/automationController.js` - Automation CRUD + test
- `server/controllers/businessHoursController.js` - Business hours CRUD
- `server/controllers/searchController.js` - Global search
- `server/services/automationEngine.js` - Core automation processor
- `server/jobs/automationJob.js` - Time-based automation cron
- `server/routes/dashboard.js` - Dashboard routes
- `server/routes/reports.js` - Report routes
- `server/routes/automations.js` - Automation routes
- `server/routes/businessHours.js` - Business hours routes
- `server/routes/search.js` - Search routes

### Backend Files to Modify
- `server/index.js` - Mount new routes, init automation job
- `server/controllers/ticketController.js` - Wire automation on create/update
- `server/controllers/replyController.js` - Wire automation on reply
- `server/controllers/settingsController.js` - Add email preview, reset
- `server/prisma/seed.js` - Add default automation rules

### Frontend Files to Create
- `client/src/pages/dashboard/DashboardPage.jsx` - Full dashboard
- `client/src/pages/reports/ReportsPage.jsx` - Reports with date range
- `client/src/pages/settings/AutomationsPage.jsx` - Automation builder
- `client/src/pages/settings/SettingsPage.jsx` - Full settings (replace stub)

### Frontend Files to Modify
- `client/src/api/index.js` - Add dashboard, reports, automations, search APIs
- `client/src/components/layout/Topbar.jsx` - Global search
- `client/src/App.jsx` - Update routes

---

## Task 1: Settings Cache Utility

**Files:**
- Create: `server/utils/settingsCache.js`

- [ ] **Step 1: Create settingsCache.js**

```javascript
// server/utils/settingsCache.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// In-memory cache
let cache = {};
let lastRefresh = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get a setting value from cache (refreshes from DB if stale)
 */
async function getSetting(key) {
  const now = Date.now();

  // Refresh cache if stale
  if (now - lastRefresh > CACHE_TTL) {
    await refreshCache();
  }

  return cache[key] || null;
}

/**
 * Get multiple settings at once
 */
async function getSettings(keys) {
  const now = Date.now();

  if (now - lastRefresh > CACHE_TTL) {
    await refreshCache();
  }

  const result = {};
  for (const key of keys) {
    result[key] = cache[key] || null;
  }
  return result;
}

/**
 * Set a setting value (updates DB and cache)
 */
async function setSetting(key, value) {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: String(value) },
    update: { value: String(value) },
  });

  cache[key] = String(value);
}

/**
 * Refresh cache from database
 */
async function refreshCache() {
  const settings = await prisma.appSetting.findMany();
  cache = settings.reduce((acc, s) => {
    acc[s.key] = s.value;
    return acc;
  }, {});
  lastRefresh = Date.now();
}

/**
 * Clear the cache (forces refresh on next read)
 */
function clearCache() {
  cache = {};
  lastRefresh = 0;
}

module.exports = {
  getSetting,
  getSettings,
  setSetting,
  refreshCache,
  clearCache,
};
```

- [ ] **Step 2: Verify file created**

Run: `dir server\utils\settingsCache.js`
Expected: File exists

- [ ] **Step 3: Commit**

```bash
git add server/utils/settingsCache.js
git commit -m "feat: add settings cache utility with 5-min TTL"
```

---

## Task 2: Business Hours Controller and Routes

**Files:**
- Create: `server/controllers/businessHoursController.js`
- Create: `server/routes/businessHours.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create businessHoursController.js**

```javascript
// server/controllers/businessHoursController.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * GET /api/business-hours
 * Returns all 7 BusinessHours records (one per day)
 */
async function getBusinessHours(req, res, next) {
  try {
    const businessHours = await prisma.businessHours.findMany({
      orderBy: { dayOfWeek: 'asc' },
    });

    res.json({ businessHours });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/business-hours
 * Upserts all 7 records in a transaction
 */
async function updateBusinessHours(req, res, next) {
  try {
    const { hours } = req.body;

    if (!Array.isArray(hours) || hours.length !== 7) {
      return res.status(400).json({ error: 'Must provide exactly 7 day records' });
    }

    // Validate each record
    for (const h of hours) {
      if (h.dayOfWeek < 0 || h.dayOfWeek > 6) {
        return res.status(400).json({ error: 'dayOfWeek must be 0-6' });
      }
      if (h.isOpen && (!h.openTime || !h.closeTime)) {
        return res.status(400).json({
          error: `Day ${h.dayOfWeek}: openTime and closeTime required when open`
        });
      }
    }

    // Upsert all in transaction
    const updates = hours.map((h) =>
      prisma.businessHours.upsert({
        where: { dayOfWeek: h.dayOfWeek },
        create: {
          dayOfWeek: h.dayOfWeek,
          isOpen: h.isOpen,
          openTime: h.isOpen ? h.openTime : null,
          closeTime: h.isOpen ? h.closeTime : null,
        },
        update: {
          isOpen: h.isOpen,
          openTime: h.isOpen ? h.openTime : null,
          closeTime: h.isOpen ? h.closeTime : null,
        },
      })
    );

    await prisma.$transaction(updates);

    // Return updated records
    const businessHours = await prisma.businessHours.findMany({
      orderBy: { dayOfWeek: 'asc' },
    });

    res.json({ businessHours });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getBusinessHours,
  updateBusinessHours,
};
```

- [ ] **Step 2: Create businessHours routes**

```javascript
// server/routes/businessHours.js
const express = require('express');
const router = express.Router();
const {
  getBusinessHours,
  updateBusinessHours
} = require('../controllers/businessHoursController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');

router.use(requireAuth);

router.get('/', getBusinessHours);
router.put('/', requireRole('ADMIN'), updateBusinessHours);

module.exports = router;
```

- [ ] **Step 3: Mount routes in index.js**

Add after Phase 6 routes section in `server/index.js`:

```javascript
// ============================================================================
// Route imports - Phase 7
// ============================================================================
const businessHoursRoutes = require('./routes/businessHours');

app.use('/api/business-hours', businessHoursRoutes);
```

- [ ] **Step 4: Commit**

```bash
git add server/controllers/businessHoursController.js server/routes/businessHours.js server/index.js
git commit -m "feat: add business hours CRUD endpoints"
```

---

## Task 3: Dashboard Controller - Stats Endpoint

**Files:**
- Create: `server/controllers/dashboardController.js`

- [ ] **Step 1: Create dashboardController.js with getDashboardStats**

```javascript
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
      prisma.ticket.count({ where: { status: 'RESOLVED' } }),
      prisma.ticket.count({ where: { status: 'CLOSED' } }),
      prisma.ticket.count({
        where: {
          dueDate: { lt: now },
          status: { notIn: ['CLOSED', 'RESOLVED'] },
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
  const statuses = ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'];
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

module.exports = {
  getDashboardStats,
  formatHours,
};
```

- [ ] **Step 2: Commit**

```bash
git add server/controllers/dashboardController.js
git commit -m "feat: add dashboard stats endpoint with parallel queries"
```

---

## Task 4: Dashboard Controller - Trends Endpoint

**Files:**
- Modify: `server/controllers/dashboardController.js`

- [ ] **Step 1: Add getDashboardTrends to dashboardController.js**

Add after getDashboardStats function:

```javascript
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

// Update module.exports
module.exports = {
  getDashboardStats,
  getDashboardTrends,
  formatHours,
};
```

- [ ] **Step 2: Commit**

```bash
git add server/controllers/dashboardController.js
git commit -m "feat: add dashboard trends endpoint with period support"
```

---

## Task 5: Dashboard Routes

**Files:**
- Create: `server/routes/dashboard.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create dashboard routes**

```javascript
// server/routes/dashboard.js
const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getDashboardTrends
} = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/stats', getDashboardStats);
router.get('/trends', getDashboardTrends);

module.exports = router;
```

- [ ] **Step 2: Mount routes in index.js**

Add to Phase 7 section in `server/index.js`:

```javascript
const dashboardRoutes = require('./routes/dashboard');

app.use('/api/dashboard', dashboardRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/dashboard.js server/index.js
git commit -m "feat: add dashboard routes"
```

---

## Task 6: Report Controller - Ticket Volume

**Files:**
- Create: `server/controllers/reportController.js`

- [ ] **Step 1: Create reportController.js with getTicketVolumeReport**

```javascript
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

module.exports = {
  getTicketVolumeReport,
};
```

- [ ] **Step 2: Commit**

```bash
git add server/controllers/reportController.js
git commit -m "feat: add ticket volume report endpoint"
```

---

## Task 7: Report Controller - Agent Performance

**Files:**
- Modify: `server/controllers/reportController.js`

- [ ] **Step 1: Add getAgentPerformanceReport**

Add to reportController.js:

```javascript
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

// Update module.exports
module.exports = {
  getTicketVolumeReport,
  getAgentPerformanceReport,
};
```

- [ ] **Step 2: Commit**

```bash
git add server/controllers/reportController.js
git commit -m "feat: add agent performance report endpoint"
```

---

## Task 8: Report Controller - SLA Compliance

**Files:**
- Modify: `server/controllers/reportController.js`

- [ ] **Step 1: Add getSLAComplianceReport**

Add to reportController.js:

```javascript
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

// Update module.exports
module.exports = {
  getTicketVolumeReport,
  getAgentPerformanceReport,
  getSLAComplianceReport,
};
```

- [ ] **Step 2: Commit**

```bash
git add server/controllers/reportController.js
git commit -m "feat: add SLA compliance report endpoint"
```

---

## Task 9: Report Controller - Time & Materials

**Files:**
- Modify: `server/controllers/reportController.js`

- [ ] **Step 1: Add getTimeAndMaterialsReport**

Add to reportController.js:

```javascript
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

// Update module.exports
module.exports = {
  getTicketVolumeReport,
  getAgentPerformanceReport,
  getSLAComplianceReport,
  getTimeAndMaterialsReport,
};
```

- [ ] **Step 2: Commit**

```bash
git add server/controllers/reportController.js
git commit -m "feat: add time and materials report endpoint"
```

---

## Task 10: Report Controller - CSV Export

**Files:**
- Modify: `server/controllers/reportController.js`

- [ ] **Step 1: Add exportReport**

Add to reportController.js:

```javascript
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

// Update module.exports
module.exports = {
  getTicketVolumeReport,
  getAgentPerformanceReport,
  getSLAComplianceReport,
  getTimeAndMaterialsReport,
  exportReport,
};
```

- [ ] **Step 2: Commit**

```bash
git add server/controllers/reportController.js
git commit -m "feat: add CSV export for all report types"
```

---

## Task 11: Report Routes

**Files:**
- Create: `server/routes/reports.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create report routes**

```javascript
// server/routes/reports.js
const express = require('express');
const router = express.Router();
const {
  getTicketVolumeReport,
  getAgentPerformanceReport,
  getSLAComplianceReport,
  getTimeAndMaterialsReport,
  exportReport,
} = require('../controllers/reportController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');

router.use(requireAuth);

router.get('/ticket-volume', getTicketVolumeReport);
router.get('/agent-performance', getAgentPerformanceReport);
router.get('/sla-compliance', getSLAComplianceReport);
router.get('/time-materials', getTimeAndMaterialsReport);
router.get('/export', requireRole('ADMIN', 'AGENT'), exportReport);

module.exports = router;
```

- [ ] **Step 2: Mount routes in index.js**

Add to Phase 7 section:

```javascript
const reportRoutes = require('./routes/reports');

app.use('/api/reports', reportRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/reports.js server/index.js
git commit -m "feat: add report routes with CSV export"
```

---

## Task 12: Automation Engine Service

**Files:**
- Create: `server/services/automationEngine.js`

- [ ] **Step 1: Create automationEngine.js**

```javascript
// server/services/automationEngine.js
const { PrismaClient } = require('@prisma/client');
const { sendTicketAssignedEmail } = require('./emailService');

const prisma = new PrismaClient();

/**
 * Run automations for a given trigger on a ticket
 * @param {string} trigger - AutomationTrigger enum value
 * @param {object} ticket - Full ticket object with relations
 * @param {object} changes - What changed (for TICKET_UPDATED)
 * @returns {object} { fired: [ruleNames], actionsExecuted: Int }
 */
async function runAutomations(trigger, ticket, changes = {}) {
  const result = { fired: [], actionsExecuted: 0 };
  let currentTicket = ticket;
  let passCount = 0;
  const maxPasses = 3;

  while (passCount < maxPasses) {
    passCount++;
    let anyFired = false;

    // Load active automation rules for this trigger
    const rules = await prisma.automationRule.findMany({
      where: { trigger, isActive: true },
      orderBy: { runOrder: 'asc' },
    });

    for (const rule of rules) {
      // Skip if already fired this rule (prevent re-firing)
      if (result.fired.includes(rule.name)) continue;

      // Evaluate all conditions
      const conditions = rule.conditions;
      let allPassed = true;

      for (const condition of conditions) {
        if (!evaluateCondition(condition, currentTicket)) {
          allPassed = false;
          break;
        }
      }

      if (allPassed) {
        console.log(`[Automation] '${rule.name}' fired on ticket #${currentTicket.ticketNumber}`);
        result.fired.push(rule.name);
        anyFired = true;

        // Execute all actions
        for (const action of rule.actions) {
          await executeAction(action, currentTicket, rule.name);
          result.actionsExecuted++;
        }

        // Re-fetch ticket after actions
        currentTicket = await prisma.ticket.findUnique({
          where: { id: currentTicket.id },
          include: {
            requester: { select: { id: true, name: true, email: true } },
            company: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true, email: true } },
            group: { select: { id: true, name: true } },
            tags: { include: { tag: true } },
          },
        });
      }
    }

    // If no rules fired this pass, we're done
    if (!anyFired) break;
  }

  return result;
}

/**
 * Evaluate a single condition against a ticket
 */
function evaluateCondition(condition, ticket) {
  const { field, operator, value } = condition;
  let fieldValue;

  // Get field value from ticket
  switch (field) {
    case 'status':
      fieldValue = ticket.status;
      break;
    case 'priority':
      fieldValue = ticket.priority;
      break;
    case 'type':
      fieldValue = ticket.type;
      break;
    case 'assigneeId':
      fieldValue = ticket.assigneeId || 'unassigned';
      break;
    case 'groupId':
      fieldValue = ticket.groupId || null;
      break;
    case 'companyId':
      fieldValue = ticket.companyId || null;
      break;
    case 'tag':
      // Check if tag exists in ticket tags
      const tagNames = ticket.tags?.map((t) => t.tag?.name || t.name) || [];
      fieldValue = tagNames;
      break;
    case 'subject':
      fieldValue = ticket.subject || '';
      break;
    case 'requesterEmail':
      fieldValue = ticket.requester?.email || '';
      break;
    case 'ticketAgeDays':
      const ageMs = Date.now() - new Date(ticket.createdAt).getTime();
      fieldValue = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      break;
    default:
      return false;
  }

  // Apply operator
  switch (operator) {
    case 'is':
      if (Array.isArray(fieldValue)) {
        return fieldValue.some((v) => v.toLowerCase() === value.toLowerCase());
      }
      return String(fieldValue).toLowerCase() === String(value).toLowerCase();

    case 'is_not':
      if (Array.isArray(fieldValue)) {
        return !fieldValue.some((v) => v.toLowerCase() === value.toLowerCase());
      }
      return String(fieldValue).toLowerCase() !== String(value).toLowerCase();

    case 'contains':
      if (Array.isArray(fieldValue)) {
        return fieldValue.some((v) => v.toLowerCase().includes(value.toLowerCase()));
      }
      return String(fieldValue).toLowerCase().includes(value.toLowerCase());

    case 'not_contains':
      if (Array.isArray(fieldValue)) {
        return !fieldValue.some((v) => v.toLowerCase().includes(value.toLowerCase()));
      }
      return !String(fieldValue).toLowerCase().includes(value.toLowerCase());

    case 'greater_than':
      return parseFloat(fieldValue) > parseFloat(value);

    case 'less_than':
      return parseFloat(fieldValue) < parseFloat(value);

    default:
      return false;
  }
}

/**
 * Execute a single action on a ticket
 */
async function executeAction(action, ticket, ruleName) {
  const { type, value } = action;

  switch (type) {
    case 'set_status':
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: value },
      });
      await createActivityLog(ticket.id, 'STATUS_CHANGED',
        `Automation '${ruleName}': Status changed to ${value}`);
      break;

    case 'set_priority':
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { priority: value },
      });
      await createActivityLog(ticket.id, 'PRIORITY_CHANGED',
        `Automation '${ruleName}': Priority changed to ${value}`);
      break;

    case 'assign_agent':
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { assigneeId: value },
      });
      await createActivityLog(ticket.id, 'ASSIGNED',
        `Automation '${ruleName}': Assigned to agent`);

      // Send email notification
      const agent = await prisma.user.findUnique({ where: { id: value } });
      if (agent) {
        try {
          await sendTicketAssignedEmail(ticket, agent);
        } catch (e) {
          console.error('[Automation] Failed to send assignment email:', e.message);
        }
      }
      break;

    case 'assign_group':
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { groupId: value },
      });
      await createActivityLog(ticket.id, 'GROUP_CHANGED',
        `Automation '${ruleName}': Assigned to group`);
      break;

    case 'add_tag':
      // Find or create tag
      let tag = await prisma.tag.findUnique({ where: { name: value } });
      if (!tag) {
        tag = await prisma.tag.create({ data: { name: value } });
      }
      // Add to ticket if not exists
      const existingTag = await prisma.ticketTag.findUnique({
        where: { ticketId_tagId: { ticketId: ticket.id, tagId: tag.id } },
      });
      if (!existingTag) {
        await prisma.ticketTag.create({
          data: { ticketId: ticket.id, tagId: tag.id },
        });
        await createActivityLog(ticket.id, 'TAG_ADDED',
          `Automation '${ruleName}': Added tag '${value}'`);
      }
      break;

    case 'remove_tag':
      const tagToRemove = await prisma.tag.findUnique({ where: { name: value } });
      if (tagToRemove) {
        await prisma.ticketTag.deleteMany({
          where: { ticketId: ticket.id, tagId: tagToRemove.id },
        });
        await createActivityLog(ticket.id, 'TAG_REMOVED',
          `Automation '${ruleName}': Removed tag '${value}'`);
      }
      break;

    case 'send_email':
      // value = email address or "requester" or "assignee"
      let emailTo;
      if (value === 'requester') {
        emailTo = ticket.requester?.email;
      } else if (value === 'assignee') {
        emailTo = ticket.assignee?.email;
      } else {
        emailTo = value;
      }

      if (emailTo) {
        // Simple notification email
        console.log(`[Automation] Would send email to ${emailTo} for ticket #${ticket.ticketNumber}`);
        await createActivityLog(ticket.id, 'EMAIL_SENT',
          `Automation '${ruleName}': Email sent to ${emailTo}`);
      }
      break;

    case 'add_note':
      // Resolve variables in note text
      let noteText = value;
      noteText = noteText.replace(/\{\{ticket_number\}\}/g, `#${ticket.ticketNumber}`);
      noteText = noteText.replace(/\{\{requester_name\}\}/g, ticket.requester?.name || 'Unknown');
      noteText = noteText.replace(/\{\{assignee_name\}\}/g, ticket.assignee?.name || 'Unassigned');

      // Get first admin for author
      const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
      if (admin) {
        await prisma.ticketReply.create({
          data: {
            ticketId: ticket.id,
            authorId: admin.id,
            body: noteText,
            isInternal: true,
          },
        });
        await createActivityLog(ticket.id, 'NOTE_ADDED',
          `Automation '${ruleName}': Internal note added`);
      }
      break;
  }
}

async function createActivityLog(ticketId, type, description) {
  await prisma.ticketActivity.create({
    data: { ticketId, type, description },
  });
}

/**
 * Test automation without executing actions
 */
async function testAutomation(ruleId, ticketId) {
  const rule = await prisma.automationRule.findUnique({ where: { id: ruleId } });
  if (!rule) throw new Error('Automation rule not found');

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, email: true } },
      group: { select: { id: true, name: true } },
      tags: { include: { tag: true } },
    },
  });
  if (!ticket) throw new Error('Ticket not found');

  const conditionsResult = [];
  let wouldFire = true;

  for (const condition of rule.conditions) {
    const passed = evaluateCondition(condition, ticket);
    const actualValue = getFieldValue(condition.field, ticket);

    conditionsResult.push({
      condition: `${condition.field} ${condition.operator} ${condition.value}`,
      passed,
      actualValue: String(actualValue),
    });

    if (!passed) wouldFire = false;
  }

  const actions = rule.actions.map((a) => `${a.type}: ${a.value}`);

  return { conditionsResult, wouldFire, actions };
}

function getFieldValue(field, ticket) {
  switch (field) {
    case 'status': return ticket.status;
    case 'priority': return ticket.priority;
    case 'type': return ticket.type;
    case 'assigneeId': return ticket.assigneeId || 'unassigned';
    case 'groupId': return ticket.groupId;
    case 'companyId': return ticket.companyId;
    case 'tag': return ticket.tags?.map((t) => t.tag?.name).join(', ') || '';
    case 'subject': return ticket.subject;
    case 'requesterEmail': return ticket.requester?.email;
    case 'ticketAgeDays':
      const ageMs = Date.now() - new Date(ticket.createdAt).getTime();
      return Math.floor(ageMs / (1000 * 60 * 60 * 24));
    default: return '';
  }
}

module.exports = {
  runAutomations,
  evaluateCondition,
  executeAction,
  testAutomation,
};
```

- [ ] **Step 2: Commit**

```bash
git add server/services/automationEngine.js
git commit -m "feat: add automation engine with conditions and actions"
```

---

## Task 13: Automation Controller

**Files:**
- Create: `server/controllers/automationController.js`

- [ ] **Step 1: Create automationController.js**

```javascript
// server/controllers/automationController.js
const { PrismaClient } = require('@prisma/client');
const { testAutomation } = require('../services/automationEngine');

const prisma = new PrismaClient();

/**
 * GET /api/automations
 */
async function getAutomations(req, res, next) {
  try {
    const automations = await prisma.automationRule.findMany({
      orderBy: { runOrder: 'asc' },
    });

    res.json({ automations });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/automations
 */
async function createAutomation(req, res, next) {
  try {
    const { name, trigger, conditions, actions, runOrder = 0, isActive = true } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const validTriggers = ['TICKET_CREATED', 'TICKET_UPDATED', 'REPLY_RECEIVED', 'TIME_BASED'];
    if (!trigger || !validTriggers.includes(trigger)) {
      return res.status(400).json({ error: 'Valid trigger is required' });
    }

    if (!Array.isArray(conditions) || conditions.length === 0) {
      return res.status(400).json({ error: 'At least one condition is required' });
    }

    if (!Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({ error: 'At least one action is required' });
    }

    const automation = await prisma.automationRule.create({
      data: {
        name: name.trim(),
        trigger,
        conditions,
        actions,
        runOrder: parseInt(runOrder) || 0,
        isActive,
      },
    });

    res.status(201).json(automation);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/automations/:id
 */
async function updateAutomation(req, res, next) {
  try {
    const { id } = req.params;
    const { name, trigger, conditions, actions, runOrder, isActive } = req.body;

    const existing = await prisma.automationRule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (trigger !== undefined) updateData.trigger = trigger;
    if (conditions !== undefined) updateData.conditions = conditions;
    if (actions !== undefined) updateData.actions = actions;
    if (runOrder !== undefined) updateData.runOrder = parseInt(runOrder);
    if (isActive !== undefined) updateData.isActive = isActive;

    const automation = await prisma.automationRule.update({
      where: { id },
      data: updateData,
    });

    res.json(automation);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/automations/:id/toggle
 */
async function toggleAutomation(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await prisma.automationRule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    const automation = await prisma.automationRule.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    res.json({ id: automation.id, isActive: automation.isActive });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/automations/:id
 */
async function deleteAutomation(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await prisma.automationRule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    await prisma.automationRule.delete({ where: { id } });

    res.json({ message: 'Automation deleted' });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/automations/:id/test
 */
async function testAutomationEndpoint(req, res, next) {
  try {
    const { id } = req.params;
    const { ticketId } = req.body;

    if (!ticketId) {
      return res.status(400).json({ error: 'ticketId is required' });
    }

    const result = await testAutomation(id, ticketId);
    res.json(result);
  } catch (error) {
    if (error.message === 'Automation rule not found' || error.message === 'Ticket not found') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
}

module.exports = {
  getAutomations,
  createAutomation,
  updateAutomation,
  toggleAutomation,
  deleteAutomation,
  testAutomationEndpoint,
};
```

- [ ] **Step 2: Commit**

```bash
git add server/controllers/automationController.js
git commit -m "feat: add automation CRUD controller"
```

---

## Task 14: Automation Routes

**Files:**
- Create: `server/routes/automations.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create automation routes**

```javascript
// server/routes/automations.js
const express = require('express');
const router = express.Router();
const {
  getAutomations,
  createAutomation,
  updateAutomation,
  toggleAutomation,
  deleteAutomation,
  testAutomationEndpoint,
} = require('../controllers/automationController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');

router.use(requireAuth);
router.use(requireRole('ADMIN'));

router.get('/', getAutomations);
router.post('/', createAutomation);
router.put('/:id', updateAutomation);
router.patch('/:id/toggle', toggleAutomation);
router.delete('/:id', deleteAutomation);
router.post('/:id/test', testAutomationEndpoint);

module.exports = router;
```

- [ ] **Step 2: Mount routes in index.js**

Add to Phase 7 section:

```javascript
const automationRoutes = require('./routes/automations');

app.use('/api/automations', automationRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/automations.js server/index.js
git commit -m "feat: add automation routes"
```

---

## Task 15: Time-Based Automation Job

**Files:**
- Create: `server/jobs/automationJob.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create automationJob.js**

```javascript
// server/jobs/automationJob.js
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { runAutomations, evaluateCondition } = require('../services/automationEngine');

const prisma = new PrismaClient();

/**
 * Scheduled job to run time-based automations
 * Runs every hour at minute 0
 */
function scheduleAutomationJob() {
  console.log('[AutomationJob] Scheduling time-based automation job (hourly)');

  cron.schedule('0 * * * *', async () => {
    console.log('[AutomationJob] Running time-based automations...');

    try {
      // Get all active time-based rules
      const rules = await prisma.automationRule.findMany({
        where: {
          trigger: 'TIME_BASED',
          isActive: true,
        },
        orderBy: { runOrder: 'asc' },
      });

      if (rules.length === 0) {
        console.log('[AutomationJob] No time-based rules found');
        return;
      }

      let totalFired = 0;
      let totalActions = 0;

      for (const rule of rules) {
        // Find tickets matching all conditions
        const tickets = await findMatchingTickets(rule.conditions);

        console.log(`[AutomationJob] Rule '${rule.name}' found ${tickets.length} matching tickets`);

        for (const ticket of tickets) {
          const result = await runAutomations('TIME_BASED', ticket, {});
          totalFired += result.fired.length;
          totalActions += result.actionsExecuted;
        }
      }

      console.log(`[AutomationJob] Complete. Fired ${totalFired} rules, executed ${totalActions} actions`);
    } catch (error) {
      console.error('[AutomationJob] Error:', error.message);
    }
  });
}

/**
 * Find tickets matching given conditions
 */
async function findMatchingTickets(conditions) {
  // Build basic where clause from conditions
  const where = {};

  for (const condition of conditions) {
    if (condition.field === 'status' && condition.operator === 'is') {
      where.status = condition.value;
    }
    if (condition.field === 'priority' && condition.operator === 'is') {
      where.priority = condition.value;
    }
  }

  // Get candidate tickets
  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      requester: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, email: true } },
      group: { select: { id: true, name: true } },
      tags: { include: { tag: true } },
    },
    take: 100, // Limit for safety
  });

  // Filter by all conditions (including complex ones like ticketAgeDays)
  return tickets.filter((ticket) => {
    for (const condition of conditions) {
      if (!evaluateCondition(condition, ticket)) {
        return false;
      }
    }
    return true;
  });
}

module.exports = { scheduleAutomationJob };
```

- [ ] **Step 2: Initialize job in index.js**

Add to server startup section after other jobs:

```javascript
// Initialize automation job
const { scheduleAutomationJob } = require('./jobs/automationJob');
scheduleAutomationJob();
```

- [ ] **Step 3: Commit**

```bash
git add server/jobs/automationJob.js server/index.js
git commit -m "feat: add time-based automation cron job"
```

---

## Task 16: Wire Automations into Controllers

**Files:**
- Modify: `server/controllers/ticketController.js`
- Modify: `server/controllers/replyController.js`

- [ ] **Step 1: Update ticketController.js**

Add import at top:

```javascript
const { runAutomations } = require('../services/automationEngine');
```

In createTicket function, after ticket creation and before response, add:

```javascript
// Run automations
try {
  const fullTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, email: true } },
      group: { select: { id: true, name: true } },
      tags: { include: { tag: true } },
    },
  });
  await runAutomations('TICKET_CREATED', fullTicket, {});
} catch (automationError) {
  console.error('[Automation] Error running automations:', automationError.message);
}
```

In updateTicket function, after ticket update and before response, add:

```javascript
// Run automations
try {
  const fullTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, email: true } },
      group: { select: { id: true, name: true } },
      tags: { include: { tag: true } },
    },
  });
  const changes = req.body;
  await runAutomations('TICKET_UPDATED', fullTicket, changes);
} catch (automationError) {
  console.error('[Automation] Error running automations:', automationError.message);
}
```

- [ ] **Step 2: Update replyController.js**

Add import at top:

```javascript
const { runAutomations } = require('../services/automationEngine');
```

In createReply function, after reply creation (for public replies only), add:

```javascript
// Run automations for public replies
if (!isInternal) {
  try {
    const fullTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        company: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        group: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
      },
    });
    await runAutomations('REPLY_RECEIVED', fullTicket, {});
  } catch (automationError) {
    console.error('[Automation] Error running automations:', automationError.message);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add server/controllers/ticketController.js server/controllers/replyController.js
git commit -m "feat: wire automation engine into ticket and reply controllers"
```

---

## Task 17: Search Controller and Routes

**Files:**
- Create: `server/controllers/searchController.js`
- Create: `server/routes/search.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create searchController.js**

```javascript
// server/controllers/searchController.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * GET /api/search?q=
 */
async function globalSearch(req, res, next) {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const searchTerm = q.toLowerCase();

    // Search in parallel
    const [tickets, contacts, companies, articles] = await Promise.all([
      // Tickets
      prisma.ticket.findMany({
        where: {
          OR: [
            { subject: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          status: true,
          priority: true,
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),

      // Contacts
      prisma.contact.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          company: { select: { name: true } },
        },
        take: 5,
        orderBy: { name: 'asc' },
      }),

      // Companies
      prisma.company.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { domain: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          domain: true,
        },
        take: 5,
        orderBy: { name: 'asc' },
      }),

      // KB Articles (published only)
      prisma.kBArticle.findMany({
        where: {
          isPublished: true,
          title: { contains: searchTerm, mode: 'insensitive' },
        },
        select: {
          id: true,
          title: true,
          category: { select: { name: true } },
        },
        take: 3,
        orderBy: { title: 'asc' },
      }),
    ]);

    // Format contacts with company name
    const formattedContacts = contacts.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      companyName: c.company?.name || null,
    }));

    // Format articles with category name
    const formattedArticles = articles.map((a) => ({
      id: a.id,
      title: a.title,
      categoryName: a.category?.name || null,
    }));

    const total = tickets.length + contacts.length + companies.length + articles.length;

    res.json({
      query: q,
      results: {
        tickets,
        contacts: formattedContacts,
        companies,
        articles: formattedArticles,
      },
      total,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { globalSearch };
```

- [ ] **Step 2: Create search routes**

```javascript
// server/routes/search.js
const express = require('express');
const router = express.Router();
const { globalSearch } = require('../controllers/searchController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', globalSearch);

module.exports = router;
```

- [ ] **Step 3: Mount routes in index.js**

Add to Phase 7 section:

```javascript
const searchRoutes = require('./routes/search');

app.use('/api/search', searchRoutes);
```

- [ ] **Step 4: Commit**

```bash
git add server/controllers/searchController.js server/routes/search.js server/index.js
git commit -m "feat: add global search endpoint"
```

---

## Task 18: Update Settings Controller

**Files:**
- Modify: `server/controllers/settingsController.js`

- [ ] **Step 1: Add email preview and reset endpoints**

Add to settingsController.js:

```javascript
const fs = require('fs');
const path = require('path');
const { clearCache } = require('../utils/settingsCache');

/**
 * GET /api/settings/email-preview?template=X
 */
async function previewEmailTemplate(req, res, next) {
  try {
    const { template } = req.query;

    if (!template) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    const templatePath = path.join(__dirname, '../templates', `${template}.html`);

    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: 'Template not found' });
    }

    let html = fs.readFileSync(templatePath, 'utf8');

    // Replace with dummy data
    const dummyData = {
      '{{ticket_number}}': '12345',
      '{{ticket_subject}}': 'Sample Ticket Subject',
      '{{requester_name}}': 'John Smith',
      '{{agent_name}}': 'Sam Admin',
      '{{reply_content}}': 'This is a sample reply content for preview purposes.',
      '{{status}}': 'RESOLVED',
      '{{company_name}}': 'NADC Helpdesk',
      '{{survey_link}}': '#',
    };

    for (const [key, value] of Object.entries(dummyData)) {
      html = html.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    res.json({ html });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/settings/reset
 */
async function resetSettings(req, res, next) {
  try {
    const defaults = {
      company_name: 'NADC Helpdesk',
      google_review_enabled: 'false',
      google_review_url: '',
      review_cooldown_days: '30',
      review_send_delay_hours: '24',
      satisfaction_enabled: 'true',
      auto_close_days: '7',
      default_priority: 'MEDIUM',
      default_type: 'QUESTION',
    };

    const updates = Object.entries(defaults).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    );

    await prisma.$transaction(updates);

    // Clear cache
    clearCache();

    const settings = await prisma.appSetting.findMany();
    const settingsObj = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    res.json(settingsObj);
  } catch (error) {
    next(error);
  }
}

// Update module.exports to include new functions
module.exports = {
  getSettings,
  getSettingsFull,
  updateSetting,
  updateSettings,
  testEmail,
  testImap,
  previewEmailTemplate,
  resetSettings,
};
```

- [ ] **Step 2: Update settings routes**

Add to `server/routes/settings.js`:

```javascript
const { previewEmailTemplate, resetSettings } = require('../controllers/settingsController');

router.get('/email-preview', previewEmailTemplate);
router.post('/reset', requireRole('ADMIN'), resetSettings);
```

- [ ] **Step 3: Commit**

```bash
git add server/controllers/settingsController.js server/routes/settings.js
git commit -m "feat: add email preview and settings reset endpoints"
```

---

## Task 19: Seed Default Automation Rules

**Files:**
- Modify: `server/prisma/seed.js`

- [ ] **Step 1: Add automation rules to seed.js**

Add after existing seed data, before the final console.log:

```javascript
// Clear existing automation rules
await prisma.automationRule.deleteMany();

// Create default automation rules
const rule1 = await prisma.automationRule.create({
  data: {
    name: 'Auto-assign urgent tickets to Tier 1',
    trigger: 'TICKET_CREATED',
    conditions: [
      { field: 'priority', operator: 'is', value: 'URGENT' },
    ],
    actions: [
      { type: 'assign_group', value: group.id },
      { type: 'add_tag', value: 'urgent' },
    ],
    runOrder: 1,
    isActive: true,
  },
});
console.log('Created automation rule:', rule1.name);

const rule2 = await prisma.automationRule.create({
  data: {
    name: 'Close stale resolved tickets',
    trigger: 'TIME_BASED',
    conditions: [
      { field: 'status', operator: 'is', value: 'RESOLVED' },
      { field: 'ticketAgeDays', operator: 'greater_than', value: '7' },
    ],
    actions: [
      { type: 'set_status', value: 'CLOSED' },
    ],
    runOrder: 2,
    isActive: true,
  },
});
console.log('Created automation rule:', rule2.name);

const rule3 = await prisma.automationRule.create({
  data: {
    name: 'Flag overdue open tickets',
    trigger: 'TIME_BASED',
    conditions: [
      { field: 'status', operator: 'is', value: 'OPEN' },
      { field: 'ticketAgeDays', operator: 'greater_than', value: '3' },
    ],
    actions: [
      { type: 'set_priority', value: 'HIGH' },
      { type: 'add_tag', value: 'overdue' },
    ],
    runOrder: 3,
    isActive: true,
  },
});
console.log('Created automation rule:', rule3.name);
```

- [ ] **Step 2: Run seed**

```bash
cd server && npx prisma db seed
```

- [ ] **Step 3: Commit**

```bash
git add server/prisma/seed.js
git commit -m "feat: add default automation rules to seed data"
```

---

## Task 20: Install Recharts

**Files:**
- Modify: `client/package.json`

- [ ] **Step 1: Install recharts**

```bash
cd client && npm install recharts
```

- [ ] **Step 2: Verify installation**

```bash
cd client && npm list recharts
```

- [ ] **Step 3: Commit**

```bash
git add client/package.json client/package-lock.json
git commit -m "chore: add recharts dependency for dashboard charts"
```

---

## Task 21: Add Frontend API Functions

**Files:**
- Modify: `client/src/api/index.js`

- [ ] **Step 1: Add dashboard, reports, automations, search APIs**

Add to client/src/api/index.js:

```javascript
export const dashboard = {
  getStats: () => client.get('/api/dashboard/stats').then((r) => r.data),
  getTrends: (period) => client.get('/api/dashboard/trends', { params: { period } }).then((r) => r.data),
};

export const reports = {
  getTicketVolume: (params) => client.get('/api/reports/ticket-volume', { params }).then((r) => r.data),
  getAgentPerformance: (params) => client.get('/api/reports/agent-performance', { params }).then((r) => r.data),
  getSlaCompliance: (params) => client.get('/api/reports/sla-compliance', { params }).then((r) => r.data),
  getTimeMaterials: (params) => client.get('/api/reports/time-materials', { params }).then((r) => r.data),
  exportCsv: (params) => client.get('/api/reports/export', { params, responseType: 'blob' }).then((r) => r.data),
};

export const automations = {
  getAutomations: () => client.get('/api/automations').then((r) => r.data),
  createAutomation: (data) => client.post('/api/automations', data).then((r) => r.data),
  updateAutomation: (id, data) => client.put('/api/automations/' + id, data).then((r) => r.data),
  toggleAutomation: (id) => client.patch('/api/automations/' + id + '/toggle').then((r) => r.data),
  deleteAutomation: (id) => client.delete('/api/automations/' + id).then((r) => r.data),
  testAutomation: (id, ticketId) => client.post('/api/automations/' + id + '/test', { ticketId }).then((r) => r.data),
};

export const businessHours = {
  getBusinessHours: () => client.get('/api/business-hours').then((r) => r.data),
  updateBusinessHours: (hours) => client.put('/api/business-hours', { hours }).then((r) => r.data),
};

export const search = {
  globalSearch: (q) => client.get('/api/search', { params: { q } }).then((r) => r.data),
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/api/index.js
git commit -m "feat: add dashboard, reports, automations, search API functions"
```

---

## Task 22: Create Dashboard Page

**Files:**
- Create: `client/src/pages/dashboard/DashboardPage.jsx`

- [ ] **Step 1: Create dashboard directory**

```bash
mkdir -p client/src/pages/dashboard
```

- [ ] **Step 2: Create DashboardPage.jsx**

Create file `client/src/pages/dashboard/DashboardPage.jsx` with the following content:

```jsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Ticket, Clock, CheckCircle, ThumbsUp, AlertTriangle,
  PlusCircle, Package, Building2, Activity
} from 'lucide-react';
import { dashboard } from '../../api';
import { Avatar, Badge } from '../../components/shared';

const COLORS = {
  primary: '#1B2A4A',
  success: '#15803D',
  open: '#3B82F6',
  pending: '#F59E0B',
  resolved: '#10B981',
  closed: '#6B7280',
};

function StatCard({ icon: Icon, label, value, subtext, color = 'blue', onClick }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div
      className={`bg-white rounded-lg shadow p-4 ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
        </div>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg shadow p-4 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
          <div className="h-8 bg-gray-200 rounded w-16" />
        </div>
        <div className="w-10 h-10 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [trendPeriod, setTrendPeriod] = useState('30d');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboard.getStats,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: trends } = useQuery({
    queryKey: ['dashboard-trends', trendPeriod],
    queryFn: () => dashboard.getTrends(trendPeriod),
    staleTime: 5 * 60 * 1000,
  });

  if (statsLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-4 md:p-6">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Welcome to NADC Helpdesk!</h2>
          <p className="text-gray-500 mb-4">Create your first ticket to get started.</p>
          <Link to="/tickets/new" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg">
            <PlusCircle className="w-4 h-4" /> New Ticket
          </Link>
        </div>
      </div>
    );
  }

  const statusData = stats.ticketsByStatus || [];
  const priorityData = stats.ticketsByPriority || [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Ticket} label="Open Tickets" value={stats.ticketCounts?.open || 0}
          subtext={stats.ticketCounts?.overdue > 0 ? `${stats.ticketCounts.overdue} overdue` : null} color="blue" />
        <StatCard icon={Clock} label="Avg Response Time" value={stats.avgResponseTime?.formatted || '—'}
          subtext="last 30 days" color="green" />
        <StatCard icon={CheckCircle} label="Avg Resolution Time" value={stats.avgResolutionTime?.formatted || '—'}
          subtext="last 30 days" color="purple" />
        <StatCard icon={ThumbsUp} label="Satisfaction Rate"
          value={stats.satisfactionSummary?.positivePercent != null ? `${stats.satisfactionSummary.positivePercent}%` : '—'}
          subtext={`${stats.satisfactionSummary?.total || 0} ratings`} color="amber" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Created vs Resolved</h3>
            <div className="flex gap-1">
              {['7d', '30d', '90d'].map((p) => (
                <button key={p} onClick={() => setTrendPeriod(p)}
                  className={`px-2 py-1 text-xs rounded ${trendPeriod === p ? 'bg-primary text-white' : 'bg-gray-100'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trends?.createdVsResolved || stats.createdVsResolved || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="created" stroke={COLORS.primary} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="resolved" stroke={COLORS.success} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-4">Tickets by Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={50} outerRadius={70}>
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={COLORS[entry.status.toLowerCase()] || COLORS.closed} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-center text-2xl font-bold">{stats.ticketCounts?.total || 0}</div>
          <div className="text-center text-xs text-gray-500">Total Tickets</div>
        </div>
      </div>

      {/* Priority + Agent Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-4">Tickets by Priority</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={priorityData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="priority" tick={{ fontSize: 10 }} width={60} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {priorityData.map((entry, i) => {
                  const colors = { LOW: '#6B7280', MEDIUM: '#3B82F6', HIGH: '#F59E0B', URGENT: '#EF4444' };
                  return <Cell key={i} fill={colors[entry.priority]} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="lg:col-span-2 bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b"><h3 className="font-semibold">Agent Workload</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Agent</th>
                  <th className="text-center p-3">Open</th>
                  <th className="text-center p-3">Pending</th>
                  <th className="text-center p-3 hidden md:table-cell">Resolved</th>
                </tr>
              </thead>
              <tbody>
                {(stats.agentWorkload || []).map((agent) => (
                  <tr key={agent.agentId} className="border-t hover:bg-gray-50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={agent.agentName} size="sm" />
                        <span>{agent.agentName}</span>
                      </div>
                    </td>
                    <td className="text-center p-3"><Badge variant="info">{agent.open}</Badge></td>
                    <td className="text-center p-3"><Badge variant="warning">{agent.pending}</Badge></td>
                    <td className="text-center p-3 hidden md:table-cell">{agent.resolvedThisMonth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Activity + Bottom Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">Recent Activity</h3>
            <Activity className="w-4 h-4 text-gray-400" />
          </div>
          <div className="divide-y max-h-80 overflow-y-auto">
            {(stats.recentActivity || []).map((activity) => (
              <div key={activity.id} className="p-4 flex items-start gap-3">
                <Avatar name={activity.user?.name || 'System'} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{activity.description}</p>
                  <Link to={`/tickets/${activity.ticketId}`} className="text-xs text-primary hover:underline">
                    #{activity.ticketNumber}: {activity.ticketSubject}
                  </Link>
                </div>
                <span className="text-xs text-gray-400">{new Date(activity.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <StatCard icon={Clock} label="Time Logged (Month)" value={stats.timeTrackedThisMonth?.formatted || '0h'}
            subtext="across all tickets" color="blue" />
          <StatCard icon={Package} label="Materials (Month)" value={stats.materialsThisMonth?.formatted || '$0.00'}
            subtext="parts and expenses" color="purple" />
          <Link to="/tickets?slaBreached=true">
            <StatCard icon={AlertTriangle} label="SLA Breached" value={stats.ticketCounts?.slaBreached || 0}
              color={stats.ticketCounts?.slaBreached > 0 ? 'red' : 'green'} />
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/dashboard/DashboardPage.jsx
git commit -m "feat: add dashboard page with charts and stats"
```

---

## Task 23: Create Reports Page

**Files:**
- Create: `client/src/pages/reports/ReportsPage.jsx`

- [ ] **Step 1: Create reports directory**

```bash
mkdir -p client/src/pages/reports
```

- [ ] **Step 2: Create ReportsPage.jsx**

Create file `client/src/pages/reports/ReportsPage.jsx`:

```jsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, FileText, Users, Clock, AlertTriangle, Package } from 'lucide-react';
import { reports, agents as agentsApi, companies as companiesApi } from '../../api';
import { Button, Spinner, Badge } from '../../components/shared';

const REPORT_TYPES = [
  { id: 'ticket-volume', label: 'Ticket Volume', icon: FileText },
  { id: 'agent-performance', label: 'Agent Performance', icon: Users },
  { id: 'sla-compliance', label: 'SLA Compliance', icon: AlertTriangle },
  { id: 'time-materials', label: 'Time & Materials', icon: Package },
];

const DATE_RANGES = [
  { id: 'last7', label: 'Last 7 days', getValue: () => ({ start: subDays(new Date(), 7), end: new Date() }) },
  { id: 'last30', label: 'Last 30 days', getValue: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
  { id: 'last90', label: 'Last 90 days', getValue: () => ({ start: subDays(new Date(), 90), end: new Date() }) },
  { id: 'thisMonth', label: 'This month', getValue: () => ({ start: startOfMonth(new Date()), end: new Date() }) },
  { id: 'lastMonth', label: 'Last month', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 1)), end: endOfMonth(subMonths(new Date(), 1)) }) },
];

export default function ReportsPage() {
  const [reportType, setReportType] = useState('ticket-volume');
  const [dateRange, setDateRange] = useState('last30');
  const [groupBy, setGroupBy] = useState('day');
  const [exporting, setExporting] = useState(false);

  const range = DATE_RANGES.find((r) => r.id === dateRange)?.getValue() || DATE_RANGES[1].getValue();
  const startDate = format(range.start, 'yyyy-MM-dd');
  const endDate = format(range.end, 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['report', reportType, startDate, endDate, groupBy],
    queryFn: () => {
      const params = { startDate, endDate };
      switch (reportType) {
        case 'ticket-volume': return reports.getTicketVolume({ ...params, groupBy });
        case 'agent-performance': return reports.getAgentPerformance(params);
        case 'sla-compliance': return reports.getSlaCompliance(params);
        case 'time-materials': return reports.getTimeMaterials(params);
        default: return null;
      }
    },
    staleTime: 60000,
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await reports.exportCsv({ type: reportType, startDate, endDate, format: 'csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}-${startDate}-to-${endDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
    setExporting(false);
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-56 bg-white border-r p-4 space-y-6 hidden md:block">
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Report Type</h3>
          <div className="space-y-1">
            {REPORT_TYPES.map((type) => (
              <button key={type.id} onClick={() => setReportType(type.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm ${reportType === type.id ? 'bg-primary text-white' : 'hover:bg-gray-100'}`}>
                <type.icon className="w-4 h-4" /> {type.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Date Range</h3>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm">
            {DATE_RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>

        {reportType === 'ticket-volume' && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Group By</h3>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm">
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>
        )}

        <Button onClick={handleExport} disabled={exporting || isLoading} className="w-full">
          <Download className="w-4 h-4 mr-2" /> {exporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{REPORT_TYPES.find((t) => t.id === reportType)?.label} Report</h1>
          <span className="text-sm text-gray-500">{startDate} to {endDate}</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : reportType === 'ticket-volume' ? (
          <TicketVolumeReport data={data} />
        ) : reportType === 'agent-performance' ? (
          <AgentPerformanceReport data={data} />
        ) : reportType === 'sla-compliance' ? (
          <SlaComplianceReport data={data} />
        ) : reportType === 'time-materials' ? (
          <TimeMaterialsReport data={data} />
        ) : null}
      </div>
    </div>
  );
}

function TicketVolumeReport({ data }) {
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{data.totals?.created || 0}</div>
          <div className="text-sm text-gray-500">Created</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{data.totals?.resolved || 0}</div>
          <div className="text-sm text-gray-500">Resolved</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-3xl font-bold text-gray-600">{data.totals?.closed || 0}</div>
          <div className="text-sm text-gray-500">Closed</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-4">Ticket Volume Over Time</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.data || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="created" stroke="#3B82F6" strokeWidth={2} />
            <Line type="monotone" dataKey="resolved" stroke="#10B981" strokeWidth={2} />
            <Line type="monotone" dataKey="closed" stroke="#6B7280" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AgentPerformanceReport({ data }) {
  if (!data) return null;
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-3">Agent</th>
            <th className="text-center p-3">Assigned</th>
            <th className="text-center p-3">Closed</th>
            <th className="text-center p-3">Avg First Response</th>
            <th className="text-center p-3">Avg Resolution</th>
            <th className="text-center p-3">SLA %</th>
            <th className="text-center p-3">Hours</th>
          </tr>
        </thead>
        <tbody>
          {(data.agents || []).map((agent) => (
            <tr key={agent.agentId} className="border-t">
              <td className="p-3 font-medium">{agent.agentName}</td>
              <td className="text-center p-3">{agent.ticketsAssigned}</td>
              <td className="text-center p-3">{agent.ticketsClosed}</td>
              <td className="text-center p-3">{agent.avgFirstResponseHours ? `${agent.avgFirstResponseHours}h` : '—'}</td>
              <td className="text-center p-3">{agent.avgResolutionHours ? `${agent.avgResolutionHours}h` : '—'}</td>
              <td className="text-center p-3">
                <Badge variant={agent.slaCompliancePercent >= 90 ? 'success' : agent.slaCompliancePercent >= 60 ? 'warning' : 'error'}>
                  {agent.slaCompliancePercent}%
                </Badge>
              </td>
              <td className="text-center p-3">{agent.totalHoursLogged}h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SlaComplianceReport({ data }) {
  if (!data) return null;
  const pieData = [
    { name: 'Compliant', value: data.overall?.compliant || 0, color: '#10B981' },
    { name: 'Breached', value: data.overall?.breached || 0, color: '#EF4444' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className={`text-5xl font-bold ${data.overall?.compliancePercent >= 90 ? 'text-green-600' : data.overall?.compliancePercent >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
            {data.overall?.compliancePercent || 0}%
          </div>
          <div className="text-gray-500 mt-2">Overall SLA Compliance</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-4">Compliance by Priority</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.byPriority || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="priority" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="compliancePercent" fill="#3B82F6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {data.breachedTickets?.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b"><h3 className="font-semibold">Breached Tickets</h3></div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">#</th>
                <th className="text-left p-3">Subject</th>
                <th className="text-center p-3">Priority</th>
                <th className="text-left p-3">Assignee</th>
              </tr>
            </thead>
            <tbody>
              {data.breachedTickets.map((t) => (
                <tr key={t.ticketId} className="border-t">
                  <td className="p-3">{t.ticketNumber}</td>
                  <td className="p-3">{t.subject}</td>
                  <td className="text-center p-3"><Badge variant={t.priority === 'URGENT' ? 'error' : 'warning'}>{t.priority}</Badge></td>
                  <td className="p-3">{t.assigneeName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TimeMaterialsReport({ data }) {
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-3xl font-bold text-blue-600">{data.timeEntries?.formatted || '0h'}</div>
          <div className="text-gray-500">Total Time</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-3xl font-bold text-green-600">${data.materials?.totalCost?.toFixed(2) || '0.00'}</div>
          <div className="text-gray-500">Total Materials</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-4">Time by Agent</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.timeEntries?.byAgent || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="agentName" width={100} />
              <Tooltip />
              <Bar dataKey="hours" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-4">Materials by Company</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {(data.materials?.byCompany || []).map((c, i) => (
              <div key={i} className="flex justify-between p-2 bg-gray-50 rounded">
                <span>{c.companyName}</span>
                <span className="font-medium">${c.totalCost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/reports/ReportsPage.jsx
git commit -m "feat: add reports page with 4 report types and CSV export"
```

---

## Task 24: Create Automations Page

**Files:**
- Create: `client/src/pages/settings/AutomationsPage.jsx`

- [ ] **Step 1: Create AutomationsPage.jsx**

Create file `client/src/pages/settings/AutomationsPage.jsx` with automation rules list, create/edit modal with condition/action builders. Include:
- Table showing all automations with name, trigger, conditions count, actions count, active toggle
- Create/Edit form with name, trigger select, conditions builder, actions builder
- Test automation functionality

Key structure:
```jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, GripVertical, X } from 'lucide-react';
import { automations as automationsApi, agents as agentsApi } from '../../api';
import { Button, Modal, Spinner, ConfirmDialog } from '../../components/shared';
import toast from 'react-hot-toast';

// Define TRIGGERS, CONDITION_FIELDS, OPERATORS, ACTION_TYPES constants
// Main AutomationsPage component with list and CRUD
// AutomationForm component with condition/action builders
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/settings/AutomationsPage.jsx
git commit -m "feat: add automations page with condition/action builder"
```

---

## Task 25: Update Settings Page

**Files:**
- Modify: `client/src/pages/SettingsPage.jsx`

- [ ] **Step 1: Replace SettingsPage with full version**

Update to include sections: General, Email, Business Hours, Automations (link), Tags, SLA Policies, Satisfaction. Each section as a separate component.

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/SettingsPage.jsx
git commit -m "feat: add full settings page with all sections"
```

---

## Task 26: Add Global Search to Topbar

**Files:**
- Modify: `client/src/components/layout/Topbar.jsx`

- [ ] **Step 1: Add search functionality**

Add debounced search input that calls /api/search. Show dropdown with:
- Tickets section (number, subject, status badge)
- Contacts section (name, email, company)
- Companies section (name, domain)
- Keyboard navigation (arrow keys, enter, escape)

- [ ] **Step 2: Commit**

```bash
git add client/src/components/layout/Topbar.jsx
git commit -m "feat: add global search with keyboard navigation"
```

---

## Task 27: Update App Router

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Add new routes**

```jsx
import DashboardPage from './pages/dashboard/DashboardPage';
import ReportsPage from './pages/reports/ReportsPage';
import AutomationsPage from './pages/settings/AutomationsPage';

// In routes:
<Route path="/dashboard" element={<DashboardPage />} />
<Route path="/reports" element={<ReportsPage />} />
<Route path="/settings" element={<SettingsPage />} />
<Route path="/settings/automations" element={<AutomationsPage />} />
```

- [ ] **Step 2: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: update router with dashboard, reports, automations routes"
```

---

## Task 28: Update Progress.md

**Files:**
- Modify: `progress.md`

- [ ] **Step 1: Mark Phase 7 complete**

Update summary table and add Phase 7 details with all completed tasks.

- [ ] **Step 2: Commit**

```bash
git add progress.md
git commit -m "docs: mark Phase 7 complete"
```

---

## Completion Criteria Checklist

### Backend Verification
- [ ] `GET /api/dashboard/stats` returns all metrics
- [ ] `GET /api/dashboard/trends?period=30d` returns trend data
- [ ] `GET /api/reports/ticket-volume?startDate=X&endDate=Y` returns grouped data
- [ ] `GET /api/reports/agent-performance` returns per-agent stats
- [ ] `GET /api/reports/sla-compliance` returns compliance breakdown
- [ ] `GET /api/reports/time-materials` returns time + cost data
- [ ] `GET /api/reports/export?type=ticket-volume&format=csv` downloads CSV
- [ ] `POST /api/automations` creates rule with conditions + actions
- [ ] `POST /api/automations/:id/test` returns condition evaluation
- [ ] Creating URGENT ticket fires auto-assign automation
- [ ] Time-based automation job logs on server start
- [ ] `GET /api/search?q=email` returns matching results
- [ ] `GET /api/business-hours` returns 7 records
- [ ] `PUT /api/business-hours` updates all days

### Frontend Verification
- [ ] `/dashboard` renders all sections with real data
- [ ] Dashboard stat cards show correct numbers
- [ ] Charts render correctly with data
- [ ] Period selector updates trend chart
- [ ] `/reports` loads with date range selector
- [ ] All 4 report types render correctly
- [ ] Export CSV downloads valid file
- [ ] `/settings/automations` shows rules table
- [ ] Create/edit automation works correctly
- [ ] Test automation shows pass/fail results
- [ ] Active toggle works on automations
- [ ] Settings sections all save correctly
- [ ] Global search returns results
- [ ] Keyboard navigation works in search
