# NADC Helpdesk — Build Progress

## Summary

| Phase | Description | Status | Completed |
|-------|-------------|--------|-----------|
| 1 | Scaffold & Schema | ✅ Complete | 2026-05-19 |
| 2 | Auth & Agents | ✅ Complete | 2026-05-19 |
| 3 | Core Ticket Engine | ✅ Complete | 2026-05-19 |
| 4 | Replies, Notes & Attachments | ✅ Complete | 2026-05-19 |
| 5 | Contacts, Companies & Frontend UI | ✅ Complete | 2026-05-19 |
| 5b | Extended Features & Mobile-First UI | ✅ Complete | 2026-05-20 |
| 6 | Email & Notifications | ✅ Complete | 2026-05-20 |
| 7 | SLA, Automations & Dashboard | ✅ Complete | 2026-05-23 |
| 8 | Client Portal & Knowledge Base | ⏳ Pending | - |

---

## Phase 1 — Scaffold & Schema ✅

**Completed:** 2026-05-19

### Tasks
- [x] Project folder structure created
- [x] Root package.json with concurrent scripts
- [x] Client initialized (Vite + React + Tailwind CSS v3)
- [x] Server initialized (Express + all dependencies)
- [x] Complete Prisma schema with all 21 models
- [x] docker-compose.yml created
- [x] .env.example created
- [x] Express server entry point with health check
- [x] Socket.io attached
- [x] PROGRESS.md created
- [x] README.md created
- [x] .gitignore created

### Verification Results
| Check | Result |
|-------|--------|
| `npx prisma generate` | ✅ Passed |
| `npm run dev` starts server | ✅ "Server running on port 3001" |
| GET /api/health | ✅ Returns `{"status":"ok"}` |
| Folder structure | ✅ All directories created |

### Prisma Models Created (21 total)
- User, Contact, Company
- Ticket, TicketReply, TicketActivity, TicketAttachment
- Tag, TicketTag, TicketWatcher, RelatedTicket
- Group, UserGroup
- SLAPolicy, AutomationRule, CannedResponse
- KBCategory, KBArticle
- Notification, CustomField, CustomFieldValue, BusinessHours

---

## Phase 2 — Auth & Agents ✅

**Completed:** 2026-05-19

### Tasks
- [x] JWT auth (login, logout, refresh, /me)
- [x] Auth middleware (requireAuth, requireRole)
- [x] Agent CRUD with soft delete
- [x] Availability status endpoint
- [x] Groups CRUD
- [x] Input validation with express-validator
- [x] Global error handler
- [x] Seed data (1 admin, 2 agents, groups, tags, SLA policies, business hours)

### Files Created

**Middleware:**
- `/server/middleware/auth.js` - JWT verification (requireAuth)
- `/server/middleware/requireRole.js` - Role-based access control
- `/server/middleware/validate.js` - Input validation rules

**Controllers:**
- `/server/controllers/authController.js` - login, refresh, logout, me
- `/server/controllers/agentController.js` - Agent and Group CRUD

**Routes:**
- `/server/routes/auth.js` - POST /login, /refresh, /logout; GET /me
- `/server/routes/agents.js` - CRUD operations for agents
- `/server/routes/groups.js` - CRUD operations for groups

**Seed:**
- `/server/prisma/seed.js` - Database seed script

### API Endpoints (Phase 2)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | /api/auth/login | - | - | Login with email/password |
| POST | /api/auth/refresh | - | - | Refresh access token |
| POST | /api/auth/logout | ✓ | Any | Logout |
| GET | /api/auth/me | ✓ | Any | Get current user |
| GET | /api/agents | ✓ | Any | List all active agents |
| GET | /api/agents/:id | ✓ | Any | Get single agent |
| POST | /api/agents | ✓ | ADMIN | Create agent |
| PUT | /api/agents/:id | ✓ | ADMIN | Update agent |
| PATCH | /api/agents/:id/availability | ✓ | Any* | Update availability |
| DELETE | /api/agents/:id | ✓ | ADMIN | Soft delete agent |
| GET | /api/groups | ✓ | Any | List all groups |
| POST | /api/groups | ✓ | ADMIN | Create group |

---

## Phase 3 — Core Ticket Engine ✅

**Completed:** 2026-05-19

### Tasks
- [x] Ticket CRUD (list, get, create, update, delete)
- [x] Ticket filters (status, priority, assignee, company, tag, search, date range, SLA)
- [x] Pagination and sorting
- [x] Activity log (auto-created on ticket events)
- [x] Merge tickets
- [x] Link/unlink related tickets
- [x] Watchers (add/remove)
- [x] Tag CRUD
- [x] Custom fields CRUD
- [x] Saved views (static)
- [x] SLA policy CRUD
- [x] SLA checker cron job (every 15 min)
- [x] Business hours calculator utility
- [x] Sample tickets seeded (5 tickets, 2 contacts, 2 companies)

### Files Created

**Controllers:**
- `/server/controllers/ticketController.js` - Full ticket CRUD, merge, watchers, related tickets, activity
- `/server/controllers/tagController.js` - Tag CRUD
- `/server/controllers/customFieldController.js` - Custom fields CRUD
- `/server/controllers/slaController.js` - SLA policy CRUD

**Routes:**
- `/server/routes/tickets.js` - All ticket endpoints
- `/server/routes/tags.js` - Tag endpoints
- `/server/routes/customFields.js` - Custom field endpoints
- `/server/routes/sla.js` - SLA policy endpoints

