/**
 * Script to fix "Paul Braley" -> "Peter Braley" name typo in database
 * Run with: node scripts/fix-peter-braley-name.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPeterBraleyName() {
  console.log('Searching for user with name "Paul Braley"...');

  // Find user by email or name
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { name: 'Paul Braley' },
        { email: 'pbraley@nadc.com' },
      ],
    },
  });

  if (!user) {
    console.log('User not found. Checking all users...');
    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, email: true },
    });
    console.log('Current users:', allUsers);
    return;
  }

  console.log(`Found user: ${user.name} (${user.email})`);

  if (user.name === 'Peter Braley') {
    console.log('Name is already correct. No update needed.');
    return;
  }

  // Update the name
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name: 'Peter Braley' },
  });

  console.log(`Updated user name from "${user.name}" to "${updated.name}"`);
  console.log('Done!');
}

fixPeterBraleyName()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
