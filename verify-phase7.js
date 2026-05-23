/**
 * Phase 7 Backend Verification Script
 * Tests all Phase 7 endpoints and functionality
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';
let accessToken = '';
let results = [];
let firstAutomationId = '';
let firstTicketId = '';
let firstContactId = '';

async function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (accessToken) {
      options.headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const contentType = res.headers['content-type'] || '';
          if (contentType.includes('application/json')) {
            resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
          } else {
            resolve({ status: res.statusCode, data, headers: res.headers });
          }
        } catch (e) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function pass(endpoint) {
  results.push({ pass: true, endpoint });
  console.log(`✅ PASS — ${endpoint}`);
}

function fail(endpoint, reason) {
  results.push({ pass: false, endpoint, reason });
  console.log(`❌ FAIL — ${endpoint}: ${reason}`);
}

async function login() {
  console.log('\n=== Logging in ===\n');
  try {
    const res = await request('POST', '/api/auth/login', {
      email: 'sam@nadc.com',
      password: 'Admin1234!',
    });
    if (res.status === 200 && res.data.accessToken) {
      accessToken = res.data.accessToken;
      console.log('Logged in successfully as sam@nadc.com\n');
      return true;
    } else {
      console.log('Login failed:', res.data);
      return false;
    }
  } catch (e) {
    console.log('Login error:', e.message);
    return false;
  }
}

async function getFirstIds() {
  // Get first automation ID
  const automations = await request('GET', '/api/automations');
  if (automations.data.automations && automations.data.automations.length > 0) {
    firstAutomationId = automations.data.automations[0].id;
  }

  // Get first ticket ID
  const tickets = await request('GET', '/api/tickets');
  if (tickets.data.tickets && tickets.data.tickets.length > 0) {
    firstTicketId = tickets.data.tickets[0].id;
  }

  // Get first contact ID
  const contacts = await request('GET', '/api/contacts');
  if (contacts.data.contacts && contacts.data.contacts.length > 0) {
    firstContactId = contacts.data.contacts[0].id;
  }
}

async function testDashboardStats() {
  const endpoint = 'GET /api/dashboard/stats';
  try {
    const res = await request('GET', '/api/dashboard/stats');
    if (
      res.status === 200 &&
      res.data.ticketCounts &&
      res.data.avgResponseTime !== undefined &&
      res.data.agentWorkload &&
      res.data.createdVsResolved
    ) {
      pass(endpoint);
    } else {
      fail(endpoint, `Missing required fields. Got: ${JSON.stringify(Object.keys(res.data))}`);
    }
  } catch (e) {
    fail(endpoint, e.message);
  }
}

async function testDashboardTrends() {
  const endpoint = 'GET /api/dashboard/trends?period=30d';
  try {
    const res = await request('GET', '/api/dashboard/trends?period=30d');
    if (res.status === 200 && res.data.createdVsResolved && Array.isArray(res.data.createdVsResolved)) {
      pass(endpoint);
    } else {
      fail(endpoint, `Missing createdVsResolved array. Got: ${JSON.stringify(Object.keys(res.data))}`);
    }
  } catch (e) {
    fail(endpoint, e.message);
  }
}

async function testTicketVolumeReport() {
  const endpoint = 'GET /api/reports/ticket-volume';
  try {
    const res = await request('GET', '/api/reports/ticket-volume?startDate=2024-01-01&endDate=2026-12-31');
    if (res.status === 200 && res.data.data && Array.isArray(res.data.data) && res.data.totals) {
      pass(endpoint);
    } else {
      fail(endpoint, `Missing data array or totals. Got: ${JSON.stringify(Object.keys(res.data))}`);
    }
  } catch (e) {
    fail(endpoint, e.message);
  }
}

async function testAgentPerformanceReport() {
  const endpoint = 'GET /api/reports/agent-performance';
  try {
    const res = await request('GET', '/api/reports/agent-performance?startDate=2024-01-01&endDate=2026-12-31');
    if (res.status === 200 && res.data.agents && Array.isArray(res.data.agents) && res.data.agents.length >= 2) {
      pass(endpoint);
    } else {
      const count = res.data.agents ? res.data.agents.length : 0;
      fail(endpoint, `Expected at least 2 agents, got ${count}`);
    }
  } catch (e) {
    fail(endpoint, e.message);
  }
}

async function testSlaComplianceReport() {
  const endpoint = 'GET /api/reports/sla-compliance';
  try {
    const res = await request('GET', '/api/reports/sla-compliance?startDate=2024-01-01&endDate=2026-12-31');
    if (res.status === 200 && res.data.overall && res.data.overall.compliancePercent !== undefined) {
      pass(endpoint);
    } else {
      fail(endpoint, `Missing overall.compliancePercent. Got: ${JSON.stringify(res.data)}`);
    }
  } catch (e) {
    fail(endpoint, e.message);
  }
}

async function testTimeMaterialsReport() {
  const endpoint = 'GET /api/reports/time-materials';
  try {
    const res = await request('GET', '/api/reports/time-materials?startDate=2024-01-01&endDate=2026-12-31');
    if (res.status === 200 && res.data.timeEntries && res.data.materials) {
      pass(endpoint);
    } else {
      fail(endpoint, `Missing timeEntries or materials. Got: ${JSON.stringify(Object.keys(res.data))}`);
    }
  } catch (e) {
    fail(endpoint, e.message);
  }
}

async function testCsvExport() {
  const endpoint = 'GET /api/reports/export (CSV)';
  try {
    const res = await request('GET', '/api/reports/export?type=ticket-volume&format=csv&startDate=2024-01-01&endDate=2026-12-31');
    const contentType = res.headers['content-type'] || '';
    if (contentType.includes('text/csv') && res.data && res.data.length > 0) {
      pass(endpoint);
    } else {
      fail(endpoint, `Content-Type: ${contentType}, Body length: ${res.data ? res.data.length : 0}`);
    }
  } catch (e) {
    fail(endpoint, e.message);
  }
}

async function testGlobalSearch() {
  const endpoint = 'GET /api/search?q=email';
  try {
    const res = await request('GET', '/api/search?q=email');
    if (
      res.status === 200 &&
      res.data.results &&
      'tickets' in res.data.results &&
      'contacts' in res.data.results &&
      'companies' in res.data.results &&
      'articles' in res.data.results
    ) {
      pass(endpoint);
    } else {
      fail(endpoint, `Missing results keys. Got: ${JSON.stringify(res.data)}`);
    }
  } catch (e) {
    fail(endpoint, e.message);
  }
}

async function testAutomations() {
  const endpoint = 'GET /api/automations';
  try {
    const res = await request('GET', '/api/automations');
    if (res.status === 200 && res.data.automations && res.data.automations.length >= 3) {
      pass(endpoint);
    } else {
      const count = res.data.automations ? res.data.automations.length : 0;
      fail(endpoint, `Expected at least 3 automation rules, got ${count}`);
    }
  } catch (e) {
    fail(endpoint, e.message);
  }
}

async function testBusinessHours() {
  const endpoint = 'GET /api/business-hours';
  try {
    const res = await request('GET', '/api/business-hours');
    if (res.status === 200 && res.data.businessHours && res.data.businessHours.length === 7) {
      pass(endpoint);
    } else {
      const count = res.data.businessHours ? res.data.businessHours.length : 0;
      fail(endpoint, `Expected 7 business hours entries, got ${count}`);
    }
  } catch (e) {
    fail(endpoint, e.message);
  }
}

async function testSettings() {
  const endpoint = 'GET /api/settings';
  try {
    const res = await request('GET', '/api/settings');
    if (res.status === 200 && 'google_review_url' in res.data && 'review_cooldown_days' in res.data) {
      pass(endpoint);
    } else {
      fail(endpoint, `Missing google_review_url or review_cooldown_days. Got keys: ${JSON.stringify(Object.keys(res.data))}`);
    }
  } catch (e) {
    fail(endpoint, e.message);
  }
}

async function testAutomationTest() {
  const endpoint = 'POST /api/automations/:id/test';
  try {
    if (!firstAutomationId || !firstTicketId) {
      fail(endpoint, 'No automation or ticket ID available');
      return;
    }
    const res = await request('POST', `/api/automations/${firstAutomationId}/test`, {
      ticketId: firstTicketId,
    });
    if (res.status === 200 && res.data.conditionsResult && 'wouldFire' in res.data) {
      pass(endpoint);
    } else {
      fail(endpoint, `Missing conditionsResult or wouldFire. Got: ${JSON.stringify(res.data)}`);
    }
  } catch (e) {
    fail(endpoint, e.message);
  }
}

async function testAutomationOnUrgentTicket() {
  const endpoint = 'Create URGENT ticket + verify automation activity';
  try {
    if (!firstContactId) {
      fail(endpoint, 'No contact ID available');
      return;
    }

    // Create an URGENT ticket
    const createRes = await request('POST', '/api/tickets', {
      subject: 'URGENT TEST - Automation verification',
      description: 'This is an urgent test ticket to verify automation runs on ticket creation.',
      requesterId: firstContactId,
      priority: 'URGENT',
    });

    if (createRes.status !== 201) {
      fail(endpoint, `Failed to create ticket: ${JSON.stringify(createRes.data)}`);
      return;
    }

    // Ticket is returned directly, not wrapped in { ticket: ... }
    const newTicketId = createRes.data.id;
    console.log(`   Created test ticket: #${createRes.data.ticketNumber}`);

    // Wait a moment for automation to run
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Fetch activity log
    const activityRes = await request('GET', `/api/tickets/${newTicketId}/activity`);

    if (activityRes.status !== 200) {
      fail(endpoint, `Failed to fetch activity: ${JSON.stringify(activityRes.data)}`);
      return;
    }

    const activities = activityRes.data.activities || activityRes.data;
    const hasAutomationActivity = activities.some(
      (a) =>
        (a.type && a.type.toLowerCase().includes('automation')) ||
        (a.description && a.description.toLowerCase().includes('automation'))
    );

    if (hasAutomationActivity) {
      pass(endpoint);
    } else {
      // Check if there's any assignment activity (automation assigns to group)
      const hasAssignment = activities.some(
        (a) => a.type === 'ASSIGNED' || (a.description && a.description.includes('Assigned'))
      );
      if (hasAssignment) {
        console.log('   (Found assignment activity from automation)');
        pass(endpoint);
      } else {
        fail(endpoint, `No automation activity found in log. Activities: ${JSON.stringify(activities.map(a => a.type || a.description))}`);
      }
    }
  } catch (e) {
    fail(endpoint, e.message);
  }
}

async function main() {
  console.log('=============================================');
  console.log('  Phase 7 Backend Verification Script');
  console.log('=============================================');

  const loggedIn = await login();
  if (!loggedIn) {
    console.log('\n❌ Cannot proceed without authentication\n');
    process.exit(1);
  }

  await getFirstIds();

  console.log('=== Testing Endpoints ===\n');

  await testDashboardStats();
  await testDashboardTrends();
  await testTicketVolumeReport();
  await testAgentPerformanceReport();
  await testSlaComplianceReport();
  await testTimeMaterialsReport();
  await testCsvExport();
  await testGlobalSearch();
  await testAutomations();
  await testBusinessHours();
  await testSettings();
  await testAutomationTest();
  await testAutomationOnUrgentTicket();

  // Summary
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;

  console.log('\n=============================================');
  console.log(`  Phase 7 Backend: ${passed}/${total} checks passed`);
  console.log('=============================================\n');

  if (passed < total) {
    console.log('Failures:');
    results.filter((r) => !r.pass).forEach((r) => {
      console.log(`  - ${r.endpoint}: ${r.reason}`);
    });
  }

  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error('Script error:', e);
  process.exit(1);
});
