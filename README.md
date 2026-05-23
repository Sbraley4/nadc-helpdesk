# NADC Helpdesk

A self-hosted helpdesk ticketing system — a Freshdesk replacement for small IT managed services companies.

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** JWT (access + refresh tokens)
- **Email:** Nodemailer (SMTP) + IMAP polling
- **Real-time:** Socket.io
- **File storage:** Local disk (uploads folder)

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm or yarn

### Setup

1. Clone the repository

2. Copy environment file:
   ```bash
   cp .env.example .env
   ```

3. Start PostgreSQL:
   ```bash
   docker-compose up -d db
   ```

4. Install dependencies:
   ```bash
   npm install
   cd client && npm install
   cd ../server && npm install
   ```

5. Generate Prisma client and push schema:
   ```bash
   cd server
   npx prisma generate
   npx prisma db push
   ```

6. Start development servers:
   ```bash
   # From root directory
   npm run dev
   ```

The client will be available at http://localhost:5173 and the API at http://localhost:3001.

## Project Structure

```
nadc-helpdesk/
├── client/           # React frontend (Vite)
├── server/           # Express backend
│   ├── controllers/  # Route handlers
│   ├── middleware/   # Auth, validation, etc.
│   ├── routes/       # API routes
│   ├── services/     # Business logic
│   ├── jobs/         # Scheduled tasks
│   ├── utils/        # Helper functions
│   └── prisma/       # Database schema
├── uploads/          # File storage
└── docker-compose.yml
```

## Features (Planned)

- [ ] Ticket management
- [ ] Email-to-ticket conversion
- [ ] Contacts & companies
- [ ] Agent management
- [ ] SLA policies
- [ ] Automation rules
- [ ] Canned responses
- [ ] Dashboard with reports
- [ ] Knowledge base
- [ ] Client portal
- [ ] In-app notifications

## License

Private - All rights reserved.