**Utils:**
- `/server/utils/businessHours.js` - Business hours calculator

**Jobs:**
- `/server/jobs/slaChecker.js` - SLA breach checker cron job

### API Endpoints (Phase 3)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | /api/tickets | ✓ | Any | List tickets (paginated, filterable) |
| GET | /api/tickets/views | ✓ | Any | Get saved view definitions |
| GET | /api/tickets/:id | ✓ | Any | Get single ticket with all relations |
| POST | /api/tickets | ✓ | Any | Create ticket |
| PUT | /api/tickets/:id | ✓ | Any | Update ticket |
| DELETE | /api/tickets/:id | ✓ | ADMIN | Delete ticket |
| POST | /api/tickets/:id/merge | ✓ | ADMIN/AGENT | Merge into another ticket |
| POST | /api/tickets/:id/watchers | ✓ | Any | Add watcher |
| DELETE | /api/tickets/:id/watchers/:userId | ✓ | Any | Remove watcher |
| POST | /api/tickets/:id/related | ✓ | Any | Link tickets |
| DELETE | /api/tickets/:id/related/:relatedId | ✓ | Any | Unlink tickets |
| GET | /api/tickets/:id/activity | ✓ | Any | Get activity log |
| GET | /api/tags | ✓ | Any | List tags |
| POST | /api/tags | ✓ | ADMIN/AGENT | Create tag |
| PUT | /api/tags/:id | ✓ | ADMIN | Update tag |
| DELETE | /api/tags/:id | ✓ | ADMIN | Delete tag |
| GET | /api/custom-fields | ✓ | Any | List custom fields |
| POST | /api/custom-fields | ✓ | ADMIN | Create custom field |
| PUT | /api/custom-fields/:id | ✓ | ADMIN | Update custom field |
| DELETE | /api/custom-fields/:id | ✓ | ADMIN | Delete custom field |
| GET | /api/sla-policies | ✓ | Any | List SLA policies |
| POST | /api/sla-policies | ✓ | ADMIN | Create SLA policy |
| PUT | /api/sla-policies/:id | ✓ | ADMIN | Update SLA policy |
| DELETE | /api/sla-policies/:id | ✓ | ADMIN | Delete SLA policy |

### Ticket List Filters

| Parameter | Description | Example |
|-----------|-------------|---------|
| status | Filter by status | `?status=OPEN` |
| priority | Filter by priority | `?priority=HIGH` |
| assigneeId | Filter by assignee (or "unassigned") | `?assigneeId=unassigned` |
| companyId | Filter by company | `?companyId=xxx` |
| groupId | Filter by group | `?groupId=xxx` |
| tag | Filter by tag name | `?tag=microsoft-365` |
| search | Search subject/description | `?search=email` |
| dueBefore | Due before date | `?dueBefore=2026-05-20` |
| slaBreached | Filter SLA breached | `?slaBreached=true` |
| createdAfter | Created after date | `?createdAfter=2026-05-01` |
| createdBefore | Created before date | `?createdBefore=2026-05-31` |
| sortBy | Sort field | `?sortBy=priority` |
| order | Sort order | `?order=desc` |
| page | Page number | `?page=1` |
| limit | Items per page | `?limit=25` |

### Seed Data (Updated)
- **Users:** Sam Admin (admin), Tech One (agent), Tech Two (agent)
- **Companies:** Acme Corp, Tech Firm LLC
- **Contacts:** John Smith (Acme), Sarah Lee (Tech Firm)
- **Groups:** Tier 1 Support (with both agents)
- **Tags:** microsoft-365, networking, voip
- **SLA Policies:** LOW (8h/48h), MEDIUM (4h/24h), HIGH (2h/8h), URGENT (1h/4h)
- **Business Hours:** Mon-Fri 9:00-17:00, Sat-Sun closed
- **Tickets:** 5 sample tickets with various statuses, priorities, and assignments

### Verification Checklist
```bash
# Start PostgreSQL and seed
docker compose up -d db
cd server
npx prisma db push
npx prisma db seed

# Start server (SLA checker logs on startup)
npm run dev

# Test ticket endpoints:

# Create ticket
curl -X POST http://localhost:3001/api/tickets \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Test","description":"Test ticket","requesterId":"CONTACT_ID"}'

# List tickets with filters
curl "http://localhost:3001/api/tickets?status=OPEN&priority=HIGH" \
  -H "Authorization: Bearer TOKEN"

# Search tickets
curl "http://localhost:3001/api/tickets?search=email" \
  -H "Authorization: Bearer TOKEN"

# Get unassigned tickets
curl "http://localhost:3001/api/tickets?assigneeId=unassigned" \
  -H "Authorization: Bearer TOKEN"

# Get saved views
curl http://localhost:3001/api/tickets/views \
  -H "Authorization: Bearer TOKEN"

# Get ticket with relations
curl http://localhost:3001/api/tickets/TICKET_ID \
  -H "Authorization: Bearer TOKEN"

# Update ticket status
curl -X PUT http://localhost:3001/api/tickets/TICKET_ID \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"RESOLVED"}'

# Get activity log
curl http://localhost:3001/api/tickets/TICKET_ID/activity \
  -H "Authorization: Bearer TOKEN"

# Get tags
curl http://localhost:3001/api/tags \
  -H "Authorization: Bearer TOKEN"

# Get SLA policies
curl http://localhost:3001/api/sla-policies \
  -H "Authorization: Bearer TOKEN"
```

