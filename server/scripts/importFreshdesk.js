/**
 * Freshdesk XML Import Script
 *
 * Imports Freshdesk XML export files into the NADC Helpdesk database.
 *
 * Usage: node scripts/importFreshdesk.js /path/to/freshdesk-export/
 *
 * Expected files in the export directory:
 *   - Companies0.xml
 *   - Users0.xml
 *   - AllAgents0.xml
 *   - Tickets0.xml, Tickets1.xml, Tickets2.xml, Tickets3.xml
 */

const { PrismaClient } = require('@prisma/client');
const { XMLParser } = require('fast-xml-parser');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// XML Parser configuration
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  trimValues: true,
});

// Status mapping from Freshdesk integer values
// Note: Freshdesk status 4 ("resolved") maps to INVOICED since WORKING is a new concept
const STATUS_MAP = {
  2: 'OPEN',
  3: 'PENDING',
  4: 'INVOICED',
  5: 'INVOICED',
};

// Priority mapping from Freshdesk integer values
const PRIORITY_MAP = {
  1: 'LOW',
  2: 'MEDIUM',
  3: 'HIGH',
  4: 'URGENT',
};

// Agent email to DB user ID mapping (populated at runtime)
const agentEmailToDbId = {};

// Freshdesk ID to DB ID mappings
const companyFdToDb = {};
const contactFdToDb = {};
const agentFdToDb = {};

// Import statistics
const stats = {
  companies: { imported: 0, skipped: 0, errors: 0 },
  contacts: { imported: 0, skipped: 0, errors: 0 },
  tickets: { imported: 0, skipped: 0, errors: 0 },
  replies: { imported: 0, skipped: 0, errors: 0 },
};

/**
 * Read and parse an XML file
 */
function readXmlFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`  File not found: ${filePath}`);
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return xmlParser.parse(content);
}

/**
 * Helper to safely get a value from XML node (handles nil="true")
 */
function getValue(node, key) {
  const value = node[key];
  if (value === undefined || value === null) return null;
  if (typeof value === 'object') {
    if (value['@_nil'] === true || value['@_nil'] === 'true') return null;
    if (value['#text'] !== undefined) return value['#text'];
    return null;
  }
  return value;
}

/**
 * Parse ISO date string
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Ensure array (XML parser returns object for single item, array for multiple)
 */
function ensureArray(item) {
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

// ============================================================================
// IMPORT FUNCTIONS
// ============================================================================

/**
 * Load NADC agents into the email-to-ID mapping
 */
async function loadNadcAgents() {
  console.log('\n--- Loading NADC Agents ---');
  const agents = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'AGENT'] }, isActive: true },
  });

  for (const agent of agents) {
    agentEmailToDbId[agent.email.toLowerCase()] = agent.id;
    console.log(`  Mapped: ${agent.email} -> ${agent.id}`);
  }
  console.log(`  Loaded ${agents.length} NADC agents`);
}

/**
 * Parse Freshdesk agents XML to map Freshdesk agent IDs to emails
 */
async function loadFreshdeskAgents(importDir) {
  console.log('\n--- Loading Freshdesk Agents (AllAgents0.xml) ---');
  const filePath = path.join(importDir, 'AllAgents0.xml');
  const data = readXmlFile(filePath);

  if (!data) {
    console.log('  WARNING: AllAgents0.xml not found, agent assignment will be skipped');
    return;
  }

  const agents = ensureArray(data?.users?.user);

  for (const agent of agents) {
    const fdId = getValue(agent, 'id') || getValue(agent, 'user-id');
    const email = getValue(agent, 'email');

    if (fdId && email) {
      const emailLower = email.toLowerCase();
      if (agentEmailToDbId[emailLower]) {
        agentFdToDb[fdId] = agentEmailToDbId[emailLower];
        console.log(`  Mapped Freshdesk agent ${fdId} (${email}) -> DB ${agentEmailToDbId[emailLower]}`);
      } else {
        console.log(`  Freshdesk agent ${fdId} (${email}) has no matching NADC agent`);
      }
    }
  }

  console.log(`  Processed ${agents.length} Freshdesk agents, ${Object.keys(agentFdToDb).length} mapped to NADC agents`);
}

