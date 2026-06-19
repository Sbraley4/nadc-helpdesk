const { PrismaClient } = require('@prisma/client');
const { deleteFile, getFileUrl } = require('../utils/fileUtils');
const {
  sendAgentReplyEmail,
  sendReplyNotificationToAgent,
  sendNoteNotificationToAgent,
} = require('../services/emailService');
const { runAutomations } = require('../services/automationEngine');

const prisma = new PrismaClient();

/**
 * Get all replies for a ticket
 * GET /api/tickets/:ticketId/replies
 */
async function getReplies(req, res, next) {
  try {
    const { ticketId } = req.params;

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Get replies - agents/admins see all, others only see public
    const replies = await prisma.ticketReply.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
            role: true,
          },
        },
        attachments: {
          select: {
            id: true,
            filename: true,
            storedName: true,
            mimeType: true,
            size: true,
            createdAt: true,
          },
        },
      },
    });

    // Add file URLs to attachments
    const repliesWithUrls = replies.map((reply) => ({
      ...reply,
      attachments: reply.attachments.map((att) => ({
        ...att,
        url: getFileUrl(att.storedName),
      })),
    }));

    res.json({ replies: repliesWithUrls });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a reply or internal note
 * POST /api/tickets/:ticketId/replies
 */
async function createReply(req, res, next) {
  try {
    const { ticketId } = req.params;
    const { body, isInternal, notifyAgentIds } = req.body;
    const files = req.files || [];

    // Parse notifyAgentIds if it's a JSON string
    let agentIdsToNotify = [];
    if (notifyAgentIds) {
      try {
        agentIdsToNotify = typeof notifyAgentIds === 'string'
          ? JSON.parse(notifyAgentIds)
          : notifyAgentIds;
      } catch (e) {
        agentIdsToNotify = [];
      }
    }

    // Validate body
    if (!body || body.trim() === '') {
      return res.status(400).json({ error: 'Reply body is required' });
    }

    // Verify ticket exists and get requester, assignee, and additional assignees for notifications
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        requester: {
          select: { id: true, name: true, email: true },
        },
        assignee: {
          select: { id: true, name: true, email: true },
        },
        additionalAssignees: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!ticket) {
      // Clean up uploaded files if ticket not found
      for (const file of files) {
        deleteFile(file.filename);
      }
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const isInternalNote = isInternal === 'true' || isInternal === true;

    // Create reply with attachments in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the reply
      const reply = await tx.ticketReply.create({
        data: {
          body: body.trim(),
          isInternal: isInternalNote,
          authorId: req.user.id,
          ticketId,
        },
      });

      // Create attachments if files uploaded
      const attachments = [];
      for (const file of files) {
        const attachment = await tx.ticketAttachment.create({
          data: {
            filename: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            replyId: reply.id,
            uploadedById: req.user.id,
          },
        });
        attachments.push(attachment);
      }

      // Update ticket and create activity based on reply type
      if (!isInternalNote) {
        // Public reply
        const updates = { updatedAt: new Date() };

        // Set firstResponseAt if null
        if (!ticket.firstResponseAt) {
          updates.firstResponseAt = new Date();
        }

        // Reopen ticket if it was in a completed state
        if (['INVOICED', 'POSTED', 'CLOSED'].includes(ticket.status)) {
          updates.status = 'OPEN';

          // Create reopen activity
          await tx.ticketActivity.create({
            data: {
              ticketId,
              type: 'status_changed',
              description: 'Ticket reopened due to new reply',
              userId: req.user.id,
              metadata: {
                oldStatus: ticket.status,
                newStatus: 'OPEN',
              },
            },
          });
        }

        await tx.ticket.update({
          where: { id: ticketId },
          data: updates,
        });

        // Create reply activity
        await tx.ticketActivity.create({
          data: {
            ticketId,
            type: 'reply_added',
            description: 'Reply sent to requester',
            userId: req.user.id,
          },
        });
      } else {
        // Internal note
        await tx.ticketActivity.create({
          data: {
            ticketId,
            type: 'note_added',
            description: 'Internal note added',
            userId: req.user.id,
          },
        });

        // Create notifications for notified agents
        if (agentIdsToNotify && agentIdsToNotify.length > 0) {
          for (const agentId of agentIdsToNotify) {
            // Don't notify the author
            if (agentId === req.user.id) continue;

            await tx.notification.create({
              data: {
                userId: agentId,
                type: 'note_mention',
                title: 'You were mentioned in a note',
                message: `${req.user.name} mentioned you in a note on ticket #${ticket.ticketNumber}`,
                relatedTicketId: ticketId,
              },
            });
          }
        }
      }

      return { reply, attachments };
    });

    // Fetch full reply with author and attachments
    const fullReply = await prisma.ticketReply.findUnique({
      where: { id: result.reply.id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
            role: true,
          },
        },
        attachments: {
          select: {
            id: true,
            filename: true,
            storedName: true,
            mimeType: true,
            size: true,
            createdAt: true,
          },
        },
      },
    });

    // Add file URLs
    const replyWithUrls = {
      ...fullReply,
      attachments: fullReply.attachments.map((att) => ({
        ...att,
        url: getFileUrl(att.storedName),
      })),
    };

    // Emit Socket.io event
    const io = req.app.get('io');
    if (io) {
      io.to(`ticket:${ticketId}`).emit('ticket:reply', {
        ticketId,
        reply: replyWithUrls,
      });
      console.log(`[Socket.io] Emitted ticket:reply to room ticket:${ticketId}`);

      // Emit notification events for notified agents
      if (isInternalNote && agentIdsToNotify && agentIdsToNotify.length > 0) {
        for (const agentId of agentIdsToNotify) {
          if (agentId === req.user.id) continue;
          io.to(`user:${agentId}`).emit('notification:new', {
            type: 'note_mention',
            title: 'You were mentioned in a note',
            ticketId,
          });
        }
      }
    }

    // Send email to requester for public replies
    if (!isInternalNote && ticket.requester?.email) {
      const agent = { id: req.user.id, name: req.user.name };
      sendAgentReplyEmail(ticket, fullReply, agent, ticket.requester).catch((err) =>
        console.error('[Reply] Failed to send reply email:', err.message)
      );
    }

    // Handle agent notifications differently for internal notes vs public replies
    if (isInternalNote) {
      // INTERNAL NOTE: Notify agents from notifyAgentIds (user-selected list)
      if (agentIdsToNotify && agentIdsToNotify.length > 0) {
        // Fetch full agent records from database
        const agentsToNotify = await prisma.user.findMany({
          where: {
            id: { in: agentIdsToNotify },
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
        });

        const author = { id: req.user.id, name: req.user.name };

        for (const agent of agentsToNotify) {
          if (agent.email) {
            sendNoteNotificationToAgent(ticket, fullReply, author, agent)
              .catch((err) => console.error(`[Reply] Failed to send note email to agent ${agent.id}:`, err.message));
          }
        }
      }
    } else {
      // PUBLIC REPLY: Notify assigned agents (primary + additional), excluding the author
      const allAssignedAgents = [];
      if (ticket.assignee && ticket.assignee.id !== req.user.id && ticket.assignee.email) {
        allAssignedAgents.push(ticket.assignee);
      }
      if (ticket.additionalAssignees && ticket.additionalAssignees.length > 0) {
        for (const ta of ticket.additionalAssignees) {
          const agent = ta.user || ta;
          // Skip the person making the change, and skip duplicates
          if (agent && agent.email && agent.id !== req.user.id && !allAssignedAgents.some(a => a.id === agent.id)) {
            allAssignedAgents.push(agent);
          }
        }
      }

      const author = { id: req.user.id, name: req.user.name };

      for (const agent of allAssignedAgents) {
        // Create in-app notification for agent
        await prisma.notification.create({
          data: {
            userId: agent.id,
            type: 'reply_added',
            title: 'New reply on your ticket',
            message: `${req.user.name} added a reply to ticket #${ticket.ticketNumber || ticketId}`,
            relatedTicketId: ticketId,
          },
        }).catch((err) => console.error(`[Reply] Failed to create notification for agent ${agent.id}:`, err.message));

        // Emit socket notification to agent
        if (io) {
          io.to(`user:${agent.id}`).emit('notification:new', {
            type: 'reply_added',
            title: 'New reply on your ticket',
            message: `${req.user.name} added a reply to ticket #${ticket.ticketNumber || ticketId}`,
            ticketId,
          });
        }

        // Send email notification to agent
        sendReplyNotificationToAgent(ticket, fullReply, author, agent).catch((err) =>
          console.error(`[Reply] Failed to send reply email to agent ${agent.id}:`, err.message)
        );
      }
    }

    // Run automations for public replies
    if (!isInternalNote) {
      try {
        const fullTicket = await prisma.ticket.findUnique({
          where: { id: ticketId },
          include: {
            requester: { select: { id: true, name: true, email: true } },
            company: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true, email: true } },
            group: { select: { id: true, name: true } },
            tags: { include: { tag: true } },
          },
        });
        await runAutomations('REPLY_RECEIVED', fullTicket, {});
      } catch (automationError) {
        console.error('[Automation] Error running automations:', automationError.message);
      }
    }

    res.status(201).json(replyWithUrls);
  } catch (error) {
    // Log the full error for debugging
    console.error('[Reply] CAUGHT ERROR:', error);
    console.error('[Reply] Error stack:', error.stack);

    // Clean up uploaded files on error
    if (req.files) {
      for (const file of req.files) {
        deleteFile(file.filename);
      }
    }
    next(error);
  }
}

