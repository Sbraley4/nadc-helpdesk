# NADC Helpdesk - Production Checklist

## Pre-Deployment Checklist

### 1. Environment Setup
- [ ] Copy `server/.env.example` to `server/.env` and configure all values
- [ ] Set strong, unique values for:
  - `JWT_SECRET` (generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
  - `JWT_REFRESH_SECRET` (generate with same command)
- [ ] Set `NODE_ENV=production`
- [ ] Configure `DATABASE_URL` for production database
- [ ] Configure `CLIENT_URL` to your production domain

### 2. Database
- [ ] Run `npx prisma migrate deploy` to apply all migrations
- [ ] Run `npx prisma db seed` for initial data (optional)
- [ ] Verify database connection and schema integrity
- [ ] Set up database backups

### 3. Security
- [ ] All JWT secrets are strong and unique
- [ ] CORS configured for production domain only
- [ ] HTTPS enabled on server
- [ ] File upload directory permissions set correctly
- [ ] Rate limiting configured (if using a reverse proxy)

### 4. Email Configuration (Optional)
- [ ] Configure SMTP settings in `.env` or via Settings page:
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_USER`
  - `SMTP_PASS`
  - `SMTP_FROM`
- [ ] Test email sending via Settings > Test Email

### 5. IMAP Email-to-Ticket (Optional)
- [ ] Configure IMAP settings if using email-to-ticket:
  - `IMAP_HOST`
  - `IMAP_PORT`
  - `IMAP_USER`
  - `IMAP_PASS`
- [ ] Test IMAP connection via Settings > Test IMAP

### 6. Build & Deploy
- [ ] Run `npm run build` in client directory
- [ ] Copy `client/dist` to your web server
- [ ] Configure reverse proxy (nginx/Apache) for API routing
- [ ] Start server with PM2 or similar process manager:
  ```bash
  pm2 start server/index.js --name nadc-helpdesk
  ```

### 7. Post-Deployment Verification
- [ ] Login works for all user types (Admin, Agent)
- [ ] Ticket creation and updates work
- [ ] Email notifications send (if configured)
- [ ] File uploads work
- [ ] Portal access works for contacts
- [ ] Knowledge Base is accessible

---

## Production Architecture

### Recommended Stack
```
                    ┌─────────────────┐
                    │   CloudFlare    │
                    │   (CDN/SSL)     │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │     Nginx       │
                    │ (Reverse Proxy) │
                    └────────┬────────┘
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐
        │   Static  │  │   API     │  │  Uploads  │
        │   Files   │  │  Server   │  │  Storage  │
        │ (client/) │  │ (port     │  │           │
        │           │  │  3001)    │  │           │
        └───────────┘  └─────┬─────┘  └───────────┘
                             │
                    ┌────────┴────────┐
                    │   PostgreSQL    │
                    │   Database      │
                    └─────────────────┘
```

### Nginx Configuration Example
```nginx
server {
    listen 443 ssl http2;
    server_name helpdesk.yourcompany.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Static files (React app)
    location / {
        root /var/www/nadc-helpdesk/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # File uploads
    location /uploads {
        alias /var/www/nadc-helpdesk/server/uploads;
    }
}
```

---

## Environment Variables Reference

### Required
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `JWT_SECRET` | JWT signing key (64+ chars) | Generate with crypto |
| `JWT_REFRESH_SECRET` | Refresh token key (64+ chars) | Generate with crypto |
| `PORT` | Server port | `3001` |
| `CLIENT_URL` | Frontend URL | `https://helpdesk.yourcompany.com` |
| `NODE_ENV` | Environment | `production` |

### Optional - Email
| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server | `smtp.office365.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | Email username | `helpdesk@company.com` |
| `SMTP_PASS` | Email password | `***` |
| `SMTP_FROM` | From address | `helpdesk@company.com` |

### Optional - IMAP
| Variable | Description | Example |
|----------|-------------|---------|
| `IMAP_HOST` | IMAP server | `imap.office365.com` |
| `IMAP_PORT` | IMAP port | `993` |
| `IMAP_USER` | IMAP username | `tickets@company.com` |
| `IMAP_PASS` | IMAP password | `***` |

---

## Backup Strategy

### Database
```bash
# Daily backup
pg_dump -U postgres nadc_helpdesk > backup_$(date +%Y%m%d).sql

# Restore
psql -U postgres nadc_helpdesk < backup_20261224.sql
```

### File Uploads
```bash
# Backup uploads directory
tar -czf uploads_$(date +%Y%m%d).tar.gz server/uploads/
```

---

## Monitoring

### Health Check Endpoint
```bash
curl https://helpdesk.yourcompany.com/api/health
```

### PM2 Monitoring
```bash
pm2 status
pm2 logs nadc-helpdesk
pm2 monit
```

---

## Troubleshooting

### Common Issues

1. **500 errors on API calls**
   - Check server logs: `pm2 logs nadc-helpdesk`
   - Verify database connection
   - Check JWT secrets are set

2. **Email not sending**
   - Verify SMTP settings in `.env`
   - Test via Settings > Test Email
   - Check server logs for errors

3. **File uploads failing**
   - Check `UPLOAD_DIR` permissions
   - Verify `MAX_FILE_SIZE_MB` setting
   - Check disk space

4. **Slow performance**
   - Add database indexes if needed
   - Enable nginx caching for static files
   - Consider Redis for session storage

---

## Support

For issues and feature requests, contact the development team or create an issue in the repository.

**Last Updated:** 2026-05-24
**Version:** 1.0.0
