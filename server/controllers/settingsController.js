const { PrismaClient } = require('@prisma/client');
const { sendTestEmail, reinitialize: reinitializeEmail } = require('../services/emailService');
const { testImapConnection } = require('../services/imapService');
const fs = require('fs');
const path = require('path');
const { clearCache } = require('../utils/settingsCache');

const prisma = new PrismaClient();

// GET /api/settings
// Returns all settings as a key-value object
async function getSettings(req, res, next) {
  try {
    const settings = await prisma.appSetting.findMany();

    // Convert to key-value object
    const settingsObj = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    res.json(settingsObj);
  } catch (error) {
    next(error);
  }
}

// GET /api/settings/full
// Returns all settings with descriptions
async function getSettingsFull(req, res, next) {
  try {
    const settings = await prisma.appSetting.findMany({
      orderBy: { key: 'asc' },
    });

    res.json({ settings });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/settings/:key
// Update a single setting
async function updateSetting(req, res, next) {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    // Upsert the setting
    const setting = await prisma.appSetting.upsert({
      where: { key },
      create: {
        key,
        value: String(value),
      },
      update: {
        value: String(value),
      },
    });

    res.json(setting);
  } catch (error) {
    next(error);
  }
}

// PUT /api/settings
// Bulk update multiple settings
async function updateSettings(req, res, next) {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    // Batch upsert all settings
    const updates = Object.entries(settings).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        create: {
          key,
          value: String(value),
        },
        update: {
          value: String(value),
        },
      })
    );

    await prisma.$transaction(updates);

    // Return updated settings
    const allSettings = await prisma.appSetting.findMany();
    const settingsObj = allSettings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    res.json(settingsObj);
  } catch (error) {
    next(error);
  }
}

// POST /api/settings/test-email
// Test SMTP connection by sending a test email
async function testEmail(req, res, next) {
  try {
    // Reinitialize transporter to pick up any new settings
    await reinitializeEmail();

    // Get the user's email to send test to
    const userEmail = req.user.email;
    if (!userEmail) {
      return res.status(400).json({ error: 'No email address found for current user' });
    }

    const result = await sendTestEmail(userEmail);

    if (result.success) {
      res.json({
        success: true,
        message: result.stubMode
          ? 'Email logged to console (SMTP not configured)'
          : `Test email sent to ${userEmail}`,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to send test email',
      });
    }
  } catch (error) {
    next(error);
  }
}

// POST /api/settings/test-imap
// Test IMAP connection
async function testImap(req, res, next) {
  try {
    const result = await testImapConnection();

    if (result.success) {
      res.json({
        success: true,
        message: 'IMAP connection successful',
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to connect to IMAP',
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/settings/email-preview?template=X
 */
async function previewEmailTemplate(req, res, next) {
  try {
    const { template } = req.query;

    if (!template) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    const templatePath = path.join(__dirname, '../templates', `${template}.html`);

    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: 'Template not found' });
    }

    let html = fs.readFileSync(templatePath, 'utf8');

    // Replace with dummy data
    const dummyData = {
      '{{ticket_number}}': '12345',
      '{{ticket_subject}}': 'Sample Ticket Subject',
      '{{requester_name}}': 'John Smith',
      '{{agent_name}}': 'Sam Admin',
      '{{reply_content}}': 'This is a sample reply content for preview purposes.',
      '{{status}}': 'WORKING',
      '{{company_name}}': 'NADC Helpdesk',
      '{{survey_link}}': '#',
    };

    for (const [key, value] of Object.entries(dummyData)) {
      html = html.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    res.json({ html });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/settings/reset
 */
async function resetSettings(req, res, next) {
  try {
    const defaults = {
      company_name: 'NADC Helpdesk',
      google_review_enabled: 'false',
      google_review_url: '',
      review_cooldown_days: '30',
      review_send_delay_hours: '24',
      satisfaction_enabled: 'true',
      auto_close_days: '7',
      default_priority: 'MEDIUM',
      default_type: 'QUESTION',
    };

    const updates = Object.entries(defaults).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    );

    await prisma.$transaction(updates);

    // Clear cache
    clearCache();

    const settings = await prisma.appSetting.findMany();
    const settingsObj = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    res.json(settingsObj);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSettings,
  getSettingsFull,
  updateSetting,
  updateSettings,
  testEmail,
  testImap,
  previewEmailTemplate,
  resetSettings,
};
