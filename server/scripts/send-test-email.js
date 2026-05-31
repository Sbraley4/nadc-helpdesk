// Load environment variables
require('dotenv').config();

const nodemailer = require('nodemailer');

async function sendTestEmail() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT, 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  const secure = process.env.SMTP_SECURE === 'true';

  console.log('SMTP Configuration:');
  console.log(`  Host: ${host}`);
  console.log(`  Port: ${port}`);
  console.log(`  User: ${user}`);
  console.log(`  From: ${from}`);
  console.log(`  Secure: ${secure}`);
  console.log('');

  if (!host || !user || !pass) {
    console.error('ERROR: SMTP not fully configured. Check .env file.');
    process.exit(1);
  }

  console.log('Creating transporter...');
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  console.log('Verifying connection...');
  try {
    await transporter.verify();
    console.log('SMTP connection verified!\n');
  } catch (error) {
    console.error('SMTP connection failed:', error.message);
    process.exit(1);
  }

  console.log('Sending test email to sbraley@nadc.com...');
  try {
    const result = await transporter.sendMail({
      from: `"NADC Tickets" <${from}>`,
      to: 'sbraley@nadc.com',
      subject: 'NADC Helpdesk - Test Email',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h2 style="color: #1B2A4A;">Test Email Successful!</h2>
          <p>This is a test email from the NADC Helpdesk ticket system.</p>
          <p>If you received this email, your email notifications are configured correctly.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            Sent from: ${from}<br>
            Authenticated as: ${user}<br>
            Server: ${host}:${port}
          </p>
        </div>
      `,
      text: 'This is a test email from the NADC Helpdesk ticket system. If you received this email, your email notifications are configured correctly.',
    });

    console.log('');
    console.log('='.repeat(50));
    console.log('TEST EMAIL SENT SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log(`Message ID: ${result.messageId}`);
    console.log('Check sbraley@nadc.com inbox for the test email.');
  } catch (error) {
    console.error('Failed to send email:', error.message);
    if (error.message.includes('535')) {
      console.error('\nThis may be an authentication issue. Check:');
      console.error('  1. Password is correct');
      console.error('  2. If MFA is enabled, use an App Password');
      console.error('  3. SMTP AUTH is enabled for your account');
    }
    if (error.message.includes('SendAsDenied') || error.message.includes('5.7.60')) {
      console.error('\nYou need "Send As" permission on tech@nadc.com');
      console.error('Or change SMTP_FROM to sbraley@nadc.com in .env');
    }
    process.exit(1);
  }
}

sendTestEmail();
