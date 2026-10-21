/**
 * Outlook Calendar Sync Backfill Script
 *
 * Syncs existing schedules and calendar events to Outlook calendars.
 * By default runs in dry-run mode - use --apply to actually sync.
 *
 * Usage:
 *   node server/scripts/outlook-backfill.js              # Dry run
 *   node server/scripts/outlook-backfill.js --apply      # Actually sync
 *   node server/scripts/outlook-backfill.js --email=someone@nadc.com  # Limit to one mailbox
 *   node server/scripts/outlook-backfill.js --apply --email=someone@nadc.com
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const {
  syncSourceDirect,
  getSyncConfig,
  isUserEligible,
} = require('../services/outlookCalendarService');
const { initializeTransporter, getGraphClient } = require('../services/emailService');

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const applyMode = args.includes('--apply');
const emailArg = args.find((a) => a.startsWith('--email='));
const filterEmail = emailArg ? emailArg.split('=')[1].toLowerCase() : null;

async function main() {
  console.log('======================================');
  console.log('Outlook Calendar Sync Backfill');
  console.log('======================================\n');

  // Check configuration
  const { enabled, allowedEmails } = getSyncConfig();

  console.log('Configuration:');
  console.log(`  OUTLOOK_SYNC_ENABLED: ${enabled}`);
  console.log(`  OUTLOOK_SYNC_ALLOWED_EMAILS: ${allowedEmails.join(', ') || '(none)'}`);
  console.log(`  Mode: ${applyMode ? 'APPLY (will sync)' : 'DRY RUN (preview only)'}`);
  if (filterEmail) {
    console.log(`  Filter: Only ${filterEmail}`);
  }
  console.log('');

  if (!enabled) {
    console.log('ERROR: OUTLOOK_SYNC_ENABLED is not set to "true". Aborting.');
    process.exit(1);
  }

  if (allowedEmails.length === 0) {
    console.log('ERROR: OUTLOOK_SYNC_ALLOWED_EMAILS is empty. No mailboxes configured.');
    process.exit(1);
  }

  // Initialize Graph client if applying
  if (applyMode) {
    console.log('Initializing Microsoft Graph client...');
    await initializeTransporter();
    const graphClient = getGraphClient();
    if (!graphClient) {
      console.log('ERROR: Graph client is null after initialization. Check Azure credentials.');
      process.exit(1);
    }
    console.log('Graph client ready.\n');
  }

  // Filter allowed emails if --email specified
  const targetEmails = filterEmail
    ? allowedEmails.filter((e) => e === filterEmail)
    : allowedEmails;

  if (targetEmails.length === 0) {
    console.log(`ERROR: Email ${filterEmail} is not in OUTLOOK_SYNC_ALLOWED_EMAILS.`);
    process.exit(1);
  }

  // Get eligible users
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      email: { in: targetEmails.map((e) => e) },
      NOT: { email: { endsWith: '.internal' } },
    },
  });

  if (users.length === 0) {
    console.log('No eligible users found.');
    process.exit(0);
  }

  console.log(`Found ${users.length} eligible user(s):`);
  for (const user of users) {
    console.log(`  - ${user.name} <${user.email}>`);
  }
  console.log('');

  const now = new Date();

  // Find ticket schedules to sync (future OR in-progress multi-day)
  console.log('Finding ticket schedules...');
  const ticketSchedules = await prisma.ticketSchedule.findMany({
    where: {
      OR: [
        // Future schedules
        { scheduledStart: { gte: now } },
        // In-progress multi-day: started in the past but not yet ended
        {
          scheduledStart: { lt: now },
          scheduledEnd: { gte: now },
        },
      ],
      ticket: {
        status: { notIn: ['INVOICED', 'POSTED'] },
        OR: [
          { assigneeId: { in: users.map((u) => u.id) } },
          { additionalAssignees: { some: { userId: { in: users.map((u) => u.id) } } } },
        ],
      },
    },
    include: {
      ticket: {
        include: {
          company: true,
          assignee: true,
          additionalAssignees: { include: { user: true } },
        },
      },
    },
    orderBy: { scheduledStart: 'asc' },
  });

  // Group by user
  const schedulesByUser = new Map();
  for (const schedule of ticketSchedules) {
    const assignees = [];
    if (schedule.ticket.assignee) assignees.push(schedule.ticket.assignee);
    for (const ta of schedule.ticket.additionalAssignees || []) {
      if (ta.user) assignees.push(ta.user);
    }

    for (const user of assignees) {
      if (isUserEligible(user, targetEmails)) {
        if (!schedulesByUser.has(user.email)) {
          schedulesByUser.set(user.email, []);
        }
        schedulesByUser.get(user.email).push({
          type: 'TICKET_SCHEDULE',
          id: schedule.id,
          title: `#${schedule.ticket.ticketNumber} ${schedule.ticket.company?.name || 'Unknown'} - ${schedule.ticket.subject}`,
          start: schedule.scheduledStart,
        });
      }
    }
  }

  // Find calendar events to sync
  console.log('Finding calendar events...');
  const calendarEvents = await prisma.calendarEvent.findMany({
    where: {
      startTime: { gte: now },
      assignees: { some: { userId: { in: users.map((u) => u.id) } } },
    },
    include: {
      assignees: { include: { user: true } },
    },
    orderBy: { startTime: 'asc' },
  });

  for (const event of calendarEvents) {
    for (const assignee of event.assignees || []) {
      const user = assignee.user;
      if (user && isUserEligible(user, targetEmails)) {
        if (!schedulesByUser.has(user.email)) {
          schedulesByUser.set(user.email, []);
        }
        schedulesByUser.get(user.email).push({
          type: 'CALENDAR_EVENT',
          id: event.id,
          title: event.title,
          start: event.startTime,
        });
      }
    }
  }

  // Find orphaned mappings (optionally filtered by mailbox)
  console.log('Finding orphaned mappings...\n');
  const mappingWhere = filterEmail ? { mailbox: filterEmail } : {};
  const allMappings = await prisma.outlookEventSync.findMany({ where: mappingWhere });
  const orphanedMappings = [];

  for (const mapping of allMappings) {
    let exists = false;
    if (mapping.sourceType === 'TICKET_SCHEDULE') {
      const schedule = await prisma.ticketSchedule.findUnique({ where: { id: mapping.sourceId } });
      exists = !!schedule;
    } else if (mapping.sourceType === 'CALENDAR_EVENT') {
      const event = await prisma.calendarEvent.findUnique({ where: { id: mapping.sourceId } });
      exists = !!event;
    }

    if (!exists) {
      orphanedMappings.push(mapping);
    }
  }

  // Print summary
  console.log('======================================');
  console.log('SYNC SUMMARY');
  console.log('======================================\n');

  let totalToSync = 0;
  for (const [email, items] of schedulesByUser) {
    console.log(`${email}: ${items.length} item(s)`);
    for (const item of items) {
      const startStr = item.start.toISOString().slice(0, 16).replace('T', ' ');
      console.log(`  [${item.type}] ${startStr} - ${item.title.slice(0, 60)}`);
      totalToSync++;
    }
    console.log('');
  }

  if (totalToSync === 0) {
    console.log('No items to sync.');
  }

  console.log(`Orphaned mappings: ${orphanedMappings.length}`);
  for (const mapping of orphanedMappings) {
    console.log(`  [${mapping.sourceType}] ${mapping.sourceId} -> ${mapping.mailbox}`);
  }
  console.log('');

  if (!applyMode) {
    console.log('======================================');
    console.log('DRY RUN COMPLETE');
    console.log('Run with --apply to actually sync.');
    console.log('======================================');
    return;
  }

  // Actually sync
  console.log('======================================');
  console.log('SYNCING...');
  console.log('======================================\n');

  // Sync all schedules and events
  const syncedIds = new Set();
  for (const [, items] of schedulesByUser) {
    for (const item of items) {
      const key = `${item.type}:${item.id}`;
      if (syncedIds.has(key)) continue;
      syncedIds.add(key);

      try {
        console.log(`Syncing ${item.type} ${item.id}...`);
        await syncSourceDirect(item.type, item.id);
      } catch (err) {
        console.error(`  Error: ${err.message}`);
      }
    }
  }

  // Clean up orphaned mappings via syncSourceDirect (deletes Outlook events and mappings)
  if (orphanedMappings.length > 0) {
    console.log('\nCleaning up orphaned mappings...');
    for (const mapping of orphanedMappings) {
      try {
        console.log(`  Syncing orphan ${mapping.sourceType}:${mapping.sourceId}...`);
        await syncSourceDirect(mapping.sourceType, mapping.sourceId);
      } catch (err) {
        console.error(`  Error cleaning up ${mapping.sourceType}:${mapping.sourceId}: ${err.message}`);
      }
    }
  }

  console.log('\n======================================');
  console.log('SYNC COMPLETE');
  console.log('======================================');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
