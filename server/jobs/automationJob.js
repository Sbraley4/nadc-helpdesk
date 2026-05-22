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
