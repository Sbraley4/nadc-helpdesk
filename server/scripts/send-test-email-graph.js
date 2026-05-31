// Load environment variables
require('dotenv').config();

const { ClientSecretCredential } = require('@azure/identity');
const { Client } = require('@microsoft/microsoft-graph-client');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');

async function sendTestEmail() {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const fromAddress = process.env.GRAPH_MAIL_FROM || 'tickets@nadc.com';

  console.log('Microsoft Graph Configuration:');
  console.log(`  Tenant ID: ${tenantId}`);
  console.log(`  Client ID: ${clientId}`);
  console.log(`  From Address: ${fromAddress}`);
  console.log('');

  if (!tenantId || !clientId || !clientSecret) {
    console.error('ERROR: Azure credentials not configured. Check .env file.');
    process.exit(1);
  }

  console.log('Creating credential...');
  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

  console.log('Creating auth provider...');
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  });

  console.log('Creating Graph client...');
  const graphClient = Client.initWithMiddleware({ authProvider });

  console.log('Skipping connection test, sending email directly...\n');

  console.log('Sending test email to sbraley@nadc.com...');
  try {
    const message = {
      subject: 'NADC Helpdesk — Test Email (Graph API)',
      body: {
        contentType: 'HTML',
        content: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
            <h2 style="color: #1B2A4A;">Test Email Successful!</h2>
            <p>This is a test email from the NADC Helpdesk ticket system.</p>
            <p>Emails are now being sent via <strong>Microsoft Graph API</strong>.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              Sent from: ${fromAddress}<br>
              Method: Microsoft Graph API
            </p>
          </div>
        `,
      },
      toRecipients: [
        {
          emailAddress: {
            address: 'sbraley@nadc.com',
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

    console.log('');
    console.log('='.repeat(50));
    console.log('TEST EMAIL SENT SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log('Check sbraley@nadc.com inbox for the test email.');
  } catch (error) {
    console.error('Failed to send email:', error.message);
    if (error.message.includes('MailboxNotEnabledForRESTAPI')) {
      console.error('\nThe mailbox needs to be licensed for Exchange Online.');
    }
    if (error.message.includes('ResourceNotFound')) {
      console.error('\nThe mailbox tickets@nadc.com was not found.');
      console.error('Make sure the shared mailbox exists and has a license.');
    }
    if (error.message.includes('Authorization')) {
      console.error('\nMake sure you granted admin consent for Mail.Send permission.');
    }
    process.exit(1);
  }
}

sendTestEmail();
