const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/tickets/:ticketId/checklist
async function getChecklist(req, res, next) {
  try {
    const { ticketId } = req.params;

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const items = await prisma.ticketChecklistItem.findMany({
      where: { ticketId },
      include: {
        checkedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { order: 'asc' },
    });

    const total = items.length;
    const checked = items.filter((item) => item.isChecked).length;
    const percentComplete = total > 0 ? Math.round((checked / total) * 100) : 0;

    res.json({
      items,
      total,
      checked,
      percentComplete,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/tickets/:ticketId/checklist
async function addChecklistItem(req, res, next) {
  try {
    const { ticketId } = req.params;
    const { label, order } = req.body;

    // Validate
    if (!label || !label.trim()) {
      return res.status(400).json({ error: 'Label is required' });
    }

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Get next order if not provided
    let itemOrder = order;
    if (itemOrder === undefined) {
      const lastItem = await prisma.ticketChecklistItem.findFirst({
        where: { ticketId },
        orderBy: { order: 'desc' },
      });
      itemOrder = lastItem ? lastItem.order + 1 : 0;
    }

    const item = await prisma.ticketChecklistItem.create({
      data: {
        ticketId,
        label: label.trim(),
        order: itemOrder,
      },
      include: {
        checkedBy: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
}

// PUT /api/tickets/:ticketId/checklist/:itemId
async function updateChecklistItem(req, res, next) {
  try {
    const { ticketId, itemId } = req.params;
    const { label, isChecked, order } = req.body;

    // Find existing item
    const existing = await prisma.ticketChecklistItem.findUnique({
      where: { id: itemId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }

    if (existing.ticketId !== ticketId) {
      return res.status(400).json({ error: 'Item does not belong to this ticket' });
    }

    const updateData = {};
    if (label !== undefined) updateData.label = label.trim();
    if (order !== undefined) updateData.order = order;

    // Handle isChecked change
    if (isChecked !== undefined) {
      updateData.isChecked = isChecked;
      if (isChecked && !existing.isChecked) {
        // Being checked
        updateData.checkedAt = new Date();
        updateData.checkedById = req.user.id;
      } else if (!isChecked && existing.isChecked) {
        // Being unchecked
        updateData.checkedAt = null;
        updateData.checkedById = null;
      }
    }

    const item = await prisma.ticketChecklistItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        checkedBy: {
          select: { id: true, name: true },
        },
      },
    });

    res.json(item);
  } catch (error) {
    next(error);
  }
}

// DELETE /api/tickets/:ticketId/checklist/:itemId
async function deleteChecklistItem(req, res, next) {
  try {
    const { ticketId, itemId } = req.params;

    // Find existing item
    const existing = await prisma.ticketChecklistItem.findUnique({
      where: { id: itemId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }

    if (existing.ticketId !== ticketId) {
      return res.status(400).json({ error: 'Item does not belong to this ticket' });
    }

    await prisma.ticketChecklistItem.delete({
      where: { id: itemId },
    });

    res.json({ message: 'Item deleted' });
  } catch (error) {
    next(error);
  }
}

// PUT /api/tickets/:ticketId/checklist/reorder
async function reorderChecklist(req, res, next) {
  try {
    const { ticketId } = req.params;
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Batch update order values
    const updates = items.map((item) =>
      prisma.ticketChecklistItem.update({
        where: { id: item.id },
        data: { order: item.order },
      })
    );

    await prisma.$transaction(updates);

    res.json({ message: 'Reordered' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getChecklist,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  reorderChecklist,
};
