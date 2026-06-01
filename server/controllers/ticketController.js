const { PrismaClient } = require('@prisma/client');
const { scheduleReviewRequest } = require('./satisfactionController');
const {
  sendTicketConfirmation,
  sendTicketAssignedEmail,
  sendStatusChangedEmail,
} = require('../services/emailService');
const { runAutomations } = require('../services/automationEngine');

const prisma = new PrismaClient();

// Common include for ticket relations
const ticketInclude = {
  requester: {
    select: { id: true, name: true, email: true, phone: true },
  },
  company: {
    select: { id: true, name: true, domain: true },
  },
  assignee: {
    select: { id: true, name: true, email: true, avatar: true, color: true },
  },
  additionalAssignees: {
    include: {
      user: {
        select: { id: true, name: true, email: true, avatar: true, color: true },
      },
    },
  },
  group: {
    select: { id: true, name: true },
  },
  tags: {
    include: {
      tag: true,
    },
  },
  slaPolicy: true,
};

// Full include for single ticket view
const fullTicketInclude = {
  ...ticketInclude,
  customFields: {
    include: {
      field: {
        select: { id: true, label: true, fieldKey: true, fieldType: true },
      },
    },
  },
  watchers: {
    include: {
      user: {
        select: { id: true, name: true, avatar: true },
      },
    },
  },
  relatedTickets: {
    include: {
      relatedTicket: {
        select: { id: true, ticketNumber: true, subject: true, status: true },
      },
    },
  },
  _count: {
    select: { replies: true, attachments: true },
  },
};

/**
 * Transform ticket object to flatten nested relations
 */
function transformTicket(ticket) {
  return {
    ...ticket,
    tags: ticket.tags?.map((tt) => tt.tag) || [],
    additionalAssignees: ticket.additionalAssignees?.map((ta) => ta.user) || [],
    customFields: ticket.customFields?.map((cfv) => ({
      fieldId: cfv.fieldId,
      fieldKey: cfv.field.fieldKey,
      label: cfv.field.label,
      fieldType: cfv.field.fieldType,
      value: cfv.value,
    })) || undefined,
    watchers: ticket.watchers?.map((tw) => tw.user) || undefined,
    relatedTickets: ticket.relatedTickets?.map((rt) => rt.relatedTicket) || undefined,
  };
}

/**
 * GET /api/tickets
 * List tickets with filters and pagination
 */
