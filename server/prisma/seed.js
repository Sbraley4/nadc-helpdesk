const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Clear existing data in correct order (respecting foreign keys)
  // Phase 8 tables
  await prisma.kBArticle.deleteMany();
  await prisma.kBCategory.deleteMany();

  // Phase 5b tables
  await prisma.satisfactionRating.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.materialEntry.deleteMany();
  await prisma.ticketChecklistItem.deleteMany();
  await prisma.ticketDevice.deleteMany();
  await prisma.recurringSchedule.deleteMany();
  await prisma.templateChecklistItem.deleteMany();
  await prisma.ticketTemplate.deleteMany();
  await prisma.device.deleteMany();
  await prisma.appSetting.deleteMany();

  // Original tables
  await prisma.ticketActivity.deleteMany();
  await prisma.ticketAttachment.deleteMany();
  await prisma.ticketReply.deleteMany();
  await prisma.ticketTag.deleteMany();
  await prisma.ticketWatcher.deleteMany();
  await prisma.relatedTicket.deleteMany();
  await prisma.customFieldValue.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.userGroup.deleteMany();
  await prisma.cannedResponse.deleteMany();
  await prisma.user.deleteMany();
  await prisma.group.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.sLAPolicy.deleteMany();
  await prisma.businessHours.deleteMany();
  await prisma.customField.deleteMany();

  console.log('Cleared existing data');

  // Create Users
  const hashedAdminPassword = await bcrypt.hash('Admin1234!', 10);
  const hashedAgentPassword = await bcrypt.hash('Agent1234!', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Sam Admin',
      email: 'sam@nadc.com',
      password: hashedAdminPassword,
      role: 'ADMIN',
    },
  });
  console.log('Created admin:', admin.email);

  const agent1 = await prisma.user.create({
    data: {
      name: 'Tech One',
      email: 'tech1@nadc.com',
      password: hashedAgentPassword,
      role: 'AGENT',
    },
  });
  console.log('Created agent:', agent1.email);

  const agent2 = await prisma.user.create({
    data: {
      name: 'Tech Two',
      email: 'tech2@nadc.com',
      password: hashedAgentPassword,
      role: 'AGENT',
    },
  });
  console.log('Created agent:', agent2.email);

  // Create Group
  const group = await prisma.group.create({
    data: {
      name: 'Tier 1 Support',
      description: 'First level technical support',
    },
  });
  console.log('Created group:', group.name);

  // Add agents to group
  await prisma.userGroup.createMany({
    data: [
      { userId: agent1.id, groupId: group.id },
      { userId: agent2.id, groupId: group.id },
    ],
  });
  console.log('Added agents to group');

  // Create Tags
  const tagMicrosoft = await prisma.tag.create({
    data: { name: 'microsoft-365', color: '#0078D4' },
  });
  const tagNetworking = await prisma.tag.create({
    data: { name: 'networking', color: '#1B2A4A' },
  });
  const tagVoip = await prisma.tag.create({
    data: { name: 'voip', color: '#E63946' },
  });
  console.log('Created 3 tags');

  // Create SLA Policies
  const slaLow = await prisma.sLAPolicy.create({
    data: {
      name: 'Low Priority SLA',
      firstResponseHours: 8,
      resolutionHours: 48,
      appliesTo: 'LOW',
      businessHoursOnly: true,
    },
  });
  const slaMedium = await prisma.sLAPolicy.create({
    data: {
      name: 'Medium Priority SLA',
      firstResponseHours: 4,
      resolutionHours: 24,
      appliesTo: 'MEDIUM',
      businessHoursOnly: true,
    },
  });
  const slaHigh = await prisma.sLAPolicy.create({
    data: {
      name: 'High Priority SLA',
      firstResponseHours: 2,
      resolutionHours: 8,
      appliesTo: 'HIGH',
      businessHoursOnly: true,
    },
  });
  const slaUrgent = await prisma.sLAPolicy.create({
    data: {
      name: 'Urgent Priority SLA',
      firstResponseHours: 1,
      resolutionHours: 4,
      appliesTo: 'URGENT',
      businessHoursOnly: true,
    },
  });
  console.log('Created 4 SLA policies');

  // Create Business Hours (Mon-Fri 9-5, Sat-Sun closed)
  const businessHours = await prisma.businessHours.createMany({
    data: [
      { dayOfWeek: 0, isOpen: false, openTime: null, closeTime: null }, // Sunday
      { dayOfWeek: 1, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Monday
      { dayOfWeek: 2, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Tuesday
      { dayOfWeek: 3, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Wednesday
      { dayOfWeek: 4, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Thursday
      { dayOfWeek: 5, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Friday
      { dayOfWeek: 6, isOpen: false, openTime: null, closeTime: null }, // Saturday
    ],
  });
  console.log('Created', businessHours.count, 'business hours entries');

  // Create Companies
  const acmeCorp = await prisma.company.create({
    data: {
      name: 'Acme Corp',
      domain: 'acmecorp.com',
      notes: 'Large enterprise client',
    },
  });
  const techFirm = await prisma.company.create({
    data: {
      name: 'Tech Firm LLC',
      domain: 'techfirm.com',
      notes: 'Technology consulting company',
    },
  });
  console.log('Created 2 companies');

  // Create Contacts
  const johnSmith = await prisma.contact.create({
    data: {
      name: 'John Smith',
      email: 'john@acmecorp.com',
      phone: '555-0101',
      companyId: acmeCorp.id,
    },
  });
  const sarahLee = await prisma.contact.create({
    data: {
      name: 'Sarah Lee',
      email: 'sarah@techfirm.com',
      phone: '555-0102',
      companyId: techFirm.id,
    },
  });
  console.log('Created 2 contacts');

  // Create Sample Tickets
  // Ticket 1: Email not syncing on iPhone
  const ticket1 = await prisma.ticket.create({
    data: {
      subject: 'Email not syncing on iPhone',
      description: 'User reports that their Microsoft 365 email is not syncing on their iPhone. They have tried restarting the device but the issue persists.',
      priority: 'HIGH',
      type: 'INCIDENT',
      status: 'OPEN',
      requesterId: johnSmith.id,
      companyId: acmeCorp.id,
      assigneeId: agent1.id,
      groupId: group.id,
      slaPolicyId: slaHigh.id,
      firstResponseAt: new Date(),
    },
  });
  await prisma.ticketTag.create({
    data: { ticketId: ticket1.id, tagId: tagMicrosoft.id },
  });
  await prisma.ticketActivity.create({
    data: {
      ticketId: ticket1.id,
      type: 'ticket_created',
      description: 'Ticket created',
      userId: admin.id,
    },
  });
  console.log('Created ticket #1:', ticket1.subject);

  // Ticket 2: Wi-Fi dropping in conference room
  const ticket2 = await prisma.ticket.create({
    data: {
      subject: 'Wi-Fi dropping in conference room',
      description: 'The Wi-Fi connection in the main conference room keeps dropping during video calls. This has been happening for the past week.',
      priority: 'MEDIUM',
      type: 'PROBLEM',
      status: 'OPEN',
      requesterId: sarahLee.id,
      companyId: techFirm.id,
      assigneeId: agent2.id,
      groupId: group.id,
      slaPolicyId: slaMedium.id,
      firstResponseAt: new Date(),
    },
  });
  await prisma.ticketTag.create({
    data: { ticketId: ticket2.id, tagId: tagNetworking.id },
  });
  await prisma.ticketActivity.create({
    data: {
      ticketId: ticket2.id,
      type: 'ticket_created',
      description: 'Ticket created',
      userId: admin.id,
    },
  });
  console.log('Created ticket #2:', ticket2.subject);

  // Ticket 3: VoIP calls cutting out
  const ticket3 = await prisma.ticket.create({
    data: {
      subject: 'VoIP calls cutting out',
      description: 'VoIP calls are cutting out intermittently. Callers report that they can hear the employee but the employee cannot hear them.',
      priority: 'URGENT',
      type: 'INCIDENT',
      status: 'PENDING',
      requesterId: johnSmith.id,
      companyId: acmeCorp.id,
      groupId: group.id,
      slaPolicyId: slaUrgent.id,
    },
  });
  await prisma.ticketTag.create({
    data: { ticketId: ticket3.id, tagId: tagVoip.id },
  });
  await prisma.ticketActivity.create({
    data: {
      ticketId: ticket3.id,
      type: 'ticket_created',
      description: 'Ticket created',
      userId: admin.id,
    },
  });
  console.log('Created ticket #3:', ticket3.subject);

  // Ticket 4: New employee laptop setup
  const ticket4 = await prisma.ticket.create({
    data: {
      subject: 'New employee laptop setup',
      description: 'New employee starting next Monday. Need laptop configured with standard software suite and email access.',
      priority: 'LOW',
      type: 'FEATURE_REQUEST',
      status: 'RESOLVED',
      requesterId: sarahLee.id,
      companyId: techFirm.id,
      assigneeId: agent1.id,
      groupId: group.id,
      slaPolicyId: slaLow.id,
      firstResponseAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      resolvedAt: new Date(),
    },
  });
  await prisma.ticketActivity.create({
    data: {
      ticketId: ticket4.id,
      type: 'ticket_created',
      description: 'Ticket created',
      userId: admin.id,
    },
  });
  await prisma.ticketActivity.create({
    data: {
      ticketId: ticket4.id,
      type: 'status_changed',
      description: 'Status changed from OPEN to RESOLVED',
      userId: agent1.id,
    },
  });
  console.log('Created ticket #4:', ticket4.subject);

  // Ticket 5: Printer offline on 2nd floor
  const ticket5 = await prisma.ticket.create({
    data: {
      subject: 'Printer offline on 2nd floor',
      description: 'The shared printer on the 2nd floor is showing as offline. Users cannot print documents.',
      priority: 'MEDIUM',
      type: 'INCIDENT',
      status: 'OPEN',
      requesterId: johnSmith.id,
      companyId: acmeCorp.id,
      slaPolicyId: slaMedium.id,
    },
  });
  await prisma.ticketActivity.create({
    data: {
      ticketId: ticket5.id,
      type: 'ticket_created',
      description: 'Ticket created',
      userId: admin.id,
    },
  });
  console.log('Created ticket #5:', ticket5.subject);

  // Create Canned Responses
  await prisma.cannedResponse.create({
    data: {
      title: 'Acknowledge receipt',
      tags: ['general'],
      body: `Hi {{requester_name}},

Thank you for reaching out to NADC support. We've received your request (#{{ticket_id}}) and will be in touch shortly.

Best regards,
{{agent_name}}`,
      createdById: admin.id,
    },
  });

  await prisma.cannedResponse.create({
    data: {
      title: 'Request more information',
      tags: ['general'],
      body: `Hi {{requester_name}},

To help resolve your issue faster, could you please provide the following additional details?

- [detail 1]
- [detail 2]

Thank you,
{{agent_name}}`,
      createdById: admin.id,
    },
  });

  await prisma.cannedResponse.create({
    data: {
      title: 'Issue resolved — please confirm',
      tags: ['resolution'],
      body: `Hi {{requester_name}},

We believe we've resolved your issue with ticket #{{ticket_id}}. Could you please confirm everything is working on your end?

If you have any further questions, don't hesitate to reply.

Best regards,
{{agent_name}}
NADC Support`,
      createdById: admin.id,
    },
  });

  await prisma.cannedResponse.create({
    data: {
      title: 'Scheduled maintenance notice',
      tags: ['maintenance'],
      body: `Hi {{requester_name}},

Please be advised that we will be performing scheduled maintenance which may affect your services. We will keep you updated on progress.

Apologies for any inconvenience.

{{agent_name}}`,
      createdById: admin.id,
    },
  });
  console.log('Created 4 canned responses');

  // Create Default App Settings
  const defaultSettings = [
    {
      key: 'google_review_url',
      value: process.env.GOOGLE_REVIEW_URL || '',
      description: 'Google Business review link',
    },
    {
      key: 'review_cooldown_days',
      value: process.env.REVIEW_COOLDOWN_DAYS || '90',
      description: 'Days between review requests per contact',
    },
    {
      key: 'review_send_delay_hours',
      value: process.env.REVIEW_SEND_DELAY_HOURS || '24',
      description: 'Hours after ticket close before sending review request',
    },
    {
      key: 'company_name',
      value: 'NADC',
      description: 'Company name shown in emails',
    },
    {
      key: 'helpdesk_url',
      value: process.env.CLIENT_URL || 'http://localhost:5173',
      description: 'Public URL of this helpdesk',
    },
  ];

  for (const setting of defaultSettings) {
    await prisma.appSetting.create({ data: setting });
  }
  console.log('Created', defaultSettings.length, 'default app settings');

  // Create Sample Devices
  const acmeDesktop = await prisma.device.create({
    data: {
      name: "John's Desktop",
      type: 'DESKTOP',
      make: 'Dell',
      model: 'OptiPlex 7080',
      serialNumber: 'DELL-123456',
      operatingSystem: 'Windows 11 Pro',
      ipAddress: '192.168.1.101',
      companyId: acmeCorp.id,
    },
  });

  const acmeLaptop = await prisma.device.create({
    data: {
      name: "Sarah's Laptop",
      type: 'LAPTOP',
      make: 'Lenovo',
      model: 'ThinkPad X1 Carbon',
      serialNumber: 'LEN-789012',
      operatingSystem: 'Windows 11 Pro',
      companyId: techFirm.id,
    },
  });

  const acmePrinter = await prisma.device.create({
    data: {
      name: '2nd Floor Printer',
      type: 'PRINTER',
      make: 'HP',
      model: 'LaserJet Pro M428',
      serialNumber: 'HP-PRINTER-001',
      ipAddress: '192.168.1.200',
      companyId: acmeCorp.id,
    },
  });

  const acmeRouter = await prisma.device.create({
    data: {
      name: 'Main Office Router',
      type: 'ROUTER',
      make: 'Cisco',
      model: 'RV340',
      serialNumber: 'CISCO-RT-001',
      ipAddress: '192.168.1.1',
      companyId: acmeCorp.id,
    },
  });
  console.log('Created 4 sample devices');

  // Link printer device to ticket5
  await prisma.ticketDevice.create({
    data: {
      ticketId: ticket5.id,
      deviceId: acmePrinter.id,
    },
  });
  console.log('Linked printer to ticket #5');

  // Create a Sample Template
  const monthlyPatchTemplate = await prisma.ticketTemplate.create({
    data: {
      name: 'Monthly Patch Check',
      subject: 'Monthly Security Patch Verification',
      description: 'Perform monthly security patch verification and apply any pending Windows updates.',
      priority: 'MEDIUM',
      type: 'INCIDENT',
      assigneeId: agent1.id,
      groupId: group.id,
      tags: ['maintenance', 'security'],
      createdById: admin.id,
      checklistItems: {
        create: [
          { label: 'Check Windows Update status', order: 0 },
          { label: 'Review pending updates', order: 1 },
          { label: 'Apply critical security patches', order: 2 },
          { label: 'Restart if required', order: 3 },
          { label: 'Verify system stability', order: 4 },
        ],
      },
    },
  });

  // Add recurring schedule to template
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  nextMonth.setHours(9, 0, 0, 0);

  await prisma.recurringSchedule.create({
    data: {
      templateId: monthlyPatchTemplate.id,
      frequency: 'MONTHLY',
      dayOfMonth: 1,
      startDate: new Date(),
      nextRunAt: nextMonth,
    },
  });
  console.log('Created sample ticket template with recurring schedule');

  // Clear existing automation rules
  await prisma.automationRule.deleteMany();

  // Create default automation rules
  const rule1 = await prisma.automationRule.create({
    data: {
      name: 'Auto-assign urgent tickets to Tier 1',
      trigger: 'TICKET_CREATED',
      conditions: [
        { field: 'priority', operator: 'is', value: 'URGENT' },
      ],
      actions: [
        { type: 'assign_group', value: group.id },
        { type: 'add_tag', value: 'urgent' },
      ],
      runOrder: 1,
      isActive: true,
    },
  });
  console.log('Created automation rule:', rule1.name);

  const rule2 = await prisma.automationRule.create({
    data: {
      name: 'Close stale resolved tickets',
      trigger: 'TIME_BASED',
      conditions: [
        { field: 'status', operator: 'is', value: 'RESOLVED' },
        { field: 'ticketAgeDays', operator: 'greater_than', value: '7' },
      ],
      actions: [
        { type: 'set_status', value: 'CLOSED' },
      ],
      runOrder: 2,
      isActive: true,
    },
  });
  console.log('Created automation rule:', rule2.name);

  const rule3 = await prisma.automationRule.create({
    data: {
      name: 'Flag overdue open tickets',
      trigger: 'TIME_BASED',
      conditions: [
        { field: 'status', operator: 'is', value: 'OPEN' },
        { field: 'ticketAgeDays', operator: 'greater_than', value: '3' },
      ],
      actions: [
        { type: 'set_priority', value: 'HIGH' },
        { type: 'add_tag', value: 'overdue' },
      ],
      runOrder: 3,
      isActive: true,
    },
  });
  console.log('Created automation rule:', rule3.name);

  // Phase 8: Knowledge Base Categories
  const kbGettingStarted = await prisma.kBCategory.create({
    data: {
      name: 'Getting Started',
      slug: 'getting-started',
      description: 'Basic guides to help you get started with our support system',
      order: 1,
    },
  });

  const kbMicrosoft365 = await prisma.kBCategory.create({
    data: {
      name: 'Microsoft 365',
      slug: 'microsoft-365',
      description: 'Guides and troubleshooting for Microsoft 365 applications',
      order: 2,
    },
  });

  const kbNetworkWifi = await prisma.kBCategory.create({
    data: {
      name: 'Network & Wi-Fi',
      slug: 'network-wifi',
      description: 'Network connectivity and Wi-Fi troubleshooting guides',
      order: 3,
    },
  });

  const kbVoipPhones = await prisma.kBCategory.create({
    data: {
      name: 'VoIP & Phones',
      slug: 'voip-phones',
      description: 'Voice over IP and phone system documentation',
      order: 4,
    },
  });
  console.log('Created 4 KB categories');

  // Phase 8: Knowledge Base Articles
  await prisma.kBArticle.create({
    data: {
      title: 'How to Submit a Support Ticket',
      slug: 'how-to-submit-support-ticket',
      body: `# How to Submit a Support Ticket

Follow these steps to submit a support ticket through our portal:

## Step 1: Log In
Log into the client portal using your email and password.

## Step 2: Navigate to Tickets
Click on "My Tickets" in the navigation menu.

## Step 3: Create New Ticket
Click the "New Ticket" button in the top right corner.

## Step 4: Fill Out the Form
- **Subject**: Provide a brief summary of your issue
- **Description**: Describe your problem in detail
- **Priority**: Select the appropriate urgency level

## Step 5: Submit
Click "Submit Ticket" to create your request. You'll receive a confirmation email with your ticket number.

---
Need help? Contact us at support@nadc.com`,
      categoryId: kbGettingStarted.id,
      authorId: admin.id,
      isPublished: true,
      
    },
  });

  await prisma.kBArticle.create({
    data: {
      title: 'Setting Up Email on Your iPhone',
      slug: 'setting-up-email-iphone',
      body: `# Setting Up Email on Your iPhone

This guide will help you configure Microsoft 365 email on your iPhone.

## Prerequisites
- Your Microsoft 365 email address
- Your password
- iPhone running iOS 14 or later

## Steps

### 1. Open Settings
Go to **Settings > Mail > Accounts > Add Account**

### 2. Select Microsoft Exchange
Choose "Microsoft Exchange" from the list of email providers.

### 3. Enter Your Credentials
- **Email**: Enter your full email address
- **Description**: Give your account a name (e.g., "Work Email")

### 4. Sign In
You'll be redirected to Microsoft's sign-in page. Enter your password and complete any multi-factor authentication.

### 5. Choose What to Sync
Select which items to sync:
- Mail
- Contacts
- Calendars
- Reminders

### 6. Save
Tap "Save" to complete the setup.

## Troubleshooting
If email isn't syncing:
1. Check your internet connection
2. Verify your password is correct
3. Remove and re-add the account

---
Still having issues? Submit a support ticket.`,
      categoryId: kbMicrosoft365.id,
      authorId: admin.id,
      isPublished: true,
      
    },
  });

  await prisma.kBArticle.create({
    data: {
      title: 'Troubleshooting Wi-Fi Connection Issues',
      slug: 'troubleshooting-wifi-issues',
      body: `# Troubleshooting Wi-Fi Connection Issues

Having trouble connecting to Wi-Fi? Follow these steps to diagnose and fix common issues.

## Quick Fixes

### 1. Restart Your Device
Turn your device off and back on. This resolves most temporary connectivity issues.

### 2. Forget and Reconnect
1. Go to your Wi-Fi settings
2. Find your network and select "Forget"
3. Reconnect by entering the password again

### 3. Restart the Router
If multiple devices are affected:
1. Unplug the router power cable
2. Wait 30 seconds
3. Plug it back in
4. Wait 2-3 minutes for full restart

## Advanced Troubleshooting

### Check for Interference
- Move closer to the router
- Reduce obstacles between your device and router
- Check for interfering devices (microwaves, cordless phones)

### Verify Network Settings
Make sure you're connecting to the correct network (5GHz vs 2.4GHz).

### Check for Outages
Contact your IT department to verify there are no network maintenance or outages.

---
If issues persist, please submit a support ticket with details about your device and location.`,
      categoryId: kbNetworkWifi.id,
      authorId: admin.id,
      isPublished: true,
      
    },
  });

  await prisma.kBArticle.create({
    data: {
      title: 'Using Your VoIP Phone System',
      slug: 'using-voip-phone-system',
      body: `# Using Your VoIP Phone System

Learn how to use the basic features of your VoIP phone.

## Making Calls

### Internal Calls
- Dial the extension number directly (e.g., 1001)
- Press the green call button

### External Calls
- Dial 9 + the full phone number
- Include area code for local calls

### International Calls
- Dial 9 + 011 + country code + number

## Receiving Calls
Simply pick up the handset or press the flashing line button.

## Common Features

### Transfer a Call
1. Press the **Transfer** button
2. Dial the extension
3. Press **Transfer** again to complete

### Put a Call on Hold
Press the **Hold** button. Press it again to resume.

### Voicemail
1. Press the **Messages** button
2. Enter your PIN when prompted
3. Follow the voice prompts

### Conference Call
1. While on a call, press **Conference**
2. Dial the third party
3. Press **Conference** again to connect all parties

## Troubleshooting
If your phone displays "No Service":
1. Check the network cable connection
2. Restart the phone
3. Contact IT support

---
For additional assistance, contact your IT department.`,
      categoryId: kbVoipPhones.id,
      authorId: admin.id,
      isPublished: true,
      
    },
  });

  await prisma.kBArticle.create({
    data: {
      title: 'Password Reset Guide',
      slug: 'password-reset-guide',
      body: `# Password Reset Guide

Learn how to reset your password for various systems.

## Microsoft 365 Password

### Self-Service Reset
1. Go to [portal.office.com](https://portal.office.com)
2. Click "Can't access your account?"
3. Select "Work or school account"
4. Enter your email address
5. Complete the CAPTCHA
6. Follow the verification steps (phone or email)
7. Create a new password

### Through IT Support
If self-service reset isn't available:
1. Submit a support ticket requesting a password reset
2. An IT admin will generate a temporary password
3. You'll receive an email with reset instructions

## Windows Login Password
Contact IT support directly. For security reasons, Windows passwords must be reset by an administrator.

## VPN Password
VPN uses your Microsoft 365 credentials. Reset your Microsoft password following the steps above.

## Password Requirements
All passwords must meet these requirements:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (!@#$%^&*)

## Security Tips
- Never share your password
- Use a unique password for work accounts
- Enable multi-factor authentication when available
- Change your password immediately if you suspect compromise

---
Questions about passwords? Contact IT support.`,
      categoryId: kbGettingStarted.id,
      authorId: admin.id,
      isPublished: true,
      
    },
  });
  console.log('Created 5 KB articles');

  // Phase 8: Set portal access for test contact
  const hashedPortalPassword = await bcrypt.hash('Portal1234!', 10);
  await prisma.contact.update({
    where: { id: johnSmith.id },
    data: {
      portalPassword: hashedPortalPassword,
    },
  });
  console.log('Enabled portal access for John Smith (john@acmecorp.com / Portal1234!)');

  console.log('');
  console.log('='.repeat(50));
  console.log('Seed completed successfully!');
  console.log('='.repeat(50));
  console.log('');
  console.log('Users:');
  console.log('  - sam@nadc.com / Admin1234! (ADMIN)');
  console.log('  - tech1@nadc.com / Agent1234! (AGENT)');
  console.log('  - tech2@nadc.com / Agent1234! (AGENT)');
  console.log('');
  console.log('Contacts: 2 (John Smith, Sarah Lee)');
  console.log('Companies: 2 (Acme Corp, Tech Firm LLC)');
  console.log('Tickets: 5');
  console.log('Tags: 3');
  console.log('SLA Policies: 4');
  console.log('Business Hours: Mon-Fri 9-5');
  console.log('Canned Responses: 4');
  console.log('');
  console.log('Phase 5b:');
  console.log('  Devices: 4');
  console.log('  App Settings: 5');
  console.log('  Ticket Templates: 1 (Monthly Patch Check)');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