/**
 * Import companies from Companies0.xml
 */
async function importCompanies(importDir) {
  console.log('\n--- Importing Companies (Companies0.xml) ---');
  const filePath = path.join(importDir, 'Companies0.xml');
  const data = readXmlFile(filePath);

  if (!data) {
    console.log('  WARNING: Companies0.xml not found');
    return;
  }

  const companies = ensureArray(data?.companies?.company);
  console.log(`  Found ${companies.length} companies to process`);

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    try {
      const fdId = getValue(company, 'id');
      const name = getValue(company, 'name');
      const description = getValue(company, 'description');
      const note = getValue(company, 'note');
      const domains = getValue(company, 'domains');

      if (!name) {
        console.log(`  Skipping company at index ${i}: missing name`);
        stats.companies.skipped++;
        continue;
      }

      // Check for existing company by name
      const existing = await prisma.company.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      });

      if (existing) {
        companyFdToDb[fdId] = existing.id;
        console.log(`  Existing: "${name}" (FD ${fdId} -> DB ${existing.id})`);
        stats.companies.skipped++;
        continue;
      }

      // Combine description and note
      let notes = null;
      if (description && note) {
        notes = `${description}\n\n${note}`;
      } else {
        notes = description || note || null;
      }

      // Create company
      const newCompany = await prisma.company.create({
        data: {
          name,
          domain: domains || null,
          notes,
        },
      });

      companyFdToDb[fdId] = newCompany.id;
      stats.companies.imported++;

      if ((i + 1) % 50 === 0) {
        console.log(`  Progress: ${i + 1}/${companies.length} companies...`);
      }
    } catch (error) {
      console.error(`  ERROR importing company at index ${i}:`, error.message);
      stats.companies.errors++;
    }
  }

  console.log(`  Completed: ${stats.companies.imported} imported, ${stats.companies.skipped} skipped, ${stats.companies.errors} errors`);
}

/**
 * Import contacts from Users0.xml
 */
async function importContacts(importDir) {
  console.log('\n--- Importing Contacts (Users0.xml) ---');
  const filePath = path.join(importDir, 'Users0.xml');
  const data = readXmlFile(filePath);

  if (!data) {
    console.log('  WARNING: Users0.xml not found');
    return;
  }

  const users = ensureArray(data?.users?.user);
  console.log(`  Found ${users.length} users to process`);

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    try {
      const fdId = getValue(user, 'id');
      const name = getValue(user, 'name');
      const email = getValue(user, 'email');
      const phoneRaw = getValue(user, 'phone') || getValue(user, 'mobile');
      const phone = phoneRaw != null ? String(phoneRaw) : null;
      const jobTitle = getValue(user, 'job-title');
      const companyId = getValue(user, 'company-id');
      const isAgent = getValue(user, 'helpdesk-agent');
      const isDeleted = getValue(user, 'deleted');

      // Skip agents and deleted users
      if (isAgent === true || isAgent === 'true') {
        console.log(`  Skipping agent: ${email}`);
        stats.contacts.skipped++;
        continue;
      }

      if (isDeleted === true || isDeleted === 'true') {
        console.log(`  Skipping deleted user: ${email}`);
        stats.contacts.skipped++;
        continue;
      }

      if (!email) {
        console.log(`  Skipping user at index ${i}: missing email`);
        stats.contacts.skipped++;
        continue;
      }

      // Check for existing contact by email
      const existing = await prisma.contact.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existing) {
        contactFdToDb[fdId] = existing.id;
        stats.contacts.skipped++;
        continue;
      }

      // Map company ID
      const dbCompanyId = companyId ? companyFdToDb[companyId] : null;

      // Put job title in notes since there's no jobTitle field
      const notes = jobTitle ? `Job Title: ${jobTitle}` : null;

      // Create contact
      const newContact = await prisma.contact.create({
        data: {
          name: name || email.split('@')[0],
          email: email.toLowerCase(),
          phone: phone || null,
          companyId: dbCompanyId || null,
          notes,
        },
      });

      contactFdToDb[fdId] = newContact.id;
      stats.contacts.imported++;

      if ((i + 1) % 100 === 0) {
        console.log(`  Progress: ${i + 1}/${users.length} contacts...`);
      }
    } catch (error) {
      console.error(`  ERROR importing contact at index ${i}:`, error.message);
      stats.contacts.errors++;
    }
  }

  console.log(`  Completed: ${stats.contacts.imported} imported, ${stats.contacts.skipped} skipped, ${stats.contacts.errors} errors`);
}

