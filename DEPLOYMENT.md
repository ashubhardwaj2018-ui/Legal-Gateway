# Legal Filing India — VPS Deployment Guide
Target OS: **CentOS Stream 9** (or any RHEL 9-compatible distro)  
Stack: Node.js · pnpm · PostgreSQL · PM2 · Nginx

---

## 1. Server Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB | 50 GB SSD |
| OS | CentOS Stream 9 | CentOS Stream 9 |
| Node.js | 20 LTS | 22 LTS |
| pnpm | 9+ | 9+ |
| PM2 | 5+ | 5+ |
| PostgreSQL | 15+ | 16+ |

---

## 2. Install Prerequisites

```bash
# Node.js 22 (via NodeSource)
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs

# pnpm
npm install -g pnpm@9

# PM2
npm install -g pm2

# PostgreSQL 16
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm
sudo dnf -qy module disable postgresql
sudo dnf install -y postgresql16-server postgresql16
sudo /usr/pgsql-16/bin/postgresql-16-setup initdb
sudo systemctl enable --now postgresql-16

# Nginx
sudo dnf install -y nginx
sudo systemctl enable --now nginx

# Firewall
sudo firewall-cmd --permanent --add-service=http --add-service=https
sudo firewall-cmd --reload
```

---

## 3. Database Setup

```bash
sudo -u postgres psql <<'SQL'
CREATE USER lfiuser WITH PASSWORD 'your-strong-password';
CREATE DATABASE legalfiling OWNER lfiuser;
GRANT ALL PRIVILEGES ON DATABASE legalfiling TO lfiuser;
SQL
```

Edit `/var/lib/pgsql/16/data/pg_hba.conf` to allow local md5 auth, then reload:
```bash
sudo systemctl reload postgresql-16
```

---

## 4. Deploy Application

```bash
# Create deploy user and directory
sudo useradd -m -s /bin/bash deploy
sudo mkdir -p /var/www/legalfilingindia
sudo chown deploy:deploy /var/www/legalfilingindia

# Clone / copy your code
sudo -u deploy git clone https://github.com/your-org/legal-filing-india.git /var/www/legalfilingindia
cd /var/www/legalfilingindia

# Install dependencies
pnpm install --frozen-lockfile

# Copy and fill environment file
cp .env.example .env
nano .env   # fill in DATABASE_URL, SESSION_SECRET, SMTP_*, etc.

# Create log directory
sudo mkdir -p /var/log/lfi
sudo chown deploy:deploy /var/log/lfi
```

---

## 5. Database Migration

Push the schema to your production database:

```bash
cd /var/www/legalfilingindia
pnpm --filter @workspace/db run push-force
```

> This uses `drizzle-kit push --force` which applies schema changes non-interactively.  
> Run this after every deployment that includes DB schema changes.

---

## 6. Build

```bash
cd /var/www/legalfilingindia

# Build the API server
pnpm --filter @workspace/api-server run build

# Build the frontend static site
# BASE_PATH defaults to "/" for a root deployment
BASE_PATH=/ pnpm --filter @workspace/lawfirm run build
```

Built files:
- **API server**: `artifacts/api-server/dist/index.mjs`
- **Frontend**: `artifacts/lawfirm/dist/public/` (served as static files by Nginx)

---

## 7. PM2 Start

Edit `ecosystem.config.js` and set `cwd` to `/var/www/legalfilingindia`, then:

```bash
cd /var/www/legalfilingindia

# Start with production env
pm2 start ecosystem.config.js --env production

# Save process list so it survives reboots
pm2 save

# Generate and enable systemd startup script
pm2 startup systemd -u deploy --hp /home/deploy
# → copy and run the generated sudo command shown in terminal
```

Verify:
```bash
pm2 status
pm2 logs lfi-api --lines 50
```

---

## 8. Nginx Configuration

Create `/etc/nginx/conf.d/legalfilingindia.conf`:

```nginx
server {
    listen 80;
    server_name legalfilingindia.com www.legalfilingindia.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name legalfilingindia.com www.legalfilingindia.com;

    # SSL — obtain with: sudo certbot --nginx -d legalfilingindia.com
    ssl_certificate     /etc/letsencrypt/live/legalfilingindia.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/legalfilingindia.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # Uploads directory (served directly by Nginx for performance)
    location /uploads/ {
        alias /var/www/legalfilingindia/uploads/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # API — proxy to Node.js
    location /api/ {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        client_max_body_size 50M;
    }

    # Frontend static site
    location / {
        root  /var/www/legalfilingindia/artifacts/lawfirm/dist/public;
        index index.html;
        try_files $uri $uri/ /index.html;   # SPA fallback
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    # Long-cache for hashed assets
    location ~* \.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico|webp)$ {
        root   /var/www/legalfilingindia/artifacts/lawfirm/dist/public;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
}
```

Test and reload:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### SSL with Let's Encrypt

```bash
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d legalfilingindia.com -d www.legalfilingindia.com
# Add to cron for auto-renewal:
echo "0 3 * * * root certbot renew --quiet" | sudo tee /etc/cron.d/certbot
```

