const { PrismaClient } = require('@prisma/client');
const {
  sendTicketConfirmation,
  sendAgentReplyEmail,
  sendTicketAssignedEmail,
  sendStatusChangedEmail,
  sendSLABreachEmail,
} = require('./emailService');

const prisma = new PrismaClient();

// Store io instance for real-time notifications
let io = null;

function setSocketIO(socketIO) {
  io = socketIO;
}

// Emit notification to user via Socket.io
function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

// Create and emit notification
async function createAndEmit({ userId, type, title, message, link }) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link,
      },
    });

    // Emit via Socket.io
    emitToUser(userId, 'notification:new', notification);

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}

// Notify when ticket is assigned
async function onTicketAssigned(ticket, assignee, assigner) {
  // Skip if self-assigning
  if (assignee.id === assigner?.id) return;

  // Create in-app notification
  const notification = await createAndEmit({
    userId: assignee.id,
    type: 'ticket_assigned',
    title: 'Ticket Assigned to You',
    message: `#${ticket.id}: ${ticket.subject}`,
    link: `/tickets/${ticket.id}`,
  });

  // Send email notification
  const requester = await prisma.contact.findFirst({
    where: { id: ticket.requesterId },
  });
  sendTicketAssignedEmail(ticket, assignee, requester).catch((err) =>
    console.error('[Notifications] Failed to send assignment email:', err.message)
  );

  return notification;
}

// Notify when reply is added
async function onTicketReply(ticket, reply, author) {
  const notifications = [];

  // Get ticket with watchers and assignee
  const fullTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    include: {
      watchers: { include: { user: true } },
      assignee: true,
      requester: true,
    },
  });

  // Notify assignee (if not the author)
  if (fullTicket.assignee && fullTicket.assignee.id !== author.id) {
    const notif = await createAndEmit({
      userId: fullTicket.assignee.id,
      type: 'ticket_reply',
      title: 'New Reply',
      message: `#${ticket.id}: ${ticket.subject}`,
      link: `/tickets/${ticket.id}`,
    });
    if (notif) notifications.push(notif);
  }

  // Notify watchers (except author)
  for (const watcher of fullTicket.watchers) {
    if (watcher.userId === author.id) continue;
    if (watcher.userId === fullTicket.assignee?.id) continue; // Already notified

    const notif = await createAndEmit({
      userId: watcher.userId,
      type: 'ticket_reply',
      title: 'New Reply',
      message: `#${ticket.id}: ${ticket.subject}`,
      link: `/tickets/${ticket.id}`,
    });
    if (notif) notifications.push(notif);
  }

  // Send email to requester (if not internal note)
  if (!reply.isInternal && fullTicket.requester?.email) {
    sendAgentReplyEmail(fullTicket, reply, author, fullTicket.requester).catch((err) =>
      console.error('[Notifications] Failed to send reply email:', err.message)
    );
  }

  // Emit to ticket room for real-time UI update
  if (io) {
    io.to(`ticket:${ticket.id}`).emit('ticket:reply', {
      ticketId: ticket.id,
      reply,
    });
  }

  return notifications;
}

// Notify when ticket status changes
async function onTicketStatusChange(ticket, oldStatus, newStatus, changedBy) {
  const notifications = [];

  // Get ticket with watchers and assignee
  const fullTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    include: {
      watchers: { include: { user: true } },
      assignee: true,
      requester: true,
    },
  });

  // Notify assignee (if not the one who changed)
  if (fullTicket.assignee && fullTicket.assignee.id !== changedBy.id) {
    const notif = await createAndEmit({
      userId: fullTicket.assignee.id,
      type: 'ticket_status_changed',
      title: `Ticket ${newStatus}`,
      message: `#${ticket.id}: ${ticket.subject}`,
      link: `/tickets/${ticket.id}`,
    });
    if (notif) notifications.push(notif);
  }

  // Notify watchers (except the one who changed)
  for (const watcher of fullTicket.watchers) {
    if (watcher.userId === changedBy.id) continue;
    if (watcher.userId === fullTicket.assignee?.id) continue;

    const notif = await createAndEmit({
      userId: watcher.userId,
      type: 'ticket_status_changed',
      title: `Ticket ${newStatus}`,
      message: `#${ticket.id}: ${ticket.subject}`,
      link: `/tickets/${ticket.id}`,
    });
    if (notif) notifications.push(notif);
  }

  // Send status change email to requester
  if (fullTicket.requester?.email) {
    sendStatusChangedEmail(fullTicket, oldStatus, newStatus, fullTicket.requester).catch((err) =>
      console.error('[Notifications] Failed to send status change email:', err.message)
    );
  }

  // Emit to ticket room
  if (io) {
    io.to(`ticket:${ticket.id}`).emit('ticket:updated', {
      ticketId: ticket.id,
      changes: { status: newStatus },
    });
  }

  return notifications;
}

// Notify when ticket is created
async function onTicketCreated(ticket) {
  // Get ticket with full relations
  const fullTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    include: {
      requester: true,
      assignee: true,
      company: true,
    },
  });

  // Send confirmation email to requester
  if (fullTicket.requester?.email) {
    sendTicketConfirmation(fullTicket, fullTicket.requester).catch((err) =>
      console.error('[Notifications] Failed to send ticket confirmation email:', err.message)
    );
  }

  // Notify assignee if assigned
  if (fullTicket.assignee) {
    await createAndEmit({
      userId: fullTicket.assignee.id,
      type: 'ticket_assigned',
      title: 'New Ticket Assigned',
      message: `#${ticket.id}: ${ticket.subject}`,
      link: `/tickets/${ticket.id}`,
    });
  }

  // Emit to general agent room for unassigned tickets
  if (io && !fullTicket.assignee) {
    io.to('agents').emit('ticket:new', {
      ticketId: ticket.id,
      subject: ticket.subject,
      priority: ticket.priority,
    });
  }
}

// SLA warning notification
async function onSLAWarning(ticket, timeRemaining) {
  const fullTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    include: { assignee: true, requester: true },
  });

  if (!fullTicket.assignee) return;

  // Create in-app notification
  await createAndEmit({
    userId: fullTicket.assignee.id,
    type: 'sla_warning',
    title: 'SLA Warning',
    message: `#${ticket.ticketNumber || ticket.id} - ${timeRemaining} remaining`,
    link: `/tickets/${ticket.id}`,
  });

  // Send SLA breach warning email
  sendSLABreachEmail(fullTicket, fullTicket.assignee, 'SLA Warning').catch((err) =>
    console.error('[Notifications] Failed to send SLA warning email:', err.message)
  );
}

// SLA breached notification
async function onSLABreached(ticket, breachType = 'Resolution') {
  const fullTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    include: { assignee: true, requester: true },
  });

  if (!fullTicket.assignee) return;

  await createAndEmit({
    userId: fullTicket.assignee.id,
    type: 'sla_breached',
    title: 'SLA Breached',
    message: `#${ticket.ticketNumber || ticket.id}: ${ticket.subject}`,
    link: `/tickets/${ticket.id}`,
  });

  // Send SLA breach email
  sendSLABreachEmail(fullTicket, fullTicket.assignee, breachType).catch((err) =>
    console.error('[Notifications] Failed to send SLA breach email:', err.message)
  );
}

module.exports = {
  setSocketIO,
  emitToUser,
  createAndEmit,
  onTicketAssigned,
  onTicketReply,
  onTicketStatusChange,
  onTicketCreated,
  onSLAWarning,
  onSLABreached,
};