/**
 * Update a reply
 * PUT /api/tickets/:ticketId/replies/:replyId
 */
async function updateReply(req, res, next) {
  try {
    const { ticketId, replyId } = req.params;
    const { body } = req.body;

    // Find the reply
    const reply = await prisma.ticketReply.findUnique({
      where: { id: replyId },
      include: { author: true },
    });

    if (!reply) {
      return res.status(404).json({ error: 'Reply not found' });
    }

    if (reply.ticketId !== ticketId) {
      return res.status(400).json({ error: 'Reply does not belong to this ticket' });
    }

    // Only author or admin can edit
    if (reply.authorId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to edit this reply' });
    }

    // Validate body
    if (!body || body.trim() === '') {
      return res.status(400).json({ error: 'Reply body is required' });
    }

    // Update reply
    const updatedReply = await prisma.ticketReply.update({
      where: { id: replyId },
      data: {
        body: body.trim(),
        updatedAt: new Date(),
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
            role: true,
          },
        },
        attachments: {
          select: {
            id: true,
            filename: true,
            storedName: true,
            mimeType: true,
            size: true,
            createdAt: true,
          },
        },
      },
    });

    // Add file URLs
    const replyWithUrls = {
      ...updatedReply,
      attachments: updatedReply.attachments.map((att) => ({
        ...att,
        url: getFileUrl(att.storedName),
      })),
    };

    res.json(replyWithUrls);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a reply (ADMIN only)
 * DELETE /api/tickets/:ticketId/replies/:replyId
 */
async function deleteReply(req, res, next) {
  try {
    const { ticketId, replyId } = req.params;

    // Find the reply with attachments
    const reply = await prisma.ticketReply.findUnique({
      where: { id: replyId },
      include: { attachments: true },
    });

    if (!reply) {
      return res.status(404).json({ error: 'Reply not found' });
    }

    if (reply.ticketId !== ticketId) {
      return res.status(400).json({ error: 'Reply does not belong to this ticket' });
    }

    // Delete attachments from disk
    for (const attachment of reply.attachments) {
      deleteFile(attachment.storedName);
    }

    // Delete reply (cascades to attachments due to schema)
    await prisma.ticketReply.delete({
      where: { id: replyId },
    });

    res.json({ message: 'Reply deleted' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getReplies,
  createReply,
  updateReply,
  deleteReply,
};
