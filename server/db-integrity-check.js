/**
 * Database Integrity Check Script
 * Checks for orphaned records, missing relations, and data inconsistencies
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let passed = 0;
let failed = 0;
let warnings = [];

async function check(name, fn) {
  try {
    const result = await fn();
    if (result.passed) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}: ${result.message}`);
      failed++;
    }
    if (result.warning) {
      warnings.push({ name, message: result.warning });
    }
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
    failed++;
  }
}

async function main() {
  console.log('===========================================');
  console.log('  DATABASE INTEGRITY CHECK');
  console.log('===========================================\n');

  // Check 1: Tickets have valid requesters
  await check('All tickets have valid requesters', async () => {
    const tickets = await prisma.ticket.findMany({
      where: {
        requester: null,
      },
    });
    return {
      passed: tickets.length === 0,
      message: `Found ${tickets.length} tickets without requesters`,
    };
  });

  // Check 2: Tickets with assigneeId have valid assignees
  await check('All assigned tickets have valid assignees', async () => {
    const tickets = await prisma.ticket.findMany({
      where: {
        assigneeId: { not: null },
      },
      include: {
        assignee: true,
      },
    });
    const orphaned = tickets.filter(t => !t.assignee);
    return {
      passed: orphaned.length === 0,
      message: `Found ${orphaned.length} tickets with invalid assignee references`,
    };
  });

  // Check 3: Contacts with companyId have valid companies
  await check('All contacts with company have valid company references', async () => {
    const contacts = await prisma.contact.findMany({
      where: {
        companyId: { not: null },
      },
      include: {
        company: true,
      },
    });
    const orphaned = contacts.filter(c => !c.company);
    return {
      passed: orphaned.length === 0,
      message: `Found ${orphaned.length} contacts with invalid company references`,
    };
  });

  // Check 4: No duplicate ticket numbers
  await check('No duplicate ticket numbers', async () => {
    const result = await prisma.$queryRaw`
      SELECT "ticketNumber", COUNT(*) as count
      FROM "Ticket"
      GROUP BY "ticketNumber"
      HAVING COUNT(*) > 1
    `;
    return {
      passed: result.length === 0,
      message: `Found ${result.length} duplicate ticket numbers`,
    };
  });

  // Check 5: No duplicate contact emails
  await check('No duplicate contact emails', async () => {
    const result = await prisma.$queryRaw`
      SELECT email, COUNT(*) as count
      FROM "Contact"
      GROUP BY email
      HAVING COUNT(*) > 1
    `;
    return {
      passed: result.length === 0,
      message: `Found ${result.length} duplicate contact emails`,
    };
  });

  // Check 6: No duplicate user emails
  await check('No duplicate user/agent emails', async () => {
    const result = await prisma.$queryRaw`
      SELECT email, COUNT(*) as count
      FROM "User"
      GROUP BY email
      HAVING COUNT(*) > 1
    `;
    return {
      passed: result.length === 0,
      message: `Found ${result.length} duplicate user emails`,
    };
  });

  // Check 7: All time entries have valid tickets
  await check('All time entries have valid tickets', async () => {
    const entries = await prisma.timeEntry.findMany({
      include: {
        ticket: true,
      },
    });
    const orphaned = entries.filter(e => !e.ticket);
    return {
      passed: orphaned.length === 0,
      message: `Found ${orphaned.length} orphaned time entries`,
    };
  });

  // Check 8: All material entries have valid tickets
  await check('All material entries have valid tickets', async () => {
    const entries = await prisma.materialEntry.findMany({
      include: {
        ticket: true,
      },
    });
    const orphaned = entries.filter(e => !e.ticket);
    return {
      passed: orphaned.length === 0,
      message: `Found ${orphaned.length} orphaned material entries`,
    };
  });

  // Check 9: All devices have valid companies
  await check('All devices have valid companies', async () => {
    const devices = await prisma.device.findMany({
      include: {
        company: true,
      },
    });
    const orphaned = devices.filter(d => !d.company);
    return {
      passed: orphaned.length === 0,
      message: `Found ${orphaned.length} devices without companies`,
    };
  });

  // Check 10: Business hours has exactly 7 records (one per day)
  await check('Business hours has 7 records', async () => {
    const count = await prisma.businessHours.count();
    return {
      passed: count === 7,
      message: `Found ${count} business hours records, expected 7`,
    };
  });

  // Check 11: All SLA policies have valid priority values
  await check('All SLA policies have valid priority values', async () => {
    const policies = await prisma.sLAPolicy.findMany();
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    const invalid = policies.filter(p => !validPriorities.includes(p.appliesTo));
    return {
      passed: invalid.length === 0,
      message: `Found ${invalid.length} SLA policies with invalid priority`,
    };
  });

  // Check 12: No orphaned TicketTag records
  await check('No orphaned TicketTag records', async () => {
    const tags = await prisma.ticketTag.findMany({
      include: {
        ticket: true,
        tag: true,
      },
    });
    const orphaned = tags.filter(t => !t.ticket || !t.tag);
    return {
      passed: orphaned.length === 0,
      message: `Found ${orphaned.length} orphaned ticket-tag relations`,
    };
  });

  // Summary
  console.log('\n===========================================');
  console.log(`  RESULTS: ${passed}/${passed + failed} checks passed`);
  console.log('===========================================\n');

  if (warnings.length > 0) {
    console.log('WARNINGS:');
    warnings.forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.name}: ${w.message}`);
    });
  }

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
