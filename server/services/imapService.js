const Imap = require('imap');
const { simpleParser } = require('mailparser');
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

let imapClient = null;
let isProcessing = false;
let imapReady = false;

/**
 * Check if IMAP is configured
 */
function isImapConfigured() {
  return !!(
    process.env.IMAP_HOST &&
    process.env.IMAP_USER &&
    process.env.IMAP_PASS
  );
}

/**
 * Create IMAP connection
 */
function createImapConnection() {
  return new Imap({
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASS,
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    authTimeout: 10000,
    connTimeout: 30000,
  });
}

/**
 * Extract ticket number from email subject
 * Looks for patterns like [#123] or Re: #123
 */
function extractTicketNumber(subject) {
  if (!subject) return null;

  // Match [#123] pattern (most reliable)
  const bracketMatch = subject.match(/\[#(\d+)\]/);
  if (bracketMatch) {
    return parseInt(bracketMatch[1], 10);
  }

  // Match "Re: ... #123" or "Ticket #123" patterns
  const hashMatch = subject.match(/#(\d+)\b/);
  if (hashMatch) {
    return parseInt(hashMatch[1], 10);
  }

  return null;
}

/**
 * Clean email subject (remove Re:, Fwd:, ticket references)
 */
function cleanSubject(subject) {
  if (!subject) return 'No Subject';

  return subject
    .replace(/^(Re:|Fwd:|Fw:)\s*/gi, '')
    .replace(/\[#\d+\]\s*/g, '')
    .trim() || 'No Subject';
}

/**
 * Clean email body - remove quoted replies
 */
function cleanEmailBody(text) {
  if (!text) return '';

  const lines = text.split('\n');
  const cleanLines = [];

  for (const line of lines) {
    // Stop at quoted content markers
    if (line.match(/^On .+ wrote:$/)) break;
    if (line.match(/^>+ /)) continue;
    if (line.match(/^-{3,}.*Original Message/i)) break;
    if (line.match(/^From:/i) && cleanLines.length > 0) break;

    cleanLines.push(line);
  }

  return cleanLines.join('\n').trim();
}

/**
 * Find or create contact from email
 */
async function findOrCreateContact(email, name) {
  const normalizedEmail = email.toLowerCase();

  // Check if contact exists
  let contact = await prisma.contact.findUnique({
    where: { email: normalizedEmail },
    include: { company: true },
  });

  if (!contact) {
    // Try to match company by domain
    const domain = normalizedEmail.split('@')[1];
    const company = await prisma.company.findFirst({
      where: { domain },
    });

    // Create new contact
    contact = await prisma.contact.create({
      data: {
        email: normalizedEmail,
        name: name || email.split('@')[0],
        companyId: company?.id,
      },
      include: { company: true },
    });

    console.log(`[IMAP] Created new contact: ${contact.email}`);
  }

  return contact;
}

/**
 * Get default SLA policy for email tickets
 */
async function getDefaultSLAPolicy() {
  // Try to get a standard policy
  const policy = await prisma.slaPolicy.findFirst({
    where: { name: { contains: 'Standard' } },
  });

  if (policy) return policy.id;

  // Get any active policy
  const anyPolicy = await prisma.slaPolicy.findFirst();
  return anyPolicy?.id || null;
}

/**
 * Create a new ticket from email
 */
async function createTicketFromEmail(parsed) {
  try {
    const fromAddress = parsed.from?.value?.[0];
    if (!fromAddress?.address) {
      console.log('[IMAP] Email has no valid from address, skipping');
      return null;
    }

    // Check if sender is an internal user (agent/admin)
    const internalUser = await prisma.user.findFirst({
      where: {
        email: fromAddress.address.toLowerCase(),
        deletedAt: null,
      },
    });

    if (internalUser) {
      console.log(`[IMAP] Skipping email from internal user: ${fromAddress.address}`);
      return null;
    }

    // Find or create contact
    const contact = await findOrCreateContact(
      fromAddress.address,
      fromAddress.name
    );

    // Get subject and body
    const subject = cleanSubject(parsed.subject);
    const body = cleanEmailBody(parsed.text) || parsed.html?.replace(/<[^>]*>/g, '') || '';

    // Get next ticket number
    const lastTicket = await prisma.ticket.findFirst({
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    });
    const ticketNumber = (lastTicket?.ticketNumber || 0) + 1;

    // Get default SLA policy
    const slaPolicyId = await getDefaultSLAPolicy();

    // Create ticket
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        subject,
        description: body.substring(0, 10000),
        status: 'OPEN',
        priority: 'MEDIUM',
        source: 'EMAIL',
        requesterId: contact.id,
        companyId: contact.companyId,
        slaPolicyId,
      },
      include: {
        requester: true,
      },
    });

    // Create activity
    await prisma.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        type: 'created',
        description: 'Ticket created from inbound email',
        metadata: {
          source: 'email',
          fromEmail: fromAddress.address,
        },
      },
    });

    console.log(`[IMAP] Created ticket #${ticketNumber} from email: ${fromAddress.address}`);
    return ticket;
  } catch (error) {
    console.error('[IMAP] Error creating ticket from email:', error);
    return null;
  }
}

