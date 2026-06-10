/**
 * Migration script to move existing scheduled tickets to the new TicketSchedule table.
 * For any ticket where dueDate is not null, creates a TicketSchedule record with:
 *   - scheduledStart = dueDate
 *   - scheduledEnd = scheduledEnd (if exists)
 *
 * Run with: node scripts/migrate-ticket-schedules.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateTicketSchedules() {
  console.log('Starting migration of existing scheduled tickets...');

  try {
    // Find all tickets with a dueDate
    const scheduledTickets = await prisma.ticket.findMany({
      where: {
        dueDate: { not: null },
      },
      select: {
        id: true,
        ticketNumber: true,
        dueDate: true,
        scheduledEnd: true,
      },
    });

    console.log(`Found ${scheduledTickets.length} tickets with dueDate set.`);

    if (scheduledTickets.length === 0) {
      console.log('No tickets to migrate.');
      return;
    }

    // Check for existing TicketSchedule records to avoid duplicates
    const existingSchedules = await prisma.ticketSchedule.findMany({
      select: { ticketId: true },
    });
    const existingTicketIds = new Set(existingSchedules.map(s => s.ticketId));

    let created = 0;
    let skipped = 0;

    for (const ticket of scheduledTickets) {
      // Skip if already has a schedule entry
      if (existingTicketIds.has(ticket.id)) {
        console.log(`  Skipping ticket #${ticket.ticketNumber} - already has schedule entry`);
        skipped++;
        continue;
      }

      await prisma.ticketSchedule.create({
        data: {
          ticketId: ticket.id,
          scheduledStart: ticket.dueDate,
          scheduledEnd: ticket.scheduledEnd || null,
          isAllDay: false,
        },
      });

      console.log(`  Created schedule for ticket #${ticket.ticketNumber}`);
      created++;
    }

    console.log(`\nMigration complete:`);
    console.log(`  - Created: ${created} schedule entries`);
    console.log(`  - Skipped: ${skipped} (already had entries)`);

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateTicketSchedules()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
