// Temporary script to check for potential duplicate tickets
// Run with: node server/scripts/check-duplicate-tickets.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDuplicates() {
  console.log('Checking for potential duplicate tickets...\n');

  // Get tickets from the last 7 days, grouped by contact
  const recentTickets = await prisma.ticket.findMany({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
    select: {
      id: true,
      ticketNumber: true,
      subject: true,
      description: true,
      createdAt: true,
      requesterId: true,
      requester: {
        select: { name: true, email: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${recentTickets.length} tickets in the last 7 days.\n`);

  // Find tickets created within 60 seconds of each other with the same requester
  const potentialDuplicates = [];

  for (let i = 0; i < recentTickets.length; i++) {
    for (let j = i + 1; j < recentTickets.length; j++) {
      const t1 = recentTickets[i];
      const t2 = recentTickets[j];

      // Same requester
      if (t1.requesterId !== t2.requesterId) continue;

      // Created within 60 seconds of each other
      const timeDiff = Math.abs(t2.createdAt.getTime() - t1.createdAt.getTime());
      if (timeDiff > 60000) continue;

      // Similar subject (check if one is substring of the other or >80% similar)
      const subjectSimilar =
        t1.subject === t2.subject ||
        t1.subject.includes(t2.subject) ||
        t2.subject.includes(t1.subject);

      potentialDuplicates.push({
        ticket1: {
          id: t1.id,
          ticketNumber: t1.ticketNumber,
          subject: t1.subject,
          createdAt: t1.createdAt.toISOString(),
          requester: t1.requester?.name || t1.requesterId,
        },
        ticket2: {
          id: t2.id,
          ticketNumber: t2.ticketNumber,
          subject: t2.subject,
          createdAt: t2.createdAt.toISOString(),
          requester: t2.requester?.name || t2.requesterId,
        },
        timeDiffSeconds: Math.round(timeDiff / 1000),
        subjectMatch: subjectSimilar ? 'EXACT/SIMILAR' : 'DIFFERENT',
      });
    }
  }

  if (potentialDuplicates.length === 0) {
    console.log('No potential duplicate tickets found.');
  } else {
    console.log(`Found ${potentialDuplicates.length} potential duplicate pairs:\n`);
    for (const dup of potentialDuplicates) {
      console.log('--- Potential Duplicate ---');
      console.log(`Ticket 1: #${dup.ticket1.ticketNumber} - "${dup.ticket1.subject}"`);
      console.log(`  Created: ${dup.ticket1.createdAt}`);
      console.log(`  Contact: ${dup.ticket1.requester}`);
      console.log(`Ticket 2: #${dup.ticket2.ticketNumber} - "${dup.ticket2.subject}"`);
      console.log(`  Created: ${dup.ticket2.createdAt}`);
      console.log(`  Contact: ${dup.ticket2.requester}`);
      console.log(`Time difference: ${dup.timeDiffSeconds} seconds`);
      console.log(`Subject match: ${dup.subjectMatch}`);
      console.log('');
    }
  }

  await prisma.$disconnect();
}

checkDuplicates().catch((err) => {
  console.error('Error:', err);
  prisma.$disconnect();
  process.exit(1);
});
