import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust the Replit / reverse-proxy layer so express-rate-limit can read
// X-Forwarded-For correctly and the login limiter doesn't throw a ValidationError.
app.set("trust proxy", 1);

// ── Security headers ─────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,  // allow iframes for portal/preview
    contentSecurityPolicy: false,      // managed by frontend Vite build
  }),
);

// ── CORS ──────────────────────────────────────────────────────────────────────
// In production (NODE_ENV=production) only APP_URL (and its www. variant) are
// accepted. Replit preview domains are intentionally excluded so no Replit-hosted
// page can call the production API with user credentials.
// In development all Replit preview domains are added automatically.
//
// To permit additional origins (e.g. a staging subdomain) set CORS_EXTRA_ORIGINS
// as a comma-separated list of exact origin URLs:
//   CORS_EXTRA_ORIGINS=https://staging.legalfilingindia.com,https://preview.example.com
const isProduction = process.env.NODE_ENV === "production";
const appUrl = process.env.APP_URL?.replace(/\/$/, ""); // strip trailing slash

// Build an explicit Set of allowed origin strings (no regexes — exact match only)
const explicitOrigins = new Set<string>();

if (appUrl) {
  explicitOrigins.add(appUrl);
  // Also allow the www. variant when APP_URL has no www prefix
  try {
    const parsed = new URL(appUrl);
    if (!parsed.hostname.startsWith("www.")) {
      explicitOrigins.add(`${parsed.protocol}//www.${parsed.hostname}`);
    }
  } catch { /* invalid APP_URL — skip www variant */ }
} else if (isProduction) {
  logger.warn("APP_URL is not set — CORS will only permit loopback origins in production");
}

// Additional origins from env (comma-separated exact origin URLs)
(process.env.CORS_EXTRA_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean)
  .forEach((o) => explicitOrigins.add(o));

/** True only for exact localhost / loopback hostnames. Prevents bypass via
 *  `https://localhost.attacker.example` (substring match would allow that). */
function isLoopback(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

/** True for Replit preview domains (allowed in development only). */
function isReplitPreview(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname.endsWith(".replit.dev") ||
      hostname.endsWith(".replit.app") ||
      hostname.endsWith(".repl.co")
    );
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin: (origin, cb) => {
      // Development: allow all origins — CORS restrictions only protect production
      if (!isProduction) return cb(null, true);

      // Production rules:
      // No origin = same-origin request, server-to-server, or curl — always allow
      if (!origin) return cb(null, true);

      // Loopback: exact hostname check (guards against localhost.attacker.example)
      if (isLoopback(origin)) return cb(null, true);

      // Explicit allowlist: APP_URL, www variant, CORS_EXTRA_ORIGINS
      if (explicitOrigins.has(origin)) return cb(null, true);

      cb(new Error("CORS policy"), false);
    },
    credentials: true,
  }),
);

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Strict limit on login endpoint (brute-force protection)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,                     // 20 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait 15 minutes." },
  skip: (req) => process.env.NODE_ENV === "test",
});

// General API limiter (prevents scrapers / runaway clients)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 300,                    // 300 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === "test",
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use("/api", apiLimiter);
app.use("/api/admin/auth/login", loginLimiter);

// Forgot-password: stricter limit — 5 requests per 15 min per IP to prevent token/SMTP abuse
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many password reset requests. Please wait 15 minutes and try again." },
});
app.use("/api/admin/auth/forgot-password", forgotPasswordLimiter);
app.use("/api", router);

// ── Static file serving for uploads ──────────────────────────────────────────
// Serve uploaded files (logos, chat attachments, etc.) from the uploads directory.
// This must come AFTER /api routes so API paths are not shadowed.
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOADS_DIR, { maxAge: "7d" }));

export default app;
