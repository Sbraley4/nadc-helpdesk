const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * List contacts with pagination and filters
 * GET /api/contacts
 */
async function listContacts(req, res, next) {
  try {
    const {
      page = 1,
      limit = 25,
      search,
      companyId,
      sortBy = 'name',
      order = 'asc',
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (companyId) {
      where.companyId = companyId;
    }

    // Build orderBy
    const validSortFields = ['name', 'createdAt'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'name';
    const sortOrder = order === 'desc' ? 'desc' : 'asc';
    const orderBy = { [sortField]: sortOrder };

    // Get contacts with company and ticket count
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          company: {
            select: { name: true },
          },
          _count: {
            select: { tickets: true },
          },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    res.json({
      contacts,
      pagination: {
        total,
        page: parseInt(page),
        limit: take,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single contact
 * GET /api/contacts/:id
 */
async function getContact(req, res, next) {
  try {
    const { id } = req.params;

    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        company: true,
        tickets: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
            status: true,
            priority: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ contact });
  } catch (error) {
    next(error);
  }
}

/**
 * Create contact
 * POST /api/contacts
 */
async function createContact(req, res, next) {
  try {
    console.log('[CreateContact] Request body:', req.body);
    const { name, email, phone, companyId, notes } = req.body;

    // Validate required fields
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!email || email.trim() === '') {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check email uniqueness
    const existing = await prisma.contact.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return res.status(409).json({ error: 'A contact with this email already exists' });
    }

    const contact = await prisma.contact.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        companyId: companyId || null,
        notes: notes?.trim() || null,
      },
      include: {
        company: true,
      },
    });

    res.status(201).json(contact);
  } catch (error) {
    next(error);
  }
}

/**
 * Update contact
 * PUT /api/contacts/:id
 */
async function updateContact(req, res, next) {
  try {
    const { id } = req.params;
    const { name, email, phone, companyId, notes } = req.body;

    // Check contact exists
    const existing = await prisma.contact.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Build update data
    const updateData = {};

    if (name !== undefined) {
      if (name.trim() === '') {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      updateData.name = name.trim();
    }

    if (email !== undefined) {
      if (email.trim() === '') {
        return res.status(400).json({ error: 'Email cannot be empty' });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Check email uniqueness (excluding current contact)
      const emailTaken = await prisma.contact.findFirst({
        where: {
          email: email.toLowerCase().trim(),
          id: { not: id },
        },
      });

      if (emailTaken) {
        return res.status(409).json({ error: 'This email is already used by another contact' });
      }

      updateData.email = email.toLowerCase().trim();
    }

    if (phone !== undefined) {
      updateData.phone = phone?.trim() || null;
    }

    if (companyId !== undefined) {
      updateData.companyId = companyId || null;
    }

    if (notes !== undefined) {
      updateData.notes = notes?.trim() || null;
    }

    const contact = await prisma.contact.update({
      where: { id },
      data: updateData,
      include: {
        company: true,
      },
    });

    res.json(contact);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete contact
 * DELETE /api/contacts/:id
 */
async function deleteContact(req, res, next) {
  try {
    const { id } = req.params;

    // Check contact exists
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            tickets: {
              where: {
                status: { in: ['OPEN', 'PENDING'] },
              },
            },
          },
        },
      },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Check for open tickets
    const openTicketCount = await prisma.ticket.count({
      where: {
        requesterId: id,
        status: { in: ['OPEN', 'PENDING'] },
      },
    });

    if (openTicketCount > 0) {
      return res.status(409).json({
        error: 'Cannot delete contact with open tickets',
        count: openTicketCount,
      });
    }

    await prisma.contact.delete({
      where: { id },
    });

    res.json({ message: 'Contact deleted' });
  } catch (error) {
    next(error);
  }
}

/**
 * Search contacts (for typeahead)
 * GET /api/contacts/search
 */
async function searchContacts(req, res, next) {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ contacts: [] });
    }

    const contacts = await prisma.contact.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 10,
      select: {
        id: true,
        name: true,
        email: true,
        company: {
          select: { name: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ contacts });
  } catch (error) {
    next(error);
  }
}

/**
 * Get portal access status for a contact
 * GET /api/contacts/:id/portal-status
 */
async function getPortalStatus(req, res, next) {
  try {
    const { id } = req.params;

    const contact = await prisma.contact.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        portalPassword: true,
        portalLastLoginAt: true,
      },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({
      contactId: contact.id,
      contactName: contact.name,
      contactEmail: contact.email,
      hasPortalAccess: !!contact.portalPassword,
      lastLoginAt: contact.portalLastLoginAt,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Revoke portal access for a contact
 * DELETE /api/contacts/:id/portal-access
 */
async function revokePortalAccess(req, res, next) {
  try {
    const { id } = req.params;

    const contact = await prisma.contact.findUnique({
      where: { id },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    await prisma.contact.update({
      where: { id },
      data: {
        portalPassword: null,
        portalLastLoginAt: null,
      },
    });

    res.json({ message: 'Portal access revoked' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  searchContacts,
  getPortalStatus,
  revokePortalAccess,
};