---

## Phase 4 — Replies, Notes & Attachments ✅

**Completed:** 2026-05-19

### Tasks
- [x] File upload middleware (multer, UUID filenames, mime validation)
- [x] Static file serving for /uploads
- [x] Reply CRUD (create, read, update, delete)
- [x] Internal notes (isInternal flag, same model as replies)
- [x] File attachments on tickets and replies (up to 5 files)
- [x] Attachment download endpoint
- [x] Canned responses CRUD with variable preview
- [x] Socket.io room management (join/leave ticket rooms)
- [x] Socket.io emit on new reply
- [x] 4 seeded canned responses

### Files Created

**Middleware:**
- `/server/middleware/upload.js` - Multer config with UUID filenames, mime validation, size limits

**Utils:**
- `/server/utils/fileUtils.js` - deleteFile, getFileUrl, formatFileSize

**Controllers:**
- `/server/controllers/replyController.js` - getReplies, createReply, updateReply, deleteReply
- `/server/controllers/attachmentController.js` - uploadTicketAttachment, getTicketAttachments, deleteAttachment, downloadAttachment
- `/server/controllers/cannedResponseController.js` - CRUD + previewCannedResponse with variable resolution

**Routes:**
- `/server/routes/replies.js` - Reply CRUD endpoints
- `/server/routes/ticketAttachments.js` - Ticket attachment upload/list
- `/server/routes/attachments.js` - Download/delete attachments
- `/server/routes/cannedResponses.js` - Canned response endpoints

### API Endpoints (Phase 4)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | /api/tickets/:ticketId/replies | ✓ | Any | List replies for ticket |
| POST | /api/tickets/:ticketId/replies | ✓ | Any | Create reply (with optional files) |
| PUT | /api/tickets/:ticketId/replies/:replyId | ✓ | Author/ADMIN | Update reply body |
| DELETE | /api/tickets/:ticketId/replies/:replyId | ✓ | ADMIN | Delete reply and attachments |
| POST | /api/tickets/:ticketId/attachments | ✓ | Any | Upload ticket attachments |
| GET | /api/tickets/:ticketId/attachments | ✓ | Any | List ticket attachments (grouped) |
| GET | /api/attachments/:id/download | ✓ | Any | Download attachment |
| DELETE | /api/attachments/:id | ✓ | ADMIN/AGENT | Delete attachment |
| GET | /api/canned-responses | ✓ | Any | List canned responses |
| GET | /api/canned-responses/:id | ✓ | Any | Get single canned response |
| POST | /api/canned-responses | ✓ | ADMIN/AGENT | Create canned response |
| PUT | /api/canned-responses/:id | ✓ | Creator/ADMIN | Update canned response |
| DELETE | /api/canned-responses/:id | ✓ | ADMIN | Delete canned response |
| POST | /api/canned-responses/:id/preview | ✓ | Any | Preview with resolved variables |

### File Upload Configuration
- **Max file size:** 10MB (configurable via MAX_FILE_SIZE_MB)
- **Max files per upload:** 5
- **Allowed types:** JPEG, PNG, GIF, WebP, PDF, Word, Excel, TXT, CSV
- **Storage:** UUID-named files in ./uploads directory

### Canned Response Variables
| Variable | Resolves To |
|----------|-------------|
| `{{requester_name}}` | ticket.requester.name |
| `{{ticket_id}}` | #ticket.ticketNumber |
| `{{agent_name}}` | Current user's name |
| `{{company_name}}` | ticket.company.name |
| `{{ticket_subject}}` | ticket.subject |
| `{{ticket_status}}` | ticket.status |

### Socket.io Events

**Room Management:**
- `join:ticket` - Join a ticket room for real-time updates
- `leave:ticket` - Leave a ticket room
- `join:agent` - Join agent room for personal notifications

**Emitted Events:**
- `ticket:reply` - Emitted when a new reply is created

### Seed Data (Updated)
- **Canned Responses:** 4 templates (Acknowledge receipt, Request more information, Issue resolved, Scheduled maintenance)

---

## Phase 5 — Contacts, Companies & Frontend UI ✅

**Completed:** 2026-05-19
**Verified:** 2026-05-19 — Login working, UI functional

### Tasks
- [x] Contact CRUD (list, get, create, update, delete, search)
- [x] Company CRUD (list, get, create, update, delete, search)
- [x] React frontend dependencies installed
- [x] Tailwind CSS configured with custom theme
- [x] API client with token refresh interceptor
- [x] Zustand auth store
- [x] React Router with protected routes
- [x] Layout components (Sidebar, Topbar, AppLayout)
- [x] Shared UI components (Badge, Avatar, Button, Input, Select, etc.)
- [x] Login page with demo credentials
- [x] Ticket list page with filters and pagination
- [x] New ticket page with contact search
- [x] Ticket detail page with replies and sidebar
- [x] Contact list and detail pages
- [x] Company list and detail pages
- [x] 404 page

### Backend Files Created

**Controllers:**
- `/server/controllers/contactController.js` - Contact CRUD with search, pagination, deletion protection
- `/server/controllers/companyController.js` - Company CRUD with search, pagination, deletion protection

**Routes:**
- `/server/routes/contacts.js` - Contact endpoints with search before /:id
- `/server/routes/companies.js` - Company endpoints with search before /:id

### Frontend Files Created

