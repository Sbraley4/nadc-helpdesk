const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * GET /api/tags
 * Get all tags with ticket counts
 */
const getTags = async (req, res, next) => {
  try {
    const { search } = req.query;

    const where = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const tags = await prisma.tag.findMany({
      where,
      include: {
        _count: {
          select: { tickets: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(tags);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tags
 * Create a new tag
 */
const createTag = async (req, res, next) => {
  try {
    const { name, color } = req.body;

    // Check if tag name already exists
    const existingTag = await prisma.tag.findUnique({
      where: { name },
    });

    if (existingTag) {
      return res.status(409).json({ error: 'Tag with this name already exists' });
    }

    const tag = await prisma.tag.create({
      data: { name, color },
      include: {
        _count: {
          select: { tickets: true },
        },
      },
    });

    res.status(201).json(tag);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/tags/:id
 * Update a tag
 */
const updateTag = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    // Check if tag exists
    const existingTag = await prisma.tag.findUnique({
      where: { id },
    });

    if (!existingTag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    // Check if new name already exists (if name is being changed)
    if (name && name !== existingTag.name) {
      const duplicateTag = await prisma.tag.findUnique({
        where: { name },
      });
      if (duplicateTag) {
        return res.status(409).json({ error: 'Tag with this name already exists' });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;

    const tag = await prisma.tag.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { tickets: true },
        },
      },
    });

    res.json(tag);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/tags/:id
 * Delete a tag and all associated TicketTag records
 */
const deleteTag = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if tag exists
    const existingTag = await prisma.tag.findUnique({
      where: { id },
    });

    if (!existingTag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    // Delete tag and associated join records in transaction
    await prisma.$transaction([
      prisma.ticketTag.deleteMany({ where: { tagId: id } }),
      prisma.tag.delete({ where: { id } }),
    ]);

    res.json({ message: 'Tag deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTags,
  createTag,
  updateTag,
  deleteTag,
};
