const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { sendReviewRequestEmail } = require('./emailService');

const prisma = new PrismaClient();

/**
 * Send review request email
 */
async function sendReviewRequest(ticket, contact) {
  try {
    // Check if contact has a valid email
    if (!contact.email) {
      console.log(`[Satisfaction] Contact ${contact.id} has no email, skipping review request`);
      return { success: false, error: 'Contact has no email' };
    }

    // Check if contact has opted out
    if (contact.optedOutOfReviews || contact.reviewOptOut) {
      console.log(`[Satisfaction] Contact ${contact.email} has opted out of review requests`);
      return { success: false, reason: 'opted_out' };
    }

    // Generate JWT token for review page
    const tokenPayload = { ticketId: ticket.id, contactId: contact.id };

    const reviewToken = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    const optOutToken = jwt.sign(
      { contactId: contact.id, action: 'opt-out' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Send email using the email service
    const result = await sendReviewRequestEmail(contact, ticket, {
      reviewToken,
      optOutToken,
    });

    // If email service is in stub mode, don't mark as sent so it retries later
    if (result.stubMode) {
      console.warn(`[Satisfaction] Email service not configured (stub mode), review request for ticket #${ticket.id} will retry`);
      return { success: false, error: 'Email service not configured (stub mode)' };
    }

    if (result.success) {
      // Update contact and ticket timestamps
      await prisma.contact.update({
        where: { id: contact.id },
        data: { lastReviewRequestedAt: new Date() },
      });

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { reviewRequestedAt: new Date() },
      });

      console.log(`[Satisfaction] Review request sent for ticket #${ticket.id} to ${contact.email}`);
    }

    return result;
  } catch (error) {
    console.error('[Satisfaction] Failed to send review request:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendReviewRequest,
};
