const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../services/emailService');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET;
const PORTAL_JWT_SECRET = JWT_SECRET + '_portal';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

/**
 * POST /api/portal/auth/login
 * Contact portal login
 */
async function portalLogin(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find contact by email
    const contact = await prisma.contact.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        company: {
          select: { id: true, name: true },
        },
      },
    });

    if (!contact) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if portal access is set up
    if (!contact.portalPassword) {
      return res.status(401).json({
        error: 'No portal account set up. Please contact NADC support to activate your portal access.',
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, contact.portalPassword);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate portal access token (8 hour expiry)
    const accessToken = jwt.sign(
      { contactId: contact.id, email: contact.email, type: 'portal' },
      PORTAL_JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Generate portal refresh token (30 day expiry)
    const refreshToken = jwt.sign(
      { contactId: contact.id, email: contact.email, type: 'portal_refresh' },
      PORTAL_JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Update last login timestamp
    await prisma.contact.update({
      where: { id: contact.id },
      data: { portalLastLoginAt: new Date() },
    });

    res.json({
      accessToken,
      refreshToken,
      contact: {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/portal/auth/refresh
 * Refresh portal access token
 */
async function portalRefresh(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    // Verify refresh token
    let payload;
    try {
      payload = jwt.verify(refreshToken, PORTAL_JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    if (payload.type !== 'portal_refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Verify contact still exists
    const contact = await prisma.contact.findUnique({
      where: { id: payload.contactId },
    });

    if (!contact || !contact.portalPassword) {
      return res.status(401).json({ error: 'Portal access revoked' });
    }

    // Issue new access token
    const accessToken = jwt.sign(
      { contactId: contact.id, email: contact.email, type: 'portal' },
      PORTAL_JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ accessToken });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/portal/auth/me
 * Get current portal contact
 */
async function portalMe(req, res, next) {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: req.contact.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: {
          select: { id: true, name: true },
        },
      },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(contact);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/portal/auth/set-password
 * Agent sets/activates portal password for a contact
 */
async function portalSetPassword(req, res, next) {
  try {
    const { contactId, password, sendWelcomeEmail = false } = req.body;

    if (!contactId || !password) {
      return res.status(400).json({ error: 'Contact ID and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Verify contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: { company: true },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update contact
    await prisma.contact.update({
      where: { id: contactId },
      data: { portalPassword: hashedPassword },
    });

    // Send welcome email if requested
    if (sendWelcomeEmail) {
      try {
        const templatePath = path.join(__dirname, '../email-templates/portal-welcome.html');
        let template = fs.readFileSync(templatePath, 'utf-8');

        const portalUrl = `${CLIENT_URL}/portal/login`;

        template = template
          .replace(/\{\{contact_name\}\}/g, contact.name)
          .replace(/\{\{contact_email\}\}/g, contact.email)
          .replace(/\{\{portal_url\}\}/g, portalUrl)
          .replace(/\{\{temp_password\}\}/g, password)
          .replace(/\{\{company_name\}\}/g, contact.company?.name || 'NADC');

        await sendEmail({
          to: contact.email,
          subject: 'Welcome to the NADC Support Portal',
          html: template,
        });
      } catch (emailError) {
        console.error('Failed to send portal welcome email:', emailError);
        // Don't fail the request if email fails
      }
    }

    res.json({ message: 'Portal access activated' });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/portal/auth/change-password
 * Contact changes their own portal password
 */
async function portalChangePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    // Get contact with password
    const contact = await prisma.contact.findUnique({
      where: { id: req.contact.id },
    });

    if (!contact || !contact.portalPassword) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, contact.portalPassword);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.contact.update({
      where: { id: req.contact.id },
      data: { portalPassword: hashedPassword },
    });

    res.json({ message: 'Password updated' });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/portal/auth/forgot-password
 * Request password reset email
 */
async function portalForgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Always return success to not reveal if email exists
    const successMessage = 'If that email exists, a reset link has been sent';

    // Find contact
    const contact = await prisma.contact.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Only send email if contact exists and has portal access
    if (contact && contact.portalPassword) {
      try {
        // Generate reset token (1 hour expiry)
        const resetToken = jwt.sign(
          { contactId: contact.id, type: 'portal_reset' },
          PORTAL_JWT_SECRET,
          { expiresIn: '1h' }
        );

        const resetUrl = `${CLIENT_URL}/portal/reset-password?token=${resetToken}`;

        await sendEmail({
          to: contact.email,
          subject: 'Reset your NADC portal password',
          html: `
            <p>Hi ${contact.name},</p>
            <p>We received a request to reset your NADC portal password.</p>
            <p><a href="${resetUrl}" style="display: inline-block; background-color: #1B2A4A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Reset Password</a></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
            <p>Best,<br>NADC Support Team</p>
          `,
        });
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
      }
    }

    res.json({ message: successMessage });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/portal/auth/reset-password
 * Reset password using token
 */
async function portalResetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Verify token
    let payload;
    try {
      payload = jwt.verify(token, PORTAL_JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired reset token' });
    }

    if (payload.type !== 'portal_reset') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Verify contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: payload.contactId },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.contact.update({
      where: { id: payload.contactId },
      data: { portalPassword: hashedPassword },
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  portalLogin,
  portalRefresh,
  portalMe,
  portalSetPassword,
  portalChangePassword,
  portalForgotPassword,
  portalResetPassword,
};
