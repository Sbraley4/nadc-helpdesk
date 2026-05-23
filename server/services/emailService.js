const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Settings cache
const settingsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let transporter = null;
let emailServiceReady = false;

/**
 * Initialize the email transporter
 */
async function initializeTransporter() {
  const host = await getConfigValue('SMTP_HOST');
  const port = await getConfigValue('SMTP_PORT');
  const user = await getConfigValue('SMTP_USER');
  const pass = await getConfigValue('SMTP_PASS');
  const secure = await getConfigValue('SMTP_SECURE');

  if (!host || !port) {
    console.warn('[Email Service] SMTP not configured - emails will be logged to console');
    return false;
  }

  try {
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: secure === 'true',
      auth: user && pass ? { user, pass } : undefined,
    });

    // Verify connection
    await transporter.verify();
    console.log('[Email Service] Email service ready');
    emailServiceReady = true;
    return true;
  } catch (error) {
    console.error('[Email Service] Email service unavailable:', error.message);
    emailServiceReady = false;
    return false;
  }
}

/**
 * Get configuration value - checks AppSetting first, then .env
 */
async function getConfigValue(key) {
  // Try AppSetting first (lowercase key for DB)
  const setting = await getAppSetting(key.toLowerCase());
  if (setting) return setting;

  // Fall back to .env
  return process.env[key] || null;
}

/**
 * Get app setting with caching
 */
async function getAppSetting(key) {
  const cached = settingsCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }

  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key },
    });

    const value = setting?.value || null;
    settingsCache.set(key, { value, timestamp: Date.now() });
    return value;
  } catch (error) {
    // DB might not be ready yet on startup
    return null;
  }
}

/**
 * Clear settings cache
 */
function clearSettingsCache() {
  settingsCache.clear();
}

/**
 * Send an email
 */
async function sendEmail({ to, subject, html, text, attachments = [] }) {
  if (!to) {
    console.warn('[Email Service] No recipient email provided, skipping');
    return { success: false, error: 'No recipient email' };
  }

  const companyName = (await getAppSetting('company_name')) || 'NADC Helpdesk';
  const fromAddress = (await getConfigValue('SMTP_FROM')) || process.env.SMTP_FROM || 'noreply@helpdesk.local';

  const mailOptions = {
    from: `"${companyName}" <${fromAddress}>`,
    to,
    subject,
    html,
    text: text || (html ? html.replace(/<[^>]*>/g, '') : ''), // Strip HTML for text version
    attachments,
  };

  // If SMTP not configured, log to console
  if (!emailServiceReady || !transporter) {
    console.log('[Email Service] STUB MODE - Would send email:');
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body preview: ${(text || html || '').substring(0, 200)}...`);
    return { success: true, messageId: `stub-${Date.now()}`, stubMode: true };
  }

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log(`[Email Service] Email sent to ${to}: ${subject}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error(`[Email Service] Failed to send email to ${to}:`, error.message);
    // Don't throw - email failures should never crash the app
    return { success: false, error: error.message };
  }
}

/**
 * Render an email template from file
 */
async function renderTemplate(templateName, variables = {}) {
  const templatePath = path.join(__dirname, '..', 'email-templates', `${templateName}.html`);

  try {
    let html = await fs.readFile(templatePath, 'utf8');

    // Replace all {{variable}} placeholders
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, value ?? '');
    }

    return html;
  } catch (error) {
    console.error(`[Email Service] Failed to render template ${templateName}:`, error.message);
    throw error;
  }
}

/**
 * Send a templated email
 */
async function sendTemplatedEmail({ to, subject, templateName, variables }) {
  try {
    const html = await renderTemplate(templateName, variables);
    return await sendEmail({ to, subject, html });
  } catch (error) {
    console.error(`[Email Service] Failed to send templated email:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send test email
 */
async function sendTestEmail(toEmail) {
  return await sendEmail({
    to: toEmail,
    subject: 'NADC Helpdesk — Test Email',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #1B2A4A;">Test Email</h2>
        <p>If you received this, your email configuration is working correctly.</p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">Sent from NADC Helpdesk</p>
      </div>
    `,
    text: 'If you received this, your email configuration is working correctly.',
  });
}

/**
 * Check if email service is ready
 */
function isReady() {
  return emailServiceReady;
}

/**
 * Re-initialize transporter (after settings change)
 */
async function reinitialize() {
  clearSettingsCache();
  transporter = null;
  emailServiceReady = false;
  return await initializeTransporter();
}

// ============================================
// SPECIFIC EMAIL FUNCTIONS
// ============================================

/**
 * Send new ticket confirmation to requester
 */
async function sendTicketConfirmation(ticket, requester) {
  const companyName = (await getAppSetting('company_name')) || 'NADC Helpdesk';
  const helpdeskUrl = process.env.HELPDESK_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const ticketUrl = `${helpdeskUrl}/portal/tickets/${ticket.id}`;
  const agentName = ticket.assignee?.name || 'our team';

  return await sendTemplatedEmail({
    to: requester.email,
    subject: `Ticket #${ticket.id} Created: ${ticket.subject}`,
    templateName: 'new-ticket-confirmation',
    variables: {
      requester_name: requester.name || 'Customer',
      ticket_number: ticket.id.toString(),
      ticket_subject: ticket.subject,
      ticket_url: ticketUrl,
      company_name: companyName,
      agent_name: agentName,
    },
  });
}

