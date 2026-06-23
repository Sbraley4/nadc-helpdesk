const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/inventory
async function getItems(req, res, next) {
  try {
    const { search, category, page = 1, limit = 50 } = req.query;

    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    // Get distinct categories for filter dropdown
    const categories = await prisma.inventoryItem.findMany({
      select: { category: true },
      distinct: ['category'],
      where: { category: { not: null } },
    });

    res.json({
      items,
      categories: categories.map((c) => c.category).filter(Boolean),
      total,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/inventory
async function createItem(req, res, next) {
  try {
    const { name, category, quantity, threshold, notes } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Item name is required' });
    }

    const qty = parseInt(quantity, 10) || 0;
    const thresh = parseInt(threshold, 10) || 0;
    const isLow = qty <= thresh;

    const item = await prisma.inventoryItem.create({
      data: {
        name: name.trim(),
        category: category?.trim() || null,
        quantity: qty,
        threshold: thresh,
        notes: notes?.trim() || null,
        isLow,
      },
    });

    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
}

// PUT /api/inventory/:id
async function updateItem(req, res, next) {
  try {
    const { id } = req.params;
    const { name, category, quantity, threshold, notes, isLow } = req.body;

    // Verify item exists
    const existing = await prisma.inventoryItem.findUnique({
      where: { id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const updateData = {};

    if (name !== undefined) updateData.name = name.trim();
    if (category !== undefined) updateData.category = category?.trim() || null;
    if (quantity !== undefined) updateData.quantity = parseInt(quantity, 10) || 0;
    if (threshold !== undefined) updateData.threshold = parseInt(threshold, 10) || 0;
    if (notes !== undefined) updateData.notes = notes?.trim() || null;

    // Handle isLow - if explicitly set, use that value; otherwise auto-calculate
    if (isLow !== undefined) {
      updateData.isLow = isLow;
    } else {
      // Auto-calculate isLow based on quantity and threshold
      const newQty = updateData.quantity !== undefined ? updateData.quantity : existing.quantity;
      const newThresh = updateData.threshold !== undefined ? updateData.threshold : existing.threshold;
      updateData.isLow = newQty <= newThresh;
    }

    const item = await prisma.inventoryItem.update({
      where: { id },
      data: updateData,
    });

    res.json(item);
  } catch (error) {
    next(error);
  }
}

// DELETE /api/inventory/:id
async function deleteItem(req, res, next) {
  try {
    const { id } = req.params;

    // Verify item exists
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    await prisma.inventoryItem.delete({
      where: { id },
    });

    res.json({ message: 'Inventory item deleted' });
  } catch (error) {
    next(error);
  }
}

// GET /api/inventory/deductions
// Get all PENDING deductions with ticket and item info
async function getPendingDeductions(req, res, next) {
  try {
    const deductions = await prisma.inventoryDeduction.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
          },
        },
        inventoryItem: {
          select: {
            id: true,
            name: true,
            quantity: true,
            category: true,
          },
        },
      },
    });

    res.json({ deductions });
  } catch (error) {
    next(error);
  }
}

// PUT /api/inventory/deductions/:id/approve
// Approve a deduction and deduct from inventory
async function approveDeduction(req, res, next) {
  try {
    const { id } = req.params;

    // Find the deduction
    const deduction = await prisma.inventoryDeduction.findUnique({
      where: { id },
      include: { inventoryItem: true },
    });

    if (!deduction) {
      return res.status(404).json({ error: 'Deduction not found' });
    }

    if (deduction.status !== 'PENDING') {
      return res.status(400).json({ error: 'Deduction has already been processed' });
    }

    // Use transaction to update deduction status and deduct from inventory
    const result = await prisma.$transaction(async (tx) => {
      // Update deduction status
      const updatedDeduction = await tx.inventoryDeduction.update({
        where: { id },
        data: { status: 'APPROVED' },
        include: {
          ticket: {
            select: {
              id: true,
              ticketNumber: true,
              subject: true,
            },
          },
          inventoryItem: true,
        },
      });

      // If matched to an inventory item, deduct the quantity
      if (deduction.inventoryItemId) {
        const newQuantity = Math.max(0, deduction.inventoryItem.quantity - deduction.quantity);
        const newThreshold = deduction.inventoryItem.threshold;
        const isLow = newQuantity <= newThreshold;

        await tx.inventoryItem.update({
          where: { id: deduction.inventoryItemId },
          data: {
            quantity: newQuantity,
            isLow,
          },
        });
      }

      return updatedDeduction;
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

// PUT /api/inventory/deductions/:id/reject
// Reject a deduction
async function rejectDeduction(req, res, next) {
  try {
    const { id } = req.params;

    // Find the deduction
    const deduction = await prisma.inventoryDeduction.findUnique({
      where: { id },
    });

    if (!deduction) {
      return res.status(404).json({ error: 'Deduction not found' });
    }

    if (deduction.status !== 'PENDING') {
      return res.status(400).json({ error: 'Deduction has already been processed' });
    }

    // Update deduction status
    const updatedDeduction = await prisma.inventoryDeduction.update({
      where: { id },
      data: { status: 'REJECTED' },
      include: {
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
          },
        },
        inventoryItem: true,
      },
    });

    res.json(updatedDeduction);
  } catch (error) {
    next(error);
  }
}

// GET /api/tickets/:ticketId/inventory-deductions
// Get all deductions for a specific ticket
async function getTicketDeductions(req, res, next) {
  try {
    const { ticketId } = req.params;

    const deductions = await prisma.inventoryDeduction.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
      include: {
        inventoryItem: {
          select: {
            id: true,
            name: true,
            quantity: true,
            category: true,
          },
        },
      },
    });

    res.json({ deductions });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getItems,
  createItem,
  updateItem,
  deleteItem,
  getPendingDeductions,
  approveDeduction,
  rejectDeduction,
  getTicketDeductions,
};
