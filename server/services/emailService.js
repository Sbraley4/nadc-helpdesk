const fs = require('fs').promises;
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { ClientSecretCredential } = require('@azure/identity');
const { Client } = require('@microsoft/microsoft-graph-client');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');

const prisma = new PrismaClient();

// Settings cache
const settingsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let graphClient = null;
let emailServiceReady = false;

/**
 * Initialize the Microsoft Graph client
 */
async function initializeTransporter() {
  console.log('[Email Service] Initializing Microsoft Graph API...');
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  console.log(`[Email Service] AZURE_TENANT_ID: ${tenantId ? 'SET' : 'NOT SET'}`);
  console.log(`[Email Service] AZURE_CLIENT_ID: ${clientId ? 'SET' : 'NOT SET'}`);
  console.log(`[Email Service] AZURE_CLIENT_SECRET: ${clientSecret ? 'SET (' + clientSecret.length + ' chars)' : 'NOT SET'}`);

  if (!tenantId || !clientId || !clientSecret) {
    console.warn('[Email Service] Microsoft Graph API not configured - emails will be logged to console (STUB MODE)');
    emailServiceReady = false;
    return false;
  }

  try {
    // Create credential using client secret
    console.log('[Email Service] Creating ClientSecretCredential...');
    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

    // Create auth provider
    console.log('[Email Service] Creating TokenCredentialAuthenticationProvider...');
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default'],
    });

    // Create Graph client
    console.log('[Email Service] Creating Graph client...');
    graphClient = Client.initWithMiddleware({ authProvider });

    console.log('[Email Service] Microsoft Graph API ready - emails will be sent');
    emailServiceReady = true;
    return true;
  } catch (error) {
    console.error('[Email Service] Microsoft Graph API initialization FAILED:', error.message);
    console.error('[Email Service] Full error:', error);
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
 * Send an email using Microsoft Graph API
 */
async function sendEmail({ to, subject, html, text, attachments = [] }) {
  if (!to) {
    console.warn('[Email Service] No recipient email provided, skipping');
    return { success: false, error: 'No recipient email' };
  }

  const companyName = (await getAppSetting('company_name')) || 'NADC Tickets';
  const fromAddress = process.env.GRAPH_MAIL_FROM || process.env.SMTP_FROM || 'tickets@nadc.com';

  // If Graph API not configured, log to console
  if (!emailServiceReady || !graphClient) {
    console.log('[Email Service] STUB MODE - Would send email:');
    console.log(`  From: "${companyName}" <${fromAddress}>`);
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body preview: ${(text || html || '').substring(0, 200)}...`);
    return { success: true, messageId: `stub-${Date.now()}`, stubMode: true };
  }

  try {
    // Build the email message for Graph API
    const message = {
      subject,
      body: {
        contentType: html ? 'HTML' : 'Text',
        content: html || text,
      },
      toRecipients: [
        {
          emailAddress: {
            address: to,
          },
        },
      ],
    };

    // Add attachments if any
    if (attachments && attachments.length > 0) {
      message.attachments = attachments.map((att) => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.filename,
        contentType: att.contentType || 'application/octet-stream',
        contentBytes: att.content.toString('base64'),
      }));
    }

    // Send email using Graph API
    await graphClient
      .api(`/users/${fromAddress}/sendMail`)
      .post({
        message,
        saveToSentItems: false,
      });

    console.log(`[Email Service] Email sent to ${to}: ${subject}`);
    return { success: true, messageId: `graph-${Date.now()}` };
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
        <p>Emails are now being sent via <strong>Microsoft Graph API</strong>.</p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">Sent from NADC Helpdesk</p>
      </div>
    `,
    text: 'If you received this, your email configuration is working correctly. Emails are now being sent via Microsoft Graph API.',
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
  graphClient = null;
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
  const displayNumber = ticket.ticketNumber || ticket.id;

  return await sendTemplatedEmail({
    to: requester.email,
    subject: `Ticket #${displayNumber} Created: ${ticket.subject}`,
    templateName: 'new-ticket-confirmation',
    variables: {
      requester_name: requester.name || 'Customer',
      ticket_number: displayNumber.toString(),
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
  const displayNumber = ticket.ticketNumber || ticket.id;

  return await sendTemplatedEmail({
    to: requester.email,
    subject: `Re: Ticket #${displayNumber} - ${ticket.subject}`,
    templateName: 'agent-reply',
    variables: {
      requester_name: requester.name || 'Customer',
      ticket_number: displayNumber.toString(),
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
  const displayNumber = ticket.ticketNumber || ticket.id;
  console.log(`[Email Service] sendTicketAssignedEmail called for ticket #${displayNumber} to ${agent?.email}`);
  console.log(`[Email Service] emailServiceReady: ${emailServiceReady}, graphClient exists: ${!!graphClient}`);

  if (!agent?.email) {
    console.warn('[Email Service] No agent email provided for assignment notification');
    return { success: false, error: 'No agent email' };
  }

  const companyName = (await getAppSetting('company_name')) || 'NADC Helpdesk';
  const helpdeskUrl = process.env.HELPDESK_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const ticketUrl = `${helpdeskUrl}/tickets/${ticket.id}`;

  const result = await sendTemplatedEmail({
    to: agent.email,
    subject: `Ticket #${displayNumber} Assigned: ${ticket.subject}`,
    templateName: 'ticket-assigned',
    variables: {
      agent_name: agent.name,
      ticket_number: displayNumber.toString(),
      ticket_subject: ticket.subject,
      requester_name: requester?.name || 'Unknown',
      priority: ticket.priority,
      ticket_url: ticketUrl,
      company_name: companyName,
    },
  });

  console.log(`[Email Service] sendTicketAssignedEmail result:`, JSON.stringify(result));
  return result;
}

/**
 * Send ticket status changed notification to requester
 */
async function sendStatusChangedEmail(ticket, oldStatus, newStatus, requester) {
  const companyName = (await getAppSetting('company_name')) || 'NADC Helpdesk';
  const helpdeskUrl = process.env.HELPDESK_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const ticketUrl = `${helpdeskUrl}/portal/tickets/${ticket.id}`;
  const displayNumber = ticket.ticketNumber || ticket.id;

  return await sendTemplatedEmail({
    to: requester.email,
    subject: `Ticket #${displayNumber} Status Updated: ${newStatus}`,
    templateName: 'ticket-status-changed',
    variables: {
      requester_name: requester.name || 'Customer',
      ticket_number: displayNumber.toString(),
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
  const displayNumber = ticket.ticketNumber || ticket.id;

  return await sendTemplatedEmail({
    to: recipient.email,
    subject: `SLA Breach: Ticket #${displayNumber} - ${ticket.subject}`,
    templateName: 'sla-breach-warning',
    variables: {
      agent_name: recipient.name,
      ticket_number: displayNumber.toString(),
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
  const displayNumber = ticket.ticketNumber || ticket.id;

  return await sendTemplatedEmail({
    to: contact.email,
    subject: 'How did we do?',
    templateName: 'review-request',
    variables: {
      requester_name: contact.name || 'Customer',
      ticket_number: displayNumber.toString(),
      ticket_subject: ticket.subject,
      agent_name: agentName,
      review_url: `${helpdeskUrl}/review/${tokens.reviewToken}`,
      opt_out_url: `${helpdeskUrl}/api/satisfaction/opt-out?token=${tokens.optOutToken}`,
      company_name: companyName,
    },
  });
}

/**
 * Send reply notification email to assigned agent
 */
async function sendReplyNotificationToAgent(ticket, reply, author, agent) {
  const companyName = (await getAppSetting('company_name')) || 'NADC Helpdesk';
  const helpdeskUrl = process.env.HELPDESK_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const ticketUrl = `${helpdeskUrl}/tickets/${ticket.id}`;
  const displayNumber = ticket.ticketNumber || ticket.id;

  // Truncate reply for preview (strip HTML and limit length)
  const replyText = reply.body.replace(/<[^>]*>/g, '').substring(0, 300);
  const replyPreview = replyText.length < reply.body.replace(/<[^>]*>/g, '').length
    ? replyText + '...'
    : replyText;

  return await sendTemplatedEmail({
    to: agent.email,
    subject: `Re: Ticket #${displayNumber} - New Reply`,
    templateName: 'ticket-reply-agent',
    variables: {
      agent_name: agent.name,
      ticket_number: displayNumber.toString(),
      ticket_subject: ticket.subject,
      author_name: author.name,
      reply_preview: replyPreview,
      ticket_url: ticketUrl,
      company_name: companyName,
    },
  });
}

/**
 * Send internal note notification email to assigned agent
 */
async function sendNoteNotificationToAgent(ticket, note, author, agent) {
  const companyName = (await getAppSetting('company_name')) || 'NADC Helpdesk';
  const helpdeskUrl = process.env.HELPDESK_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const ticketUrl = `${helpdeskUrl}/tickets/${ticket.id}`;
  const displayNumber = ticket.ticketNumber || ticket.id;

  // Truncate note for preview (strip HTML and limit length)
  const noteText = note.body.replace(/<[^>]*>/g, '').substring(0, 300);
  const notePreview = noteText.length < note.body.replace(/<[^>]*>/g, '').length
    ? noteText + '...'
    : noteText;

  return await sendTemplatedEmail({
    to: agent.email,
    subject: `Ticket #${displayNumber} - New Internal Note`,
    templateName: 'ticket-note-agent',
    variables: {
      agent_name: agent.name,
      ticket_number: displayNumber.toString(),
      ticket_subject: ticket.subject,
      author_name: author.name,
      note_preview: notePreview,
      ticket_url: ticketUrl,
      company_name: companyName,
    },
  });
}

/**
 * Send status change notification email to assigned agent
 */
async function sendStatusChangeToAgent(ticket, oldStatus, newStatus, changedBy, agent) {
  const companyName = (await getAppSetting('company_name')) || 'NADC Helpdesk';
  const helpdeskUrl = process.env.HELPDESK_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const ticketUrl = `${helpdeskUrl}/tickets/${ticket.id}`;
  const displayNumber = ticket.ticketNumber || ticket.id;

  return await sendTemplatedEmail({
    to: agent.email,
    subject: `Ticket #${displayNumber} - Status Changed to ${newStatus}`,
    templateName: 'ticket-status-agent',
    variables: {
      agent_name: agent.name,
      ticket_number: displayNumber.toString(),
      ticket_subject: ticket.subject,
      changed_by: changedBy.name,
      old_status: oldStatus,
      new_status: newStatus,
      ticket_url: ticketUrl,
      company_name: companyName,
    },
  });
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(user, resetToken) {
  const companyName = (await getAppSetting('company_name')) || 'NADC Helpdesk';
  const helpdeskUrl = process.env.HELPDESK_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const resetUrl = `${helpdeskUrl}/reset-password/${resetToken}`;

  return await sendTemplatedEmail({
    to: user.email,
    subject: `${companyName} — Password Reset Request`,
    templateName: 'password-reset',
    variables: {
      user_name: user.name || 'User',
      reset_url: resetUrl,
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
  // Agent notification emails
  sendReplyNotificationToAgent,
  sendNoteNotificationToAgent,
  sendStatusChangeToAgent,
  // Password emails
  sendPasswordResetEmail,
};