/**
 * Create a reply from email on existing ticket
 */
async function createReplyFromEmail(ticket, parsed) {
  try {
    const fromAddress = parsed.from?.value?.[0];
    if (!fromAddress?.address) {
      console.log('[IMAP] Reply email has no valid from address, skipping');
      return null;
    }

    // Get email body
    const body = cleanEmailBody(parsed.text) || parsed.html?.replace(/<[^>]*>/g, '') || '';

    // Check if sender is an internal user
    const internalUser = await prisma.user.findFirst({
      where: {
        email: fromAddress.address.toLowerCase(),
        deletedAt: null,
      },
    });

    // Create reply
    const reply = await prisma.ticketReply.create({
      data: {
        ticketId: ticket.id,
        body: body.substring(0, 10000),
        isInternal: false,
        authorId: internalUser?.id || null,
      },
    });

    // Update ticket
    const updates = { updatedAt: new Date() };

    // Reopen if resolved/closed
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      updates.status = 'OPEN';

      await prisma.ticketActivity.create({
        data: {
          ticketId: ticket.id,
          type: 'status_changed',
          description: 'Ticket reopened due to email reply',
          metadata: {
            oldStatus: ticket.status,
            newStatus: 'OPEN',
            source: 'email',
          },
        },
      });
    }

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: updates,
    });

    // Create activity
    await prisma.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        type: 'reply_added',
        description: 'Reply added from inbound email',
        userId: internalUser?.id || null,
        metadata: {
          source: 'email',
          fromEmail: fromAddress.address,
        },
      },
    });

    console.log(`[IMAP] Added email reply to ticket #${ticket.ticketNumber}`);
    return reply;
  } catch (error) {
    console.error('[IMAP] Error creating reply from email:', error);
    return null;
  }
}

/**
 * Process a single inbound email
 */
async function processInboundEmail(parsed) {
  try {
    // Extract ticket number from subject
    const ticketNumber = extractTicketNumber(parsed.subject);

    if (ticketNumber) {
      // This is a reply to an existing ticket
      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber },
        include: { requester: true },
      });

      if (ticket) {
        await createReplyFromEmail(ticket, parsed);
        return { type: 'reply', ticketNumber };
      } else {
        console.log(`[IMAP] Ticket #${ticketNumber} not found, creating new ticket`);
      }
    }

    // Create new ticket
    const ticket = await createTicketFromEmail(parsed);
    if (ticket) {
      return { type: 'new', ticketNumber: ticket.ticketNumber };
    }

    return null;
  } catch (error) {
    console.error('[IMAP] Error processing inbound email:', error);
    return null;
  }
}

/**
 * Fetch and process new emails
 */
