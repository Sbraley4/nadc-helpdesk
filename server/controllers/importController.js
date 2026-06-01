const { PrismaClient } = require('@prisma/client');
const csv = require('csv-parse/sync');

const prisma = new PrismaClient();

// Status mapping from Freshdesk to our system
const STATUS_MAP = {
  'Open': 'OPEN',
  'Pending': 'PENDING',
  'Resolved': 'INVOICED',
  'Closed': 'INVOICED',
  'In Progress': 'PENDING',
  'Waiting on Customer': 'PENDING',
  'Waiting on Third Party': 'PENDING',
};

// Priority mapping from Freshdesk
const PRIORITY_MAP = {
  'Low': 'LOW',
  'Medium': 'MEDIUM',
  'High': 'HIGH',
  'Urgent': 'URGENT',
  '1': 'LOW',
  '2': 'MEDIUM',
  '3': 'HIGH',
  '4': 'URGENT',
};

/**
 * POST /api/import/preview
 * Preview CSV file contents
 */
const previewCSV = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { type } = req.body; // companies, contacts, or tickets

    if (!['companies', 'contacts', 'tickets'].includes(type)) {
      return res.status(400).json({ error: 'Invalid import type. Must be companies, contacts, or tickets' });
    }

    // Parse CSV
    const csvContent = req.file.buffer.toString('utf-8');
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    // Get first 10 rows for preview
    const preview = records.slice(0, 10);
    const totalRows = records.length;
    const columns = records.length > 0 ? Object.keys(records[0]) : [];

    res.json({
      type,
      columns,
      preview,
      totalRows,
    });
  } catch (error) {
    console.error('CSV preview error:', error);
    if (error.code === 'CSV_INVALID_ARGUMENT') {
      return res.status(400).json({ error: 'Invalid CSV file format' });
    }
    next(error);
  }
};

/**
 * POST /api/import/companies
 * Import companies from Freshdesk CSV
 */
const importCompanies = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const results = {
      imported: 0,
      skipped: 0,
      errors: [],
    };

    // Process in transaction
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        try {
          // Map Freshdesk fields to our fields
          const name = record['Name'] || record['name'] || record['Company Name'] || record['company_name'];
          const domain = record['Domain'] || record['domain'] || record['Domains'] || record['domains'];
          const notes = record['Notes'] || record['notes'] || record['Description'] || record['description'];

          if (!name) {
            results.errors.push(`Row ${i + 2}: Missing company name`);
            results.skipped++;
            continue;
          }

          // Check for duplicates by name
          const existing = await tx.company.findFirst({
            where: { name: { equals: name, mode: 'insensitive' } },
          });

          if (existing) {
            results.skipped++;
            continue;
          }

          // Create company
          await tx.company.create({
            data: {
              name,
              domain: domain || null,
              notes: notes || null,
            },
          });

          results.imported++;
        } catch (err) {
          results.errors.push(`Row ${i + 2}: ${err.message}`);
          results.skipped++;
        }
      }
    });

    res.json({
      success: true,
      ...results,
      total: records.length,
    });
  } catch (error) {
    console.error('Company import error:', error);
    res.status(500).json({
      error: 'Import failed',
      message: error.message,
    });
  }
};

/**
 * POST /api/import/contacts
 * Import contacts from Freshdesk CSV
 */
const importContacts = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const results = {
      imported: 0,
      skipped: 0,
      errors: [],
    };

    // Process in transaction
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        try {
          // Map Freshdesk fields to our fields
          const name = record['Name'] || record['name'] || record['Full Name'] || record['full_name'] || record['Contact Name'];
          const email = record['Email'] || record['email'] || record['Primary Email'] || record['primary_email'];
          const phone = record['Phone'] || record['phone'] || record['Work Phone'] || record['work_phone'] || record['Mobile'];
          const companyName = record['Company'] || record['company'] || record['Company Name'] || record['company_name'];

          if (!name || !email) {
            results.errors.push(`Row ${i + 2}: Missing name or email`);
            results.skipped++;
            continue;
          }

          // Check for duplicates by email
          const existing = await tx.contact.findUnique({
            where: { email: email.toLowerCase() },
          });

          if (existing) {
            results.skipped++;
            continue;
          }

          // Find company if specified
          let companyId = null;
          if (companyName) {
            const company = await tx.company.findFirst({
              where: { name: { equals: companyName, mode: 'insensitive' } },
            });
            if (company) {
              companyId = company.id;
            }
          }

          // Create contact
          await tx.contact.create({
            data: {
              name,
              email: email.toLowerCase(),
              phone: phone || null,
              companyId,
            },
          });

          results.imported++;
        } catch (err) {
          if (err.code === 'P2002') {
            results.skipped++;
          } else {
            results.errors.push(`Row ${i + 2}: ${err.message}`);
            results.skipped++;
          }
        }
      }
    });

    res.json({
      success: true,
      ...results,
      total: records.length,
    });
  } catch (error) {
    console.error('Contact import error:', error);
    res.status(500).json({
      error: 'Import failed',
      message: error.message,
    });
  }
};

