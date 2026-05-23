const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Get all canned responses
 * GET /api/canned-responses
 */
async function getCannedResponses(req, res, next) {
  try {
    const { search, tag } = req.query;

    let where = {};

    // Search filter (case-insensitive search in title and body)
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Tag filter
    if (tag) {
      where.tags = { has: tag };
    }

    const cannedResponses = await prisma.cannedResponse.findMany({
      where,
      include: {
        createdBy: {
          select: { name: true },
        },
      },
      orderBy: { title: 'asc' },
    });

    res.json({ cannedResponses });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single canned response
 * GET /api/canned-responses/:id
 */
async function getCannedResponse(req, res, next) {
  try {
    const { id } = req.params;

    const cannedResponse = await prisma.cannedResponse.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { name: true },
        },
      },
    });

    if (!cannedResponse) {
      return res.status(404).json({ error: 'Canned response not found' });
    }

    res.json(cannedResponse);
  } catch (error) {
    next(error);
  }
}

/**
 * Create a canned response
 * POST /api/canned-responses
 */
async function createCannedResponse(req, res, next) {
  try {
    const { title, body, tags } = req.body;

    // Validate required fields
    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!body || body.trim() === '') {
      return res.status(400).json({ error: 'Body is required' });
    }

    // Check for duplicate title
    const existing = await prisma.cannedResponse.findFirst({
      where: { title: { equals: title.trim(), mode: 'insensitive' } },
    });

    if (existing) {
      return res.status(409).json({ error: 'A canned response with this title already exists' });
    }

    const cannedResponse = await prisma.cannedResponse.create({
      data: {
        title: title.trim(),
        body: body.trim(),
        tags: tags || [],
        createdById: req.user.id,
      },
      include: {
        createdBy: {
          select: { name: true },
        },
      },
    });

    res.status(201).json(cannedResponse);
  } catch (error) {
    next(error);
  }
}

/**
 * Update a canned response
 * PUT /api/canned-responses/:id
 */
async function updateCannedResponse(req, res, next) {
  try {
    const { id } = req.params;
    const { title, body, tags } = req.body;

    // Find canned response
    const cannedResponse = await prisma.cannedResponse.findUnique({
      where: { id },
    });

    if (!cannedResponse) {
      return res.status(404).json({ error: 'Canned response not found' });
    }

    // Only creator or admin can edit
    if (cannedResponse.createdById !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to edit this canned response' });
    }

    // Build update data
    const updateData = {};
    if (title !== undefined) {
      if (title.trim() === '') {
        return res.status(400).json({ error: 'Title cannot be empty' });
      }
      // Check for duplicate title (excluding current)
      const existing = await prisma.cannedResponse.findFirst({
        where: {
          title: { equals: title.trim(), mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (existing) {
        return res.status(409).json({ error: 'A canned response with this title already exists' });
      }
      updateData.title = title.trim();
    }
    if (body !== undefined) {
      if (body.trim() === '') {
        return res.status(400).json({ error: 'Body cannot be empty' });
      }
      updateData.body = body.trim();
    }
    if (tags !== undefined) {
      updateData.tags = tags;
    }

    const updated = await prisma.cannedResponse.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: { name: true },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a canned response (ADMIN only)
 * DELETE /api/canned-responses/:id
 */
async function deleteCannedResponse(req, res, next) {
  try {
    const { id } = req.params;

    const cannedResponse = await prisma.cannedResponse.findUnique({
      where: { id },
    });

    if (!cannedResponse) {
      return res.status(404).json({ error: 'Canned response not found' });
    }

    await prisma.cannedResponse.delete({
      where: { id },
    });

    res.json({ message: 'Canned response deleted' });
  } catch (error) {
    next(error);
  }
}

/**
 * Preview a canned response with resolved variables
 * POST /api/canned-responses/:id/preview
 */
async function previewCannedResponse(req, res, next) {
  try {
    const { id } = req.params;
    const { ticketId } = req.body;

    if (!ticketId) {
      return res.status(400).json({ error: 'ticketId is required' });
    }

    // Find canned response
    const cannedResponse = await prisma.cannedResponse.findUnique({
      where: { id },
    });

    if (!cannedResponse) {
      return res.status(404).json({ error: 'Canned response not found' });
    }

    // Find ticket with requester and company
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        requester: true,
        company: true,
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Resolve variables
    let resolvedBody = cannedResponse.body;

    const variables = {
      '{{requester_name}}': ticket.requester?.name || '',
      '{{ticket_id}}': `#${ticket.ticketNumber}`,
      '{{agent_name}}': req.user.name || '',
      '{{company_name}}': ticket.company?.name || '',
      '{{ticket_subject}}': ticket.subject || '',
      '{{ticket_status}}': ticket.status || '',
    };

    for (const [placeholder, value] of Object.entries(variables)) {
      resolvedBody = resolvedBody.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    res.json({ body: resolvedBody });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCannedResponses,
  getCannedResponse,
  createCannedResponse,
  updateCannedResponse,
  deleteCannedResponse,
  previewCannedResponse,
};