function fetchNewEmails(imap) {
  return new Promise((resolve, reject) => {
    imap.search(['UNSEEN'], (err, results) => {
      if (err) {
        return reject(err);
      }

      if (!results || results.length === 0) {
        console.log('[IMAP] No new emails');
        return resolve([]);
      }

      console.log(`[IMAP] Found ${results.length} new email(s)`);

      const processed = [];
      const fetch = imap.fetch(results, { bodies: '', markSeen: true });

      fetch.on('message', (msg) => {
        let buffer = '';

        msg.on('body', (stream) => {
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });
        });

        msg.once('end', async () => {
          try {
            const parsed = await simpleParser(buffer);
            const result = await processInboundEmail(parsed);
            if (result) {
              processed.push(result);
            }
          } catch (parseError) {
            console.error('[IMAP] Error parsing email:', parseError.message);
          }
        });
      });

      fetch.once('error', (fetchErr) => {
        console.error('[IMAP] Fetch error:', fetchErr);
        reject(fetchErr);
      });

      fetch.once('end', () => {
        console.log('[IMAP] Finished fetching emails');
        setTimeout(() => resolve(processed), 1000);
      });
    });
  });
}

/**
 * Check for new emails
 */
async function checkEmails() {
  if (!imapReady || !imapClient || isProcessing) {
    return;
  }

  isProcessing = true;
  console.log('[IMAP] Checking for new emails...');

  try {
    await new Promise((resolve, reject) => {
      imapClient.openBox('INBOX', false, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    await fetchNewEmails(imapClient);
  } catch (error) {
    console.error('[IMAP] Error checking emails:', error.message);

    // Reconnect if connection lost
    if (error.message?.includes('Not authenticated') || error.message?.includes('Connection')) {
      console.log('[IMAP] Attempting to reconnect...');
      imapReady = false;
      startImapConnection();
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * Start IMAP connection
 */
function startImapConnection() {
  if (imapClient) {
    try {
      imapClient.end();
    } catch (e) {
      // Ignore
    }
  }

  imapClient = createImapConnection();

  imapClient.once('ready', () => {
    console.log('[IMAP] Connection ready');
    imapReady = true;
    checkEmails();
  });

  imapClient.once('error', (err) => {
    console.error('[IMAP] Connection error:', err.message);
    imapReady = false;
  });

  imapClient.once('end', () => {
    console.log('[IMAP] Connection ended');
    imapReady = false;
  });

  imapClient.connect();
}

/**
 * Start IMAP listener with polling
 */
function startImapListener() {
  if (!isImapConfigured()) {
    console.log('[IMAP] Not configured, skipping IMAP listener');
    return;
  }

  console.log('[IMAP] Starting IMAP listener...');

  // Start initial connection
  startImapConnection();

  // Schedule polling every 2 minutes using node-cron
  cron.schedule('*/2 * * * *', () => {
    if (imapReady) {
      checkEmails();
    } else {
      console.log('[IMAP] Not connected, attempting reconnect...');
      startImapConnection();
    }
  });

  console.log('[IMAP] Scheduled to check every 2 minutes');
}

/**
 * Stop IMAP listener
 */
function stopImapListener() {
  if (imapClient) {
    console.log('[IMAP] Stopping listener...');
    try {
      imapClient.end();
    } catch (e) {
      // Ignore
    }
    imapClient = null;
    imapReady = false;
  }
}

/**
 * Test IMAP connection
 */
async function testImapConnection() {
  if (!isImapConfigured()) {
    return { success: false, error: 'IMAP not configured' };
  }

  return new Promise((resolve) => {
    const testClient = createImapConnection();
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        try {
          testClient.end();
        } catch (e) {
          // Ignore
        }
      }
    };

    testClient.once('ready', () => {
      console.log('[IMAP] Test connection successful');
      cleanup();
      resolve({ success: true });
    });

    testClient.once('error', (err) => {
      console.error('[IMAP] Test connection failed:', err.message);
      cleanup();
      resolve({ success: false, error: err.message });
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      if (!resolved) {
        cleanup();
        resolve({ success: false, error: 'Connection timeout' });
      }
    }, 15000);

    testClient.connect();
  });
}

module.exports = {
  startImapListener,
  stopImapListener,
  testImapConnection,
  isImapConfigured,
  checkEmails,
  processInboundEmail,
};
