require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  const keepEmail = 'sbraley@nadc.com';

  console.log(`\nCleaning all test data, keeping user: ${keepEmail}\n`);

  // Get the user to keep
  const keepUser = await prisma.user.findUnique({ where: { email: keepEmail } });
  if (!keepUser) {
    console.error(`User ${keepEmail} not found!`);
    process.exit(1);
  }

  // Delete in order respecting foreign keys
  console.log('Deleting satisfaction ratings...');
  await prisma.satisfactionRating.deleteMany();

  console.log('Deleting ticket devices...');
  await prisma.ticketDevice.deleteMany();

  console.log('Deleting ticket checklist items...');
  await prisma.ticketChecklistItem.deleteMany();

  console.log('Deleting material entries...');
  await prisma.materialEntry.deleteMany();

  console.log('Deleting time entries...');
  await prisma.timeEntry.deleteMany();

  console.log('Deleting custom field values...');
  await prisma.customFieldValue.deleteMany();

  console.log('Deleting notifications...');
  await prisma.notification.deleteMany();

  console.log('Deleting ticket watchers...');
  await prisma.ticketWatcher.deleteMany();

  console.log('Deleting related tickets...');
  await prisma.relatedTicket.deleteMany();

  console.log('Deleting ticket tags...');
  await prisma.ticketTag.deleteMany();

  console.log('Deleting ticket attachments...');
  await prisma.ticketAttachment.deleteMany();

  console.log('Deleting ticket activities...');
  await prisma.ticketActivity.deleteMany();

  console.log('Deleting ticket replies...');
  await prisma.ticketReply.deleteMany();

  console.log('Deleting tickets...');
  await prisma.ticket.deleteMany();

  console.log('Deleting recurring schedules...');
  await prisma.recurringSchedule.deleteMany();

  console.log('Deleting template checklist items...');
  await prisma.templateChecklistItem.deleteMany();

  console.log('Deleting ticket templates...');
  await prisma.ticketTemplate.deleteMany();

  console.log('Deleting KB articles...');
  await prisma.kBArticle.deleteMany();

  console.log('Deleting KB categories...');
  await prisma.kBCategory.deleteMany();

  console.log('Deleting canned responses...');
  await prisma.cannedResponse.deleteMany();

  console.log('Deleting devices...');
  await prisma.device.deleteMany();

  console.log('Deleting contacts...');
  await prisma.contact.deleteMany();

  console.log('Deleting companies...');
  await prisma.company.deleteMany();

  console.log('Deleting user groups...');
  await prisma.userGroup.deleteMany();

  console.log('Deleting groups...');
  await prisma.group.deleteMany();

  console.log('Deleting tags...');
  await prisma.tag.deleteMany();

  console.log('Deleting custom fields...');
  await prisma.customField.deleteMany();

  console.log('Deleting SLA policies...');
  await prisma.sLAPolicy.deleteMany();

  console.log('Deleting automation rules...');
  await prisma.automationRule.deleteMany();

  console.log(`Deleting users (except ${keepEmail})...`);
  await prisma.user.deleteMany({
    where: { email: { not: keepEmail } }
  });

  console.log('\n✓ Cleanup complete!\n');

  // Show what's left
  const userCount = await prisma.user.count();
  console.log(`Remaining users: ${userCount}`);
}

cleanup()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