**API Layer:**
- `/client/src/api/client.js` - Axios instance with token refresh interceptor
- `/client/src/api/index.js` - All API functions (auth, tickets, replies, attachments, contacts, companies, agents, tags, canned responses, SLA)

**State Management:**
- `/client/src/store/authStore.js` - Zustand auth store (login, logout, loadUser, setTokens)

**Layout Components:**
- `/client/src/components/layout/Sidebar.jsx` - Collapsible navigation sidebar
- `/client/src/components/layout/Topbar.jsx` - Header with search, notifications, user dropdown
- `/client/src/components/layout/AppLayout.jsx` - Main layout combining Sidebar + Topbar

**Shared Components:**
- `/client/src/components/shared/Avatar.jsx` - User avatar with initials
- `/client/src/components/shared/Badge.jsx` - Status/priority badges
- `/client/src/components/shared/Button.jsx` - Button with variants and loading state
- `/client/src/components/shared/ConfirmDialog.jsx` - Confirmation modal
- `/client/src/components/shared/EmptyState.jsx` - Empty state placeholder
- `/client/src/components/shared/Input.jsx` - Form input field
- `/client/src/components/shared/Modal.jsx` - Generic modal
- `/client/src/components/shared/Pagination.jsx` - Pagination controls
- `/client/src/components/shared/SearchInput.jsx` - Debounced search input
- `/client/src/components/shared/Select.jsx` - Select dropdown
- `/client/src/components/shared/Spinner.jsx` - Loading spinner
- `/client/src/components/shared/Textarea.jsx` - Textarea field
- `/client/src/components/shared/index.js` - Barrel exports

**Pages:**
- `/client/src/pages/auth/LoginPage.jsx` - Login form with validation
- `/client/src/pages/tickets/TicketListPage.jsx` - Ticket list with filters
- `/client/src/pages/tickets/NewTicketPage.jsx` - New ticket form
- `/client/src/pages/tickets/TicketDetailPage.jsx` - Ticket detail with conversation
- `/client/src/pages/contacts/ContactListPage.jsx` - Contact list
- `/client/src/pages/contacts/ContactDetailPage.jsx` - Contact detail with tickets
- `/client/src/pages/companies/CompanyListPage.jsx` - Company list
- `/client/src/pages/companies/CompanyDetailPage.jsx` - Company detail with contacts/tickets
- `/client/src/pages/NotFoundPage.jsx` - 404 page

### API Endpoints (Phase 5)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | /api/contacts | ✓ | Any | List contacts (paginated, filterable) |
| GET | /api/contacts/search | ✓ | Any | Search contacts (typeahead) |
| GET | /api/contacts/:id | ✓ | Any | Get contact with company and tickets |
| POST | /api/contacts | ✓ | Any | Create contact |
| PUT | /api/contacts/:id | ✓ | Any | Update contact |
| DELETE | /api/contacts/:id | ✓ | ADMIN | Delete contact (blocked if open tickets) |
| GET | /api/companies | ✓ | Any | List companies (paginated, filterable) |
| GET | /api/companies/search | ✓ | Any | Search companies (typeahead) |
| GET | /api/companies/:id | ✓ | Any | Get company with contacts and tickets |
| POST | /api/companies | ✓ | Any | Create company |
| PUT | /api/companies/:id | ✓ | Any | Update company |
| DELETE | /api/companies/:id | ✓ | ADMIN | Delete company (blocked if open tickets) |

### Frontend Dependencies Added
- axios - HTTP client
- react-router-dom - Client-side routing
- zustand - State management
- @tanstack/react-query - Data fetching
- react-hook-form - Form handling
- @hookform/resolvers - Form validation
- zod - Schema validation
- socket.io-client - Real-time updates
- react-hot-toast - Toast notifications
- date-fns - Date formatting
- lucide-react - Icons
- @tiptap/react, @tiptap/starter-kit, @tiptap/extension-placeholder, @tiptap/extension-link - Rich text editor

### Theme Configuration
- Primary color: #1B2A4A (navy blue)
- Accent color: #E63946 (red)

---

## Phase 5b — Extended Features & Mobile-First UI ✅

**Completed:** 2026-05-20

### Tasks
- [x] Schema updates (3 new enums, 9 new models, updated relations)
- [x] Time tracking backend (CRUD for time entries per ticket)
- [x] Materials tracking backend (CRUD for material entries per ticket)
- [x] Device/asset tracking backend (Device CRUD + ticket linking)
- [x] Ticket templates backend (Template CRUD with checklist items and recurring schedules)
- [x] Checklist backend (Ticket checklist items CRUD with reordering)
- [x] Resolution summary backend (Update resolution summary on ticket)
- [x] Satisfaction & Google review backend (Survey scheduling, rating submission, opt-out)
- [x] Settings backend (Key-value app settings CRUD)
- [x] Calendar backend (Calendar tickets and workload summary)
- [x] Mobile-first UI overhaul (Drawer sidebar, bottom navigation, FAB, bottom sheets)
- [x] Calendar page (Month/Week/Day views with ticket pills)
- [x] Templates page (Template CRUD with checklist and recurring options)
- [x] Devices page (Device list and detail with linked tickets)
- [x] Workload page (Kanban board by agent with drag-to-reassign)
- [x] Satisfaction page (Ratings dashboard with stats and feedback list)
- [x] Settings page (Google review and general settings configuration)

