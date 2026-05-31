const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const admins = [
  { name: 'Sam Braley', email: 'sbraley@nadc.com', password: 'Nadc2024!Admin' },
  { name: 'Chris Lowrance', email: 'clowrance@nadc.com', password: 'Nadc2024!Admin' },
  { name: 'Peter Braley', email: 'pbraley@nadc.com', password: 'Nadc2024!Admin' },
];

async function main() {
  console.log('Creating admin accounts...\n');

  const createdAccounts = [];

  for (const admin of admins) {
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: admin.email },
    });

    if (existing) {
      console.log(`User ${admin.email} already exists - skipping`);
      createdAccounts.push({ ...admin, status: 'existing' });
      continue;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(admin.password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name: admin.name,
        email: admin.email,
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
      },
    });

    console.log(`Created admin: ${user.name} (${user.email})`);
    createdAccounts.push({ ...admin, status: 'created', id: user.id });
  }

  // Update email settings in AppSetting table
  console.log('\nConfiguring email settings...');

  // Update or create company_name setting
  await prisma.appSetting.upsert({
    where: { key: 'company_name' },
    update: { value: 'NADC Support' },
    create: {
      key: 'company_name',
      value: 'NADC Support',
      description: 'Company name shown in emails',
    },
  });
  console.log('Set company_name to "NADC Support"');

  // Update or create SMTP from settings
  await prisma.appSetting.upsert({
    where: { key: 'smtp_from' },
    update: { value: 'tech@nadc.com' },
    create: {
      key: 'smtp_from',
      value: 'tech@nadc.com',
      description: 'Email address for outbound notifications',
    },
  });
  console.log('Set smtp_from to "tech@nadc.com"');

  console.log('\n' + '='.repeat(60));
  console.log('SETUP COMPLETE');
  console.log('='.repeat(60));
  console.log('\nAdmin Accounts Created:');
  console.log('-'.repeat(60));

  for (const account of createdAccounts) {
    console.log(`  Name:     ${account.name}`);
    console.log(`  Email:    ${account.email}`);
    console.log(`  Password: ${account.password}`);
    console.log(`  Role:     ADMIN`);
    console.log(`  Status:   ${account.status === 'created' ? 'CREATED' : 'Already existed'}`);
    console.log('-'.repeat(60));
  }

  console.log('\nEmail Settings:');
  console.log('  From Address: tech@nadc.com');
  console.log('  From Name:    NADC Support');
  console.log('\nNote: SMTP server credentials must be configured in .env file.');
}

main()
  .catch((e) => {
    console.error('Setup error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
