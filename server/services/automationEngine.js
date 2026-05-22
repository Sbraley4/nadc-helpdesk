// server/services/automationEngine.js
const { PrismaClient } = require('@prisma/client');
const { sendTicketAssignedEmail } = require('./emailService');

const prisma = new PrismaClient();

/**
 * Run automations for a given trigger on a ticket
 * @param {string} trigger - AutomationTrigger enum value
 * @param {object} ticket - Full ticket object with relations
 * @param {object} changes - What changed (for TICKET_UPDATED)
 * @returns {object} { fired: [ruleNames], actionsExecuted: Int }
 */
async function runAutomations(trigger, ticket, changes = {}) {
  const result = { fired: [], actionsExecuted: 0 };
  let currentTicket = ticket;
  let passCount = 0;
  const maxPasses = 3;

  while (passCount < maxPasses) {
    passCount++;
    let anyFired = false;

    // Load active automation rules for this trigger
    const rules = await prisma.automationRule.findMany({
      where: { trigger, isActive: true },
      orderBy: { runOrder: 'asc' },
    });

    for (const rule of rules) {
      // Skip if already fired this rule (prevent re-firing)
      if (result.fired.includes(rule.name)) continue;

      // Evaluate all conditions
      const conditions = rule.conditions;
      let allPassed = true;

      for (const condition of conditions) {
        if (!evaluateCondition(condition, currentTicket)) {
          allPassed = false;
          break;
        }
      }

      if (allPassed) {
        console.log(`[Automation] '${rule.name}' fired on ticket #${currentTicket.ticketNumber}`);
        result.fired.push(rule.name);
        anyFired = true;

        // Execute all actions
        for (const action of rule.actions) {
          await executeAction(action, currentTicket, rule.name);
          result.actionsExecuted++;
        }

        // Re-fetch ticket after actions
        currentTicket = await prisma.ticket.findUnique({
          where: { id: currentTicket.id },
          include: {
            requester: { select: { id: true, name: true, email: true } },
            company: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true, email: true } },
            group: { select: { id: true, name: true } },
            tags: { include: { tag: true } },
          },
        });
      }
    }

    // If no rules fired this pass, we're done
    if (!anyFired) break;
  }

  return result;
}

/**
 * Evaluate a single condition against a ticket
 */
function evaluateCondition(condition, ticket) {
  const { field, operator, value } = condition;
  let fieldValue;

  // Get field value from ticket
  switch (field) {
    case 'status':
      fieldValue = ticket.status;
      break;
    case 'priority':
      fieldValue = ticket.priority;
      break;
    case 'type':
      fieldValue = ticket.type;
      break;
    case 'assigneeId':
      fieldValue = ticket.assigneeId || 'unassigned';
      break;
    case 'groupId':
      fieldValue = ticket.groupId || null;
      break;
    case 'companyId':
      fieldValue = ticket.companyId || null;
      break;
    case 'tag':
      // Check if tag exists in ticket tags
      const tagNames = ticket.tags?.map((t) => t.tag?.name || t.name) || [];
      fieldValue = tagNames;
      break;
    case 'subject':
      fieldValue = ticket.subject || '';
      break;
    case 'requesterEmail':
      fieldValue = ticket.requester?.email || '';
      break;
    case 'ticketAgeDays':
      const ageMs = Date.now() - new Date(ticket.createdAt).getTime();
      fieldValue = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      break;
    default:
      return false;
  }

  // Apply operator
  switch (operator) {
    case 'is':
      if (Array.isArray(fieldValue)) {
        return fieldValue.some((v) => v.toLowerCase() === value.toLowerCase());
      }
      return String(fieldValue).toLowerCase() === String(value).toLowerCase();

    case 'is_not':
      if (Array.isArray(fieldValue)) {
        return !fieldValue.some((v) => v.toLowerCase() === value.toLowerCase());
      }
      return String(fieldValue).toLowerCase() !== String(value).toLowerCase();

    case 'contains':
      if (Array.isArray(fieldValue)) {
        return fieldValue.some((v) => v.toLowerCase().includes(value.toLowerCase()));
      }
      return String(fieldValue).toLowerCase().includes(value.toLowerCase());

    case 'not_contains':
      if (Array.isArray(fieldValue)) {
        return !fieldValue.some((v) => v.toLowerCase().includes(value.toLowerCase()));
      }
      return !String(fieldValue).toLowerCase().includes(value.toLowerCase());

    case 'greater_than':
      return parseFloat(fieldValue) > parseFloat(value);

    case 'less_than':
      return parseFloat(fieldValue) < parseFloat(value);

    default:
      return false;
  }
}

/**
 * Execute a single action on a ticket
 */