/**
 * Import tickets from Tickets[0-3].xml files
 */
async function importTickets(importDir) {
  console.log('\n--- Importing Tickets ---');

  const ticketFiles = ['Tickets0.xml', 'Tickets1.xml', 'Tickets2.xml', 'Tickets3.xml'];

  for (const fileName of ticketFiles) {
    const filePath = path.join(importDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.log(`  Skipping ${fileName}: file not found`);
      continue;
    }

    console.log(`\n  Processing ${fileName}...`);
    const data = readXmlFile(filePath);

    if (!data) continue;

    const tickets = ensureArray(data?.['helpdesk-tickets']?.['helpdesk-ticket'] || data?.tickets?.ticket);
    console.log(`    Found ${tickets.length} tickets in ${fileName}`);

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      try {
        const fdId = getValue(ticket, 'id');
        const displayId = getValue(ticket, 'display-id');
        const subject = getValue(ticket, 'subject');
        const description = getValue(ticket, 'description') || getValue(ticket, 'description-text');
        const statusInt = getValue(ticket, 'status');
        const priorityInt = getValue(ticket, 'priority');
        const requesterId = getValue(ticket, 'requester-id');
        const responderId = getValue(ticket, 'responder-id');
        const createdAt = getValue(ticket, 'created-at');
        const dueBy = getValue(ticket, 'due-by');
        const isDeleted = getValue(ticket, 'deleted');
        const isSpam = getValue(ticket, 'spam');

        // Skip deleted and spam tickets
        if (isDeleted === true || isDeleted === 'true') {
          stats.tickets.skipped++;
          continue;
        }
        if (isSpam === true || isSpam === 'true') {
          stats.tickets.skipped++;
          continue;
        }

        if (!subject) {
          console.log(`    Skipping ticket FD#${displayId}: missing subject`);
          stats.tickets.skipped++;
          continue;
        }

        // Map requester - if not found, create a placeholder or skip
        let dbRequesterId = contactFdToDb[requesterId];
        if (!dbRequesterId) {
          // Try to find by looking up the requester in the XML data
          console.log(`    Ticket FD#${displayId}: requester ${requesterId} not in mapping, creating placeholder`);
          const placeholderEmail = `imported_fd_${requesterId}_${Date.now()}@placeholder.local`;
          const placeholder = await prisma.contact.create({
            data: {
              name: `Freshdesk User ${requesterId}`,
              email: placeholderEmail,
            },
          });
          contactFdToDb[requesterId] = placeholder.id;
          dbRequesterId = placeholder.id;
        }

        // Map assignee
        const dbAssigneeId = responderId ? agentFdToDb[responderId] : null;

        // Map status and priority
        const status = STATUS_MAP[statusInt] || 'OPEN';
        const priority = PRIORITY_MAP[priorityInt] || 'MEDIUM';

        // Parse dates
        const createdDate = parseDate(createdAt) || new Date();
        const dueDate = parseDate(dueBy);

        // Create ticket
        const newTicket = await prisma.ticket.create({
          data: {
            subject,
            description: description || subject,
            status,
            priority,
            requesterId: dbRequesterId,
            assigneeId: dbAssigneeId,
            dueDate,
            createdAt: createdDate,
            resolvedAt: ['INVOICED'].includes(status) ? createdDate : null,
          },
        });

        stats.tickets.imported++;

        // Import ticket notes/replies
        const notes = ensureArray(ticket?.notes?.['helpdesk-note'] || ticket?.notes?.note);
        for (const note of notes) {
          try {
            const noteBodyRaw = getValue(note, 'body');
            const noteBodyHtmlRaw = getValue(note, 'body-html');
            const isPrivate = getValue(note, 'private');
            const noteUserId = getValue(note, 'user-id');
            const noteCreatedAt = getValue(note, 'created-at');

            if (noteBodyRaw == null) continue;
            const noteBodyPlain = String(noteBodyRaw);

            // Skip Freshdesk system metadata notes (check plain text body)
            if (noteBodyPlain.startsWith('created_by:')) {
              continue;
            }

            // Use HTML body if available, otherwise fall back to plain text
            const noteBody = (noteBodyHtmlRaw != null && String(noteBodyHtmlRaw).trim() !== '')
              ? String(noteBodyHtmlRaw)
              : noteBodyPlain;

            // Determine if this is from an agent or contact
            // Try both the raw value and string version for map lookup
            let authorId = null;
            let portalContactId = null;
            const userIdKey = noteUserId;
            const userIdKeyStr = String(noteUserId);

            if (agentFdToDb[userIdKey] || agentFdToDb[userIdKeyStr]) {
              authorId = agentFdToDb[userIdKey] || agentFdToDb[userIdKeyStr];
            } else if (contactFdToDb[userIdKey] || contactFdToDb[userIdKeyStr]) {
              portalContactId = contactFdToDb[userIdKey] || contactFdToDb[userIdKeyStr];
            }

            await prisma.ticketReply.create({
              data: {
                body: noteBody,
                isInternal: isPrivate === true || isPrivate === 'true',
                authorId,
                portalContactId,
                ticketId: newTicket.id,
                createdAt: parseDate(noteCreatedAt) || createdDate,
              },
            });

            stats.replies.imported++;
          } catch (noteError) {
            console.error(`    ERROR importing note for ticket ${newTicket.id}:`, noteError.message);
            stats.replies.errors++;
          }
        }

        if ((i + 1) % 100 === 0) {
          console.log(`    Progress: ${i + 1}/${tickets.length} tickets...`);
        }
      } catch (error) {
        console.error(`    ERROR importing ticket at index ${i}:`, error.message);
        stats.tickets.errors++;
      }
    }
  }

  console.log(`\n  Tickets completed: ${stats.tickets.imported} imported, ${stats.tickets.skipped} skipped, ${stats.tickets.errors} errors`);
  console.log(`  Replies completed: ${stats.replies.imported} imported, ${stats.replies.errors} errors`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const importDir = process.argv[2];

  if (!importDir) {
    console.error('Usage: node scripts/importFreshdesk.js /path/to/freshdesk-export/');
    process.exit(1);
  }

  if (!fs.existsSync(importDir)) {
    console.error(`Error: Directory not found: ${importDir}`);
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('FRESHDESK XML IMPORT');
  console.log('='.repeat(60));
  console.log(`Import directory: ${importDir}`);
  console.log(`Started at: ${new Date().toISOString()}`);

  // List available files
  const files = fs.readdirSync(importDir).filter(f => f.endsWith('.xml'));
  console.log(`\nFound XML files: ${files.join(', ')}`);

  // Load NADC agents first
  await loadNadcAgents();

  // Load Freshdesk agent mappings
  await loadFreshdeskAgents(importDir);

  // Import in order: Companies -> Contacts -> Tickets
  await importCompanies(importDir);
  await importContacts(importDir);
  await importTickets(importDir);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Companies: ${stats.companies.imported} imported, ${stats.companies.skipped} skipped, ${stats.companies.errors} errors`);
  console.log(`Contacts:  ${stats.contacts.imported} imported, ${stats.contacts.skipped} skipped, ${stats.contacts.errors} errors`);
  console.log(`Tickets:   ${stats.tickets.imported} imported, ${stats.tickets.skipped} skipped, ${stats.tickets.errors} errors`);
  console.log(`Replies:   ${stats.replies.imported} imported, ${stats.replies.errors} errors`);
  console.log('='.repeat(60));
  console.log(`Completed at: ${new Date().toISOString()}`);
}

main()
  .catch((e) => {
    console.error('Import error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