---

## 9. Uploads Directory

The API server writes uploaded files (logos, chat attachments, etc.) to `./uploads/` relative to its working directory. On the VPS this resolves to `/var/www/legalfilingindia/uploads/`.

PM2 must be started from the project root (`cwd` in `ecosystem.config.js`) so this path resolves correctly. Nginx serves `/uploads/` directly for efficiency.

```bash
mkdir -p /var/www/legalfilingindia/uploads
```

---

## 10. Deployment Update Steps

```bash
cd /var/www/legalfilingindia
git pull origin main

pnpm install --frozen-lockfile

# Re-apply DB schema changes if any
pnpm --filter @workspace/db run push-force

# Rebuild
pnpm --filter @workspace/api-server run build
BASE_PATH=/ pnpm --filter @workspace/lawfirm run build

# Zero-downtime reload
pm2 reload lfi-api
```

---

## 11. Rollback Steps

```bash
cd /var/www/legalfilingindia
git log --oneline -10         # find the target commit
git checkout <commit-hash>

pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server run build
BASE_PATH=/ pnpm --filter @workspace/lawfirm run build

pm2 reload lfi-api
```

---

## 12. Backup Steps

```bash
# Database backup (run daily via cron)
pg_dump -U lfiuser -h localhost legalfiling | gzip > /backups/lfi-db-$(date +%Y%m%d).sql.gz

# Uploads backup
tar -czf /backups/lfi-uploads-$(date +%Y%m%d).tar.gz /var/www/legalfilingindia/uploads/

# Suggested cron entries
0 2 * * * pg_dump -U lfiuser -h localhost legalfiling | gzip > /backups/lfi-db-$(date +\%Y\%m\%d).sql.gz
0 3 * * * tar -czf /backups/lfi-uploads-$(date +\%Y\%m\%d).tar.gz /var/www/legalfilingindia/uploads/
# Keep 30 days of backups
0 4 * * * find /backups/ -name "lfi-*.gz" -mtime +30 -delete
```

---

## 13. Environment Variables Summary

See `.env.example` for the full annotated list. **Minimum required** to start:

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Must be `production` |
| `PORT` | API server port (e.g. `8080`) |
| `DATABASE_URL` | Full PostgreSQL connection string |
| `SESSION_SECRET` | Random string ≥ 32 chars for cookie signing |
| `APP_URL` | Public URL e.g. `https://legalfilingindia.com` |
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (587 or 465) |
| `SMTP_USER` | SMTP login |
| `SMTP_PASSWORD` | SMTP password |

---

## 14. Health Monitoring

### Health endpoint

The API exposes `GET /api/health` for uptime checks:

```bash
curl http://localhost:8080/api/health
# → {"ok":true,"db":"connected","uptime":3721}
# → HTTP 200 when healthy, HTTP 503 when DB is unreachable
```

The admin **Settings** page shows a live status badge (green/red) that polls this endpoint every 30 seconds.

### Cron-based alert (email on downtime)

Create `/usr/local/bin/lfi-health-check.sh`:

```bash
#!/bin/bash
HEALTH=$(curl -sf http://localhost:8080/api/health)
if [ $? -ne 0 ]; then
  echo "LFI API is DOWN at $(date)" | mail -s "⚠️ LFI Server Down" admin@legalfilingindia.com
fi
```

```bash
chmod +x /usr/local/bin/lfi-health-check.sh
# Install mailx if needed:  sudo dnf install -y mailx
```

Add to `/etc/cron.d/lfi-monitor` (checks every minute):

```
* * * * * root /usr/local/bin/lfi-health-check.sh
```

### PM2 status

```bash
pm2 status          # list all processes and restart counts
pm2 logs lfi-api --lines 50   # tail recent logs
pm2 monit           # live CPU/memory dashboard
```

---

## 15. Production Startup Command

```bash
# Start (first time or after restart)
pm2 start ecosystem.config.js --env production

# Quick check
pm2 status
curl -s http://localhost:8080/api | head -5
```

---

## 15. Production Checklist

- [ ] `NODE_ENV=production` in `.env`
- [ ] `DATABASE_URL` points to production PostgreSQL
- [ ] `SESSION_SECRET` is a long random string (not the default)
- [ ] `APP_URL` matches the domain
- [ ] SMTP credentials verified (send a test reset email)
- [ ] `pnpm --filter @workspace/db run push-force` ran successfully
- [ ] `artifacts/api-server/dist/index.mjs` built
- [ ] `artifacts/lawfirm/dist/public/index.html` built
- [ ] `uploads/` directory exists and is writable by the Node process
- [ ] PM2 started and `pm2 save` run
- [ ] PM2 startup script installed
- [ ] Nginx config tested (`nginx -t`) and reloaded
- [ ] SSL certificate installed and auto-renewal configured
- [ ] Firewall allows ports 80 and 443
- [ ] `curl https://legalfilingindia.com/api` returns JSON (not an error)