### New Prisma Models
- **TimeEntry** - Time tracking entries for tickets
- **MaterialEntry** - Material/parts entries for tickets
- **Device** - Devices/assets with warranty tracking
- **TicketDevice** - Junction table linking tickets to devices
- **TicketTemplate** - Reusable ticket templates
- **TemplateChecklistItem** - Checklist items on templates
- **TicketChecklistItem** - Checklist items on tickets
- **RecurringSchedule** - Recurring ticket configuration
- **SatisfactionRating** - Customer satisfaction ratings
- **AppSetting** - Application settings key-value store

### New Enums
- **DeviceType** - COMPUTER, LAPTOP, PRINTER, SERVER, PHONE, NETWORK, OTHER
- **RecurringFrequency** - DAILY, WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, YEARLY
- **SatisfactionRatingValue** - POSITIVE, NEUTRAL, NEGATIVE

### Backend Files Created

**Controllers:**
- `/server/controllers/timeEntryController.js` - Time entry CRUD
- `/server/controllers/materialEntryController.js` - Material entry CRUD
- `/server/controllers/deviceController.js` - Device CRUD + ticket linking
- `/server/controllers/templateController.js` - Template CRUD + create ticket from template
- `/server/controllers/checklistController.js` - Checklist item CRUD with reordering
- `/server/controllers/satisfactionController.js` - Satisfaction survey scheduling and rating
- `/server/controllers/settingsController.js` - App settings CRUD
- `/server/controllers/calendarController.js` - Calendar tickets and workload

**Routes:**
- `/server/routes/timeEntries.js` - Time entry endpoints
- `/server/routes/materialEntries.js` - Material entry endpoints
- `/server/routes/devices.js` - Device endpoints
- `/server/routes/ticketDevices.js` - Ticket-device linking endpoints
- `/server/routes/templates.js` - Template endpoints
- `/server/routes/checklist.js` - Checklist endpoints
- `/server/routes/satisfaction.js` - Satisfaction survey endpoints
- `/server/routes/settings.js` - Settings endpoints
- `/server/routes/calendar.js` - Calendar endpoints

**Services:**
- `/server/services/satisfactionEmailService.js` - Satisfaction survey email service

**Jobs:**
- `/server/jobs/reviewRequestJob.js` - Hourly job for sending review requests

### API Endpoints (Phase 5b)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/tickets/:ticketId/time | ✓ | List time entries |
| POST | /api/tickets/:ticketId/time | ✓ | Create time entry |
| PUT | /api/tickets/:ticketId/time/:entryId | ✓ | Update time entry |
| DELETE | /api/tickets/:ticketId/time/:entryId | ✓ | Delete time entry |
| GET | /api/tickets/:ticketId/materials | ✓ | List material entries |
| POST | /api/tickets/:ticketId/materials | ✓ | Create material entry |
| PUT | /api/tickets/:ticketId/materials/:entryId | ✓ | Update material entry |
| DELETE | /api/tickets/:ticketId/materials/:entryId | ✓ | Delete material entry |
| GET | /api/devices | ✓ | List devices |
| GET | /api/devices/:id | ✓ | Get device |
| POST | /api/devices | ✓ | Create device |
| PUT | /api/devices/:id | ✓ | Update device |
| DELETE | /api/devices/:id | ✓ | Delete device |
| GET | /api/tickets/:ticketId/devices | ✓ | List linked devices |
| POST | /api/tickets/:ticketId/devices | ✓ | Link device to ticket |
| DELETE | /api/tickets/:ticketId/devices/:deviceId | ✓ | Unlink device |
| GET | /api/templates | ✓ | List templates |
| GET | /api/templates/:id | ✓ | Get template |
| POST | /api/templates | ✓ | Create template |
| PUT | /api/templates/:id | ✓ | Update template |
| DELETE | /api/templates/:id | ✓ | Delete template |
| POST | /api/templates/:id/create-ticket | ✓ | Create ticket from template |
| GET | /api/tickets/:ticketId/checklist | ✓ | Get checklist items |
| POST | /api/tickets/:ticketId/checklist | ✓ | Add checklist item |
| PUT | /api/tickets/:ticketId/checklist/:itemId | ✓ | Update checklist item |
| DELETE | /api/tickets/:ticketId/checklist/:itemId | ✓ | Delete checklist item |
| PUT | /api/tickets/:ticketId/checklist/reorder | ✓ | Reorder checklist |
| PATCH | /api/tickets/:ticketId/resolution | ✓ | Update resolution summary |
| POST | /api/satisfaction/schedule | ✓ | Schedule satisfaction survey |
| POST | /api/satisfaction/rate | - | Submit satisfaction rating |
| POST | /api/satisfaction/opt-out | - | Opt out of surveys |
| GET | /api/satisfaction/ratings | ✓ | List satisfaction ratings |
| GET | /api/settings | ✓ | Get public settings |
| GET | /api/settings/full | ✓ | Get all settings (admin) |
| PATCH | /api/settings/:key | ✓ | Update single setting |
| PUT | /api/settings | ✓ | Update multiple settings |
| GET | /api/calendar | ✓ | Get calendar tickets |
| GET | /api/calendar/workload | ✓ | Get workload summary |

### Frontend Files Created

**Shared Components:**
- `/client/src/components/shared/BottomSheet.jsx` - Mobile bottom sheet (slides up)
- `/client/src/components/shared/FAB.jsx` - Floating action button