const listTickets = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 25,
      status,
      priority,
      assigneeId,
      companyId,
      groupId,
      tag,
      search,
      dueBefore,
      slaBreached,
      createdAfter,
      createdBefore,
      sortBy = 'updatedAt',
      order = 'desc',
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where = {};

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (assigneeId) {
      if (assigneeId === 'unassigned') {
        where.assigneeId = null;
      } else {
        where.assigneeId = assigneeId;
      }
    }

    if (companyId) {
      where.companyId = companyId;
    }

    if (groupId) {
      where.groupId = groupId;
    }

    if (tag) {
      where.tags = {
        some: {
          tag: {
            name: tag,
          },
        },
      };
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (dueBefore) {
      where.dueDate = { lte: new Date(dueBefore) };
    }

    if (slaBreached !== undefined) {
      where.slaBreached = slaBreached === 'true';
    }

    if (createdAfter) {
      where.createdAt = { ...where.createdAt, gte: new Date(createdAfter) };
    }

    if (createdBefore) {
      where.createdAt = { ...where.createdAt, lte: new Date(createdBefore) };
    }

    // Build orderBy
    const validSortFields = ['createdAt', 'updatedAt', 'priority', 'dueDate'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'updatedAt';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    // For priority sorting, use custom order
    let orderBy;
    if (sortField === 'priority') {
      // Priority order: URGENT > HIGH > MEDIUM > LOW
      orderBy = [
        {
          priority: sortOrder,
        },
        { updatedAt: 'desc' },
      ];
    } else {
      orderBy = { [sortField]: sortOrder };
    }

    // Execute queries
    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: ticketInclude,
        skip,
        take: limitNum,
        orderBy,
      }),
      prisma.ticket.count({ where }),
    ]);

    const transformedTickets = tickets.map(transformTicket);

    res.json({
      tickets: transformedTickets,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tickets/views
 * Returns saved view definitions
 */
const getViews = async (req, res) => {
  const views = [
    {
      id: 'my-open',
      label: 'My open tickets',
      filters: { status: 'OPEN', assigneeId: '{{currentUserId}}' },
    },
    {
      id: 'unassigned',
      label: 'Unassigned tickets',
      filters: { assigneeId: 'unassigned', status: 'OPEN' },
    },
    {
      id: 'high-priority',
      label: 'High priority open',
      filters: { priority: 'HIGH', status: 'OPEN' },
    },
    {
      id: 'urgent',
      label: 'Urgent',
      filters: { priority: 'URGENT' },
    },
    {
      id: 'sla-breached',
      label: 'SLA breached',
      filters: { slaBreached: 'true' },
    },
    {
      id: 'resolved-today',
      label: 'Resolved today',
      filters: { status: 'RESOLVED', createdAfter: '{{today}}' },
    },
  ];

  res.json(views);
};

/**
 * GET /api/tickets/:id
 * Get single ticket with all relations
 */
const getTicket = async (req, res, next) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: fullTicketInclude,
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(transformTicket(ticket));
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tickets
 * Create a new ticket
 */
const createTicket = async (req, res, next) => {
  try {
    const {
      subject,
      description,
      priority = 'MEDIUM',
      type = 'QUESTION',
      status = 'OPEN',
      requesterId,
      companyId,
      assigneeId,
      additionalAssigneeIds = [],
      groupId,
      tagIds = [],
      dueDate,
      customFields = [],
    } = req.body;

    // Validate required fields
    if (!subject || !description) {
      return res.status(400).json({ error: 'Subject and description are required' });
    }

    if (!requesterId) {
      return res.status(400).json({ error: 'Requester ID is required' });
    }

    // Verify requester exists
    const requester = await prisma.contact.findUnique({
      where: { id: requesterId },
    });

    if (!requester) {
      return res.status(400).json({ error: 'Requester not found' });
    }

    // Find SLA policy for this priority
    const slaPolicy = await prisma.sLAPolicy.findFirst({
      where: { appliesTo: priority },
    });

    // Create ticket with related records
    const ticket = await prisma.$transaction(async (tx) => {
      // Create the ticket
      const newTicket = await tx.ticket.create({
        data: {
          subject,
          description,
          priority,
          type,
          status,
          requesterId,
          companyId: companyId || requester.companyId,
          assigneeId,
          groupId,
          dueDate: dueDate ? new Date(dueDate) : null,
          slaPolicyId: slaPolicy?.id,
          firstResponseAt: assigneeId ? new Date() : null,
        },
      });

      // Create tag associations
      if (tagIds.length > 0) {
        await tx.ticketTag.createMany({
          data: tagIds.map((tagId) => ({
            ticketId: newTicket.id,
            tagId,
          })),
        });
      }

      // Create additional assignee associations
      if (additionalAssigneeIds.length > 0) {
        await tx.ticketAssignee.createMany({
          data: additionalAssigneeIds.map((userId) => ({
            ticketId: newTicket.id,
            userId,
          })),
        });
      }

      // Create custom field values
      if (customFields.length > 0) {
        await tx.customFieldValue.createMany({
          data: customFields.map((cf) => ({
            ticketId: newTicket.id,
            fieldId: cf.fieldId,
            value: cf.value,
          })),
        });
      }

      // Create activity log entry
      await tx.ticketActivity.create({
        data: {
          ticketId: newTicket.id,
          type: 'ticket_created',
          description: 'Ticket created',
          userId: req.user.id,
        },
      });

      return newTicket;
    });

    // Fetch the full ticket with relations
    const fullTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: fullTicketInclude,
    });

    // Send confirmation email to requester
    if (requester.email) {
      sendTicketConfirmation(fullTicket, requester).catch((err) =>
        console.error('[Ticket] Failed to send confirmation email:', err.message)
      );
    }

    // Run automations
    try {
      const ticketForAutomation = await prisma.ticket.findUnique({
        where: { id: ticket.id },
        include: {
          requester: { select: { id: true, name: true, email: true } },
          company: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true } },
          group: { select: { id: true, name: true } },
          tags: { include: { tag: true } },
        },
      });
      await runAutomations('TICKET_CREATED', ticketForAutomation, {});
    } catch (automationError) {
      console.error('[Automation] Error running automations:', automationError.message);
    }

    res.status(201).json(transformTicket(fullTicket));
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/tickets/:id
 * Update a ticket
 */
const updateTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      subject,
      description,
      status,
      priority,
      type,
      assigneeId,
      additionalAssigneeIds,
      groupId,
      companyId,
      dueDate,
      tagIds,
      slaBreached,
    } = req.body;

    // Get existing ticket
    const existingTicket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        assignee: { select: { name: true } },
        group: { select: { name: true } },
      },
    });

    if (!existingTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Prepare activities for changes
    const activities = [];
    const updateData = {};

    // Track changes and create activity descriptions
    if (subject !== undefined && subject !== existingTicket.subject) {
      updateData.subject = subject;
      activities.push({
        type: 'subject_changed',
        description: 'Subject updated',
      });
    }

    if (description !== undefined && description !== existingTicket.description) {
      updateData.description = description;
      activities.push({
        type: 'description_changed',
        description: 'Description updated',
      });
    }

    // Store old status for email notification
    const oldStatus = existingTicket.status;
    let statusChanged = false;

    if (status !== undefined && status !== existingTicket.status) {
      updateData.status = status;
      statusChanged = true;
      activities.push({
        type: 'status_changed',
        description: `Status changed from ${existingTicket.status} to ${status}`,
      });

      // Handle timestamp updates based on status change
      if (status === 'RESOLVED') {
        updateData.resolvedAt = new Date();
      } else if (status === 'CLOSED') {
        updateData.closedAt = new Date();
        // Schedule review request when ticket is closed
        scheduleReviewRequest({ id, ...existingTicket });
      } else if (status === 'OPEN' && ['RESOLVED', 'CLOSED'].includes(existingTicket.status)) {
        updateData.resolvedAt = null;
        updateData.closedAt = null;
      }
    }

    if (priority !== undefined && priority !== existingTicket.priority) {
      updateData.priority = priority;
      activities.push({
        type: 'priority_changed',
        description: `Priority changed from ${existingTicket.priority} to ${priority}`,
      });
    }

    if (type !== undefined && type !== existingTicket.type) {
      updateData.type = type;
      activities.push({
        type: 'type_changed',
        description: `Type changed to ${type}`,
      });
    }

    // Track if we need to send assignment email
    let newAssigneeForEmail = null;

    if (assigneeId !== undefined && assigneeId !== existingTicket.assigneeId) {
      updateData.assigneeId = assigneeId || null;

      if (assigneeId) {
        const newAssignee = await prisma.user.findUnique({
          where: { id: assigneeId },
          select: { id: true, name: true, email: true },
        });
        newAssigneeForEmail = newAssignee;
        activities.push({
          type: 'assigned',
          description: `Assigned to ${newAssignee?.name || 'Unknown'}`,
        });

        // Set first response time if not already set
        if (!existingTicket.firstResponseAt) {
          updateData.firstResponseAt = new Date();
        }
      } else {
        activities.push({
          type: 'unassigned',
          description: 'Unassigned',
        });
      }
    }

    if (groupId !== undefined && groupId !== existingTicket.groupId) {
      updateData.groupId = groupId || null;

      if (groupId) {
        const newGroup = await prisma.group.findUnique({
          where: { id: groupId },
          select: { name: true },
        });
        activities.push({
          type: 'group_changed',
          description: `Moved to group ${newGroup?.name || 'Unknown'}`,
        });
      } else {
        activities.push({
          type: 'group_removed',
          description: 'Removed from group',
        });
      }
    }

    if (companyId !== undefined && companyId !== existingTicket.companyId) {
      updateData.companyId = companyId || null;
    }

    if (dueDate !== undefined) {
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
    }

    if (slaBreached !== undefined) {
      updateData.slaBreached = slaBreached;
    }

    // Execute update in transaction
    await prisma.$transaction(async (tx) => {
      // Update ticket
      if (Object.keys(updateData).length > 0) {
        await tx.ticket.update({
          where: { id },
          data: updateData,
        });
      }

      // Handle tag updates
      if (tagIds !== undefined) {
        // Delete existing tags
        await tx.ticketTag.deleteMany({
          where: { ticketId: id },
        });

        // Create new tag associations
        if (tagIds.length > 0) {
          await tx.ticketTag.createMany({
            data: tagIds.map((tagId) => ({
              ticketId: id,
              tagId,
            })),
          });
        }
      }

      // Handle additional assignees updates
      if (additionalAssigneeIds !== undefined) {
        // Delete existing additional assignees
        await tx.ticketAssignee.deleteMany({
          where: { ticketId: id },
        });

        // Create new additional assignee associations
        if (additionalAssigneeIds.length > 0) {
          await tx.ticketAssignee.createMany({
            data: additionalAssigneeIds.map((userId) => ({
              ticketId: id,
              userId,
            })),
          });
        }
      }

      // Create activity records
      for (const activity of activities) {
        await tx.ticketActivity.create({
          data: {
            ticketId: id,
            type: activity.type,
            description: activity.description,
            userId: req.user.id,
          },
        });
      }
    });

    // Fetch and return updated ticket
    const updatedTicket = await prisma.ticket.findUnique({
      where: { id },
      include: fullTicketInclude,
    });

    // Send emails (async, don't block response)
    const requester = updatedTicket.requester;

    // Send assignment email
    if (newAssigneeForEmail && newAssigneeForEmail.email) {
      sendTicketAssignedEmail(updatedTicket, newAssigneeForEmail, requester).catch((err) =>
        console.error('[Ticket] Failed to send assignment email:', err.message)
      );
    }

    // Send status change email
    if (statusChanged && requester?.email) {
      sendStatusChangedEmail(updatedTicket, oldStatus, status, requester).catch((err) =>
        console.error('[Ticket] Failed to send status change email:', err.message)
      );
    }

    // Run automations
    try {
      const ticketForAutomation = await prisma.ticket.findUnique({
        where: { id },
        include: {
          requester: { select: { id: true, name: true, email: true } },
          company: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true } },
          group: { select: { id: true, name: true } },
          tags: { include: { tag: true } },
        },
      });
      const changes = req.body;
      await runAutomations('TICKET_UPDATED', ticketForAutomation, changes);
    } catch (automationError) {
      console.error('[Automation] Error running automations:', automationError.message);
    }

    res.json(transformTicket(updatedTicket));
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/tickets/:id
 * Hard delete a ticket (ADMIN only)
 */