/**
 * Send agent reply notification to requester
 */
async function sendAgentReplyEmail(ticket, reply, agent, requester) {
  const companyName = (await getAppSetting('company_name')) || 'NADC Helpdesk';
  const helpdeskUrl = process.env.HELPDESK_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const ticketUrl = `${helpdeskUrl}/portal/tickets/${ticket.id}`;

  return await sendTemplatedEmail({
    to: requester.email,
    subject: `Re: Ticket #${ticket.id} - ${ticket.subject}`,
    templateName: 'agent-reply',
    variables: {
      requester_name: requester.name || 'Customer',
      ticket_number: ticket.id.toString(),
      ticket_subject: ticket.subject,
      agent_name: agent.name,
      reply_body: reply.body,
      ticket_url: ticketUrl,
      company_name: companyName,
    },
  });
}

/**
 * Send ticket assigned notification to agent
 */
async function sendTicketAssignedEmail(ticket, agent, requester) {
  const companyName = (await getAppSetting('company_name')) || 'NADC Helpdesk';
  const helpdeskUrl = process.env.HELPDESK_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const ticketUrl = `${helpdeskUrl}/tickets/${ticket.id}`;

  return await sendTemplatedEmail({
    to: agent.email,
    subject: `Ticket #${ticket.id} Assigned: ${ticket.subject}`,
    templateName: 'ticket-assigned',
    variables: {
      agent_name: agent.name,
      ticket_number: ticket.id.toString(),
      ticket_subject: ticket.subject,
      requester_name: requester?.name || 'Unknown',
      priority: ticket.priority,
      ticket_url: ticketUrl,
      company_name: companyName,
    },
  });
}

/**
 * Send ticket status changed notification to requester
 */
async function sendStatusChangedEmail(ticket, oldStatus, newStatus, requester) {
  const companyName = (await getAppSetting('company_name')) || 'NADC Helpdesk';
  const helpdeskUrl = process.env.HELPDESK_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const ticketUrl = `${helpdeskUrl}/portal/tickets/${ticket.id}`;

  return await sendTemplatedEmail({
    to: requester.email,
    subject: `Ticket #${ticket.id} Status Updated: ${newStatus}`,
    templateName: 'ticket-status-changed',
    variables: {
      requester_name: requester.name || 'Customer',
      ticket_number: ticket.id.toString(),
      ticket_subject: ticket.subject,
      old_status: oldStatus,
      new_status: newStatus,
      ticket_url: ticketUrl,
      company_name: companyName,
    },
  });
}

/**
 * Send SLA breach warning to agent and admins
 */
async function sendSLABreachEmail(ticket, recipient, breachType) {
  const companyName = (await getAppSetting('company_name')) || 'NADC Helpdesk';
  const helpdeskUrl = process.env.HELPDESK_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const ticketUrl = `${helpdeskUrl}/tickets/${ticket.id}`;

  return await sendTemplatedEmail({
    to: recipient.email,
    subject: `SLA Breach: Ticket #${ticket.id} - ${ticket.subject}`,
    templateName: 'sla-breach-warning',
    variables: {
      agent_name: recipient.name,
      ticket_number: ticket.id.toString(),
      ticket_subject: ticket.subject,
      requester_name: ticket.requester?.name || 'Unknown',
      priority: ticket.priority,
      breach_type: breachType, // "First Response" or "Resolution"
      ticket_url: ticketUrl,
      company_name: companyName,
    },
  });
}

/**
 * Send review request email
 */
async function sendReviewRequestEmail(contact, ticket, tokens) {
  const companyName = (await getAppSetting('company_name')) || 'NADC Helpdesk';
  const helpdeskUrl = process.env.HELPDESK_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const agentName = ticket.assignee?.name || 'the NADC team';

  return await sendTemplatedEmail({
    to: contact.email,
    subject: 'How did we do?',
    templateName: 'review-request',
    variables: {
      requester_name: contact.name || 'Customer',
      ticket_number: ticket.id.toString(),
      ticket_subject: ticket.subject,
      agent_name: agentName,
      positive_url: `${helpdeskUrl}/api/satisfaction/rate?token=${tokens.positiveToken}&rating=positive`,
      negative_url: `${helpdeskUrl}/api/satisfaction/rate?token=${tokens.negativeToken}&rating=negative`,
      opt_out_url: `${helpdeskUrl}/api/satisfaction/opt-out?token=${tokens.optOutToken}`,
      company_name: companyName,
    },
  });
}

module.exports = {
  initializeTransporter,
  sendEmail,
  renderTemplate,
  sendTemplatedEmail,
  sendTestEmail,
  getAppSetting,
  getConfigValue,
  clearSettingsCache,
  isReady,
  reinitialize,
  // Specific email functions
  sendTicketConfirmation,
  sendAgentReplyEmail,
  sendTicketAssignedEmail,
  sendStatusChangedEmail,
  sendSLABreachEmail,
  sendReviewRequestEmail,
};
