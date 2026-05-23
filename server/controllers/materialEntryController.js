const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/tickets/:ticketId/materials
async function getMaterialEntries(req, res, next) {
  try {
    const { ticketId } = req.params;

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const entries = await prisma.materialEntry.findMany({
      where: { ticketId },
      include: {
        agent: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate total cost
    const totalCost = entries.reduce((sum, e) => sum + e.totalCost, 0);

    res.json({
      entries,
      totalCost,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/tickets/:ticketId/materials
async function createMaterialEntry(req, res, next) {
  try {
    const { ticketId } = req.params;
    const { itemName, quantity = 1, unitCost = 0, notes } = req.body;

    // Validate
    if (!itemName || !itemName.trim()) {
      return res.status(400).json({ error: 'Item name is required' });
    }

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Calculate total cost server-side
    const qty = parseFloat(quantity);
    const cost = parseFloat(unitCost);
    const totalCost = qty * cost;

    const entry = await prisma.materialEntry.create({
      data: {
        ticketId,
        agentId: req.user.id,
        itemName: itemName.trim(),
        quantity: qty,
        unitCost: cost,
        totalCost,
        notes,
      },
      include: {
        agent: {
          select: { id: true, name: true },
        },
      },
    });

    // Create activity log
    const formattedCost = totalCost.toFixed(2);
    await prisma.ticketActivity.create({
      data: {
        ticketId,
        type: 'material_added',
        description: `Material added: ${itemName} x${qty} — $${formattedCost}`,
        userId: req.user.id,
        metadata: { itemName, quantity: qty, unitCost: cost, totalCost },
      },
    });

    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
}

// PUT /api/tickets/:ticketId/materials/:entryId
async function updateMaterialEntry(req, res, next) {
  try {
    const { ticketId, entryId } = req.params;
    const { itemName, quantity, unitCost, notes } = req.body;

    // Find existing entry
    const existing = await prisma.materialEntry.findUnique({
      where: { id: entryId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Material entry not found' });
    }

    if (existing.ticketId !== ticketId) {
      return res.status(400).json({ error: 'Entry does not belong to this ticket' });
    }

    // Only owner or ADMIN can edit
    if (existing.agentId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to edit this entry' });
    }

    const updateData = {};
    if (itemName !== undefined) updateData.itemName = itemName.trim();
    if (quantity !== undefined) updateData.quantity = parseFloat(quantity);
    if (unitCost !== undefined) updateData.unitCost = parseFloat(unitCost);
    if (notes !== undefined) updateData.notes = notes;

    // Recalculate totalCost if quantity or unitCost changed
    const newQty = updateData.quantity ?? existing.quantity;
    const newCost = updateData.unitCost ?? existing.unitCost;
    updateData.totalCost = newQty * newCost;

    const entry = await prisma.materialEntry.update({
      where: { id: entryId },
      data: updateData,
      include: {
        agent: {
          select: { id: true, name: true },
        },
      },
    });

    res.json(entry);
  } catch (error) {
    next(error);
  }
}

// DELETE /api/tickets/:ticketId/materials/:entryId
async function deleteMaterialEntry(req, res, next) {
  try {
    const { ticketId, entryId } = req.params;

    // Find existing entry
    const existing = await prisma.materialEntry.findUnique({
      where: { id: entryId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Material entry not found' });
    }

    if (existing.ticketId !== ticketId) {
      return res.status(400).json({ error: 'Entry does not belong to this ticket' });
    }

    // Only owner or ADMIN can delete
    if (existing.agentId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to delete this entry' });
    }

    await prisma.materialEntry.delete({
      where: { id: entryId },
    });

    res.json({ message: 'Material entry deleted' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMaterialEntries,
  createMaterialEntry,
  updateMaterialEntry,
  deleteMaterialEntry,
};