**Layout Updates:**
- `/client/src/components/layout/Sidebar.jsx` - Added mobile drawer mode, new nav items
- `/client/src/components/layout/Topbar.jsx` - Added mobile menu button
- `/client/src/components/layout/AppLayout.jsx` - Added bottom navigation, mobile drawer

**Pages:**
- `/client/src/pages/CalendarPage.jsx` - Month/Week/Day calendar views
- `/client/src/pages/TemplatesPage.jsx` - Template management
- `/client/src/pages/DevicesPage.jsx` - Device list and detail
- `/client/src/pages/WorkloadPage.jsx` - Kanban workload board
- `/client/src/pages/SatisfactionPage.jsx` - Satisfaction ratings dashboard
- `/client/src/pages/SettingsPage.jsx` - Application settings

### Mobile-First Features
- **Drawer Sidebar** - Slide-out navigation on mobile
- **Bottom Navigation** - Quick access to Tickets, Calendar, Contacts, New, Menu
- **Floating Action Button** - Context-aware quick actions
- **Bottom Sheets** - Mobile-friendly modals that slide up from bottom
- **Touch Optimization** - 44px minimum touch targets
- **Safe Area Support** - iPhone notch and home indicator handling
- **Responsive Tables** - Hidden columns on mobile with essential info visible

### Seed Data (Updated)
- **Default Settings:** google_review_enabled, satisfaction_enabled, company_name
- **Sample Devices:** 4 devices (2 computers, laptop, printer)
- **Sample Template:** "New Computer Setup" with checklist items

---

## Phase 6 — Email & Notifications ✅

**Completed:** 2026-05-20

### Tasks
- [x] SMTP email service with Nodemailer
- [x] Email templates (7 HTML templates with variable substitution)
- [x] Email sending integrated into controllers (fire-and-forget pattern)
- [x] IMAP inbound email service with node-cron polling
- [x] Email-to-ticket and email-to-reply conversion
- [x] Notification system backend with real-time delivery
- [x] Frontend notification center with bell icon and panel
- [x] Email settings configuration UI (SMTP & IMAP)
- [x] Test email and test IMAP endpoints
- [x] Socket.io complete event map documentation
- [x] Typing indicator in ticket detail
- [x] Real-time ticket updates (replies, status changes)
- [x] Real-time workload board updates

### Backend Files Created/Updated

**Services:**
- `/server/services/emailService.js` - SMTP email service with Nodemailer
  - AppSetting caching (5-minute TTL)
  - Template rendering with {{variable}} placeholders
  - Stub mode when SMTP not configured
  - Functions: sendTicketConfirmation, sendAgentReplyEmail, sendTicketAssignedEmail, sendStatusChangedEmail, sendSLABreachEmail, sendSatisfactionSurveyEmail, sendTestEmail, reinitializeEmail