const deleteTicket = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Delete all related records in transaction
    await prisma.$transaction(async (tx) => {
      // Delete in correct order due to foreign keys
      await tx.ticketActivity.deleteMany({ where: { ticketId: id } });
      await tx.ticketAttachment.deleteMany({ where: { ticketId: id } });
      await tx.ticketReply.deleteMany({ where: { ticketId: id } });
      await tx.ticketTag.deleteMany({ where: { ticketId: id } });
      await tx.ticketWatcher.deleteMany({ where: { ticketId: id } });
      await tx.ticketAssignee.deleteMany({ where: { ticketId: id } });
      await tx.relatedTicket.deleteMany({
        where: { OR: [{ ticketId: id }, { relatedTicketId: id }] },
      });
      await tx.customFieldValue.deleteMany({ where: { ticketId: id } });
      await tx.notification.deleteMany({ where: { ticketId: id } });
      await tx.ticket.delete({ where: { id } });
    });

    res.json({ message: 'Ticket deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tickets/:id/merge
 * Merge source ticket into target ticket
 */
const mergeTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { targetTicketId } = req.body;

    if (!targetTicketId) {
      return res.status(400).json({ error: 'Target ticket ID is required' });
    }

    if (id === targetTicketId) {
      return res.status(400).json({ error: 'Cannot merge ticket into itself' });
    }

    // Get both tickets
    const [sourceTicket, targetTicket] = await Promise.all([
      prisma.ticket.findUnique({ where: { id } }),
      prisma.ticket.findUnique({ where: { id: targetTicketId } }),
    ]);

    if (!sourceTicket) {
      return res.status(404).json({ error: 'Source ticket not found' });
    }

    if (!targetTicket) {
      return res.status(404).json({ error: 'Target ticket not found' });
    }

    // Perform merge in transaction
    await prisma.$transaction(async (tx) => {
      // Move all replies to target ticket
      await tx.ticketReply.updateMany({
        where: { ticketId: id },
        data: { ticketId: targetTicketId },
      });

      // Create activity on target
      await tx.ticketActivity.create({
        data: {
          ticketId: targetTicketId,
          type: 'ticket_merged',
          description: `Ticket #${sourceTicket.ticketNumber} merged into this ticket`,
          userId: req.user.id,
          metadata: { sourceTicketId: id, sourceTicketNumber: sourceTicket.ticketNumber },
        },
      });

      // Create activity on source
      await tx.ticketActivity.create({
        data: {
          ticketId: id,
          type: 'ticket_merged',
          description: `Merged into ticket #${targetTicket.ticketNumber}`,
          userId: req.user.id,
          metadata: { targetTicketId, targetTicketNumber: targetTicket.ticketNumber },
        },
      });

      // Close source ticket
      await tx.ticket.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          mergedIntoId: targetTicketId,
        },
      });
    });

    // Return updated target ticket
    const updatedTarget = await prisma.ticket.findUnique({
      where: { id: targetTicketId },
      include: fullTicketInclude,
    });

    res.json(transformTicket(updatedTarget));
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tickets/:id/watchers
 * Add a watcher to the ticket
 */
