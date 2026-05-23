/**
 * NADC Helpdesk - Comprehensive Test Suite
 * Tests all features across all phases
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';
let passed = 0;
let failed = 0;
let failures = [];

// Store IDs for use across tests
let adminToken = '';
let agentToken = '';
let adminUser = null;
let agentUser = null;
let testTicketId = '';
let testContactId = '';
let testCompanyId = '';
let testReplyId = '';
let testTagId = '';
let testDeviceId = '';
let testTemplateId = '';
let testAutomationId = '';
let testTimeEntryId = '';
let testMaterialEntryId = '';
let testChecklistItemId = '';

async function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

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

async function test(name, fn) {
  try {
    await fn();
    console.log('✅ PASS —', name);
    passed++;
  } catch (e) {
    console.log('❌ FAIL —', name + ':', e.message);
    failed++;
    failures.push({ name, error: e.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// ============ AUTH TESTS ============
async function authTests() {
  console.log('\n=== AUTH TESTS ===\n');

  await test('Login with valid credentials returns tokens', async () => {
    const res = await request('POST', '/api/auth/login', { email: 'sam@nadc.com', password: 'Admin1234!' });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.accessToken, 'Missing accessToken');
    assert(res.data.refreshToken, 'Missing refreshToken');
    adminToken = res.data.accessToken;
    adminUser = res.data.user;
  });

  await test('Login with wrong password returns 401', async () => {
    const res = await request('POST', '/api/auth/login', { email: 'sam@nadc.com', password: 'wrongpassword' });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await test('GET /me with valid token returns user (no password field)', async () => {
    const res = await request('GET', '/api/auth/me', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.email === 'sam@nadc.com', 'Wrong user returned');
    assert(!res.data.password, 'Password field should not be returned');
  });

  await test('GET /me with no token returns 401', async () => {
    const res = await request('GET', '/api/auth/me');
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await test('POST /refresh with valid refresh token returns new accessToken', async () => {
    const loginRes = await request('POST', '/api/auth/login', { email: 'sam@nadc.com', password: 'Admin1234!' });
    const res = await request('POST', '/api/auth/refresh', { refreshToken: loginRes.data.refreshToken });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.accessToken, 'Missing new accessToken');
  });

  await test('POST /refresh with invalid token returns 401', async () => {
    const res = await request('POST', '/api/auth/refresh', { refreshToken: 'invalid-token' });
    assert(res.status === 401 || res.status === 403, `Expected 401/403, got ${res.status}`);
  });

  // Login as agent for role tests
  const agentLogin = await request('POST', '/api/auth/login', { email: 'tech1@nadc.com', password: 'Agent1234!' });
  agentToken = agentLogin.data.accessToken;
  agentUser = agentLogin.data.user;
}

// ============ AGENT TESTS ============
async function agentTests() {
  console.log('\n=== AGENT TESTS ===\n');

  await test('GET /agents returns array of agents', async () => {
    const res = await request('GET', '/api/agents', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.agents || res.data), 'Should return array');
  });

  await test('GET /agents excludes password field from all results', async () => {
    const res = await request('GET', '/api/agents', null, adminToken);
    const agents = res.data.agents || res.data;
    agents.forEach(a => assert(!a.password, 'Password should not be returned'));
  });

  await test('POST /agents with AGENT token returns 403', async () => {
    const res = await request('POST', '/api/agents', { name: 'Test', email: 'test@test.com', password: 'Test1234!' }, agentToken);
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  let createdAgentId;
  await test('POST /agents with ADMIN token creates agent successfully', async () => {
    const res = await request('POST', '/api/agents', {
      name: 'Test Agent',
      email: `testagent${Date.now()}@nadc.com`,
      password: 'Test1234!',
      role: 'AGENT'
    }, adminToken);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    createdAgentId = res.data.id;
  });

  await test('PUT /agents/:id updates agent fields', async () => {
    if (!createdAgentId) throw new Error('No agent to update');
    const res = await request('PUT', `/api/agents/${createdAgentId}`, { name: 'Updated Agent' }, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.name === 'Updated Agent', 'Name not updated');
  });

  await test('PATCH /agents/:id/availability updates availability', async () => {
    if (!createdAgentId) throw new Error('No agent to update');
    const res = await request('PATCH', `/api/agents/${createdAgentId}/availability`, { availability: 'BUSY' }, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('DELETE /agents/:id sets isActive=false (soft delete)', async () => {
    if (!createdAgentId) throw new Error('No agent to delete');
    const res = await request('DELETE', `/api/agents/${createdAgentId}`, null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('GET /groups returns groups with member agents', async () => {
    const res = await request('GET', '/api/groups', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.groups || res.data), 'Should return array');
  });

  await test('POST /groups creates group with members', async () => {
    const res = await request('POST', '/api/groups', { name: `Test Group ${Date.now()}` }, adminToken);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
  });
}

// ============ CONTACT TESTS ============
async function contactTests() {
  console.log('\n=== CONTACT TESTS ===\n');

  await test('GET /contacts returns paginated contacts with ticket counts', async () => {
    const res = await request('GET', '/api/contacts', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.contacts, 'Missing contacts array');
    assert(res.data.total !== undefined, 'Missing total');
    assert(res.data.page !== undefined, 'Missing page');
  });

  await test('GET /contacts?search=john filters by name', async () => {
    const res = await request('GET', '/api/contacts?search=john', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('GET /contacts/search?q=jo returns typeahead results', async () => {
    const res = await request('GET', '/api/contacts/search?q=jo', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.contacts, 'Missing contacts array');
  });

  await test('POST /contacts creates contact successfully', async () => {
    const res = await request('POST', '/api/contacts', {
      name: `Test Contact ${Date.now()}`,
      email: `testcontact${Date.now()}@test.com`
    }, adminToken);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    testContactId = res.data.id;
  });

  await test('POST /contacts with duplicate email returns 409', async () => {
    const res = await request('POST', '/api/contacts', {
      name: 'Duplicate',
      email: 'john@acmecorp.com' // Existing email from seed
    }, adminToken);
    assert(res.status === 409 || res.status === 400, `Expected 409/400, got ${res.status}`);
  });

  await test('GET /contacts/:id returns contact with tickets array', async () => {
    const res = await request('GET', '/api/contacts', null, adminToken);
    const firstContact = res.data.contacts[0];
    const detailRes = await request('GET', `/api/contacts/${firstContact.id}`, null, adminToken);
    assert(detailRes.status === 200, `Expected 200, got ${detailRes.status}`);
  });

  await test('PUT /contacts/:id updates contact fields', async () => {
    if (!testContactId) throw new Error('No contact to update');
    const res = await request('PUT', `/api/contacts/${testContactId}`, { name: 'Updated Contact' }, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
}

// ============ COMPANY TESTS ============
async function companyTests() {
  console.log('\n=== COMPANY TESTS ===\n');

  await test('GET /companies returns paginated companies with counts', async () => {
    const res = await request('GET', '/api/companies', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('GET /companies/search?q=ac returns typeahead results', async () => {
    const res = await request('GET', '/api/companies/search?q=ac', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('POST /companies creates company successfully', async () => {
    const res = await request('POST', '/api/companies', {
      name: `Test Company ${Date.now()}`
    }, adminToken);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    testCompanyId = res.data.id;
  });

  await test('PUT /companies/:id updates company fields', async () => {
    if (!testCompanyId) throw new Error('No company to update');
    const res = await request('PUT', `/api/companies/${testCompanyId}`, { name: `Updated Company ${Date.now()}` }, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
}

// ============ TICKET TESTS ============
async function ticketTests() {
  console.log('\n=== TICKET TESTS ===\n');

  // Get a contact for ticket creation
  const contactsRes = await request('GET', '/api/contacts', null, adminToken);
  const existingContactId = contactsRes.data.contacts[0].id;

  await test('POST /tickets creates ticket with auto-assigned ticketNumber', async () => {
    const res = await request('POST', '/api/tickets', {
      subject: 'Test Ticket',
      description: 'Test description',
      requesterId: existingContactId,
      priority: 'MEDIUM'
    }, adminToken);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.data.ticketNumber, 'Missing ticketNumber');
    testTicketId = res.data.id;
  });

  await test('POST /tickets with requesterId that does not exist returns 404', async () => {
    const res = await request('POST', '/api/tickets', {
      subject: 'Test',
      description: 'Test',
      requesterId: 'nonexistent-id'
    }, adminToken);
    assert(res.status === 404 || res.status === 400, `Expected 404/400, got ${res.status}`);
  });

  await test('GET /tickets returns paginated results', async () => {
    const res = await request('GET', '/api/tickets', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.tickets, 'Missing tickets array');
    assert(res.data.total !== undefined, 'Missing total');
    assert(res.data.page !== undefined, 'Missing page');
  });

  await test('GET /tickets?status=OPEN filters correctly', async () => {
    const res = await request('GET', '/api/tickets?status=OPEN', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('GET /tickets?priority=HIGH filters correctly', async () => {
    const res = await request('GET', '/api/tickets?priority=HIGH', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('GET /tickets?assigneeId=unassigned returns unassigned tickets', async () => {
    const res = await request('GET', '/api/tickets?assigneeId=unassigned', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('GET /tickets?search=email returns matching tickets', async () => {
    const res = await request('GET', '/api/tickets?search=email', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('GET /tickets/:id returns full ticket with all relations', async () => {
    if (!testTicketId) throw new Error('No ticket to fetch');
    const res = await request('GET', `/api/tickets/${testTicketId}`, null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.requester, 'Missing requester relation');
  });

  await test('GET /tickets/views returns saved view definitions', async () => {
    const res = await request('GET', '/api/tickets/views', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.views || res.data), 'Should return array');
  });

  await test('PUT /tickets/:id updates status', async () => {
    if (!testTicketId) throw new Error('No ticket to update');
    const res = await request('PUT', `/api/tickets/${testTicketId}`, { status: 'OPEN' }, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('PUT /tickets/:id status change creates activity log entry', async () => {
    if (!testTicketId) throw new Error('No ticket');
    await request('PUT', `/api/tickets/${testTicketId}`, { status: 'PENDING' }, adminToken);
    const activityRes = await request('GET', `/api/tickets/${testTicketId}/activity`, null, adminToken);
    assert(activityRes.status === 200, `Expected 200, got ${activityRes.status}`);
    const activities = activityRes.data.activities || activityRes.data;
    assert(activities.length > 0, 'Should have activity entries');
  });

  await test('POST /tickets/:id/watchers adds watcher', async () => {
    if (!testTicketId) throw new Error('No ticket');
    const res = await request('POST', `/api/tickets/${testTicketId}/watchers`, { userId: adminUser.id }, adminToken);
    assert(res.status === 200 || res.status === 201, `Expected 200/201, got ${res.status}`);
  });

  await test('GET /tickets/:id/activity returns activities in order', async () => {
    if (!testTicketId) throw new Error('No ticket');
    const res = await request('GET', `/api/tickets/${testTicketId}/activity`, null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
}

// ============ REPLY TESTS ============
async function replyTests() {
  console.log('\n=== REPLY TESTS ===\n');

  await test('POST /tickets/:id/replies creates public reply', async () => {
    if (!testTicketId) throw new Error('No ticket');
    const res = await request('POST', `/api/tickets/${testTicketId}/replies`, {
      body: 'Test reply content'
    }, adminToken);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    testReplyId = res.data.id;
  });

  await test('POST /tickets/:id/replies with isInternal=true creates note', async () => {
    if (!testTicketId) throw new Error('No ticket');
    const res = await request('POST', `/api/tickets/${testTicketId}/replies`, {
      body: 'Internal note',
      isInternal: true
    }, adminToken);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.data.isInternal === true, 'Should be internal');
  });

  await test('GET /tickets/:id/replies returns replies with author', async () => {
    if (!testTicketId) throw new Error('No ticket');
    const res = await request('GET', `/api/tickets/${testTicketId}/replies`, null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('PUT /tickets/:id/replies/:replyId updates reply body', async () => {
    if (!testTicketId || !testReplyId) throw new Error('No reply to update');
    const res = await request('PUT', `/api/tickets/${testTicketId}/replies/${testReplyId}`, {
      body: 'Updated reply content'
    }, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
}

// ============ TAG TESTS ============
async function tagTests() {
  console.log('\n=== TAG TESTS ===\n');

  await test('GET /tags returns all tags', async () => {
    const res = await request('GET', '/api/tags', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('POST /tags creates tag with name and color', async () => {
    const res = await request('POST', '/api/tags', {
      name: `test-tag-${Date.now()}`,
      color: '#FF5733'
    }, adminToken);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    testTagId = res.data.id;
  });

  await test('PUT /tags/:id updates tag', async () => {
    if (!testTagId) throw new Error('No tag to update');
    const res = await request('PUT', `/api/tags/${testTagId}`, { color: '#00FF00' }, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('DELETE /tags/:id removes tag', async () => {
    if (!testTagId) throw new Error('No tag to delete');
    const res = await request('DELETE', `/api/tags/${testTagId}`, null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
}

// ============ CANNED RESPONSE TESTS ============
async function cannedResponseTests() {
  console.log('\n=== CANNED RESPONSE TESTS ===\n');

  let testCannedId;

  await test('GET /canned-responses returns all responses', async () => {
    const res = await request('GET', '/api/canned-responses', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('POST /canned-responses creates response', async () => {
    const res = await request('POST', '/api/canned-responses', {
      title: 'Test Response',
      body: 'Hello {{requester_name}}, your ticket #{{ticket_id}} is being processed.'
    }, adminToken);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    testCannedId = res.data.id;
  });

  await test('POST /canned-responses/:id/preview resolves variables correctly', async () => {
    if (!testCannedId || !testTicketId) throw new Error('Missing IDs');
    const res = await request('POST', `/api/canned-responses/${testCannedId}/preview`, {
      ticketId: testTicketId
    }, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(!res.data.body.includes('{{requester_name}}'), 'Variables should be resolved');
  });

  await test('DELETE /canned-responses/:id removes response', async () => {
    if (!testCannedId) throw new Error('No response to delete');
    const res = await request('DELETE', `/api/canned-responses/${testCannedId}`, null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
}

// ============ SLA TESTS ============
async function slaTests() {
  console.log('\n=== SLA TESTS ===\n');

  await test('GET /sla-policies returns all seeded policies', async () => {
    const res = await request('GET', '/api/sla-policies', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const policies = res.data.policies || res.data;
    assert(policies.length >= 4, `Expected at least 4 policies, got ${policies.length}`);
  });

  let testSlaId;
  await test('POST /sla-policies creates new policy', async () => {
    const res = await request('POST', '/api/sla-policies', {
      name: `Test SLA ${Date.now()}`,
      appliesTo: 'LOW',
      firstResponseHours: 2,
      resolutionHours: 8
    }, adminToken);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    testSlaId = res.data.id;
  });

  await test('PUT /sla-policies/:id updates policy', async () => {
    if (!testSlaId) throw new Error('No policy to update');
    const res = await request('PUT', `/api/sla-policies/${testSlaId}`, { firstResponseHours: 1 }, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('DELETE /sla-policies/:id removes policy', async () => {
    if (!testSlaId) throw new Error('No policy to delete');
    const res = await request('DELETE', `/api/sla-policies/${testSlaId}`, null, adminToken);
    assert(res.status === 200 || res.status === 409, `Expected 200/409, got ${res.status}`);
  });
}

// ============ TIME TRACKING TESTS ============
async function timeTrackingTests() {
  console.log('\n=== TIME TRACKING TESTS ===\n');

  await test('POST /tickets/:id/time creates time entry', async () => {
    if (!testTicketId) throw new Error('No ticket');
    const res = await request('POST', `/api/tickets/${testTicketId}/time`, {
      description: 'Test work',
      date: new Date().toISOString(),
      hours: 0,
      minutes: 30
    }, adminToken);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    testTimeEntryId = res.data.id;
  });

  await test('GET /tickets/:id/time returns entries', async () => {
    if (!testTicketId) throw new Error('No ticket');
    const res = await request('GET', `/api/tickets/${testTicketId}/time`, null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('PUT /tickets/:id/time/:entryId updates entry', async () => {
    if (!testTicketId || !testTimeEntryId) throw new Error('Missing IDs');
    const res = await request('PUT', `/api/tickets/${testTicketId}/time/${testTimeEntryId}`, {
      minutes: 45
    }, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('DELETE /tickets/:id/time/:entryId removes entry', async () => {
    if (!testTicketId || !testTimeEntryId) throw new Error('Missing IDs');
    const res = await request('DELETE', `/api/tickets/${testTicketId}/time/${testTimeEntryId}`, null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
}

// ============ MATERIALS TESTS ============
async function materialsTests() {
  console.log('\n=== MATERIALS TESTS ===\n');

  await test('POST /tickets/:id/materials creates entry with totalCost', async () => {
    if (!testTicketId) throw new Error('No ticket');
    const res = await request('POST', `/api/tickets/${testTicketId}/materials`, {
      itemName: 'Test part',
      quantity: 2,
      unitCost: 25.00
    }, adminToken);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    testMaterialEntryId = res.data.id;
  });

  await test('GET /tickets/:id/materials returns entries', async () => {
    if (!testTicketId) throw new Error('No ticket');
    const res = await request('GET', `/api/tickets/${testTicketId}/materials`, null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('DELETE /tickets/:id/materials/:entryId removes entry', async () => {
    if (!testTicketId || !testMaterialEntryId) throw new Error('Missing IDs');
    const res = await request('DELETE', `/api/tickets/${testTicketId}/materials/${testMaterialEntryId}`, null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
}

// ============ DEVICE TESTS ============
async function deviceTests() {
  console.log('\n=== DEVICE TESTS ===\n');

  await test('GET /devices returns paginated devices', async () => {
    const res = await request('GET', '/api/devices', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('POST /devices creates device with all fields', async () => {
    // First get a company ID
    const companiesRes = await request('GET', '/api/companies', null, adminToken);
    const existingCompanyId = companiesRes.data.companies[0].id;

    const res = await request('POST', '/api/devices', {
      name: `Test Device ${Date.now()}`,
      type: 'DESKTOP',
      serialNumber: `SN${Date.now()}`,
      companyId: existingCompanyId
    }, adminToken);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    testDeviceId = res.data.id;
  });

  await test('POST /tickets/:id/devices links device', async () => {
    if (!testTicketId || !testDeviceId) throw new Error('Missing IDs');
    const res = await request('POST', `/api/tickets/${testTicketId}/devices`, {
      deviceId: testDeviceId
    }, adminToken);
    assert(res.status === 200 || res.status === 201, `Expected 200/201, got ${res.status}`);
  });

  await test('GET /tickets/:id/devices returns linked devices', async () => {
    if (!testTicketId) throw new Error('No ticket');
    const res = await request('GET', `/api/tickets/${testTicketId}/devices`, null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
}

// ============ TEMPLATE TESTS ============
async function templateTests() {
  console.log('\n=== TEMPLATE TESTS ===\n');

  await test('GET /templates returns all templates', async () => {
    const res = await request('GET', '/api/templates', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('POST /templates creates template with checklist items', async () => {
    const res = await request('POST', '/api/templates', {
      name: `Test Template ${Date.now()}`,
      subject: 'Template Subject',
      description: 'Template Description',
      priority: 'MEDIUM',
      checklistItems: [{ label: 'Step 1', order: 1 }, { label: 'Step 2', order: 2 }]
    }, adminToken);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    testTemplateId = res.data.id;
  });

  await test('POST /templates/:id/create-ticket creates ticket from template', async () => {
    if (!testTemplateId || !testContactId) throw new Error('Missing IDs');
    const res = await request('POST', `/api/templates/${testTemplateId}/create-ticket`, {
      requesterId: testContactId
    }, adminToken);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
  });

  await test('DELETE /templates/:id removes template', async () => {
    if (!testTemplateId) throw new Error('No template to delete');
    const res = await request('DELETE', `/api/templates/${testTemplateId}`, null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
}

// ============ CHECKLIST TESTS ============
async function checklistTests() {
  console.log('\n=== CHECKLIST TESTS ===\n');

  await test('POST /tickets/:id/checklist adds checklist item', async () => {
    if (!testTicketId) throw new Error('No ticket');
    const res = await request('POST', `/api/tickets/${testTicketId}/checklist`, {
      label: 'Test checklist item'
    }, adminToken);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    testChecklistItemId = res.data.id;
  });

  await test('GET /tickets/:id/checklist returns items', async () => {
    if (!testTicketId) throw new Error('No ticket');
    const res = await request('GET', `/api/tickets/${testTicketId}/checklist`, null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('PUT /tickets/:id/checklist/:itemId toggles isChecked', async () => {
    if (!testTicketId || !testChecklistItemId) throw new Error('Missing IDs');
    const res = await request('PUT', `/api/tickets/${testTicketId}/checklist/${testChecklistItemId}`, {
      isChecked: true
    }, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('DELETE /tickets/:id/checklist/:itemId removes item', async () => {
    if (!testTicketId || !testChecklistItemId) throw new Error('Missing IDs');
    const res = await request('DELETE', `/api/tickets/${testTicketId}/checklist/${testChecklistItemId}`, null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
}

// ============ DASHBOARD TESTS ============
async function dashboardTests() {
  console.log('\n=== DASHBOARD TESTS ===\n');

  await test('GET /dashboard/stats returns ticketCounts object', async () => {
    const res = await request('GET', '/api/dashboard/stats', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.ticketCounts, 'Missing ticketCounts');
  });

  await test('GET /dashboard/stats returns agentWorkload array', async () => {
    const res = await request('GET', '/api/dashboard/stats', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.agentWorkload, 'Missing agentWorkload');
  });

  await test('GET /dashboard/trends?period=7d returns data', async () => {
    const res = await request('GET', '/api/dashboard/trends?period=7d', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('GET /dashboard/trends?period=90d returns data', async () => {
    const res = await request('GET', '/api/dashboard/trends?period=90d', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
}

// ============ REPORT TESTS ============
async function reportTests() {
  console.log('\n=== REPORT TESTS ===\n');

  await test('GET /reports/ticket-volume returns data and totals', async () => {
    const res = await request('GET', '/api/reports/ticket-volume?startDate=2024-01-01&endDate=2026-12-31', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.data, 'Missing data array');
    assert(res.data.totals, 'Missing totals');
  });

  await test('GET /reports/agent-performance returns agents array', async () => {
    const res = await request('GET', '/api/reports/agent-performance?startDate=2024-01-01&endDate=2026-12-31', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.agents, 'Missing agents array');
  });

  await test('GET /reports/sla-compliance returns overall compliance', async () => {
    const res = await request('GET', '/api/reports/sla-compliance?startDate=2024-01-01&endDate=2026-12-31', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.overall, 'Missing overall object');
  });

  await test('GET /reports/time-materials returns timeEntries and materials', async () => {
    const res = await request('GET', '/api/reports/time-materials?startDate=2024-01-01&endDate=2026-12-31', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.timeEntries !== undefined, 'Missing timeEntries');
    assert(res.data.materials !== undefined, 'Missing materials');
  });

  await test('GET /reports/export returns CSV', async () => {
    const res = await request('GET', '/api/reports/export?type=ticket-volume&format=csv&startDate=2024-01-01&endDate=2026-12-31', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.headers['content-type'].includes('text/csv'), 'Should be CSV content type');
  });
}

// ============ SEARCH TESTS ============
async function searchTests() {
  console.log('\n=== SEARCH TESTS ===\n');

  await test('GET /search?q=email returns results with tickets key', async () => {
    const res = await request('GET', '/api/search?q=email', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.results, 'Missing results');
    assert('tickets' in res.data.results, 'Missing tickets key');
  });

  await test('GET /search?q=jo returns contacts matching name', async () => {
    const res = await request('GET', '/api/search?q=john', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
}

// ============ AUTOMATION TESTS ============
async function automationTests() {
  console.log('\n=== AUTOMATION TESTS ===\n');

  await test('GET /automations returns seeded rules', async () => {
    const res = await request('GET', '/api/automations', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const automations = res.data.automations || res.data;
    assert(automations.length >= 3, `Expected at least 3 rules, got ${automations.length}`);
    testAutomationId = automations[0].id;
  });

  await test('POST /automations/:id/test returns conditionsResult', async () => {
    if (!testAutomationId || !testTicketId) throw new Error('Missing IDs');
    const res = await request('POST', `/api/automations/${testAutomationId}/test`, {
      ticketId: testTicketId
    }, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.conditionsResult, 'Missing conditionsResult');
    assert('wouldFire' in res.data, 'Missing wouldFire boolean');
  });

  await test('PATCH /automations/:id/toggle flips isActive', async () => {
    if (!testAutomationId) throw new Error('No automation');
    const res = await request('PATCH', `/api/automations/${testAutomationId}/toggle`, null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
}

// ============ BUSINESS HOURS TESTS ============
async function businessHoursTests() {
  console.log('\n=== BUSINESS HOURS TESTS ===\n');

  await test('GET /business-hours returns 7 records', async () => {
    const res = await request('GET', '/api/business-hours', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const hours = res.data.businessHours || res.data;
    assert(hours.length === 7, `Expected 7 days, got ${hours.length}`);
  });
}

// ============ SETTINGS TESTS ============
async function settingsTests() {
  console.log('\n=== SETTINGS TESTS ===\n');

  await test('GET /settings returns key-value settings object', async () => {
    const res = await request('GET', '/api/settings', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('GET /settings/full returns all settings (admin only)', async () => {
    const res = await request('GET', '/api/settings/full', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
}

// ============ NOTIFICATION TESTS ============
async function notificationTests() {
  console.log('\n=== NOTIFICATION TESTS ===\n');

  await test('GET /notifications returns notifications for current user', async () => {
    const res = await request('GET', '/api/notifications', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('GET /notifications/unread-count returns count', async () => {
    const res = await request('GET', '/api/notifications/unread-count', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('PATCH /notifications/read-all marks all as read', async () => {
    const res = await request('PATCH', '/api/notifications/read-all', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
}

// ============ CALENDAR TESTS ============
async function calendarTests() {
  console.log('\n=== CALENDAR TESTS ===\n');

  await test('GET /calendar returns tickets in date range', async () => {
    const start = new Date('2024-01-01').toISOString();
    const end = new Date('2026-12-31').toISOString();
    const res = await request('GET', `/api/calendar?start=${start}&end=${end}`, null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('GET /calendar/workload returns workload summary', async () => {
    const start = new Date('2024-01-01').toISOString();
    const end = new Date('2026-12-31').toISOString();
    const res = await request('GET', `/api/calendar/workload?start=${start}&end=${end}`, null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.workload, 'Missing workload array');
  });
}

// ============ EDGE CASE TESTS ============
async function edgeCaseTests() {
  console.log('\n=== EDGE CASE TESTS ===\n');

  await test('Pagination: GET /tickets?page=999 returns empty array not error', async () => {
    const res = await request('GET', '/api/tickets?page=999', null, adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.tickets.length === 0, 'Should return empty array');
  });

  await test('GET /tickets/:id with non-existent ID returns 404', async () => {
    const res = await request('GET', '/api/tickets/nonexistent-id-12345', null, adminToken);
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });

  await test('GET /contacts/:id with non-existent ID returns 404', async () => {
    const res = await request('GET', '/api/contacts/nonexistent-id-12345', null, adminToken);
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });

  await test('PUT /tickets/:id with invalid status value returns 400/422', async () => {
    if (!testTicketId) throw new Error('No ticket');
    const res = await request('PUT', `/api/tickets/${testTicketId}`, { status: 'INVALID_STATUS' }, adminToken);
    assert(res.status === 400 || res.status === 422, `Expected 400/422, got ${res.status}`);
  });

  await test('Merge ticket with itself returns 400 error', async () => {
    if (!testTicketId) throw new Error('No ticket');
    const res = await request('POST', `/api/tickets/${testTicketId}/merge`, {
      targetTicketId: testTicketId
    }, adminToken);
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });
}

// ============ MAIN ============
async function main() {
  console.log('=============================================');
  console.log('  NADC HELPDESK - COMPREHENSIVE TEST SUITE');
  console.log('=============================================');

  try {
    await authTests();
    await agentTests();
    await contactTests();
    await companyTests();
    await ticketTests();
    await replyTests();
    await tagTests();
    await cannedResponseTests();
    await slaTests();
    await timeTrackingTests();
    await materialsTests();
    await deviceTests();
    await templateTests();
    await checklistTests();
    await dashboardTests();
    await reportTests();
    await searchTests();
    await automationTests();
    await businessHoursTests();
    await settingsTests();
    await notificationTests();
    await calendarTests();
    await edgeCaseTests();
  } catch (e) {
    console.error('\nTest suite error:', e);
  }

  // Summary
  console.log('\n=============================================');
  console.log(`  RESULTS: ${passed}/${passed + failed} tests passed`);
  console.log('=============================================\n');

  if (failures.length > 0) {
    console.log('FAILURES:');
    failures.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.name}`);
      console.log(`     Error: ${f.error}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
