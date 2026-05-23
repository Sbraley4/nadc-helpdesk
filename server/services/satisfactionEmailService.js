const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { sendReviewRequestEmail, getAppSetting } = require('./emailService');

const prisma = new PrismaClient();

/**
 * Send review request email
 */
async function sendReviewRequest(ticket, contact) {
  try {
    // Check if contact has opted out
    if (contact.optedOutOfReviews) {
      console.log(`[Satisfaction] Contact ${contact.email} has opted out of review requests`);
      return { success: false, reason: 'opted_out' };
    }

    // Generate JWT tokens for each action
    const tokenPayload = { ticketId: ticket.id, contactId: contact.id };

    const positiveToken = jwt.sign(
      { ...tokenPayload, rating: 'POSITIVE' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const negativeToken = jwt.sign(
      { ...tokenPayload, rating: 'NEGATIVE' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const optOutToken = jwt.sign(
      { contactId: contact.id, action: 'opt-out' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Send email using the email service
    const result = await sendReviewRequestEmail(contact, ticket, {
      positiveToken,
      negativeToken,
      optOutToken,
    });

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
