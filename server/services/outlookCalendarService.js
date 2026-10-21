/**
 * Outlook Calendar Sync Service
 *
 * One-way sync from helpdesk schedules to Outlook calendars via Microsoft Graph.
 * Each assignee gets their own event in their mailbox.
 *
 * Environment variables:
 * - OUTLOOK_SYNC_ENABLED: "true" to enable (default: disabled)
 * - OUTLOOK_SYNC_ALLOWED_EMAILS: comma-separated list of allowed mailboxes (case-insensitive)
 */

const { PrismaClient } = require('@prisma/client');
const { getGraphClient } = require('./emailService');

const prisma = new PrismaClient();

// Serial queue for Graph API calls (one at a time)
const queue = [];
let processing = false;

/**
 * Check if sync is enabled and get allowed emails
 */
function getSyncConfig() {
  const enabled = process.env.OUTLOOK_SYNC_ENABLED === 'true';
  const allowedRaw = process.env.OUTLOOK_SYNC_ALLOWED_EMAILS || '';
  const allowedEmails = allowedRaw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
  return { enabled, allowedEmails };
}

/**
 * Check if a user is eligible for Outlook sync
 */
function isUserEligible(user, allowedEmails) {
  if (!user || !user.isActive) return false;
  const email = (user.email || '').toLowerCase();
  if (email.endsWith('.internal')) return false;
  if (allowedEmails.length === 0) return false;
  return allowedEmails.includes(email);
}

/**
 * Get the base URL for ticket links (from OUTLOOK_SYNC_TICKET_BASE_URL only)
 * Returns null if not configured, so callers can omit the link.
 */
function getTicketBaseUrl() {
  const url = process.env.OUTLOOK_SYNC_TICKET_BASE_URL;
  if (!url) return null;
  // Strip trailing slash
  return url.replace(/\/+$/, '');
}

/**
 * Convert UTC datetime to America/New_York date string (YYYY-MM-DD)
 * For all-day events, we interpret the stored UTC time as representing a date in Eastern time.
 */
function utcToEasternDate(utcDate) {
  // Format as Eastern time using Intl
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(utcDate);
}

/**
 * Add one day to a date string (YYYY-MM-DD)
 */
function addOneDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Format datetime for Graph API
 * Timed events: UTC without Z suffix
 * All-day events: midnight in Eastern timezone
 */
function formatGraphDateTime(date, isAllDay) {
  if (isAllDay) {
    const dateStr = utcToEasternDate(date);
    return {
      dateTime: `${dateStr}T00:00:00`,
      timeZone: 'Eastern Standard Time',
    };
  }
  // Timed: send as UTC (remove trailing Z)
  const isoStr = date.toISOString();
  return {
    dateTime: isoStr.replace('Z', ''),
    timeZone: 'UTC',
  };
}

/**
 * Build Graph event payload for a ticket schedule
 */
function buildTicketSchedulePayload(schedule, ticket, company) {
  const ticketBaseUrl = getTicketBaseUrl();
  const ticketNumber = ticket.ticketNumber || ticket.id;
  const companyName = company?.name || 'Unknown Company';

  const subject = `#${ticketNumber} ${companyName} - ${ticket.subject}`;

  const bodyLines = [
    `Ticket: #${ticketNumber}`,
    `Company: ${companyName}`,
    `Subject: ${ticket.subject}`,
    '',
  ];

  // Only include link if base URL is configured
  if (ticketBaseUrl) {
    bodyLines.push(`View ticket: ${ticketBaseUrl}/tickets/${ticket.id}`);
    bodyLines.push('');
  }

  bodyLines.push('Synced from NADC Helpdesk. Make changes in the helpdesk; edits made in Outlook will be overwritten.');

  const isAllDay = schedule.isAllDay || false;
  const startDate = new Date(schedule.scheduledStart);
  let endDate = schedule.scheduledEnd ? new Date(schedule.scheduledEnd) : null;

  // Default end = start + 1 hour for timed events, or if end <= start
  if (!isAllDay && (!endDate || endDate.getTime() <= startDate.getTime())) {
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  }

  const payload = {
    subject,
    body: {
      contentType: 'text',
      content: bodyLines.join('\n'),
    },
    showAs: 'busy',
    categories: ['NADC Helpdesk'],
    isAllDay,
  };

  if (isAllDay) {
    // All-day events: midnight-to-midnight with exclusive end date
    const startDateStr = utcToEasternDate(startDate);
    const endDateStr = endDate ? utcToEasternDate(endDate) : startDateStr;
    // End must be exclusive (next day)
    const exclusiveEnd = addOneDay(endDateStr);

    payload.start = { dateTime: `${startDateStr}T00:00:00`, timeZone: 'Eastern Standard Time' };
    payload.end = { dateTime: `${exclusiveEnd}T00:00:00`, timeZone: 'Eastern Standard Time' };
  } else {
    payload.start = formatGraphDateTime(startDate, false);
    payload.end = formatGraphDateTime(endDate, false);
  }

  // Add location if company has address
  if (company?.address) {
    payload.location = { displayName: company.address };
  }

  return payload;
}

