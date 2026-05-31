# NADC Helpdesk — Complete Project Brief
*Last updated: May 27, 2026*

---

## PROJECT OVERVIEW

Building a self-hosted Freshdesk replacement for NADC,
a small IT managed services company in Manassas, VA.
Sam is the lead developer/IT tech. His father is his boss.
The system needs to work well on mobile since Sam uses
it in the field every day.

---

## TECH STACK

Frontend: React + Vite + Tailwind CSS
Backend: Node.js + Express
Database: PostgreSQL + Prisma ORM
Auth: JWT (access + refresh tokens)
Real-time: Socket.io
Email: Nodemailer (SMTP) + IMAP polling
File storage: Local disk (/uploads)
Process manager: PM2
Web server: Nginx
Hosting: ASUS Chromebox 3 (self-hosted, office)
Remote access: Cloudflare Tunnel (not yet configured)

---

## SERVER DETAILS

Hardware: ASUS Chromebox 3 (Intel KabyLake, 4GB RAM,
          32GB Kingston M.2 SSD)
OS: Ubuntu Server 22.04.5 LTS
Server IP: 10.0.0.240 (static)
Gateway: 10.0.0.1
SSH: ssh nadc@10.0.0.240
Username: nadc
Password: Nadc5611
Hostname: nadc-helpdesk

Installed on server:
- Node.js v20.20.2
- npm v10.8.2
- PostgreSQL 14 (running)
- PM2 (installed)
- Nginx 1.18.0 (running, configured)
- OpenSSH server (running)

PostgreSQL credentials:
- User: nadc
- Password: Nadc5611
- Database: nadc_helpdesk

Nginx config: /etc/nginx/sites-available/nadc-helpdesk
App directory: /var/www/nadc-helpdesk

PM2 startup: configured (run pm2 startup to verify)

---

## PROJECT STRUCTURE

nadc-helpdesk/
├── client/          # React + Vite frontend
│   ├── public/      # Static files (put logo here)
│   └── src/
│       ├── api/     # Axios API client
│       ├── components/
│       ├── pages/
│       └── store/   # Zustand stores
├── server/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── jobs/        # Cron jobs
│   ├── email-templates/
│   └── prisma/
│       └── schema.prisma
├── uploads/         # File attachments
├── .env
├── docker-compose.yml
├── PROGRESS.md
└── NADC_PROJECT_BRIEF.md

---

## BUILD PHASES COMPLETED

✅ Phase 1 — Scaffold & Schema
✅ Phase 2 — Auth & Agents
✅ Phase 3 — Core Ticket Engine
✅ Phase 4 — Replies, Notes & Attachments
✅ Phase 5 — Contacts, Companies & Frontend UI
✅ Phase 5b — Extended Features & Mobile-First UI
✅ Phase 6 — Email & Real-Time Notifications
✅ Phase 7 — Dashboard, Reports, Automations & Settings
✅ Phase 8 — Client Portal & Knowledge Base

---

## FEATURES BUILT

### Ticket Management
- Full CRUD with auto-incremented ticket numbers
- Status: Open, Pending, Resolved, Closed
- Priority: Low, Medium, High, Urgent
- Types: Question, Incident, Problem, Feature Request
- Assignment to agents and groups
- Tags, due dates, watchers
- Merge tickets, link related tickets
- Activity log on every ticket
- SLA policies and breach detection

### Replies & Notes
- Public replies (sent to requester via email)
- Internal notes (agents only, yellow background)
- Rich text editor (Tiptap)
- File attachments (up to 5 files, 10MB each)
- Canned responses with variable substitution
- KB article insert button in composer
- Forward, Edit, Delete on notes
- Notify agent on internal notes (in progress)

### Time & Materials
- Log time entries per ticket (date, hours, minutes,
  description)
- Log materials/expenses per ticket (item, qty, cost)
- Smart note parser: detects time ranges and material
  lines in note text and auto-creates entries
- Total time and cost shown on ticket

### Contacts & Companies
- Full CRUD for contacts and companies
- Typeahead search when creating tickets
- Inline company creation when adding contact
- Portal access management per contact
- Ticket history per contact/company

### Devices/Assets
- Device records linked to companies
- Types: Desktop, Laptop, Server, Printer, Router,
  Switch, Firewall, Phone, Tablet, Other
