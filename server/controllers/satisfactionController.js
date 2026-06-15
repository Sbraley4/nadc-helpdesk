const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { sendReviewRequest } = require('../services/satisfactionEmailService');

const prisma = new PrismaClient();

// Google Business Review URL placeholder - update this in AppSettings
const GOOGLE_BUSINESS_REVIEW_URL = 'PLACEHOLDER_GOOGLE_REVIEW_URL';

// Schedule review request when ticket is closed
// Called internally from ticket update when status changes to CLOSED
async function scheduleReviewRequest(ticket) {
  try {
    // Get settings
    const settings = await prisma.appSetting.findMany();
    const settingsMap = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    const cooldownDays = parseInt(settingsMap.review_cooldown_days || '90', 10);
    const delayHours = parseInt(settingsMap.review_send_delay_hours || '24', 10);

    // Fetch ticket with contact
    const fullTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: { requester: true },
    });

    if (!fullTicket || !fullTicket.requester) {
      console.log(`[ReviewScheduler] No requester for ticket ${ticket.id}`);
      return false;
    }

    const contact = fullTicket.requester;

    // Check 1: Contact has not opted out
    if (contact.reviewOptOut) {
      console.log(`[ReviewScheduler] Contact ${contact.id} has opted out`);
      return false;
    }

    // Check 2: Contact's lastReviewRequestedAt is null or > cooldownDays ago
    if (contact.lastReviewRequestedAt) {
      const daysSinceLastRequest = Math.floor(
        (Date.now() - new Date(contact.lastReviewRequestedAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastRequest < cooldownDays) {
        console.log(`[ReviewScheduler] Contact ${contact.id} was requested ${daysSinceLastRequest} days ago (cooldown: ${cooldownDays})`);
        return false;
      }
    }

    // Check 3: Ticket does not already have reviewRequestedAt set
    if (fullTicket.reviewRequestedAt) {
      console.log(`[ReviewScheduler] Ticket ${ticket.id} already has review requested`);
      return false;
    }

    // All checks passed - schedule the review request
    const scheduledFor = new Date(Date.now() + delayHours * 60 * 60 * 1000);

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { reviewRequestScheduledFor: scheduledFor },
    });

    console.log(`[ReviewScheduler] Scheduled review request for ticket ${ticket.id} at ${scheduledFor}`);
    return true;
  } catch (error) {
    console.error('[ReviewScheduler] Error:', error);
    return false;
  }
}