/**
 * Build Graph event payload for a standalone calendar event
 */
function buildCalendarEventPayload(event) {
  const isAllDay = event.allDay || false;
  const startDate = new Date(event.startTime);
  let endDate = event.endTime ? new Date(event.endTime) : null;

  // Default end = start + 1 hour for timed events, or if end <= start
  if (!isAllDay && (!endDate || endDate.getTime() <= startDate.getTime())) {
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  }

  const payload = {
    subject: event.title,
    body: {
      contentType: 'text',
      content: event.description || '',
    },
    showAs: 'busy',
    categories: ['NADC Helpdesk'],
    isAllDay,
  };

  if (isAllDay) {
    const startDateStr = utcToEasternDate(startDate);
    const endDateStr = endDate ? utcToEasternDate(endDate) : startDateStr;
    const exclusiveEnd = addOneDay(endDateStr);

    payload.start = { dateTime: `${startDateStr}T00:00:00`, timeZone: 'Eastern Standard Time' };
    payload.end = { dateTime: `${exclusiveEnd}T00:00:00`, timeZone: 'Eastern Standard Time' };
  } else {
    payload.start = formatGraphDateTime(startDate, false);
    payload.end = formatGraphDateTime(endDate, false);
  }

  return payload;
}

/**
 * Process the queue serially
 */
async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const task = queue.shift();
    try {
      await task();
    } catch (err) {
      console.error('[OutlookSync] Queue task error:', err.message);
    }
  }

  processing = false;
}

/**
 * Enqueue a task
 */
function enqueue(task) {
  queue.push(task);
  setImmediate(processQueue);
}

/**
 * Create an Outlook event
 */
async function createOutlookEvent(graphClient, mailbox, payload) {
  const response = await graphClient.api(`/users/${mailbox}/events`).post(payload);
  return response.id;
}

/**
 * Update an Outlook event
 */
async function updateOutlookEvent(graphClient, mailbox, eventId, payload) {
  await graphClient.api(`/users/${mailbox}/events/${eventId}`).patch(payload);
}

/**
 * Delete an Outlook event
 */
async function deleteOutlookEvent(graphClient, mailbox, eventId) {
  await graphClient.api(`/users/${mailbox}/events/${eventId}`).delete();
}

/**
 * Sync a source (TICKET_SCHEDULE or CALENDAR_EVENT) for all its assignees
 */
async function syncSource(sourceType, sourceId) {
  const { enabled, allowedEmails } = getSyncConfig();
  if (!enabled) {
    console.log(`[OutlookSync] Sync disabled, skipping ${sourceType}:${sourceId}`);
    return;
  }

  const graphClient = getGraphClient();
  if (!graphClient) {
    console.log('[OutlookSync] Graph client not initialized, skipping sync');
    return;
  }

  let source = null;
  let desiredUsers = [];
  let payload = null;

  try {
    if (sourceType === 'TICKET_SCHEDULE') {
      source = await prisma.ticketSchedule.findUnique({
        where: { id: sourceId },
        include: {
          ticket: {
            include: {
              company: true,
              assignee: true,
              additionalAssignees: {
                include: { user: true },
              },
            },
          },
        },
      });

      if (!source) {
        // Source deleted, clean up all mappings
        await cleanupDeletedSource(sourceType, sourceId, graphClient);
        return;
      }

      const ticket = source.ticket;
      const company = ticket.company;

      // Collect all assignees
      const allAssignees = [];
      if (ticket.assignee) allAssignees.push(ticket.assignee);
      if (ticket.additionalAssignees) {
        for (const ta of ticket.additionalAssignees) {
          if (ta.user) allAssignees.push(ta.user);
        }
      }

      desiredUsers = allAssignees.filter((u) => isUserEligible(u, allowedEmails));
      payload = buildTicketSchedulePayload(source, ticket, company);
    } else if (sourceType === 'CALENDAR_EVENT') {
      source = await prisma.calendarEvent.findUnique({
        where: { id: sourceId },
        include: {
          assignees: {
            include: { user: true },
          },
        },
      });

      if (!source) {
        await cleanupDeletedSource(sourceType, sourceId, graphClient);
        return;
      }

      const allAssignees = source.assignees?.map((a) => a.user).filter(Boolean) || [];
      desiredUsers = allAssignees.filter((u) => isUserEligible(u, allowedEmails));
      payload = buildCalendarEventPayload(source);
    } else {
      console.error(`[OutlookSync] Unknown sourceType: ${sourceType}`);
      return;
    }

    // Get existing mappings
    const existingMappings = await prisma.outlookEventSync.findMany({
      where: { sourceType, sourceId },
    });

    const existingByUserId = new Map(existingMappings.map((m) => [m.userId, m]));
    const desiredUserIds = new Set(desiredUsers.map((u) => u.id));

    // Process each existing mapping
    for (const mapping of existingMappings) {
      if (!desiredUserIds.has(mapping.userId)) {
        // User no longer assigned, delete event
        await syncDeleteEvent(graphClient, mapping);
      }
    }

    // Process each desired user
    for (const user of desiredUsers) {
      const mapping = existingByUserId.get(user.id);
      await syncUserEvent(graphClient, sourceType, sourceId, user, mapping, payload);
    }
  } catch (err) {
    console.error(`[OutlookSync] Error syncing ${sourceType}:${sourceId}:`, err.message);
  }
}

