// server/controllers/businessHoursController.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * GET /api/business-hours
 * Returns all 7 BusinessHours records (one per day)
 */
async function getBusinessHours(req, res, next) {
  try {
    const businessHours = await prisma.businessHours.findMany({
      orderBy: { dayOfWeek: 'asc' },
    });

    res.json({ businessHours });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/business-hours
 * Upserts all 7 records in a transaction
 */
async function updateBusinessHours(req, res, next) {
  try {
    const { hours } = req.body;

    if (!Array.isArray(hours) || hours.length !== 7) {
      return res.status(400).json({ error: 'Must provide exactly 7 day records' });
    }

    // Validate each record
    for (const h of hours) {
      if (h.dayOfWeek < 0 || h.dayOfWeek > 6) {
        return res.status(400).json({ error: 'dayOfWeek must be 0-6' });
      }
      if (h.isOpen && (!h.openTime || !h.closeTime)) {
        return res.status(400).json({
          error: `Day ${h.dayOfWeek}: openTime and closeTime required when open`
        });
      }
    }

    // Upsert all in transaction
    const updates = hours.map((h) =>
      prisma.businessHours.upsert({
        where: { dayOfWeek: h.dayOfWeek },
        create: {
          dayOfWeek: h.dayOfWeek,
          isOpen: h.isOpen,
          openTime: h.isOpen ? h.openTime : null,
          closeTime: h.isOpen ? h.closeTime : null,
        },
        update: {
          isOpen: h.isOpen,
          openTime: h.isOpen ? h.openTime : null,
          closeTime: h.isOpen ? h.closeTime : null,
        },
      })
    );

    await prisma.$transaction(updates);

    // Return updated records
    const businessHours = await prisma.businessHours.findMany({
      orderBy: { dayOfWeek: 'asc' },
    });

    res.json({ businessHours });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getBusinessHours,
  updateBusinessHours,
};
