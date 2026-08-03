/**
 * PM2 Ecosystem Configuration — Legal Filing India
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 save && pm2 startup
 */

module.exports = {
  apps: [
    {
      name: "lfi-api",
      script: "node",
      args: "--enable-source-maps artifacts/api-server/dist/index.mjs",
      cwd: "/var/www/legalfilingindia",   // ← change to your actual deploy path
      instances: 1,                        // increase to "max" for cluster mode once stable
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      restart_delay: 3000,
      env_production: {
        NODE_ENV: "production",
        PORT: "8080",
      },
      // Log files (PM2 will create these; adjust path as needed)
      out_file: "/var/log/lfi/api-out.log",
      error_file: "/var/log/lfi/api-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      // Graceful shutdown: give in-flight requests 10 s to complete
      kill_timeout: 10000,
      listen_timeout: 15000,
      // Health check: PM2 will probe this URL after restarts to confirm the
      // process is accepting connections before marking it "online".
      // Adjust the port if you change PORT in .env
      // health_check_url: "http://localhost:8080/api/health",
    },
  ],
};

/*
 * ── External monitoring cron (recommended) ──────────────────────────────────
 * Add this line to /etc/cron.d/lfi-monitor on the VPS to get email alerts
 * whenever the API goes down (replace with your admin email):
 *
 *   * * * * * root /usr/local/bin/lfi-health-check.sh
 *
 * Contents of /usr/local/bin/lfi-health-check.sh:
 *
 *   #!/bin/bash
 *   HEALTH=$(curl -sf http://localhost:8080/api/health)
 *   if [ $? -ne 0 ]; then
 *     echo "LFI API is DOWN at $(date)" | mail -s "⚠️ LFI Server Down" admin@legalfilingindia.com
 *   fi
 *
 * Make it executable: chmod +x /usr/local/bin/lfi-health-check.sh
 * ────────────────────────────────────────────────────────────────────────────
 */