/**
 * Sync a single user's event
 */
async function syncUserEvent(graphClient, sourceType, sourceId, user, existingMapping, payload) {
  const mailbox = user.email.toLowerCase();

  try {
    if (existingMapping) {
      // Try to update existing event
      try {
        await updateOutlookEvent(graphClient, mailbox, existingMapping.outlookEventId, payload);
        await prisma.outlookEventSync.update({
          where: { id: existingMapping.id },
          data: { lastSyncedAt: new Date(), lastError: null },
        });
        console.log(`[OutlookSync] Updated event for ${mailbox} (${sourceType}:${sourceId})`);
      } catch (updateErr) {
        if (updateErr.statusCode === 404) {
          // Event deleted in Outlook, recreate
          console.log(`[OutlookSync] Event not found in Outlook, recreating for ${mailbox}`);
          const newEventId = await createOutlookEvent(graphClient, mailbox, payload);
          await prisma.outlookEventSync.update({
            where: { id: existingMapping.id },
            data: {
              outlookEventId: newEventId,
              lastSyncedAt: new Date(),
              lastError: null,
            },
          });
          console.log(`[OutlookSync] Recreated event for ${mailbox}`);
        } else {
          throw updateErr;
        }
      }
    } else {
      // Create new event
      const eventId = await createOutlookEvent(graphClient, mailbox, payload);
      await prisma.outlookEventSync.create({
        data: {
          sourceType,
          sourceId,
          userId: user.id,
          mailbox,
          outlookEventId: eventId,
          lastSyncedAt: new Date(),
        },
      });
      console.log(`[OutlookSync] Created event for ${mailbox} (${sourceType}:${sourceId})`);
    }
  } catch (err) {
    const errorMsg = err.message || String(err);

    // Handle 403 specially
    if (err.statusCode === 403 || errorMsg.includes('ErrorAccessDenied')) {
      console.warn(
        `[OutlookSync] Mailbox ${mailbox} not permitted (RBAC not configured for this mailbox)`
      );
    } else {
      console.error(`[OutlookSync] Error syncing event for ${mailbox}:`, errorMsg);
    }

    // Update or create mapping with error
    if (existingMapping) {
      await prisma.outlookEventSync
        .update({
          where: { id: existingMapping.id },
          data: { lastError: errorMsg.slice(0, 500) },
        })
        .catch(() => {});
    }
  }
}

/**
 * Delete an event from Outlook and remove the mapping
 * Only deletes the mapping row if Graph delete succeeded or returned 404.
 * On other errors, keeps the row and sets lastError.
 */
async function syncDeleteEvent(graphClient, mapping) {
  try {
    await deleteOutlookEvent(graphClient, mapping.mailbox, mapping.outlookEventId);
    console.log(`[OutlookSync] Deleted event from ${mapping.mailbox}`);
    // Delete succeeded, remove the mapping
    await prisma.outlookEventSync.delete({ where: { id: mapping.id } }).catch(() => {});
  } catch (err) {
    if (err.statusCode === 404) {
      // Event already gone, remove the mapping
      console.log(`[OutlookSync] Event already deleted from ${mapping.mailbox}`);
      await prisma.outlookEventSync.delete({ where: { id: mapping.id } }).catch(() => {});
    } else {
      // Other error - keep the mapping, set lastError
      const errorMsg = err.message || String(err);
      console.error(`[OutlookSync] Error deleting event from ${mapping.mailbox}:`, errorMsg);
      await prisma.outlookEventSync
        .update({
          where: { id: mapping.id },
          data: { lastError: errorMsg.slice(0, 500) },
        })
        .catch(() => {});
    }
  }
}

