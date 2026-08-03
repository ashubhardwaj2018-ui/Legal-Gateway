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
    },
  ],
};
