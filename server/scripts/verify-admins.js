const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log('\nAdmin Users in Database:');
  console.log('='.repeat(70));

  for (const admin of admins) {
    console.log(`ID:       ${admin.id}`);
    console.log(`Name:     ${admin.name}`);
    console.log(`Email:    ${admin.email}`);
    console.log(`Role:     ${admin.role}`);
    console.log(`Active:   ${admin.isActive}`);
    console.log(`Created:  ${admin.createdAt}`);
    console.log('-'.repeat(70));
  }

  console.log(`\nTotal admin accounts: ${admins.length}`);

  // Check email settings
  const settings = await prisma.appSetting.findMany({
    where: {
      key: { in: ['smtp_from', 'company_name', 'smtp_host', 'smtp_user'] },
    },
  });

  console.log('\nEmail Configuration:');
  console.log('='.repeat(70));
  for (const setting of settings) {
    console.log(`${setting.key}: ${setting.value}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
