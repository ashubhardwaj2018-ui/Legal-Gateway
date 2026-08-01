import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ── Security headers ─────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,  // allow iframes for portal/preview
    contentSecurityPolicy: false,      // managed by frontend Vite build
  }),
);

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  /\.replit\.dev$/,
  /\.repl\.co$/,
  /localhost/,
  "https://vakil.co.in",
];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // server-to-server / curl
      const allowed = allowedOrigins.some((p) =>
        typeof p === "string" ? p === origin : p.test(origin),
      );
      cb(allowed ? null : new Error("CORS policy"), allowed);
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
app.use("/api", router);

export default app;
