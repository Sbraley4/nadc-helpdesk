const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * GET /api/custom-fields
 * Get all custom fields ordered by order
 */
const getCustomFields = async (req, res, next) => {
  try {
    const customFields = await prisma.customField.findMany({
      orderBy: { order: 'asc' },
    });

    res.json(customFields);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/custom-fields
 * Create a new custom field
 */
const createCustomField = async (req, res, next) => {
  try {
    const { label, fieldKey, fieldType, options, isRequired, order } = req.body;

    // Check if fieldKey already exists
    const existingField = await prisma.customField.findUnique({
      where: { fieldKey },
    });

    if (existingField) {
      return res.status(409).json({ error: 'Field key already exists' });
    }

    const customField = await prisma.customField.create({
      data: {
        label,
        fieldKey,
        fieldType,
        options: options || null,
        isRequired: isRequired || false,
        order: order || 0,
      },
    });

    res.status(201).json(customField);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/custom-fields/:id
 * Update a custom field (cannot change fieldKey or fieldType)
 */
const updateCustomField = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { label, options, isRequired, order } = req.body;

    // Check if field exists
    const existingField = await prisma.customField.findUnique({
      where: { id },
    });

    if (!existingField) {
      return res.status(404).json({ error: 'Custom field not found' });
    }

    const updateData = {};
    if (label !== undefined) updateData.label = label;
    if (options !== undefined) updateData.options = options;
    if (isRequired !== undefined) updateData.isRequired = isRequired;
    if (order !== undefined) updateData.order = order;

    const customField = await prisma.customField.update({
      where: { id },
      data: updateData,
    });

    res.json(customField);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/custom-fields/:id
 * Delete a custom field and all associated values
 */
const deleteCustomField = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if field exists
    const existingField = await prisma.customField.findUnique({
      where: { id },
    });

    if (!existingField) {
      return res.status(404).json({ error: 'Custom field not found' });
    }

    // Delete field and associated values in transaction
    await prisma.$transaction([
      prisma.customFieldValue.deleteMany({ where: { fieldId: id } }),
      prisma.customField.delete({ where: { id } }),
    ]);

    res.json({ message: 'Custom field deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
};