- Link devices to tickets
- Full device history

### Templates
- Reusable ticket templates with checklist items
- Recurring schedules (daily/weekly/monthly/quarterly)
- "Use Template" button in note composer
- Create ticket from template

### Calendar
- Month/Week/Day views
- Click day → navigate to day view
- Click time slot → new ticket modal with
  pre-filled date/time
- Filter by tech/agent
- Shows tickets by due date

### Workload Board
- Kanban columns per agent
- Drag to reassign
- Real-time updates via Socket.io
- Filter by priority and status

### Dashboard
- Stat cards: open tickets, avg response time,
  avg resolution time
- Charts: created vs resolved, tickets by status,
  tickets by priority
- Agent workload table
- Recent activity feed (clickable rows)
- Time logged and materials cost this month

### Reports
- Ticket volume over time
- Agent performance
- SLA compliance
- Time & materials
- CSV export

### Automations
- Trigger: ticket created, updated, reply received,
  time-based
- Conditions: status, priority, type, assignee,
  company, tag, subject, age
- Actions: set status/priority, assign agent/group,
  add/remove tag, send email, add note
- Test automation without executing
- 3 default rules seeded

### Knowledge Base
- Categories and articles
- Rich text editor
- Public-facing (no login required)
- Searchable
- "Insert KB Article" button in reply composer
- "Was this helpful?" voting

### Client Portal
- Separate login for contacts (not agents)
- Contacts see only their own tickets
- Submit tickets, add replies
- View KB articles
- Account page (change password)
- Satisfaction rating on closed tickets

### Google Review Flow
- Sends review request email after ticket closes
- 90 day cooldown per contact
- 24 hour delay after close
- Positive → redirects to Google review page
- Negative → feedback form
- Opt-out link in email
- Google review URL stored in AppSetting
  (add to .env: GOOGLE_REVIEW_URL=)

### Email
- SMTP outbound (Nodemailer)
- IMAP inbound (email-to-ticket)
- Templates: new ticket, reply, assigned,
  status change, SLA breach, review request,
  portal welcome
- Test email endpoint in settings

### Notifications
- In-app bell icon with unread count
- Real-time via Socket.io
- Types: ticket assigned, reply received,
  SLA breach, note notify

---

## SEEDED TEST DATA

Users:
- sam@nadc.com / Admin1234! (ADMIN)
- tech1@nadc.com / Agent1234! (AGENT) — Tech One
- tech2@nadc.com / Agent1234! (AGENT) — Tech Two

Contacts:
- John Smith — john@acmecorp.com — Acme Corp
- Sarah Lee — sarah@techfirm.com — Tech Firm LLC

Companies:
- Acme Corp
- Tech Firm LLC

Tickets (5 seeded):
1. Email not syncing on iPhone (HIGH, OPEN)
2. Wi-Fi dropping in conference room (MEDIUM, OPEN)
3. VoIP calls cutting out (URGENT, PENDING)
4. New employee laptop setup (LOW, RESOLVED)
5. Printer offline on 2nd floor (MEDIUM, OPEN)

Tags: microsoft-365, networking, voip
SLA Policies: one per priority level
Business Hours: Mon-Fri 9am-5pm
Automations: 3 default rules
KB: 4 categories, 5 articles
Canned responses: 4 seeded

---

## ENVIRONMENT VARIABLES NEEDED

Server .env file at /server/.env:

DATABASE_URL=postgresql://nadc:Nadc5611@localhost:5432/nadc_helpdesk
PORT=3001
NODE_ENV=production
CLIENT_URL=http://10.0.0.240
JWT_SECRET=[generate random 64 char string]
JWT_REFRESH_SECRET=[generate different random 64 char string]
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=helpdesk@nadc.com
IMAP_HOST=
IMAP_PORT=993
IMAP_USER=
IMAP_PASS=
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=10
GOOGLE_REVIEW_URL=
REVIEW_COOLDOWN_DAYS=90
REVIEW_SEND_DELAY_HOURS=24

---

## KNOWN BUGS & FIX STATUS

Currently being fixed by Claude Code (May 27, 2026):

🔴 CRITICAL — In progress:
1. Contact detail page → white screen/freeze
   (F12 console error being investigated)
