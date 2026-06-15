const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * List companies with pagination and filters
 * GET /api/companies
 */
async function listCompanies(req, res, next) {
  try {
    const {
      page = 1,
      limit = 25,
      search,
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
        { domain: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Build orderBy
    const validSortFields = ['name', 'createdAt'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'name';
    const sortOrder = order === 'desc' ? 'desc' : 'asc';
    const orderBy = { [sortField]: sortOrder };

    // Get companies with counts
    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          assignedAgent: {
            select: { name: true },
          },
          _count: {
            select: {
              contacts: true,
              tickets: true,
            },
          },
        },
      }),
      prisma.company.count({ where }),
    ]);

    res.json({
      companies,
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
 * Get single company
 * GET /api/companies/:id
 */
async function getCompany(req, res, next) {
  try {
    const { id } = req.params;

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        assignedAgent: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        contacts: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
          orderBy: { name: 'asc' },
        },
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
            requester: {
              select: { id: true, name: true },
            },
          },
        },
        _count: {
          select: {
            contacts: true,
            tickets: true,
          },
        },
      },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({ company });
  } catch (error) {
    next(error);
  }
}

/**
 * Create company
 * POST /api/companies
 */
async function createCompany(req, res, next) {
  try {
    const { name, domain, notes, assignedAgentId } = req.body;

    // Validate required fields
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Check name uniqueness
    const existing = await prisma.company.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' } },
    });

    if (existing) {
      return res.status(409).json({ error: 'A company with this name already exists' });
    }

    const company = await prisma.company.create({
      data: {
        name: name.trim(),
        domain: domain?.trim() || null,
        notes: notes?.trim() || null,
        assignedAgentId: assignedAgentId || null,
      },
      include: {
        assignedAgent: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    res.status(201).json(company);
  } catch (error) {
    next(error);
  }
}

/**
 * Update company
 * PUT /api/companies/:id
 */
async function updateCompany(req, res, next) {
  try {
    const { id } = req.params;
    const { name, domain, notes, assignedAgentId } = req.body;

    // Check company exists
    const existing = await prisma.company.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Build update data
    const updateData = {};

    if (name !== undefined) {
      if (name.trim() === '') {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }

      // Check name uniqueness (excluding current)
      const nameTaken = await prisma.company.findFirst({
        where: {
          name: { equals: name.trim(), mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (nameTaken) {
        return res.status(409).json({ error: 'This name is already used by another company' });
      }

      updateData.name = name.trim();
    }

    if (domain !== undefined) {
      updateData.domain = domain?.trim() || null;
    }

    if (notes !== undefined) {
      updateData.notes = notes?.trim() || null;
    }

    if (assignedAgentId !== undefined) {
      updateData.assignedAgentId = assignedAgentId || null;
    }

    const company = await prisma.company.update({
      where: { id },
      data: updateData,
      include: {
        assignedAgent: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    res.json(company);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete company
 * DELETE /api/companies/:id
 */
async function deleteCompany(req, res, next) {
  try {
    const { id } = req.params;

    // Check company exists
    const company = await prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check for open tickets
    const openTicketCount = await prisma.ticket.count({
      where: {
        companyId: id,
        status: { in: ['OPEN', 'PENDING'] },
      },
    });

    if (openTicketCount > 0) {
      return res.status(409).json({
        error: 'Cannot delete company with open tickets',
        count: openTicketCount,
      });
    }

    // Delete company (contacts will have companyId set to null via Prisma)
    await prisma.company.delete({
      where: { id },
    });

    res.json({ message: 'Company deleted' });
  } catch (error) {
    next(error);
  }
}

/**
 * Search companies (for typeahead)
 * GET /api/companies/search
 */
async function searchCompanies(req, res, next) {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ companies: [] });
    }

    const companies = await prisma.company.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { domain: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 10,
      select: {
        id: true,
        name: true,
        domain: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({ companies });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
  searchCompanies,
};
