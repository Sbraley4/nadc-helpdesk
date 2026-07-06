const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Count and sample CLOSED tickets
  console.log('=== 1. CLOSED TICKETS ===');
  const closedCount = await prisma.ticket.count({ where: { status: 'CLOSED' } });
  console.log('Total CLOSED tickets:', closedCount);

  const closedSamples = await prisma.ticket.findMany({
    where: { status: 'CLOSED' },
    select: { ticketNumber: true, subject: true, status: true, closedAt: true },
    take: 10,
    orderBy: { ticketNumber: 'desc' }
  });
  console.log('\nSample CLOSED tickets (10 most recent):');
  closedSamples.forEach(t => {
    console.log('  #' + t.ticketNumber + ' | ' + t.status + ' | closedAt: ' + (t.closedAt ? t.closedAt.toISOString() : 'NULL') + ' | ' + t.subject.substring(0, 50));
  });

  // 2. Automation rules referencing CLOSED
  console.log('\n=== 2. AUTOMATION RULES REFERENCING CLOSED ===');
  const allRules = await prisma.automationRule.findMany({
    select: { id: true, name: true, conditions: true, actions: true, isActive: true }
  });

  const closedRules = allRules.filter(rule => {
    const str = JSON.stringify(rule.conditions) + JSON.stringify(rule.actions);
    return str.includes('CLOSED');
  });

  console.log('Total automation rules:', allRules.length);
  console.log('Rules referencing CLOSED:', closedRules.length);

  closedRules.forEach(rule => {
    console.log('\n  Rule ID:', rule.id);
    console.log('  Name:', rule.name);
    console.log('  Active:', rule.isActive);
    console.log('  Conditions:', JSON.stringify(rule.conditions, null, 2));
    console.log('  Actions:', JSON.stringify(rule.actions, null, 2));
  });

  // 3. CLOSED tickets with NULL closedAt
  console.log('\n=== 3. CLOSED TICKETS WITH NULL closedAt ===');
  const nullClosedAtCount = await prisma.ticket.count({
    where: { status: 'CLOSED', closedAt: null }
  });
  console.log('Count of CLOSED tickets with NULL closedAt:', nullClosedAtCount);

  if (nullClosedAtCount > 0) {
    const nullSamples = await prisma.ticket.findMany({
      where: { status: 'CLOSED', closedAt: null },
      select: { ticketNumber: true, subject: true, status: true, closedAt: true, updatedAt: true },
      take: 5
    });
    console.log('\nSample rows:');
    nullSamples.forEach(t => {
      console.log('  #' + t.ticketNumber + ' | closedAt: NULL | updatedAt: ' + t.updatedAt.toISOString() + ' | ' + t.subject.substring(0, 40));
    });
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