2. Company detail page → white screen/freeze
3. Device detail → clicking does nothing
4. Template creation → broken
5. Template detail → clicking does nothing
6. Workload page (sidebar) → no agents or tickets
   (works from dashboard but not /workload directly)
7. Reports → showing 0 across the board
8. Sam Admin not appearing in agent dropdowns
9. Time logging not accessible from note composer
10. Checklist items not visible on ticket detail
11. Notify agent button → not working

🟡 UX — In progress:
12. Calendar: day click should zoom to day view,
    time slot click should open new ticket modal
13. Smart note parser button (new feature)
14. Company required star missing on device form
15. Ticket numbers still showing cuid in some places
16. Contact names showing "Unknown" in ticket list

✅ Fixed this session:
- Ticket creation working
- Reply sending working
- Internal note body displaying
- Edit/Delete/Forward on notes
- Logo branding (pending transparent logo file)

---

## DEPLOYMENT STATUS

NOT YET DEPLOYED — code still in local development.

Server is ready and waiting at 10.0.0.240.
Nginx is configured at:
/etc/nginx/sites-available/nadc-helpdesk

Deployment steps remaining:
1. Wait for Claude Code to finish current fixes
2. Test everything locally one more time
3. Copy code to server:
   scp -r [local path]/nadc-helpdesk nadc@10.0.0.240:/var/www/
4. On server: cd /var/www/nadc-helpdesk/server
5. npm install
6. Create .env file with production values
7. npx prisma migrate deploy
8. npx prisma db seed
9. pm2 start index.js --name nadc-helpdesk-server
10. cd ../client && npm install && npm run build
11. pm2 save
12. Test at http://10.0.0.240
13. Set up Cloudflare Tunnel for remote access

---

## CLOUDFLARE TUNNEL (NOT YET SET UP)

This is what gives remote/mobile access for free.
Steps when ready:
1. Create free Cloudflare account at cloudflare.com
2. Add your domain (or use free tunnel subdomain)
3. Install cloudflared on the Chromebox:
   curl -L https://pkg.cloudflare.com/cloudflare-main.gpg
   | sudo tee /usr/share/keyrings/cloudflare-main.gpg
   sudo apt install cloudflared
4. Authenticate: cloudflared tunnel login
5. Create tunnel: cloudflared tunnel create nadc-helpdesk
6. Configure and route to localhost:80
7. Run as service:
   sudo cloudflared service install
8. Access from anywhere at your domain

---

## SAM'S TYPICAL TICKET FORMAT

Sam logs tickets with this structure:
Date + time range (e.g. 06/27/26, 9:00am-3:00pm)
BTO (back to office) time
Techs present
Work performed (bullet list)
Materials used (item, quantity)

The Smart Note Parser feature was built specifically
to detect this format and auto-populate time entries
and material entries from free-form note text.

---

## LOGO STATUS

Have:
- White background PNG (Frame_208__2_.png)
- Dark background PNG (nadc_logo_-_Copy.png)
- AI-generated transparent PNG (has ghost artifacts)

Need: Clean transparent PNG from original design files
      Contact whoever made the original logo

When ready: copy to client/public/logo.png
Logo branding prompt is ready to send to Claude Code.

---

## DOMAIN STATUS

No domain purchased yet.
Options discussed:
- Use existing NADC domain as subdomain
  (helpdesk.nadc.com or similar)
- Buy new domain ~$10/yr on Namecheap
- Use free Cloudflare tunnel subdomain
  (nadc.cfargotunnel.com) — costs $0

---

## NEXT STEPS IN ORDER

1. ✅ Claude Code finishing current bug fixes
2. Test all fixes locally
3. Fix remaining bugs if any
4. Add logo when transparent version available
5. Deploy to Chromebox server (10.0.0.240)
6. Configure .env with real SMTP credentials
7. Run migrations and seed on production
8. Set up Cloudflare Tunnel for remote access
9. Test from Sam's phone on cellular data
10. Train Sam's father on basic usage
11. Go live — start using for real NADC tickets
12. Monitor for issues in first week
13. Add real client contacts and activate portal

---

## HOW TO START A NEW CHAT WITH FULL CONTEXT

Paste this entire document at the start of any new
conversation with Claude and say:
"Here is my project brief — continuing work on
NADC Helpdesk. [describe what you need]"

Claude will have full context instantly.