// GET /api/satisfaction/review/:token - PUBLIC
// Returns review request details for the React review page
async function getReviewDetails(req, res) {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Missing token' });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired link' });
    }

    const { ticketId, contactId } = decoded;

    // Get ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        status: true,
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Get contact
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { id: true, name: true },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Check if already rated
    const existingRating = await prisma.satisfactionRating.findUnique({
      where: { ticketId },
    });

    if (existingRating) {
      return res.status(400).json({ error: 'already_rated', message: 'You have already submitted feedback for this ticket.' });
    }

    // Get Google review URL from settings
    const googleUrlSetting = await prisma.appSetting.findUnique({
      where: { key: 'google_review_url' },
    });

    res.json({
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      ticketSubject: ticket.subject,
      contactName: contact.name,
      googleReviewUrl: googleUrlSetting?.value || GOOGLE_BUSINESS_REVIEW_URL,
    });
  } catch (error) {
    console.error('Error getting review details:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

// POST /api/satisfaction/review/:token - PUBLIC
// Submits star rating (1-5) and optional comment
async function submitReview(req, res) {
  try {
    const { token } = req.params;
    const { rating, comment } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Missing token' });
    }

    // Validate rating
    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired link' });
    }

    const { ticketId, contactId } = decoded;

    // Get ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check if already rated
    const existingRating = await prisma.satisfactionRating.findUnique({
      where: { ticketId },
    });

    if (existingRating) {
      return res.status(400).json({ error: 'already_rated', message: 'You have already submitted feedback for this ticket.' });
    }

    // Create rating
    await prisma.satisfactionRating.create({
      data: {
        ticketId,
        contactId,
        rating: ratingNum,
        comment: comment || null,
      },
    });

    // Update contact's reviewRating
    await prisma.contact.update({
      where: { id: contactId },
      data: { reviewRating: ratingNum },
    });

    // Get Google review URL from settings
    const googleUrlSetting = await prisma.appSetting.findUnique({
      where: { key: 'google_review_url' },
    });

    res.json({
      success: true,
      message: 'Thank you for your feedback!',
      googleReviewUrl: googleUrlSetting?.value || GOOGLE_BUSINESS_REVIEW_URL,
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

// GET /api/satisfaction/opt-out - PUBLIC
// Handles opt-out from review requests
async function optOut(req, res) {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).send('<h1>Invalid request - missing token</h1>');
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).send('<h1>Invalid or expired link</h1>');
    }

    // Update contact
    await prisma.contact.update({
      where: { id: decoded.contactId },
      data: { reviewOptOut: true },
    });

    return res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f5f5f5;
      margin: 0;
      padding: 40px 20px;
    }
    .container {
      max-width: 500px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 { color: #1B2A4A; }
    p { color: #333; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <h1>You've been unsubscribed</h1>
    <p>You will no longer receive review requests from us.</p>
  </div>
</body>
</html>
    `);
  } catch (error) {
    console.error('Error processing opt-out:', error);
    return res.status(500).send('<h1>Something went wrong. Please try again later.</h1>');
  }
}

// GET /api/satisfaction/ratings - ADMIN only
// Returns all ratings for admin view with star rating support
async function getRatings(req, res, next) {
  try {
    const { minRating, maxRating, startDate, endDate, agentId, page = 1, limit = 25 } = req.query;

    const where = {};

    // Filter by rating range
    if (minRating || maxRating) {
      where.rating = {};
      if (minRating) where.rating.gte = parseInt(minRating, 10);
      if (maxRating) where.rating.lte = parseInt(maxRating, 10);
    }

    if (startDate || endDate) {
      where.ratedAt = {};
      if (startDate) where.ratedAt.gte = new Date(startDate);
      if (endDate) where.ratedAt.lte = new Date(endDate);
    }

    // Filter by agent (ticket assignee)
    if (agentId) {
      where.ticket = {
        assigneeId: agentId,
      };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [ratings, total, aggregation] = await Promise.all([
      prisma.satisfactionRating.findMany({
        where,
        include: {
          ticket: {
            select: {
              id: true,
              ticketNumber: true,
              subject: true,
              assignee: {
                select: { id: true, name: true, avatar: true },
              },
            },
          },
          contact: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { ratedAt: 'desc' },
        skip,
        take,
      }),
      prisma.satisfactionRating.count({ where }),
      prisma.satisfactionRating.aggregate({
        where,
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    // Calculate rating distribution (1-5 stars)
    const ratingCounts = await prisma.satisfactionRating.groupBy({
      by: ['rating'],
      where,
      _count: { rating: true },
    });

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratingCounts.forEach((r) => {
      distribution[r.rating] = r._count.rating;
    });

    // Count ratings with comments
    const withComments = await prisma.satisfactionRating.count({
      where: {
        ...where,
        comment: { not: null },
      },
    });

    const averageRating = aggregation._avg.rating ? Math.round(aggregation._avg.rating * 10) / 10 : 0;

    res.json({
      ratings: ratings.map((r) => ({
        id: r.id,
        ticketId: r.ticketId,
        ticketNumber: r.ticket?.ticketNumber,
        ticketSubject: r.ticket?.subject,
        rating: r.rating,
        comment: r.comment,
        ratedAt: r.ratedAt,
        contact: r.contact,
        agent: r.ticket?.assignee,
      })),
      total,
      averageRating,
      distribution,
      withComments,
      pagination: {
        page: parseInt(page, 10),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  scheduleReviewRequest,
  getReviewDetails,
  submitReview,
  optOut,
  getRatings,
};
