/**
 * One-time script to add Tech 1 and Tech 2 as scheduling-only users.
 *
 * These users:
 * - Appear in all assignee dropdowns
 * - Can be assigned to tickets and calendar events
 * - Have calendar colors assigned
 * - CANNOT log in (password is an impossible-to-guess bcrypt hash)
 *
 * Usage: node server/scripts/add-scheduling-techs.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Generate an impossible-to-guess password
// Uses 64 random bytes converted to hex = 128 character random string
const generateImpossiblePassword = () => {
  return crypto.randomBytes(64).toString('hex');
};

const SCHEDULING_TECHS = [
  {
    name: 'Tech 1',
    email: 'tech1@scheduling.internal',
    color: '#6366F1', // Indigo
  },
  {
    name: 'Tech 2',
    email: 'tech2@scheduling.internal',
    color: '#8B5CF6', // Purple/Violet
  },
];

async function main() {
  console.log('Adding scheduling-only tech users...\n');

  for (const tech of SCHEDULING_TECHS) {
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: tech.email },
    });

    if (existing) {
      console.log(`[SKIP] ${tech.name} already exists (${tech.email})`);

      // Update color if not set
      if (!existing.color) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { color: tech.color },
        });
        console.log(`  -> Updated color to ${tech.color}`);
      }
      continue;
    }

    // Generate impossible password and hash it
    const impossiblePassword = generateImpossiblePassword();
    const hashedPassword = await bcrypt.hash(impossiblePassword, 10);

    // Create the user
    const user = await prisma.user.create({
      data: {
        name: tech.name,
        email: tech.email,
        password: hashedPassword,
        role: 'AGENT',
        color: tech.color,
        isActive: true,
        availability: 'ONLINE',
      },
    });

    console.log(`[CREATED] ${tech.name}`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${tech.email}`);
    console.log(`  Color: ${tech.color}`);
    console.log(`  Role: AGENT`);
    console.log(`  Login: DISABLED (impossible password)\n`);
  }

  console.log('\nDone! Tech 1 and Tech 2 are now available in all assignee dropdowns.');
  console.log('They can be assigned to tickets and calendar events.');
  console.log('They CANNOT log in to the system.\n');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
