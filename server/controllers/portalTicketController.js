const { PrismaClient } = require('@prisma/client');
const { sendEmail } = require('../services/emailService');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

/**
 * GET /api/portal/tickets
 * Get tickets for the logged-in contact
 */
async function portalGetTickets(req, res, next) {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    // Build where clause - only this contact's tickets
    const where = {
      requesterId: req.contact.id,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.subject = { contains: search, mode: 'insensitive' };
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          status: true,
          priority: true,
          type: true,
          createdAt: true,
          updatedAt: true,
          assignee: {
            select: { name: true }, // Name only, no email
          },
          company: {
            select: { name: true },
          },
          tags: {
            include: { tag: true },
          },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    // Format tickets for portal
    const formattedTickets = tickets.map((ticket) => ({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      type: ticket.type,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      assigneeName: ticket.assignee?.name || null,
      companyName: ticket.company?.name || null,
      tags: ticket.tags.map((t) => t.tag.name),
    }));

    res.json({
      tickets: formattedTickets,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/portal/tickets/:id
 * Get single ticket for the logged-in contact
 */
async function portalGetTicket(req, res, next) {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        assignee: {
          select: { name: true }, // Name only
        },
        company: {
          select: { name: true },
        },
        tags: {
          include: { tag: true },
        },
        checklistItems: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            label: true,
            isChecked: true,
            order: true,
          },
        },
        replies: {
          where: { isInternal: false }, // Public replies only
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: { name: true }, // Name only
            },
            portalContact: {
              select: { name: true },
            },
            attachments: {
              select: {
                id: true,
                filename: true,
                mimeType: true,
                size: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Verify ticket belongs to this contact
    if (ticket.requesterId !== req.contact.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Calculate checklist progress
    const checklistTotal = ticket.checklistItems.length;
    const checklistCompleted = ticket.checklistItems.filter((item) => item.isChecked).length;
    const checklistProgress = checklistTotal > 0
      ? Math.round((checklistCompleted / checklistTotal) * 100)
      : 0;

    // Format replies for portal
    const replies = ticket.replies.map((reply) => ({
      id: reply.id,
      body: reply.body,
      createdAt: reply.createdAt,
      authorName: reply.author?.name || reply.portalContact?.name || 'Unknown',
      isFromContact: !!reply.portalContactId,
      attachments: reply.attachments,
    }));

    res.json({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      type: ticket.type,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      resolvedAt: ticket.resolvedAt,
      resolutionSummary: ticket.resolutionSummary,
      assigneeName: ticket.assignee?.name || null,
      companyName: ticket.company?.name || null,
      tags: ticket.tags.map((t) => t.tag.name),
      checklistItems: ticket.checklistItems,
      checklistProgress,
      replies,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/portal/tickets
 * Create a new ticket from portal
 */
async function portalCreateTicket(req, res, next) {
  try {
    const { subject, description, type = 'QUESTION' } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: 'Subject is required' });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    // Get contact for company association
    const contact = await prisma.contact.findUnique({
      where: { id: req.contact.id },
      include: { company: true },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Create ticket
    const ticket = await prisma.ticket.create({
      data: {
        subject: subject.trim(),
        description: description.trim(),
        type,
        priority: 'MEDIUM', // Default, contact cannot set
        status: 'OPEN',
        requesterId: contact.id,
        companyId: contact.companyId,
      },
      include: {
        requester: {
          select: { id: true, name: true, email: true },
        },
        company: {
          select: { name: true },
        },
      },
    });

    // Create activity log
    await prisma.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        type: 'ticket_created',
        description: 'Ticket submitted via customer portal',
      },
    });

    // Send confirmation email
    try {
      const templatePath = path.join(__dirname, '../email-templates/new-ticket-confirmation.html');
      if (fs.existsSync(templatePath)) {
        let template = fs.readFileSync(templatePath, 'utf-8');
        template = template
          .replace(/\{\{contact_name\}\}/g, contact.name)
          .replace(/\{\{ticket_number\}\}/g, ticket.ticketNumber)
          .replace(/\{\{ticket_subject\}\}/g, ticket.subject)
          .replace(/\{\{portal_url\}\}/g, `${CLIENT_URL}/portal/tickets/${ticket.id}`);

        await sendEmail({
          to: contact.email,
          subject: `Ticket #${ticket.ticketNumber} Received - ${ticket.subject}`,
          html: template,
        });
      }
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
    }

    // Run TICKET_CREATED automations
    try {
      const automations = await prisma.automationRule.findMany({
        where: {
          trigger: 'TICKET_CREATED',
          isActive: true,
        },
        orderBy: { runOrder: 'asc' },
      });

      for (const rule of automations) {
        await runAutomationRule(rule, ticket.id);
      }
    } catch (automationError) {
      console.error('Automation error:', automationError);
    }

    res.status(201).json({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      type: ticket.type,
      createdAt: ticket.createdAt,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/portal/tickets/:id/replies
 * Add a reply from the portal contact
 */
async function portalReplyToTicket(req, res, next) {
  try {
    const { id } = req.params;
    const { body } = req.body;

    if (!body || body.trim().length < 10) {
      return res.status(400).json({ error: 'Reply must be at least 10 characters' });
    }

    // Get ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        assignee: true,
        requester: true,
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Verify ticket belongs to this contact
    if (ticket.requesterId !== req.contact.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create reply - attributed to portal contact
    const reply = await prisma.ticketReply.create({
      data: {
        ticketId: id,
        body: body.trim(),
        isInternal: false, // Portal replies are always public
        portalContactId: req.contact.id,
      },
      include: {
        portalContact: {
          select: { name: true },
        },
      },
    });

    // Reopen ticket if it was resolved or closed
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      await prisma.ticket.update({
        where: { id },
        data: { status: 'OPEN' },
      });

      await prisma.ticketActivity.create({
        data: {
          ticketId: id,
          type: 'status_changed',
          description: 'Ticket reopened due to customer reply',
        },
      });
    }

    // Create activity log
    await prisma.ticketActivity.create({
      data: {
        ticketId: id,
        type: 'reply_added',
        description: 'Reply added via customer portal',
      },
    });

    // Notify assigned agent
    if (ticket.assigneeId) {
      await prisma.notification.create({
        data: {
          userId: ticket.assigneeId,
          type: 'portal_reply',
          title: 'New Portal Reply',
          message: `${ticket.requester.name} replied to ticket #${ticket.ticketNumber}`,
          link: `/tickets/${ticket.id}`,
          ticketId: ticket.id,
        },
      });
    }

    // Run REPLY_RECEIVED automations
    try {
      const automations = await prisma.automationRule.findMany({
        where: {
          trigger: 'REPLY_RECEIVED',
          isActive: true,
        },
        orderBy: { runOrder: 'asc' },
      });

      for (const rule of automations) {
        await runAutomationRule(rule, ticket.id);
      }
    } catch (automationError) {
      console.error('Automation error:', automationError);
    }

    res.status(201).json({
      id: reply.id,
      body: reply.body,
      createdAt: reply.createdAt,
      authorName: reply.portalContact?.name || 'You',
      isFromContact: true,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/portal/tickets/:id/replies
 * Get replies for a ticket (public only)
 */
async function portalGetReplies(req, res, next) {
  try {
    const { id } = req.params;

    // Verify ticket exists and belongs to contact
    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.requesterId !== req.contact.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const replies = await prisma.ticketReply.findMany({
      where: {
        ticketId: id,
        isInternal: false, // Public only
      },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: { name: true },
        },
        portalContact: {
          select: { name: true },
        },
        attachments: {
          select: {
            id: true,
            filename: true,
            mimeType: true,
            size: true,
          },
        },
      },
    });

    const formattedReplies = replies.map((reply) => ({
      id: reply.id,
      body: reply.body,
      createdAt: reply.createdAt,
      authorName: reply.portalContactId
        ? `${reply.portalContact?.name} (You)`
        : reply.author?.name || 'NADC Support',
      isFromContact: !!reply.portalContactId,
      attachments: reply.attachments,
    }));

    res.json({ replies: formattedReplies });
  } catch (error) {
    next(error);
  }
}

/**
 * Helper: Run automation rule on a ticket
 */
async function runAutomationRule(rule, ticketId) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      requester: true,
      company: true,
      tags: { include: { tag: true } },
    },
  });

  if (!ticket) return;

  const conditions = rule.conditions;
  const actions = rule.actions;

  // Check conditions (simplified)
  let conditionsMet = true;
  if (conditions && Array.isArray(conditions)) {
    for (const condition of conditions) {
      if (condition.field === 'priority' && ticket.priority !== condition.value) {
        conditionsMet = false;
        break;
      }
      if (condition.field === 'type' && ticket.type !== condition.value) {
        conditionsMet = false;
        break;
      }
    }
  }

  if (!conditionsMet) return;

  // Execute actions
  if (actions && Array.isArray(actions)) {
    for (const action of actions) {
      if (action.type === 'set_priority') {
        await prisma.ticket.update({
          where: { id: ticketId },
          data: { priority: action.value },
        });
      }
      if (action.type === 'assign_agent' && action.value) {
        await prisma.ticket.update({
          where: { id: ticketId },
          data: { assigneeId: action.value },
        });
      }
    }
  }
}

module.exports = {
  portalGetTickets,
  portalGetTicket,
  portalCreateTicket,
  portalReplyToTicket,
  portalGetReplies,
};
