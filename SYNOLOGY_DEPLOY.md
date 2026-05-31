# Deploying NADC Helpdesk to Synology NAS

## Prerequisites
- Synology NAS with Docker/Container Manager installed
- SSH access or File Station access to the NAS

## Step 1: Copy Files to Synology

Copy the entire `nadc-helpdesk` folder to your Synology. You can use:
- **File Station**: Upload to a shared folder (e.g., `/docker/nadc-helpdesk`)
- **SSH/SCP**: `scp -r nadc-helpdesk user@synology-ip:/volume1/docker/`

## Step 2: Configure Environment

1. SSH into your Synology or use File Station
2. Navigate to the nadc-helpdesk folder
3. Copy the environment template:
   ```bash
   cp .env.docker .env
   ```
4. Edit `.env` and fill in your values:
   ```bash
   nano .env
   ```

   **Required changes:**
   - `DB_PASSWORD` - Set a strong database password
   - `CLIENT_URL` - Your Synology's IP or hostname (e.g., `http://192.168.1.50:3001`)
   - `JWT_SECRET` - Generate with: `openssl rand -hex 64`
   - `JWT_REFRESH_SECRET` - Generate another: `openssl rand -hex 64`

## Step 3: Build and Start

SSH into your Synology and run:

```bash
cd /volume1/docker/nadc-helpdesk

# Build and start containers
docker-compose up -d --build

# Wait for it to start (check logs)
docker-compose logs -f
```

First startup takes a few minutes to build.

## Step 4: Initialize Database

After containers are running:

```bash
# Run database migrations
docker-compose exec app npx prisma migrate deploy

# Seed initial data (creates admin user)
docker-compose exec app npx prisma db seed
```

## Step 5: Access the App

Open your browser and go to:
```
http://YOUR_SYNOLOGY_IP:3001
```

**Default login:**
- Email: `admin@nadc.com`
- Password: `Admin123!`

## Step 6: Create Your User Accounts

1. Login as admin
2. Go to **Settings** → **Agents**
3. Click **Add Agent** for each user
4. Set their name, email, password, and role

---

## Remote Access Options

### Option A: Synology QuickConnect
1. Enable QuickConnect in DSM Control Panel
2. Access via: `http://quickconnect.to/YOUR_ID:3001`

### Option B: Synology Reverse Proxy (Recommended)
1. Go to **Control Panel** → **Login Portal** → **Advanced** → **Reverse Proxy**
2. Create a new rule:
   - Source: `https://helpdesk.your-domain.com` (port 443)
   - Destination: `http://localhost:3001`
3. Set up DDNS or point your domain to your public IP

### Option C: Cloudflare Tunnel
1. Install Cloudflare Tunnel container on Synology
2. Create tunnel pointing to `http://localhost:3001`
3. Get a free `*.trycloudflare.com` URL

---

## Managing the App

```bash
# View logs
docker-compose logs -f app

# Restart app
docker-compose restart app

# Stop everything
docker-compose down

# Start everything
docker-compose up -d

# Update after code changes
docker-compose up -d --build
```

## Backup

```bash
# Backup database
docker-compose exec db pg_dump -U nadc nadc_helpdesk > backup.sql

# Backup uploads
tar -czf uploads_backup.tar.gz uploads/
```

## Troubleshooting

**Container won't start:**
```bash
docker-compose logs app
```

**Database connection error:**
- Wait for db container to be healthy: `docker-compose ps`
- Check DB_PASSWORD matches in both containers

**Can't access from other devices:**
- Check Synology firewall allows port 3001
- Verify CLIENT_URL matches how you're accessing it
