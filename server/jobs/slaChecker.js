const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { calculateBusinessHours, calculateWallClockHours } = require('../utils/businessHours');
const { sendSLABreachEmail } = require('../services/emailService');

const prisma = new PrismaClient();

/**
 * Check all open/pending tickets for SLA breaches
 */
async function checkSLA() {
  console.log('[SLA Checker] Starting SLA check...');

  try {
    // Get all tickets that need checking
    const tickets = await prisma.ticket.findMany({
      where: {
        status: { in: ['OPEN', 'PENDING'] },
        slaBreached: false,
        slaPolicyId: { not: null },
      },
      include: {
        slaPolicy: true,
        assignee: {
          select: { id: true, name: true, email: true },
        },
        requester: {
          select: { id: true, name: true },
        },
      },
    });

    console.log(`[SLA Checker] Found ${tickets.length} tickets to check`);

    if (tickets.length === 0) {
      console.log('[SLA Checker] No tickets to check');
      return { checked: 0, breached: 0 };
    }

    // Get business hours records
    const businessHoursRecords = await prisma.businessHours.findMany();

    let breachedCount = 0;
    const now = new Date();

    for (const ticket of tickets) {
      const { slaPolicy } = ticket;
      let isBreached = false;

      // Calculate elapsed hours
      let elapsedHours;
      if (slaPolicy.businessHoursOnly) {
        elapsedHours = calculateBusinessHours(ticket.createdAt, now, businessHoursRecords);
      } else {
        elapsedHours = calculateWallClockHours(ticket.createdAt, now);
      }

      // Check first response SLA
      if (!ticket.firstResponseAt && elapsedHours > slaPolicy.firstResponseHours) {
        isBreached = true;
        console.log(`[SLA Checker] Ticket #${ticket.ticketNumber}: First response SLA breached (${elapsedHours.toFixed(2)}h > ${slaPolicy.firstResponseHours}h)`);
      }

      // Check resolution SLA
      if (!ticket.resolvedAt && elapsedHours > slaPolicy.resolutionHours) {
        isBreached = true;
        console.log(`[SLA Checker] Ticket #${ticket.ticketNumber}: Resolution SLA breached (${elapsedHours.toFixed(2)}h > ${slaPolicy.resolutionHours}h)`);
      }

      if (isBreached) {
        // Determine breach type
        const breachType = !ticket.firstResponseAt ? 'First Response' : 'Resolution';

        // Update ticket and create activity
        await prisma.$transaction([
          prisma.ticket.update({
            where: { id: ticket.id },
            data: { slaBreached: true },
          }),
          prisma.ticketActivity.create({
            data: {
              ticketId: ticket.id,
              type: 'sla_breached',
              description: 'SLA policy breached',
              metadata: {
                policyName: slaPolicy.name,
                elapsedHours: Math.round(elapsedHours * 100) / 100,
                firstResponseHours: slaPolicy.firstResponseHours,
                resolutionHours: slaPolicy.resolutionHours,
              },
            },
          }),
        ]);

        // Send SLA breach emails (async, don't block)
        const emailPromises = [];

        // Send to assigned agent if exists
        if (ticket.assignee?.email) {
          emailPromises.push(
            sendSLABreachEmail(ticket, ticket.assignee, breachType).catch((err) =>
              console.error(`[SLA Checker] Failed to send breach email to assignee:`, err.message)
            )
          );
        }

        // Send to all ADMIN users
        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN', deletedAt: null },
          select: { id: true, name: true, email: true },
        });

        for (const admin of admins) {
          if (admin.email && admin.id !== ticket.assignee?.id) {
            emailPromises.push(
              sendSLABreachEmail(ticket, admin, breachType).catch((err) =>
                console.error(`[SLA Checker] Failed to send breach email to admin:`, err.message)
              )
            );
          }
        }

        // Fire and forget all emails
        Promise.all(emailPromises);

        breachedCount++;
      }
    }

    console.log(`[SLA Checker] Check complete. Checked: ${tickets.length}, Breached: ${breachedCount}`);
    return { checked: tickets.length, breached: breachedCount };
  } catch (error) {
    console.error('[SLA Checker] Error:', error);
    throw error;
  }
}

/**
 * Schedule the SLA checker to run every 15 minutes
 */
function scheduleSLAChecker() {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      await checkSLA();
    } catch (error) {
      console.error('[SLA Checker] Scheduled check failed:', error);
    }
  });

  console.log('[SLA Checker] Scheduled to run every 15 minutes');

  // Also run immediately on startup
  checkSLA().catch((error) => {
    console.error('[SLA Checker] Initial check failed:', error);
  });
}

module.exports = {
  checkSLA,
  scheduleSLAChecker,
};
