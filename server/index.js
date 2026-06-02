require('dotenv').config();
// Server startup
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// CORS origins for development (allows localhost and local network)
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://10.0.0.13:5173',
  'http://172.18.80.1:5173',
  'http://172.24.144.1:5173',
  process.env.CLIENT_URL,
].filter(Boolean);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (process.env.NODE_ENV !== 'production') {
      // Allow all origins only in development mode
      callback(null, true);
    } else {
      // Reject unauthorized origins in production
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
const uploadsDir = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads', express.static(path.join(__dirname, uploadsDir)));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// Route imports - Phase 2
// ============================================================================
const authRoutes = require('./routes/auth');
const agentRoutes = require('./routes/agents');
const groupRoutes = require('./routes/groups');

app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/groups', groupRoutes);

// ============================================================================
// Route imports - Phase 3
// ============================================================================
const ticketRoutes = require('./routes/tickets');
const tagRoutes = require('./routes/tags');
const customFieldRoutes = require('./routes/customFields');
const slaRoutes = require('./routes/sla');

app.use('/api/tickets', ticketRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/custom-fields', customFieldRoutes);
app.use('/api/sla-policies', slaRoutes);

// ============================================================================
// Route imports - Phase 4
// ============================================================================
const replyRoutes = require('./routes/replies');
const ticketAttachmentRoutes = require('./routes/ticketAttachments');
const attachmentRoutes = require('./routes/attachments');
const cannedResponseRoutes = require('./routes/cannedResponses');

app.use('/api/tickets/:ticketId/replies', replyRoutes);
app.use('/api/tickets/:ticketId/attachments', ticketAttachmentRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/canned-responses', cannedResponseRoutes);

// ============================================================================
// Route imports - Phase 5
// ============================================================================
const contactRoutes = require('./routes/contacts');
const companyRoutes = require('./routes/companies');

app.use('/api/contacts', contactRoutes);
app.use('/api/companies', companyRoutes);

// ============================================================================
// Route imports - Phase 5b
// ============================================================================
const timeEntryRoutes = require('./routes/timeEntries');
const materialEntryRoutes = require('./routes/materialEntries');
const deviceRoutes = require('./routes/devices');
const ticketDeviceRoutes = require('./routes/ticketDevices');
const templateRoutes = require('./routes/templates');
const checklistRoutes = require('./routes/checklist');
const satisfactionRoutes = require('./routes/satisfaction');
const settingsRoutes = require('./routes/settings');
const calendarRoutes = require('./routes/calendar');
const calendarEventsRoutes = require('./routes/calendarEvents');

// Ticket sub-routes (must use mergeParams)
app.use('/api/tickets/:ticketId/time', timeEntryRoutes);
app.use('/api/tickets/:ticketId/materials', materialEntryRoutes);
app.use('/api/tickets/:ticketId/devices', ticketDeviceRoutes);
app.use('/api/tickets/:ticketId/checklist', checklistRoutes);

// Main routes
app.use('/api/devices', deviceRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/satisfaction', satisfactionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/calendar-events', calendarEventsRoutes);

// ============================================================================
// Route imports - Phase 6
// ============================================================================
const notificationRoutes = require('./routes/notifications');

app.use('/api/notifications', notificationRoutes);

// ============================================================================
// Route imports - Phase 7
// ============================================================================
const businessHoursRoutes = require('./routes/businessHours');
const dashboardRoutes = require('./routes/dashboard');
const reportRoutes = require('./routes/reports');
const automationRoutes = require('./routes/automations');
const searchRoutes = require('./routes/search');

app.use('/api/business-hours', businessHoursRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/search', searchRoutes);

// Import routes (admin only - Freshdesk migration)
const importRoutes = require('./routes/import');
app.use('/api/import', importRoutes);

// ============================================================================
// Route imports - Phase 8 (Client Portal & Knowledge Base)
// ============================================================================
const portalAuthRoutes = require('./routes/portalAuth');
const portalTicketRoutes = require('./routes/portalTickets');
const kbRoutes = require('./routes/kb');

// Portal routes (public and portal-authenticated)
app.use('/api/portal/auth', portalAuthRoutes);
app.use('/api/portal/tickets', portalTicketRoutes);

// Knowledge base routes (public read, agent-only write)
app.use('/api/kb', kbRoutes);
// ============================================================================

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join a ticket room
  socket.on('join:ticket', ({ ticketId }) => {
    if (ticketId) {
      socket.join(`ticket:${ticketId}`);
      console.log(`[Socket.io] ${socket.id} joined room ticket:${ticketId}`);
    }
  });

  // Leave a ticket room
  socket.on('leave:ticket', ({ ticketId }) => {
    if (ticketId) {
      socket.leave(`ticket:${ticketId}`);
      console.log(`[Socket.io] ${socket.id} left room ticket:${ticketId}`);
    }
  });

  // Join user room for personal notifications
  socket.on('join:user', ({ userId }) => {
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`[Socket.io] ${socket.id} joined room user:${userId}`);
    }
  });

  // Leave user room
  socket.on('leave:user', ({ userId }) => {
    if (userId) {
      socket.leave(`user:${userId}`);
      console.log(`[Socket.io] ${socket.id} left room user:${userId}`);
    }
  });

  // Join agents room for broadcast notifications
  socket.on('join:agents', () => {
    socket.join('agents');
    console.log(`[Socket.io] ${socket.id} joined agents room`);
  });

  // Typing indicator
  socket.on('ticket:typing', ({ ticketId, user, isTyping }) => {
    if (ticketId) {
      // Broadcast to everyone in the ticket room except the sender
      socket.to(`ticket:${ticketId}`).emit('ticket:typing', {
        ticketId,
        user,
        isTyping,
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.set('io', io);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, 'public');
  app.use(express.static(publicPath));

  // Handle client-side routing - serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// 404 handler (for API routes only in production)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err.message);
    console.error(err.stack);
  }

  // Prisma errors
  if (err.code === 'P2002') {
    return res.status(400).json({ error: 'A record with this value already exists' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }

  // Return error response
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'development'
    ? err.message
    : 'Internal server error';

  res.status(statusCode).json({ error: message });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Initialize notification service with Socket.io
  const notificationService = require('./services/notificationService');
  notificationService.setSocketIO(io);

  // Initialize SLA checker cron job
  const { scheduleSLAChecker } = require('./jobs/slaChecker');
  scheduleSLAChecker();

  // Initialize review request job
  const { scheduleReviewRequestJob } = require('./jobs/reviewRequestJob');
  scheduleReviewRequestJob();

  // Initialize automation job
  const { scheduleAutomationJob } = require('./jobs/automationJob');
  scheduleAutomationJob();

  // Start IMAP listener if configured
  const { startImapListener } = require('./services/imapService');
  startImapListener();
});

module.exports = { app, server, io };
