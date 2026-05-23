const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * GET /api/sla-policies
 * Get all SLA policies with ticket counts
 */
const getSLAPolicies = async (req, res, next) => {
  try {
    const slaPolicies = await prisma.sLAPolicy.findMany({
      include: {
        _count: {
          select: { tickets: true },
        },
      },
      orderBy: [
        { appliesTo: 'asc' },
        { name: 'asc' },
      ],
    });

    res.json(slaPolicies);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/sla-policies
 * Create a new SLA policy
 */
const createSLAPolicy = async (req, res, next) => {
  try {
    const { name, firstResponseHours, resolutionHours, appliesTo, businessHoursOnly } = req.body;

    const slaPolicy = await prisma.sLAPolicy.create({
      data: {
        name,
        firstResponseHours,
        resolutionHours,
        appliesTo,
        businessHoursOnly: businessHoursOnly !== undefined ? businessHoursOnly : true,
      },
      include: {
        _count: {
          select: { tickets: true },
        },
      },
    });

    res.status(201).json(slaPolicy);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/sla-policies/:id
 * Update an SLA policy
 */
const updateSLAPolicy = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, firstResponseHours, resolutionHours, appliesTo, businessHoursOnly } = req.body;

    // Check if policy exists
    const existingPolicy = await prisma.sLAPolicy.findUnique({
      where: { id },
    });

    if (!existingPolicy) {
      return res.status(404).json({ error: 'SLA policy not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (firstResponseHours !== undefined) updateData.firstResponseHours = firstResponseHours;
    if (resolutionHours !== undefined) updateData.resolutionHours = resolutionHours;
    if (appliesTo !== undefined) updateData.appliesTo = appliesTo;
    if (businessHoursOnly !== undefined) updateData.businessHoursOnly = businessHoursOnly;

    const slaPolicy = await prisma.sLAPolicy.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { tickets: true },
        },
      },
    });

    res.json(slaPolicy);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/sla-policies/:id
 * Delete an SLA policy (only if no tickets are using it)
 */
const deleteSLAPolicy = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if policy exists and get ticket count
    const existingPolicy = await prisma.sLAPolicy.findUnique({
      where: { id },
      include: {
        _count: {
          select: { tickets: true },
        },
      },
    });

    if (!existingPolicy) {
      return res.status(404).json({ error: 'SLA policy not found' });
    }

    // Cannot delete if tickets are using this policy
    if (existingPolicy._count.tickets > 0) {
      return res.status(409).json({
        error: 'Cannot delete SLA policy that is in use',
        ticketCount: existingPolicy._count.tickets,
      });
    }

    await prisma.sLAPolicy.delete({
      where: { id },
    });

    res.json({ message: 'SLA policy deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSLAPolicies,
  createSLAPolicy,
  updateSLAPolicy,
  deleteSLAPolicy,
};
