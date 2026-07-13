const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { deleteFile, getFileUrl } = require('../utils/fileUtils');
const { UPLOAD_DIR } = require('../middleware/upload');

const prisma = new PrismaClient();

/**
 * Upload attachments to a ticket (not linked to a reply)
 * POST /api/tickets/:ticketId/attachments
 */
async function uploadTicketAttachment(req, res, next) {
  try {
    const { ticketId } = req.params;
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      // Clean up uploaded files
      for (const file of files) {
        deleteFile(file.filename);
      }
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Create attachments and activity in transaction
    const result = await prisma.$transaction(async (tx) => {
      const attachments = [];

      for (const file of files) {
        const attachment = await tx.ticketAttachment.create({
          data: {
            filename: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            ticketId,
            uploadedById: req.user.id,
          },
        });
        attachments.push(attachment);
      }

      // Create activity
      const filenames = files.map((f) => f.originalname).join(', ');
      await tx.ticketActivity.create({
        data: {
          ticketId,
          type: 'attachment_added',
          description: `Attachment(s) added: ${filenames}`,
          userId: req.user.id,
        },
      });

      return attachments;
    });

    // Add URLs to response
    const attachmentsWithUrls = result.map((att) => ({
      ...att,
      url: getFileUrl(att.storedName),
    }));

    res.status(201).json({ attachments: attachmentsWithUrls });
  } catch (error) {
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
 * Get all attachments for a ticket (grouped by ticket-level and reply-level)
 * GET /api/tickets/:ticketId/attachments
 */
async function getTicketAttachments(req, res, next) {
  try {
    const { ticketId } = req.params;

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Get all attachments for this ticket
    const allAttachments = await prisma.ticketAttachment.findMany({
      where: {
        OR: [
          { ticketId },
          { reply: { ticketId } },
        ],
      },
      include: {
        uploadedBy: {
          select: { name: true },
        },
        reply: {
          select: {
            id: true,
            isInternal: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Add URLs and group
    const ticketAttachments = [];
    const replyAttachments = [];

    for (const att of allAttachments) {
      const attachmentWithUrl = {
        ...att,
        url: getFileUrl(att.storedName),
      };

      if (att.replyId) {
        replyAttachments.push(attachmentWithUrl);
      } else {
        ticketAttachments.push(attachmentWithUrl);
      }
    }

    res.json({
      ticketAttachments,
      replyAttachments,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete an attachment
 * DELETE /api/attachments/:id
 */
async function deleteAttachment(req, res, next) {
  try {
    const { id } = req.params;

    // Find attachment
    const attachment = await prisma.ticketAttachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Only uploader or admin can delete
    if (attachment.uploadedById !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to delete this attachment' });
    }

    // Delete file from disk
    deleteFile(attachment.storedName);

    // Delete record
    await prisma.ticketAttachment.delete({
      where: { id },
    });

    res.json({ message: 'Attachment deleted' });
  } catch (error) {
    next(error);
  }
}

/**
 * Generate a short-lived signed preview URL for an attachment
 * GET /api/attachments/:id/preview-url
 */
async function getPreviewUrl(req, res, next) {
  try {
    const { id } = req.params;

    // Verify attachment exists
    const attachment = await prisma.ticketAttachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Generate short-lived token (5 minute expiry) tied to this attachment
    const token = jwt.sign(
      {
        attachmentId: id,
        type: 'attachment_preview',
      },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    // Return the signed URL
    res.json({
      url: `/api/attachments/${id}/download?token=${encodeURIComponent(token)}`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Download an attachment
 * GET /api/attachments/:id/download
 * Accepts either Authorization Bearer header OR ?token= query param
 */
async function downloadAttachment(req, res, next) {
  try {
    const { id } = req.params;

    // Find attachment
    const attachment = await prisma.ticketAttachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Build file path
    const filePath = path.join(UPLOAD_DIR, attachment.storedName);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Set Content-Disposition header and stream file
    res.download(filePath, attachment.filename, (err) => {
      if (err) {
        // Don't send error if headers already sent
        if (!res.headersSent) {
          next(err);
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  uploadTicketAttachment,
  getTicketAttachments,
  deleteAttachment,
  downloadAttachment,
  getPreviewUrl,
};
