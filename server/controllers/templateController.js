const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Calculate nextRunAt based on frequency and startDate
function calculateNextRunAt(frequency, startDate, dayOfWeek, dayOfMonth) {
  const now = new Date();
  let next = new Date(startDate);

  // If start date is in the past, calculate next occurrence from now
  if (next <= now) {
    next = new Date(now);
  }

  switch (frequency) {
    case 'DAILY':
      // Next day at the start time
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;

    case 'WEEKLY':
      // Next occurrence of dayOfWeek
      const currentDay = next.getDay();
      const targetDay = dayOfWeek ?? 1; // Default to Monday
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      next.setDate(next.getDate() + daysUntil);
      break;

    case 'BIWEEKLY':
      // Every 2 weeks on dayOfWeek
      const currentDay2 = next.getDay();
      const targetDay2 = dayOfWeek ?? 1;
      let daysUntil2 = targetDay2 - currentDay2;
      if (daysUntil2 <= 0) daysUntil2 += 14;
      else daysUntil2 += 7; // Add extra week for biweekly
      next.setDate(next.getDate() + daysUntil2);
      break;

    case 'MONTHLY':
      // Next occurrence of dayOfMonth
      const targetDayOfMonth = dayOfMonth ?? 1;
      next.setDate(targetDayOfMonth);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      break;

    case 'QUARTERLY':
      // Every 3 months on dayOfMonth
      const targetDayOfMonth2 = dayOfMonth ?? 1;
      next.setDate(targetDayOfMonth2);
      if (next <= now) {
        next.setMonth(next.getMonth() + 3);
      }
      break;
  }

  // Set time to 9 AM
  next.setHours(9, 0, 0, 0);

  return next;
}

