---
name: API route path conventions
description: Express app mounts router at /api, so backend route handlers must NOT include /api prefix. adminAuthMiddleware path check is broken.
---

## Rule
All backend route handlers in `artifacts/api-server/src/routes/**` must NOT include the `/api` prefix.

**Correct:** `router.get("/admin/locations", ...)`
**Wrong:** `router.get("/api/admin/locations", ...)`

**Why:** `artifacts/api-server/src/app.ts` uses `app.use("/api", router)`, which strips `/api` from `req.path` before routing. Routes that include `/api` in their path string will never match.

## adminAuthMiddleware path check is broken
`adminAuthMiddleware` in `admin/auth.ts` checks `req.path.startsWith("/api/admin/")` — but because of the `/api` prefix stripping above, req.path inside the admin router is `/admin/...` not `/api/admin/...`. This means the middleware is effectively a no-op for route protection.

**How admin security actually works:** Frontend AdminLayout fetches `/api/admin/auth/me` on mount. If 401 → redirects to `/admin/login`. This is the primary protection mechanism.

**How to apply:** When adding new admin routes, use the correct path prefix (no `/api`). Do not try to fix adminAuthMiddleware path check unless doing a broader security audit — changing it would affect all admin routes.
