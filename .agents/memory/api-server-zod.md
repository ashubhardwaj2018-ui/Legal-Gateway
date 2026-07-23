---
name: API server zod constraint
description: Why zod/v4 cannot be imported directly in api-server route files
---

The api-server build uses esbuild which cannot resolve the `zod/v4` sub-path export. It fails with: "Could not resolve 'zod/v4'".

**Why:** esbuild bundles all dependencies, and `zod/v4` uses a conditional exports map that esbuild doesn't handle in this config.

**How to apply:**
- In api-server route files, never write `import { z } from "zod/v4"`.
- Use pre-built schemas from `@workspace/api-zod` when available.
- For inline validation, use plain TypeScript type assertions (`req.body as { field: string }`) or simple runtime checks.
- Alternatively, add `"zod"` to the `external` array in `artifacts/api-server/build.mjs` and import from the root `zod` (not `/v4`).
