const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { sendReviewRequest } = require('../services/satisfactionEmailService');

const prisma = new PrismaClient();

// Process scheduled review requests
async function processReviewRequests() {
  console.log('[ReviewRequestJob] Starting...');

  try {
    // Find all tickets where:
    // - status = INVOICED
    // - reviewRequestScheduledFor <= now()
    // - reviewRequestedAt is null
    const tickets = await prisma.ticket.findMany({
      where: {
        status: 'INVOICED',
        reviewRequestScheduledFor: {
          lte: new Date(),
        },
        reviewRequestedAt: null,
      },
      include: {
        requester: true,
      },
    });

    console.log(`[ReviewRequestJob] Found ${tickets.length} tickets to process`);

    let sent = 0;
    let failed = 0;

    for (const ticket of tickets) {
      if (!ticket.requester) {
        console.log(`[ReviewRequestJob] Ticket ${ticket.id} has no requester, skipping`);
        failed++;
        continue;
      }

      // Double check opt-out status (might have changed)
      if (ticket.requester.reviewOptOut) {
        console.log(`[ReviewRequestJob] Contact ${ticket.requester.id} has opted out, clearing schedule`);
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { reviewRequestScheduledFor: null },
        });
        continue;
      }

      const result = await sendReviewRequest(ticket, ticket.requester);

      if (result.success) {
        sent++;
        console.log(`[ReviewRequestJob] Sent review request for ticket ${ticket.id}`);
      } else {
        failed++;
        console.log(`[ReviewRequestJob] Failed for ticket ${ticket.id}: ${result.error}`);
      }
    }

    console.log(`[ReviewRequestJob] Complete: ${sent} sent, ${failed} failed`);
  } catch (error) {
    console.error('[ReviewRequestJob] Error:', error);
  }
}

// Schedule the job to run every hour
function scheduleReviewRequestJob() {
  // Run at minute 0 of every hour: '0 * * * *'
  cron.schedule('0 * * * *', () => {
    processReviewRequests();
  });

  console.log('[ReviewRequestJob] Scheduled to run every hour at minute 0');

  // Also run once on startup (after a short delay)
  setTimeout(() => {
    console.log('[ReviewRequestJob] Running initial check on startup...');
    processReviewRequests();
  }, 5000);
}

module.exports = {
  scheduleReviewRequestJob,
  processReviewRequests,
};
