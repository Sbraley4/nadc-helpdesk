// server/controllers/automationController.js
const { PrismaClient } = require('@prisma/client');
const { testAutomation } = require('../services/automationEngine');

const prisma = new PrismaClient();

/**
 * GET /api/automations
 */
async function getAutomations(req, res, next) {
  try {
    const automations = await prisma.automationRule.findMany({
      orderBy: { runOrder: 'asc' },
    });

    res.json({ automations });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/automations
 */
async function createAutomation(req, res, next) {
  try {
    const { name, trigger, conditions, actions, runOrder = 0, isActive = true } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const validTriggers = ['TICKET_CREATED', 'TICKET_UPDATED', 'REPLY_RECEIVED', 'TIME_BASED'];
    if (!trigger || !validTriggers.includes(trigger)) {
      return res.status(400).json({ error: 'Valid trigger is required' });
    }

    if (!Array.isArray(conditions) || conditions.length === 0) {
      return res.status(400).json({ error: 'At least one condition is required' });
    }

    if (!Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({ error: 'At least one action is required' });
    }

    const automation = await prisma.automationRule.create({
      data: {
        name: name.trim(),
        trigger,
        conditions,
        actions,
        runOrder: parseInt(runOrder) || 0,
        isActive,
      },
    });

    res.status(201).json(automation);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/automations/:id
 */
async function updateAutomation(req, res, next) {
  try {
    const { id } = req.params;
    const { name, trigger, conditions, actions, runOrder, isActive } = req.body;

    const existing = await prisma.automationRule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (trigger !== undefined) updateData.trigger = trigger;
    if (conditions !== undefined) updateData.conditions = conditions;
    if (actions !== undefined) updateData.actions = actions;
    if (runOrder !== undefined) updateData.runOrder = parseInt(runOrder);
    if (isActive !== undefined) updateData.isActive = isActive;

    const automation = await prisma.automationRule.update({
      where: { id },
      data: updateData,
    });

    res.json(automation);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/automations/:id/toggle
 */
async function toggleAutomation(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await prisma.automationRule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    const automation = await prisma.automationRule.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    res.json({ id: automation.id, isActive: automation.isActive });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/automations/:id
 */
async function deleteAutomation(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await prisma.automationRule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    await prisma.automationRule.delete({ where: { id } });

    res.json({ message: 'Automation deleted' });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/automations/:id/test
 */
async function testAutomationEndpoint(req, res, next) {
  try {
    const { id } = req.params;
    const { ticketId } = req.body;

    if (!ticketId) {
      return res.status(400).json({ error: 'ticketId is required' });
    }

    const result = await testAutomation(id, ticketId);
    res.json(result);
  } catch (error) {
    if (error.message === 'Automation rule not found' || error.message === 'Ticket not found') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
}

module.exports = {
  getAutomations,
  createAutomation,
  updateAutomation,
  toggleAutomation,
  deleteAutomation,
  testAutomationEndpoint,
};
