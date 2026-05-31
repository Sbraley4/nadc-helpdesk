require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { ClientSecretCredential } = require('@azure/identity');
const { Client } = require('@microsoft/microsoft-graph-client');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');

const prisma = new PrismaClient();

// Generate a random password
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Initialize Graph client
function getGraphClient() {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  });

  return Client.initWithMiddleware({ authProvider });
}

// Send welcome email
async function sendWelcomeEmail(graphClient, user, tempPassword) {
  const fromAddress = process.env.GRAPH_MAIL_FROM || 'tickets@nadc.com';
  const loginUrl = process.env.CLIENT_URL || 'https://tickets.myofficeemail.com';

  const message = {
    subject: 'Welcome to NADC Helpdesk - Your Login Credentials',
    body: {
      contentType: 'HTML',
      content: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #1B2A4A; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">NADC Helpdesk</h1>
          </div>

          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1B2A4A; margin-top: 0;">Welcome, ${user.name}!</h2>

            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              Your account has been created for the NADC Helpdesk ticket system.
              Here are your login credentials:
            </p>

            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Login URL:</strong> <a href="${loginUrl}" style="color: #2563eb;">${loginUrl}</a></p>
              <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${user.email}</p>
              <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #f3f4f6; padding: 2px 8px; border-radius: 4px;">${tempPassword}</code></p>
            </div>

            <p style="color: #dc2626; font-size: 14px;">
              <strong>Important:</strong> Please change your password after your first login for security purposes.
            </p>

            <div style="margin-top: 30px; text-align: center;">
              <a href="${loginUrl}" style="background: #1B2A4A; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Login Now
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

            <p style="color: #6b7280; font-size: 12px; text-align: center; margin: 0;">
              This email was sent from NADC Helpdesk. If you did not expect this email, please contact your administrator.
            </p>
          </div>
        </div>
      `,
    },
    toRecipients: [
      {
        emailAddress: {
          address: user.email,
        },
      },
    ],
  };

  await graphClient
    .api(`/users/${fromAddress}/sendMail`)
    .post({
      message,
      saveToSentItems: false,
    });
}

async function main() {
  console.log('Sending welcome emails to admin users...\n');

  // Get the 3 admin users
  const adminEmails = [
    'sbraley@nadc.com',
    'clowrance@nadc.com',
    'pbraley@nadc.com',
  ];

  const graphClient = getGraphClient();

  for (const email of adminEmails) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log(`User ${email} not found, skipping...`);
      continue;
    }

    // Generate new password
    const tempPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Update password in database
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    console.log(`Updated password for ${user.name} (${email})`);

    // Send welcome email
    try {
      await sendWelcomeEmail(graphClient, user, tempPassword);
      console.log(`  ✓ Welcome email sent to ${email}`);
    } catch (error) {
      console.error(`  ✗ Failed to send email to ${email}:`, error.message);
    }
  }

  console.log('\nDone!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
