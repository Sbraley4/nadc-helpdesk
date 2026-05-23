const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Get notifications for current user
async function getNotifications(req, res, next) {
  try {
    const userId = req.user.id;
    const { unreadOnly, limit = 20, offset = 0 } = req.query;

    const where = {
      userId,
      ...(unreadOnly === 'true' ? { readAt: null } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId, readAt: null },
      }),
    ]);

    res.json({
      notifications,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
}

// Mark notification as read
async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });

    res.json({ notification: updated });
  } catch (error) {
    next(error);
  }
}

// Mark all notifications as read
async function markAllAsRead(req, res, next) {
  try {
    const userId = req.user.id;

    const result = await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    res.json({ updated: result.count });
  } catch (error) {
    next(error);
  }
}

// Delete a notification
async function deleteNotification(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await prisma.notification.delete({ where: { id } });

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
}

// Get unread count only
async function getUnreadCount(req, res, next) {
  try {
    const userId = req.user.id;

    const count = await prisma.notification.count({
      where: { userId, readAt: null },
    });

    res.json({ unreadCount: count });
  } catch (error) {
    next(error);
  }
}

// Create notification (internal use)
async function createNotification({ userId, type, title, message, link }) {
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

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}

// Create notifications for ticket events
async function notifyTicketAssigned(ticket, assignee) {
  return createNotification({
    userId: assignee.id,
    type: 'ticket_assigned',
    title: 'Ticket Assigned',
    message: `Ticket #${ticket.id}: ${ticket.subject}`,
    link: `/tickets/${ticket.id}`,
  });
}

async function notifyTicketReply(ticket, reply, watchers) {
  const notifications = [];

  for (const watcher of watchers) {
    // Don't notify the author of the reply
    if (watcher.userId === reply.authorId) continue;

    const notif = await createNotification({
      userId: watcher.userId,
      type: 'ticket_reply',
      title: 'New Reply',
      message: `New reply on ticket #${ticket.id}: ${ticket.subject}`,
      link: `/tickets/${ticket.id}`,
    });

    if (notif) notifications.push(notif);
  }

  return notifications;
}

async function notifyTicketStatusChange(ticket, oldStatus, newStatus, watchers) {
  const notifications = [];

  for (const watcher of watchers) {
    const notif = await createNotification({
      userId: watcher.userId,
      type: 'ticket_status_changed',
      title: `Ticket ${newStatus}`,
      message: `Ticket #${ticket.id} changed from ${oldStatus} to ${newStatus}`,
      link: `/tickets/${ticket.id}`,
    });

    if (notif) notifications.push(notif);
  }

  return notifications;
}

async function notifySLAWarning(ticket, assignee, timeRemaining) {
  return createNotification({
    userId: assignee.id,
    type: 'sla_warning',
    title: 'SLA Warning',
    message: `Ticket #${ticket.id} SLA breach in ${timeRemaining}`,
    link: `/tickets/${ticket.id}`,
  });
}

async function notifySLABreached(ticket, assignee) {
  return createNotification({
    userId: assignee.id,
    type: 'sla_breached',
    title: 'SLA Breached',
    message: `Ticket #${ticket.id} has breached SLA`,
    link: `/tickets/${ticket.id}`,
  });
}

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  createNotification,
  notifyTicketAssigned,
  notifyTicketReply,
  notifyTicketStatusChange,
  notifySLAWarning,
  notifySLABreached,
};
