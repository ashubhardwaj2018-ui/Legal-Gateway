import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();
const startTime = Date.now();

/**
 * GET /api/health
 * Returns server status, DB connectivity, and process uptime.
 * Used by the admin dashboard badge and production monitoring cron.
 */
router.get("/health", async (_req, res): Promise<void> => {
  let db = "connected";
  try {
    await pool.query("SELECT 1");
  } catch {
    db = "error";
  }
  const ok = db === "connected";
  res.status(ok ? 200 : 503).json({
    ok,
    db,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
});

/**
 * GET /api/healthz
 * Backwards-compatible lightweight ping (no DB check).
 * Used by Replit deployment probes and PM2 readiness check.
 */
router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

export default router;
