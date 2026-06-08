// Test the actual emailService module (not a separate implementation)
require('dotenv').config();

const emailService = require('../services/emailService');

async function testEmailService() {
  console.log('='.repeat(60));
  console.log('Testing emailService module');
  console.log('='.repeat(60));

  // Initialize the transporter
  console.log('\n1. Initializing email service...');
  const initResult = await emailService.initializeTransporter();
  console.log(`   Init result: ${initResult}`);
  console.log(`   isReady: ${emailService.isReady()}`);

  if (!emailService.isReady()) {
    console.error('\n*** EMAIL SERVICE NOT READY - STUB MODE ACTIVE ***');
    console.error('Emails will NOT be sent, only logged to console.');
    console.error('Check Azure credentials in .env file.');
    process.exit(1);
  }

  // Send test email
  console.log('\n2. Sending test email to sbraley@nadc.com...');
  const result = await emailService.sendTestEmail('sbraley@nadc.com');
  console.log('   Result:', JSON.stringify(result, null, 2));

  if (result.success && !result.stubMode) {
    console.log('\n' + '='.repeat(60));
    console.log('SUCCESS! Email should arrive at sbraley@nadc.com');
    console.log('='.repeat(60));
  } else if (result.stubMode) {
    console.log('\n' + '='.repeat(60));
    console.log('WARNING: Email was in STUB MODE - not actually sent!');
    console.log('='.repeat(60));
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('FAILED:', result.error);
    console.log('='.repeat(60));
  }

  process.exit(0);
}

testEmailService().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
