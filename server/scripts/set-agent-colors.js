/**
 * Script to set agent colors in the database
 * Run with: node scripts/set-agent-colors.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Agent color assignments
const AGENT_COLORS = {
  'Peter Braley': '#2563EB',  // Blue
  'Sam Braley': '#DC2626',    // Red
  'Chris Lowrance': '#FBF12B', // Yellow
  'Tech 1': '#000000',        // Black (scheduling-only)
  'Tech 2': '#8B5CF6',        // Purple/Violet (scheduling-only)
};

async function setAgentColors() {
  console.log('Setting agent colors...\n');

  // Get all agents
  const agents = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'AGENT'] },
    },
    select: { id: true, name: true, color: true },
  });

  console.log(`Found ${agents.length} agents:\n`);

  for (const agent of agents) {
    const assignedColor = AGENT_COLORS[agent.name];

    if (assignedColor && agent.color !== assignedColor) {
      await prisma.user.update({
        where: { id: agent.id },
        data: { color: assignedColor },
      });
      console.log(`  ✓ ${agent.name}: ${agent.color || 'none'} → ${assignedColor}`);
    } else if (assignedColor) {
      console.log(`  - ${agent.name}: already set to ${agent.color}`);
    } else {
      console.log(`  ? ${agent.name}: no color mapping defined (current: ${agent.color || 'none'})`);
    }
  }

  console.log('\nDone!');
}

setAgentColors()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
