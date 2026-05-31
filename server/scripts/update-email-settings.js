const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Updating email settings...\n');

  // Update smtp_from
  await prisma.appSetting.upsert({
    where: { key: 'smtp_from' },
    update: { value: 'tickets@nadc.com' },
    create: {
      key: 'smtp_from',
      value: 'tickets@nadc.com',
      description: 'Email address for outbound notifications',
    },
  });
  console.log('Updated smtp_from: tickets@nadc.com');

  // Update company_name (display name in emails)
  await prisma.appSetting.upsert({
    where: { key: 'company_name' },
    update: { value: 'NADC Tickets' },
    create: {
      key: 'company_name',
      value: 'NADC Tickets',
      description: 'Company name shown in emails',
    },
  });
  console.log('Updated company_name: NADC Tickets');

  // Verify settings
  const settings = await prisma.appSetting.findMany({
    where: { key: { in: ['smtp_from', 'company_name'] } },
  });

  console.log('\nCurrent email settings:');
  console.log('='.repeat(50));
  for (const s of settings) {
    console.log(`  ${s.key}: ${s.value}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