const addWatcher = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if ticket exists
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Create watcher (upsert to handle duplicates)
    await prisma.ticketWatcher.upsert({
      where: {
        ticketId_userId: { ticketId: id, userId },
      },
      create: { ticketId: id, userId },
      update: {},
    });

    res.json({ message: 'Watcher added' });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/tickets/:id/watchers/:userId
 * Remove a watcher from the ticket
 */
const removeWatcher = async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    await prisma.ticketWatcher.deleteMany({
      where: { ticketId: id, userId },
    });

    res.json({ message: 'Watcher removed' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tickets/:id/related
 * Link two tickets together
 */
const linkTickets = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { relatedTicketId } = req.body;

    if (!relatedTicketId) {
      return res.status(400).json({ error: 'Related ticket ID is required' });
    }

    if (id === relatedTicketId) {
      return res.status(400).json({ error: 'Cannot link ticket to itself' });
    }

    // Check both tickets exist
    const [ticket1, ticket2] = await Promise.all([
      prisma.ticket.findUnique({ where: { id } }),
      prisma.ticket.findUnique({ where: { id: relatedTicketId } }),
    ]);

    if (!ticket1 || !ticket2) {
      return res.status(404).json({ error: 'One or both tickets not found' });
    }

    // Create bidirectional links
    await prisma.$transaction([
      prisma.relatedTicket.upsert({
        where: {
          ticketId_relatedTicketId: { ticketId: id, relatedTicketId },
        },
        create: { ticketId: id, relatedTicketId },
        update: {},
      }),
      prisma.relatedTicket.upsert({
        where: {
          ticketId_relatedTicketId: { ticketId: relatedTicketId, relatedTicketId: id },
        },
        create: { ticketId: relatedTicketId, relatedTicketId: id },
        update: {},
      }),
    ]);

    res.json({ message: 'Tickets linked' });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/tickets/:id/related/:relatedTicketId
 * Unlink two tickets
 */
const unlinkTickets = async (req, res, next) => {
  try {
    const { id, relatedTicketId } = req.params;

    // Delete both directions
    await prisma.$transaction([
      prisma.relatedTicket.deleteMany({
        where: { ticketId: id, relatedTicketId },
      }),
      prisma.relatedTicket.deleteMany({
        where: { ticketId: relatedTicketId, relatedTicketId: id },
      }),
    ]);

    res.json({ message: 'Tickets unlinked' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tickets/:id/activity
 * Get all activity for a ticket
 */
const getTicketActivity = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check ticket exists
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const activities = await prisma.ticketActivity.findMany({
      where: { ticketId: id },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ activities });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/tickets/:id/resolution
 * Update the resolution summary for a ticket
 */
const updateResolutionSummary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolutionSummary } = req.body;

    // Check ticket exists
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Update the resolution summary
    await prisma.ticket.update({
      where: { id },
      data: { resolutionSummary },
    });

    // Create activity log
    await prisma.ticketActivity.create({
      data: {
        ticketId: id,
        type: 'resolution_updated',
        description: 'Resolution summary updated',
        userId: req.user.id,
      },
    });

    res.json({ resolutionSummary });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listTickets,
  getViews,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
  mergeTicket,
  addWatcher,
  removeWatcher,
  linkTickets,
  unlinkTickets,
  getTicketActivity,
  updateResolutionSummary,
};
