const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ============================================================================
// CATEGORIES
// ============================================================================

/**
 * GET /api/kb/categories
 * List all categories (public: only with published articles, agents: all)
 */
async function getCategories(req, res, next) {
  try {
    const isAgent = !!req.user; // If agent is authenticated
    const isPortal = !!req.contact; // If portal contact

    let categories;

    if (isAgent) {
      // Agents see all categories with article counts
      categories = await prisma.kBCategory.findMany({
        orderBy: { order: 'asc' },
        include: {
          _count: {
            select: { articles: true },
          },
        },
      });

      categories = categories.map((cat) => ({
        ...cat,
        articleCount: cat._count.articles,
        _count: undefined,
      }));
    } else {
      // Public/portal: only categories with published articles
      categories = await prisma.kBCategory.findMany({
        where: {
          articles: {
            some: { isPublished: true },
          },
        },
        orderBy: { order: 'asc' },
        include: {
          _count: {
            select: {
              articles: {
                where: { isPublished: true },
              },
            },
          },
        },
      });

      categories = categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        articleCount: cat._count.articles,
      }));
    }

    res.json({ categories });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/kb/categories/:slug
 * Get single category by slug
 */
async function getCategory(req, res, next) {
  try {
    const { slug } = req.params;
    const isAgent = !!req.user;

    const category = await prisma.kBCategory.findUnique({
      where: { slug },
      include: {
        articles: {
          where: isAgent ? {} : { isPublished: true },
          orderBy: { updatedAt: 'desc' },
          include: {
            author: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Format for public view
    const formattedArticles = category.articles.map((article) => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      isPublished: article.isPublished,
      authorName: article.author.name,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    }));

    res.json({
      ...category,
      articles: formattedArticles,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/kb/categories
 * Create a new category (agents only)
 */
async function createCategory(req, res, next) {
  try {
    const { name, description, order = 0 } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check for duplicate slug
    const existing = await prisma.kBCategory.findUnique({
      where: { slug },
    });

    if (existing) {
      return res.status(400).json({ error: 'A category with this name already exists' });
    }

    const category = await prisma.kBCategory.create({
      data: {
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        order,
      },
    });

    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/kb/categories/:id
 * Update a category (agents only)
 */
async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description, order } = req.body;

    const existing = await prisma.kBCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const data = {};

    if (name !== undefined) {
      data.name = name.trim();
      // Update slug if name changes
      data.slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Check for duplicate slug (excluding this category)
      const duplicateSlug = await prisma.kBCategory.findFirst({
        where: {
          slug: data.slug,
          NOT: { id },
        },
      });

      if (duplicateSlug) {
        return res.status(400).json({ error: 'A category with this name already exists' });
      }
    }

    if (description !== undefined) {
      data.description = description?.trim() || null;
    }

    if (order !== undefined) {
      data.order = order;
    }

    const category = await prisma.kBCategory.update({
      where: { id },
      data,
    });

    res.json(category);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/kb/categories/:id
 * Delete a category (agents only)
 */
async function deleteCategory(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await prisma.kBCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { articles: true } },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (existing._count.articles > 0) {
      return res.status(400).json({
        error: 'Cannot delete category with articles. Move or delete articles first.',
      });
    }

    await prisma.kBCategory.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// ARTICLES
// ============================================================================

/**
 * GET /api/kb/articles
 * List articles with optional filters
 */
async function getArticles(req, res, next) {
  try {
    const { categoryId, search, published, page = 1, limit = 20 } = req.query;
    const isAgent = !!req.user;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where = {};

    // Non-agents only see published articles
    if (!isAgent) {
      where.isPublished = true;
    } else if (published !== undefined) {
      where.isPublished = published === 'true';
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [articles, total] = await Promise.all([
      prisma.kBArticle.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          author: {
            select: { name: true },
          },
        },
      }),
      prisma.kBArticle.count({ where }),
    ]);

    const formattedArticles = articles.map((article) => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      isPublished: article.isPublished,
      category: article.category,
      authorName: article.author.name,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      // Include excerpt for search results
      excerpt: article.body.substring(0, 200) + (article.body.length > 200 ? '...' : ''),
    }));

    res.json({
      articles: formattedArticles,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/kb/articles/:slug
 * Get single article by slug
 */
async function getArticle(req, res, next) {
  try {
    const { slug } = req.params;
    const isAgent = !!req.user;

    const article = await prisma.kBArticle.findUnique({
      where: { slug },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        author: {
          select: { name: true },
        },
      },
    });

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Non-agents can't see draft articles
    if (!isAgent && !article.isPublished) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({
      id: article.id,
      title: article.title,
      slug: article.slug,
      body: article.body,
      isPublished: article.isPublished,
      category: article.category,
      authorName: article.author.name,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/kb/articles
 * Create a new article (agents only)
 */
async function createArticle(req, res, next) {
  try {
    const { title, body, categoryId, isPublished = false } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Body is required' });
    }

    if (!categoryId) {
      return res.status(400).json({ error: 'Category is required' });
    }

    // Verify category exists
    const category = await prisma.kBCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return res.status(400).json({ error: 'Category not found' });
    }

    // Generate slug from title
    let slug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check for duplicate slug and append number if needed
    let counter = 0;
    let finalSlug = slug;
    while (await prisma.kBArticle.findUnique({ where: { slug: finalSlug } })) {
      counter++;
      finalSlug = `${slug}-${counter}`;
    }

    const article = await prisma.kBArticle.create({
      data: {
        title: title.trim(),
        slug: finalSlug,
        body: body.trim(),
        isPublished,
        categoryId,
        authorId: req.user.id,
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        author: {
          select: { name: true },
        },
      },
    });

    res.status(201).json({
      id: article.id,
      title: article.title,
      slug: article.slug,
      body: article.body,
      isPublished: article.isPublished,
      category: article.category,
      authorName: article.author.name,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/kb/articles/:id
 * Update an article (agents only)
 */
async function updateArticle(req, res, next) {
  try {
    const { id } = req.params;
    const { title, body, categoryId, isPublished } = req.body;

    const existing = await prisma.kBArticle.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const data = {};

    if (title !== undefined) {
      data.title = title.trim();
      // Update slug if title changes
      let slug = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Check for duplicate slug (excluding this article)
      let counter = 0;
      let finalSlug = slug;
      while (
        await prisma.kBArticle.findFirst({
          where: { slug: finalSlug, NOT: { id } },
        })
      ) {
        counter++;
        finalSlug = `${slug}-${counter}`;
      }
      data.slug = finalSlug;
    }

    if (body !== undefined) {
      data.body = body.trim();
    }

    if (categoryId !== undefined) {
      const category = await prisma.kBCategory.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        return res.status(400).json({ error: 'Category not found' });
      }
      data.categoryId = categoryId;
    }

    if (isPublished !== undefined) {
      data.isPublished = isPublished;
    }

    const article = await prisma.kBArticle.update({
      where: { id },
      data,
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        author: {
          select: { name: true },
        },
      },
    });

    res.json({
      id: article.id,
      title: article.title,
      slug: article.slug,
      body: article.body,
      isPublished: article.isPublished,
      category: article.category,
      authorName: article.author.name,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/kb/articles/:id
 * Delete an article (agents only)
 */
async function deleteArticle(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await prisma.kBArticle.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Article not found' });
    }

    await prisma.kBArticle.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// SEARCH
// ============================================================================

/**
 * GET /api/kb/search
 * Search articles
 */
async function searchArticles(req, res, next) {
  try {
    const { q, limit = 10 } = req.query;
    const isAgent = !!req.user;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const where = {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
      ],
    };

    // Non-agents only see published
    if (!isAgent) {
      where.isPublished = true;
    }

    const articles = await prisma.kBArticle.findMany({
      where,
      take: parseInt(limit, 10),
      orderBy: { updatedAt: 'desc' },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    const results = articles.map((article) => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      category: article.category,
      excerpt: article.body.substring(0, 150) + (article.body.length > 150 ? '...' : ''),
    }));

    res.json({ results });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  // Categories
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  // Articles
  getArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  // Search
  searchArticles,
};
