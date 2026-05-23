const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { sendReviewRequest } = require('../services/satisfactionEmailService');

const prisma = new PrismaClient();

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

// POST /api/satisfaction/:ticketId/rate - PUBLIC
// Handles the rating submission from email link
async function submitRating(req, res) {
  try {
    const { ticketId } = req.params;
    const { rating, token } = req.query;

    if (!token) {
      return res.status(400).send('<h1>Invalid request - missing token</h1>');
    }

    if (!rating || !['POSITIVE', 'NEGATIVE'].includes(rating)) {
      return res.status(400).send('<h1>Invalid rating value</h1>');
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).send('<h1>Invalid or expired link</h1>');
    }

    // Verify ticketId matches token
    if (decoded.ticketId !== ticketId) {
      return res.status(400).send('<h1>Invalid request</h1>');
    }

    // Get ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return res.status(404).send('<h1>Ticket not found</h1>');
    }

    if (ticket.status !== 'CLOSED') {
      return res.status(400).send('<h1>This ticket is not closed</h1>');
    }

    // Check if already rated
    const existingRating = await prisma.satisfactionRating.findUnique({
      where: { ticketId },
    });

    if (existingRating) {
      return res.send('<h1>Thank you - you have already submitted feedback for this ticket.</h1>');
    }

    // Create rating
    await prisma.satisfactionRating.create({
      data: {
        ticketId,
        contactId: decoded.contactId,
        rating,
      },
    });

    // Update contact's reviewRating
    await prisma.contact.update({
      where: { id: decoded.contactId },
      data: { reviewRating: rating },
    });

    // Get Google review URL if positive
    if (rating === 'POSITIVE') {
      const googleUrlSetting = await prisma.appSetting.findUnique({
        where: { key: 'google_review_url' },
      });
      const googleReviewUrl = googleUrlSetting?.value;

      if (googleReviewUrl) {
        // Return redirect page with Google review prompt
        return res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You!</title>
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
    h1 { color: #22c55e; margin-bottom: 20px; }
    p { color: #333; line-height: 1.6; margin-bottom: 30px; }
    .btn {
      display: inline-block;
      padding: 15px 40px;
      background-color: #1B2A4A;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-size: 18px;
      font-weight: 600;
    }
    .btn:hover { background-color: #2d3f5e; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Thank you for your feedback!</h1>
    <p>We're thrilled you had a great experience. Would you mind taking a moment to leave us a quick Google review? It really helps our team!</p>
    <a href="${googleReviewUrl}" class="btn" target="_blank">
      ⭐ Leave a Google Review
    </a>
  </div>
</body>
</html>
        `);
      }

      // No Google URL configured
      return res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You!</title>
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
    h1 { color: #22c55e; }
    p { color: #333; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Thank you for your feedback!</h1>
    <p>We're glad you had a great experience. Thank you for taking the time to let us know!</p>
  </div>
</body>
</html>
      `);
    }

    // NEGATIVE rating - show feedback form
    return res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We're Sorry</title>
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
    h1 { color: #ef4444; margin-bottom: 20px; }
    p { color: #333; line-height: 1.6; margin-bottom: 20px; }
    textarea {
      width: 100%;
      min-height: 120px;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 16px;
      margin-bottom: 20px;
      box-sizing: border-box;
      resize: vertical;
    }
    .btn {
      display: inline-block;
      padding: 12px 30px;
      background-color: #1B2A4A;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn:hover { background-color: #2d3f5e; }
  </style>
</head>
<body>
  <div class="container">
    <h1>We're sorry to hear that</h1>
    <p>We'd really like to understand what went wrong so we can improve. Could you tell us more?</p>
    <form action="/api/satisfaction/${ticketId}/feedback" method="POST">
      <input type="hidden" name="token" value="${token}">
      <textarea name="feedback" placeholder="Please share what we could do better..." required></textarea>
      <button type="submit" class="btn">Submit Feedback</button>
    </form>
  </div>
</body>
</html>
    `);
  } catch (error) {
    console.error('Error processing rating:', error);
    return res.status(500).send('<h1>Something went wrong. Please try again later.</h1>');
  }
}

// POST /api/satisfaction/:ticketId/feedback - PUBLIC
// Handles feedback submission from negative rating
async function submitFeedback(req, res) {
  try {
    const { ticketId } = req.params;
    const { feedback, token } = req.body;

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

    // Find the rating
    const rating = await prisma.satisfactionRating.findUnique({
      where: { ticketId },
    });

    if (!rating) {
      return res.status(404).send('<h1>Rating not found</h1>');
    }

    // Update with feedback
    await prisma.satisfactionRating.update({
      where: { ticketId },
      data: { feedback },
    });

    return res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You</title>
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
    <h1>Thank you for your feedback</h1>
    <p>We appreciate you taking the time to help us improve. We'll be in touch.</p>
  </div>
</body>
</html>
    `);
  } catch (error) {
    console.error('Error processing feedback:', error);
    return res.status(500).send('<h1>Something went wrong. Please try again later.</h1>');
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
// Returns all ratings for admin view
async function getRatings(req, res, next) {
  try {
    const { rating, startDate, endDate, page = 1, limit = 25 } = req.query;

    const where = {};

    if (rating) {
      where.rating = rating;
    }

    if (startDate || endDate) {
      where.ratedAt = {};
      if (startDate) where.ratedAt.gte = new Date(startDate);
      if (endDate) where.ratedAt.lte = new Date(endDate);
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [ratings, total, positiveCount, negativeCount] = await Promise.all([
      prisma.satisfactionRating.findMany({
        where,
        include: {
          ticket: {
            select: { id: true, ticketNumber: true, subject: true },
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
      prisma.satisfactionRating.count({ where: { ...where, rating: 'POSITIVE' } }),
      prisma.satisfactionRating.count({ where: { ...where, rating: 'NEGATIVE' } }),
    ]);

    const positivePercent = total > 0 ? Math.round((positiveCount / total) * 100) : 0;

    res.json({
      ratings,
      total,
      positiveCount,
      negativeCount,
      positivePercent,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  scheduleReviewRequest,
  submitRating,
  submitFeedback,
  optOut,
  getRatings,
};