async function executeAction(action, ticket, ruleName) {
  const { type, value } = action;

  switch (type) {
    case 'set_status':
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: value },
      });
      await createActivityLog(ticket.id, 'STATUS_CHANGED',
        `Automation '${ruleName}': Status changed to ${value}`);
      break;

    case 'set_priority':
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { priority: value },
      });
      await createActivityLog(ticket.id, 'PRIORITY_CHANGED',
        `Automation '${ruleName}': Priority changed to ${value}`);
      break;

    case 'assign_agent':
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { assigneeId: value },
      });
      await createActivityLog(ticket.id, 'ASSIGNED',
        `Automation '${ruleName}': Assigned to agent`);

      // Send email notification
      const agent = await prisma.user.findUnique({ where: { id: value } });
      if (agent) {
        try {
          await sendTicketAssignedEmail(ticket, agent);
        } catch (e) {
          console.error('[Automation] Failed to send assignment email:', e.message);
        }
      }
      break;

    case 'assign_group':
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { groupId: value },
      });
      await createActivityLog(ticket.id, 'GROUP_CHANGED',
        `Automation '${ruleName}': Assigned to group`);
      break;

    case 'add_tag':
      // Find or create tag
      let tag = await prisma.tag.findUnique({ where: { name: value } });
      if (!tag) {
        tag = await prisma.tag.create({ data: { name: value } });
      }
      // Add to ticket if not exists
      const existingTag = await prisma.ticketTag.findUnique({
        where: { ticketId_tagId: { ticketId: ticket.id, tagId: tag.id } },
      });
      if (!existingTag) {
        await prisma.ticketTag.create({
          data: { ticketId: ticket.id, tagId: tag.id },
        });
        await createActivityLog(ticket.id, 'TAG_ADDED',
          `Automation '${ruleName}': Added tag '${value}'`);
      }
      break;

    case 'remove_tag':
      const tagToRemove = await prisma.tag.findUnique({ where: { name: value } });
      if (tagToRemove) {
        await prisma.ticketTag.deleteMany({
          where: { ticketId: ticket.id, tagId: tagToRemove.id },
        });
        await createActivityLog(ticket.id, 'TAG_REMOVED',
          `Automation '${ruleName}': Removed tag '${value}'`);
      }
      break;

    case 'send_email':
      // value = email address or "requester" or "assignee"
      let emailTo;
      if (value === 'requester') {
        emailTo = ticket.requester?.email;
      } else if (value === 'assignee') {
        emailTo = ticket.assignee?.email;
      } else {
        emailTo = value;
      }

      if (emailTo) {
        // Simple notification email
        console.log(`[Automation] Would send email to ${emailTo} for ticket #${ticket.ticketNumber}`);
        await createActivityLog(ticket.id, 'EMAIL_SENT',
          `Automation '${ruleName}': Email sent to ${emailTo}`);
      }
      break;

    case 'add_note':
      // Resolve variables in note text
      let noteText = value;
      noteText = noteText.replace(/\{\{ticket_number\}\}/g, `#${ticket.ticketNumber}`);
      noteText = noteText.replace(/\{\{requester_name\}\}/g, ticket.requester?.name || 'Unknown');
      noteText = noteText.replace(/\{\{assignee_name\}\}/g, ticket.assignee?.name || 'Unassigned');

      // Get first admin for author
      const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
      if (admin) {
        await prisma.ticketReply.create({
          data: {
            ticketId: ticket.id,
            authorId: admin.id,
            body: noteText,
            isInternal: true,
          },
        });
        await createActivityLog(ticket.id, 'NOTE_ADDED',
          `Automation '${ruleName}': Internal note added`);
      }
      break;
  }
}

async function createActivityLog(ticketId, type, description) {
  await prisma.ticketActivity.create({
    data: { ticketId, type, description },
  });
}

/**
 * Test automation without executing actions
 */
async function testAutomation(ruleId, ticketId) {
  const rule = await prisma.automationRule.findUnique({ where: { id: ruleId } });
  if (!rule) throw new Error('Automation rule not found');

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, email: true } },
      group: { select: { id: true, name: true } },
      tags: { include: { tag: true } },
    },
  });
  if (!ticket) throw new Error('Ticket not found');

  const conditionsResult = [];
  let wouldFire = true;

  for (const condition of rule.conditions) {
    const passed = evaluateCondition(condition, ticket);
    const actualValue = getFieldValue(condition.field, ticket);

    conditionsResult.push({
      condition: `${condition.field} ${condition.operator} ${condition.value}`,
      passed,
      actualValue: String(actualValue),
    });

    if (!passed) wouldFire = false;
  }

  const actions = rule.actions.map((a) => `${a.type}: ${a.value}`);

  return { conditionsResult, wouldFire, actions };
}

function getFieldValue(field, ticket) {
  switch (field) {
    case 'status': return ticket.status;
    case 'priority': return ticket.priority;
    case 'type': return ticket.type;
    case 'assigneeId': return ticket.assigneeId || 'unassigned';
    case 'groupId': return ticket.groupId;
    case 'companyId': return ticket.companyId;
    case 'tag': return ticket.tags?.map((t) => t.tag?.name).join(', ') || '';
    case 'subject': return ticket.subject;
    case 'requesterEmail': return ticket.requester?.email;
    case 'ticketAgeDays':
      const ageMs = Date.now() - new Date(ticket.createdAt).getTime();
      return Math.floor(ageMs / (1000 * 60 * 60 * 24));
    default: return '';
  }
}

module.exports = {
  runAutomations,
  evaluateCondition,
  executeAction,
  testAutomation,
};