- `/server/services/imapService.js` - IMAP inbound email service
  - node-cron polling every 2 minutes
  - Ticket number extraction from subject ([#123] or #123)
  - Email-to-ticket conversion (new tickets from unknown emails)
  - Email-to-reply conversion (replies to existing tickets)
  - Functions: startImapListener, stopImapListener, testImapConnection, isImapConfigured, checkEmails
- `/server/services/notificationService.js` - Updated for email integration
  - Socket.io real-time notification delivery
  - Email sending on ticket events (assignment, reply, status change, SLA breach)

**Email Templates:**
- `/server/templates/ticket-confirmation.html` - New ticket confirmation to requester
- `/server/templates/agent-reply.html` - Agent reply notification to requester
- `/server/templates/ticket-assigned.html` - Assignment notification to agent
- `/server/templates/status-changed.html` - Status change notification
- `/server/templates/sla-breach.html` - SLA breach warning
- `/server/templates/satisfaction-survey.html` - Satisfaction survey request
- `/server/templates/test-email.html` - Test email template

**Controllers:**
- `/server/controllers/settingsController.js` - Added testEmail and testImap functions
- `/server/controllers/ticketController.js` - Integrated email sending on create/update
- `/server/controllers/replyController.js` - Integrated email sending on reply

**Routes:**
- `/server/routes/settings.js` - Added POST /test-email and POST /test-imap

**Documentation:**
- `/docs/SOCKET-EVENTS.md` - Complete Socket.io event documentation

### Frontend Files Created/Updated

**Components:**
- `/client/src/components/layout/NotificationPanel.jsx` - Notification panel component
  - Bell icon with unread count badge
  - Notification list with type-specific icons and colors
  - Mark as read, mark all as read, delete actions
  - Empty state handling
- `/client/src/components/layout/Topbar.jsx` - Updated with notification integration
- `/client/src/components/layout/AppLayout.jsx` - Added socket initialization

**Pages:**
- `/client/src/pages/tickets/TicketDetailPage.jsx` - Real-time features
  - Typing indicator with 3-second debounce
  - Real-time reply updates via Socket.io
  - Real-time ticket status/priority updates
- `/client/src/pages/WorkloadPage.jsx` - Real-time workload updates
  - Socket listeners for workload:moved and ticket:new events
- `/client/src/pages/SettingsPage.jsx` - Email configuration UI
  - SMTP settings (host, port, secure, user, pass, from)
  - IMAP settings (enabled, host, port, user, pass)
  - Test email and test IMAP buttons with feedback

**Hooks:**
- `/client/src/hooks/useSocket.js` - Socket.io connection management
  - useSocket: Main socket connection with auto-reconnect
  - useTicketSocket: Ticket room management
  - getSocket: Get socket instance for non-hook contexts

### API Endpoints (Phase 6)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/settings/test-email | ✓ | Send test email to current user |
| POST | /api/settings/test-imap | ✓ | Test IMAP connection |

### Socket.io Events

**Rooms:**
- `user:{userId}` - Personal notifications
- `ticket:{ticketId}` - Ticket-specific updates
- `agents` - Broadcast to all agents

**Server → Client Events:**
- `notification:new` - New notification created
- `ticket:new` - New unassigned ticket
- `ticket:reply` - Reply added to ticket
- `ticket:updated` - Ticket properties changed
- `ticket:typing` - User typing indicator
- `workload:moved` - Ticket moved on workload board

**Client → Server Events:**
- `join:user` - Join user notification room
- `leave:user` - Leave user notification room
- `join:ticket` - Join ticket room
- `leave:ticket` - Leave ticket room
- `join:agents` - Join agents broadcast room
- `ticket:typing` - Emit typing status

### Email Template Variables

| Variable | Resolves To |
|----------|-------------|
| `{{ticket_number}}` | Ticket number |
| `{{ticket_subject}}` | Ticket subject |
| `{{requester_name}}` | Requester's name |
| `{{agent_name}}` | Assigned agent's name |
| `{{reply_content}}` | Reply content |
| `{{status}}` | Ticket status |
| `{{company_name}}` | Company name (from settings) |
| `{{survey_link}}` | Satisfaction survey link (JWT-secured) |

### Configuration

**SMTP Settings (AppSetting keys):**
- `smtp_host` - SMTP server hostname
- `smtp_port` - SMTP port (default: 587)
- `smtp_secure` - Use TLS (default: false)
- `smtp_user` - SMTP username
- `smtp_pass` - SMTP password
- `smtp_from` - From email address

**IMAP Settings (AppSetting keys):**
- `imap_enabled` - Enable IMAP polling
- `imap_host` - IMAP server hostname
- `imap_port` - IMAP port (default: 993)
- `imap_user` - IMAP username
- `imap_pass` - IMAP password

---

## Phase 7 — SLA, Automations & Dashboard ✅

**Completed:** 2026-05-23

### Tasks
- [x] Settings cache utility with TTL
- [x] Business hours CRUD with day-by-day configuration
- [x] Dashboard backend (stats and trends endpoints)
- [x] Reports backend (4 report types + CSV export)
- [x] Automation engine with condition evaluation and action execution
- [x] Automation controller and routes (CRUD + toggle + test)
- [x] Time-based automation cron job
- [x] Automations wired into ticket/reply controllers
- [x] Global search backend (tickets, contacts, companies, KB articles)
- [x] Settings controller updates (email preview, reset to defaults)
- [x] Default automation rules seeded
- [x] Dashboard page with interactive charts
- [x] Reports page with 4 report types and CSV export
- [x] Automations page with condition/action builder
- [x] Settings page updates (business hours, email templates, reset defaults)
- [x] Global search in topbar with results dropdown
- [x] Router updates with new routes

### Backend Files Created/Updated

**Utils:**
- `/server/utils/settingsCache.js` - In-memory settings cache with 5-minute TTL

**Controllers:**
- `/server/controllers/businessHoursController.js` - Business hours CRUD
- `/server/controllers/dashboardController.js` - Dashboard stats and trends
- `/server/controllers/reportController.js` - 4 report types + CSV export
- `/server/controllers/automationController.js` - Automation CRUD with test endpoint
- `/server/controllers/searchController.js` - Global search across entities
- `/server/controllers/settingsController.js` - Added email preview and reset endpoints

**Routes:**
- `/server/routes/businessHours.js` - Business hours endpoints
- `/server/routes/dashboard.js` - Dashboard endpoints
- `/server/routes/reports.js` - Report endpoints
- `/server/routes/automations.js` - Automation endpoints
- `/server/routes/search.js` - Global search endpoint

**Services:**
- `/server/services/automationEngine.js` - Automation condition evaluation and action execution

**Jobs:**
- `/server/jobs/automationJob.js` - Time-based automation cron (every 15 minutes)

### API Endpoints (Phase 7)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/business-hours | ✓ | Get business hours |
| PUT | /api/business-hours | ✓ | Update business hours |
| GET | /api/dashboard/stats | ✓ | Get dashboard statistics |
| GET | /api/dashboard/trends | ✓ | Get dashboard trends data |
| GET | /api/reports/ticket-volume | ✓ | Get ticket volume report |
| GET | /api/reports/agent-performance | ✓ | Get agent performance report |
| GET | /api/reports/sla-compliance | ✓ | Get SLA compliance report |
| GET | /api/reports/time-materials | ✓ | Get time & materials report |
| GET | /api/reports/export | ✓ | Export report as CSV |
| GET | /api/automations | ✓ | List automation rules |
| POST | /api/automations | ✓ | Create automation rule |
| PUT | /api/automations/:id | ✓ | Update automation rule |
| PATCH | /api/automations/:id/toggle | ✓ | Toggle automation active state |
| DELETE | /api/automations/:id | ✓ | Delete automation rule |
| POST | /api/automations/:id/test | ✓ | Test automation against ticket |
| GET | /api/search | ✓ | Global search |
| GET | /api/settings/email-preview | ✓ | Preview email template |
| POST | /api/settings/reset | ✓ | Reset settings to defaults |

### Automation Triggers
- `TICKET_CREATED` - When a new ticket is created
- `TICKET_UPDATED` - When a ticket is updated
- `REPLY_RECEIVED` - When a reply is added
- `TIME_BASED` - Scheduled check (every 15 minutes)

### Automation Conditions
| Field | Description |
|-------|-------------|
| status | Ticket status (NEW, OPEN, PENDING, etc.) |
| priority | Ticket priority (LOW, MEDIUM, HIGH, URGENT) |
| type | Ticket type (QUESTION, INCIDENT, PROBLEM, TASK) |
| assigneeId | Assigned agent ID or "unassigned" |
| groupId | Assigned group ID |
| tag | Tag name |
| subject | Ticket subject text |
| requesterEmail | Requester's email |
| ticketAgeDays | Days since ticket created |

### Automation Operators
- `is` / `is_not` - Exact match
- `contains` / `not_contains` - Text contains
- `greater_than` / `less_than` - Numeric comparison

### Automation Actions
| Action | Description |
|--------|-------------|
| set_status | Change ticket status |
| set_priority | Change ticket priority |
| assign_agent | Assign to specific agent |
| assign_group | Assign to group |
| add_tag | Add tag to ticket |
| remove_tag | Remove tag from ticket |
| send_email | Send email to requester/assignee |
| add_note | Add internal note |

### Frontend Files Created/Updated

**Pages:**
- `/client/src/pages/dashboard/DashboardPage.jsx` - Dashboard with charts and stats
- `/client/src/pages/reports/ReportsPage.jsx` - Reports with 4 types and CSV export
- `/client/src/pages/settings/AutomationsPage.jsx` - Automations management UI
- `/client/src/pages/SettingsPage.jsx` - Updated with business hours, email templates

**Components:**
- `/client/src/components/layout/Topbar.jsx` - Global search with results dropdown
- `/client/src/components/layout/Sidebar.jsx` - Added Automations nav item

**API:**
- `/client/src/api/index.js` - Added dashboard, reports, automations, search, businessHours APIs

### Dashboard Features
- **Stats Cards:** Total tickets, Open tickets, Avg. resolution time, SLA compliance
- **Trends Chart:** Line chart showing ticket volume over time (7d/30d/90d)
- **Status Distribution:** Pie chart of ticket statuses
- **Priority Breakdown:** Bar chart of ticket priorities
- **Recent Tickets:** Quick access to latest tickets

### Report Types
1. **Ticket Volume** - Tickets by date with status breakdown
2. **Agent Performance** - Tickets assigned/resolved, avg resolution time per agent
3. **SLA Compliance** - Response/resolution SLA compliance by priority
4. **Time & Materials** - Billable hours and materials by ticket

### Default Automation Rules (Seeded)
1. Auto-escalate high priority unassigned tickets (2+ days old)
2. Auto-close resolved tickets after 7 days
3. Add "escalated" tag to SLA-breached tickets

### Dependencies Added
- `recharts` - React charting library for dashboard

---

## Phase 8 — Client Portal & Knowledge Base

**Status:** ⏳ Pending

### Tasks
- [ ] Knowledge base categories
- [ ] Knowledge base articles
- [ ] Client portal authentication
- [ ] Client portal ticket submission
- [ ] Client portal ticket tracking

---

## Changelog

| Date | Phase | Changes |
|------|-------|---------|
| 2026-05-19 | 1 | Initial scaffold complete - folder structure, Vite/React client, Express server, Prisma schema with 21 models, docker-compose, environment config |
| 2026-05-19 | 2 | Auth & Agents complete - JWT auth with login/refresh/logout/me, requireAuth & requireRole middleware, Agent CRUD with soft delete, Groups CRUD, input validation, global error handler, seed script with admin/agents/groups/tags/SLA/business hours |
| 2026-05-19 | 3 | Core Ticket Engine complete - Full ticket CRUD with pagination/filters/sorting, activity logging, merge tickets, watchers, related tickets, tag CRUD, custom fields CRUD, SLA policy CRUD, SLA checker cron job (15 min), business hours calculator, saved views (static), sample tickets seeded (5 tickets, 2 contacts, 2 companies) |
| 2026-05-19 | 4 | Replies, Notes & Attachments complete - File upload middleware (multer/UUID/mime validation), reply CRUD with internal notes, file attachments on tickets and replies, attachment download, canned responses CRUD with variable preview, Socket.io room management, 4 seeded canned responses |
| 2026-05-19 | 5 | Contacts, Companies & Frontend UI complete - Contact and Company CRUD with search/pagination/deletion protection, full React frontend with Zustand auth, React Query data fetching, protected routes, responsive layout (Sidebar/Topbar), shared UI components, all ticket/contact/company pages, 404 page |
| 2026-05-20 | 5b | Extended Features & Mobile-First UI complete - Time/Materials tracking, Devices/Assets management, Ticket templates with recurring schedules, Checklist items, Resolution summaries, Satisfaction surveys with Google review integration, App settings, Calendar views, Workload board, Mobile-first UI with drawer sidebar, bottom navigation, FAB, and bottom sheets |
| 2026-05-23 | 7 | SLA, Automations & Dashboard complete - Settings cache utility, Business hours CRUD, Dashboard with stats/trends/charts, Reports (4 types + CSV export), Automation engine with conditions/actions, Time-based automation job, Global search, Settings page updates (business hours, email templates, reset), Automations page with builder UI |
