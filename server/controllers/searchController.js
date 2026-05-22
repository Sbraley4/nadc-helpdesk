// server/controllers/searchController.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * GET /api/search?q=
 */
async function globalSearch(req, res, next) {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const searchTerm = q.toLowerCase();

    // Search in parallel
    const [tickets, contacts, companies, articles] = await Promise.all([
      // Tickets
      prisma.ticket.findMany({
        where: {
          OR: [
            { subject: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          status: true,
          priority: true,
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),

      // Contacts
      prisma.contact.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          company: { select: { name: true } },
        },
        take: 5,
        orderBy: { name: 'asc' },
      }),

      // Companies
      prisma.company.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { domain: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          domain: true,
        },
        take: 5,
        orderBy: { name: 'asc' },
      }),

      // KB Articles (published only)
      prisma.kBArticle.findMany({
        where: {
          isPublished: true,
          title: { contains: searchTerm, mode: 'insensitive' },
        },
        select: {
          id: true,
          title: true,
          category: { select: { name: true } },
        },
        take: 3,
        orderBy: { title: 'asc' },
      }),
    ]);

    // Format contacts with company name
    const formattedContacts = contacts.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      companyName: c.company?.name || null,
    }));

    // Format articles with category name
    const formattedArticles = articles.map((a) => ({
      id: a.id,
      title: a.title,
      categoryName: a.category?.name || null,
    }));

    const total = tickets.length + contacts.length + companies.length + articles.length;

    res.json({
      query: q,
      results: {
        tickets,
        contacts: formattedContacts,
        companies,
        articles: formattedArticles,
      },
      total,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { globalSearch };