/**
 * POST /api/import/tickets
 * Import tickets from Freshdesk CSV
 */
const importTickets = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const results = {
      imported: 0,
      skipped: 0,
      errors: [],
    };

    // Get all agents for assignment lookup
    const agents = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'AGENT'] }, isActive: true },
    });
    const agentMap = {};
    agents.forEach(a => {
      agentMap[a.name.toLowerCase()] = a.id;
      agentMap[a.email.toLowerCase()] = a.id;
    });

    // Process in transaction
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        try {
          // Map Freshdesk fields
          const subject = record['Subject'] || record['subject'] || record['Title'] || record['title'];
          const description = record['Description'] || record['description'] || record['Body'] || record['body'] || '';
          const requesterEmail = record['Requester Email'] || record['requester_email'] || record['Contact Email'] || record['contact_email'];
          const requesterName = record['Requester Name'] || record['requester_name'] || record['Contact Name'] || record['contact_name'];
          const statusRaw = record['Status'] || record['status'] || 'Open';
          const priorityRaw = record['Priority'] || record['priority'] || 'Medium';
          const assigneeName = record['Agent'] || record['agent'] || record['Assigned To'] || record['assigned_to'];
          const createdAt = record['Created At'] || record['created_at'] || record['Created Time'] || record['created_time'];
          const companyName = record['Company'] || record['company'] || record['Company Name'];

          if (!subject) {
            results.errors.push(`Row ${i + 2}: Missing subject`);
            results.skipped++;
            continue;
          }

          // Find or create contact
          let contact = null;
          if (requesterEmail) {
            contact = await tx.contact.findUnique({
              where: { email: requesterEmail.toLowerCase() },
            });

            if (!contact && requesterName) {
              // Create contact if doesn't exist
              contact = await tx.contact.create({
                data: {
                  name: requesterName,
                  email: requesterEmail.toLowerCase(),
                },
              });
            }
          }

          if (!contact) {
            // Create a placeholder contact
            const placeholderEmail = `imported_${Date.now()}_${i}@placeholder.local`;
            contact = await tx.contact.create({
              data: {
                name: requesterName || 'Unknown Contact',
                email: placeholderEmail,
              },
            });
          }

          // Map status
          const status = STATUS_MAP[statusRaw] || 'OPEN';
          const priority = PRIORITY_MAP[priorityRaw] || 'MEDIUM';

          // Find assignee
          let assigneeId = null;
          if (assigneeName) {
            assigneeId = agentMap[assigneeName.toLowerCase()] || null;
          }

          // Find company
          let companyId = null;
          if (companyName) {
            const company = await tx.company.findFirst({
              where: { name: { equals: companyName, mode: 'insensitive' } },
            });
            if (company) companyId = company.id;
          }

          // Parse created date
          let createdDate = new Date();
          if (createdAt) {
            const parsed = new Date(createdAt);
            if (!isNaN(parsed.getTime())) {
              createdDate = parsed;
            }
          }

          // Create ticket
          const ticket = await tx.ticket.create({
            data: {
              subject,
              description: description || subject,
              status,
              priority,
              requesterId: contact.id,
              assigneeId,
              companyId,
              createdAt: createdDate,
              resolvedAt: ['INVOICED', 'CLOSED'].includes(status) ? createdDate : null,
            },
          });

          results.imported++;
        } catch (err) {
          results.errors.push(`Row ${i + 2}: ${err.message}`);
          results.skipped++;
        }
      }
    }, {
      timeout: 300000, // 5 minute timeout for large imports
    });

    res.json({
      success: true,
      ...results,
      total: records.length,
    });
  } catch (error) {
    console.error('Ticket import error:', error);
    res.status(500).json({
      error: 'Import failed',
      message: error.message,
    });
  }
};

module.exports = {
  previewCSV,
  importCompanies,
  importContacts,
  importTickets,
};