// GET /api/templates
async function getTemplates(req, res, next) {
  try {
    const { search } = req.query;

    const where = { isActive: true };

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const templates = await prisma.ticketTemplate.findMany({
      where,
      include: {
        checklistItems: {
          orderBy: { order: 'asc' },
        },
        recurringSchedule: true,
        createdBy: {
          select: { id: true, name: true },
        },
        assignee: {
          select: { id: true, name: true },
        },
        group: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ templates });
  } catch (error) {
    next(error);
  }
}

// GET /api/templates/:id
async function getTemplate(req, res, next) {
  try {
    const { id } = req.params;

    const template = await prisma.ticketTemplate.findUnique({
      where: { id },
      include: {
        checklistItems: {
          orderBy: { order: 'asc' },
        },
        recurringSchedule: true,
        createdBy: {
          select: { id: true, name: true },
        },
        assignee: {
          select: { id: true, name: true },
        },
        group: {
          select: { id: true, name: true },
        },
      },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    next(error);
  }
}

// POST /api/templates
async function createTemplate(req, res, next) {
  try {
    const {
      name,
      subject,
      description,
      priority = 'MEDIUM',
      type = 'QUESTION',
      assigneeId,
      groupId,
      tags = [],
      checklistItems = [],
      recurring,
    } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Template name is required' });
    }
    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: 'Subject is required' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    // Create template with checklist items
    const template = await prisma.ticketTemplate.create({
      data: {
        name: name.trim(),
        subject: subject.trim(),
        description: description.trim(),
        priority,
        type,
        assigneeId,
        groupId,
        tags,
        createdById: req.user.id,
        checklistItems: {
          create: checklistItems.map((item, index) => ({
            label: item.label,
            order: item.order ?? index,
          })),
        },
      },
      include: {
        checklistItems: {
          orderBy: { order: 'asc' },
        },
        createdBy: {
          select: { id: true, name: true },
        },
        assignee: {
          select: { id: true, name: true },
        },
        group: {
          select: { id: true, name: true },
        },
      },
    });

    // Create recurring schedule if provided
    if (recurring && recurring.frequency) {
      const nextRunAt = calculateNextRunAt(
        recurring.frequency,
        recurring.startDate || new Date(),
        recurring.dayOfWeek,
        recurring.dayOfMonth
      );

      await prisma.recurringSchedule.create({
        data: {
          templateId: template.id,
          frequency: recurring.frequency,
          dayOfWeek: recurring.dayOfWeek,
          dayOfMonth: recurring.dayOfMonth,
          startDate: recurring.startDate ? new Date(recurring.startDate) : new Date(),
          endDate: recurring.endDate ? new Date(recurring.endDate) : null,
          nextRunAt,
        },
      });
    }

    // Fetch the complete template with schedule
    const fullTemplate = await prisma.ticketTemplate.findUnique({
      where: { id: template.id },
      include: {
        checklistItems: {
          orderBy: { order: 'asc' },
        },
        recurringSchedule: true,
        createdBy: {
          select: { id: true, name: true },
        },
        assignee: {
          select: { id: true, name: true },
        },
        group: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json(fullTemplate);
  } catch (error) {
    next(error);
  }
}

// PUT /api/templates/:id
async function updateTemplate(req, res, next) {
  try {
    const { id } = req.params;
    const {
      name,
      subject,
      description,
      priority,
      type,
      assigneeId,
      groupId,
      tags,
      isActive,
      checklistItems,
      recurring,
    } = req.body;

    // Verify template exists
    const existing = await prisma.ticketTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (subject !== undefined) updateData.subject = subject.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (priority !== undefined) updateData.priority = priority;
    if (type !== undefined) updateData.type = type;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
    if (groupId !== undefined) updateData.groupId = groupId;
    if (tags !== undefined) updateData.tags = tags;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update template
    await prisma.ticketTemplate.update({
      where: { id },
      data: updateData,
    });

    // Replace checklist items if provided
    if (checklistItems !== undefined) {
      // Delete existing items
      await prisma.templateChecklistItem.deleteMany({
        where: { templateId: id },
      });

      // Create new items
      if (checklistItems.length > 0) {
        await prisma.templateChecklistItem.createMany({
          data: checklistItems.map((item, index) => ({
            templateId: id,
            label: item.label,
            order: item.order ?? index,
          })),
        });
      }
    }

    // Upsert recurring schedule if provided
    if (recurring !== undefined) {
      if (recurring && recurring.frequency) {
        const nextRunAt = calculateNextRunAt(
          recurring.frequency,
          recurring.startDate || new Date(),
          recurring.dayOfWeek,
          recurring.dayOfMonth
        );

        await prisma.recurringSchedule.upsert({
          where: { templateId: id },
          create: {
            templateId: id,
            frequency: recurring.frequency,
            dayOfWeek: recurring.dayOfWeek,
            dayOfMonth: recurring.dayOfMonth,
            startDate: recurring.startDate ? new Date(recurring.startDate) : new Date(),
            endDate: recurring.endDate ? new Date(recurring.endDate) : null,
            nextRunAt,
          },
          update: {
            frequency: recurring.frequency,
            dayOfWeek: recurring.dayOfWeek,
            dayOfMonth: recurring.dayOfMonth,
            startDate: recurring.startDate ? new Date(recurring.startDate) : new Date(),
            endDate: recurring.endDate ? new Date(recurring.endDate) : null,
            nextRunAt,
            isActive: recurring.isActive ?? true,
          },
        });
      } else {
        // Remove recurring schedule if recurring is null/empty
        await prisma.recurringSchedule.deleteMany({
          where: { templateId: id },
        });
      }
    }

    // Fetch updated template
    const template = await prisma.ticketTemplate.findUnique({
      where: { id },
      include: {
        checklistItems: {
          orderBy: { order: 'asc' },
        },
        recurringSchedule: true,
        createdBy: {
          select: { id: true, name: true },
        },
        assignee: {
          select: { id: true, name: true },
        },
        group: {
          select: { id: true, name: true },
        },
      },
    });

    res.json(template);
  } catch (error) {
    next(error);
  }
}

// DELETE /api/templates/:id
async function deleteTemplate(req, res, next) {
  try {
    const { id } = req.params;

    // Verify template exists
    const template = await prisma.ticketTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Delete template (cascade will handle checklist items and schedule)
    await prisma.ticketTemplate.delete({
      where: { id },
    });

    res.json({ message: 'Template deleted' });
  } catch (error) {
    next(error);
  }
}

// POST /api/templates/:id/create-ticket
async function createTicketFromTemplate(req, res, next) {
  try {
    const { id } = req.params;
    const { requesterId, companyId, dueDate } = req.body;

    // Fetch template with checklist items
    const template = await prisma.ticketTemplate.findUnique({
      where: { id },
      include: {
        checklistItems: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Require a requester
    if (!requesterId) {
      return res.status(400).json({ error: 'Requester is required' });
    }

    // Verify requester exists
    const requester = await prisma.contact.findUnique({
      where: { id: requesterId },
    });
    if (!requester) {
      return res.status(404).json({ error: 'Requester not found' });
    }

    // Create ticket from template
    const ticket = await prisma.ticket.create({
      data: {
        subject: template.subject,
        description: template.description,
        priority: template.priority,
        type: template.type,
        requesterId,
        companyId: companyId || requester.companyId,
        assigneeId: template.assigneeId,
        groupId: template.groupId,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: {
        requester: true,
        company: true,
        assignee: {
          select: { id: true, name: true, avatar: true },
        },
        group: {
          select: { id: true, name: true },
        },
      },
    });

    // Copy checklist items to ticket
    if (template.checklistItems.length > 0) {
      await prisma.ticketChecklistItem.createMany({
        data: template.checklistItems.map((item) => ({
          ticketId: ticket.id,
          label: item.label,
          order: item.order,
        })),
      });
    }

    // Add tags if template has them
    if (template.tags && template.tags.length > 0) {
      // Find or create tags
      for (const tagName of template.tags) {
        let tag = await prisma.tag.findUnique({
          where: { name: tagName },
        });
        if (!tag) {
          tag = await prisma.tag.create({
            data: { name: tagName },
          });
        }
        await prisma.ticketTag.create({
          data: { ticketId: ticket.id, tagId: tag.id },
        });
      }
    }

    // Create activity log
    await prisma.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        type: 'ticket_created',
        description: `Ticket created from template: ${template.name}`,
        userId: req.user.id,
        metadata: { templateId: template.id, templateName: template.name },
      },
    });

    // Fetch complete ticket
    const fullTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: {
        requester: true,
        company: true,
        assignee: {
          select: { id: true, name: true, avatar: true },
        },
        group: {
          select: { id: true, name: true },
        },
        tags: {
          include: { tag: true },
        },
        checklistItems: {
          orderBy: { order: 'asc' },
        },
      },
    });

    res.status(201).json(fullTicket);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  createTicketFromTemplate,
};