/**
 * Clean up mappings for a deleted source
 */
async function cleanupDeletedSource(sourceType, sourceId, graphClient) {
  const mappings = await prisma.outlookEventSync.findMany({
    where: { sourceType, sourceId },
  });

  for (const mapping of mappings) {
    await syncDeleteEvent(graphClient, mapping);
  }

  console.log(`[OutlookSync] Cleaned up ${mappings.length} events for deleted ${sourceType}:${sourceId}`);
}

// ============================================
// PUBLIC API - Fire and forget, never throw
// ============================================

/**
 * Queue sync for a ticket schedule
 */
function queueSyncTicketSchedule(scheduleId) {
  enqueue(async () => {
    try {
      await syncSource('TICKET_SCHEDULE', scheduleId);
    } catch (err) {
      console.error('[OutlookSync] queueSyncTicketSchedule error:', err.message);
    }
  });
}

/**
 * Queue sync for a calendar event
 */
function queueSyncCalendarEvent(eventId) {
  enqueue(async () => {
    try {
      await syncSource('CALENDAR_EVENT', eventId);
    } catch (err) {
      console.error('[OutlookSync] queueSyncCalendarEvent error:', err.message);
    }
  });
}

/**
 * Queue sync for all future schedules of a ticket
 */
function queueSyncTicket(ticketId) {
  enqueue(async () => {
    try {
      const now = new Date();
      const schedules = await prisma.ticketSchedule.findMany({
        where: {
          ticketId,
          scheduledStart: { gte: now },
        },
        select: { id: true },
      });

      for (const schedule of schedules) {
        await syncSource('TICKET_SCHEDULE', schedule.id);
      }

      console.log(`[OutlookSync] Synced ${schedules.length} future schedules for ticket ${ticketId}`);
    } catch (err) {
      console.error('[OutlookSync] queueSyncTicket error:', err.message);
    }
  });
}

/**
 * Get mapping snapshot before deletion
 * Returns array of { id, sourceType, sourceId, userId, mailbox, outlookEventId }
 */
async function getMappingSnapshot(sourceType, sourceIds) {
  try {
    const ids = Array.isArray(sourceIds) ? sourceIds : [sourceIds];
    const mappings = await prisma.outlookEventSync.findMany({
      where: {
        sourceType,
        sourceId: { in: ids },
      },
    });
    return mappings;
  } catch (err) {
    console.error('[OutlookSync] getMappingSnapshot error:', err.message);
    return [];
  }
}

/**
 * Queue removal of events from a snapshot (after source is deleted)
 * Uses syncDeleteEvent which only removes mappings on success or 404.
 */
function queueRemoveSnapshot(snapshot) {
  if (!snapshot || snapshot.length === 0) return;

  enqueue(async () => {
    try {
      const { enabled } = getSyncConfig();
      if (!enabled) {
        // Sync disabled - keep mappings for later cleanup, log warning
        console.log(`[OutlookSync] Sync disabled, keeping ${snapshot.length} mapping(s) for later cleanup`);
        return;
      }

      const graphClient = getGraphClient();
      if (!graphClient) {
        // Can't reach Outlook - keep mappings for later cleanup
        console.log(`[OutlookSync] Graph client unavailable, keeping ${snapshot.length} mapping(s) for later cleanup`);
        return;
      }

      let removed = 0;
      for (const mapping of snapshot) {
        await syncDeleteEvent(graphClient, mapping);
        removed++;
      }

      console.log(`[OutlookSync] Processed ${removed} event(s) from snapshot`);
    } catch (err) {
      console.error('[OutlookSync] queueRemoveSnapshot error:', err.message);
    }
  });
}

/**
 * Direct sync (for backfill script) - returns promise
 */
async function syncSourceDirect(sourceType, sourceId) {
  return syncSource(sourceType, sourceId);
}

module.exports = {
  queueSyncTicketSchedule,
  queueSyncCalendarEvent,
  queueSyncTicket,
  getMappingSnapshot,
  queueRemoveSnapshot,
  // For backfill script
  syncSourceDirect,
  getSyncConfig,
  isUserEligible,
};
