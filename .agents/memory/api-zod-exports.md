---
name: api-zod duplicate exports
description: After Orval codegen, the api-zod barrel must only re-export from ./generated/api, not ./generated/types
---

Orval generates two outputs for api-zod:
- `lib/api-zod/src/generated/api.ts` — Zod validators (the useful one)
- `lib/api-zod/src/generated/types/` — a directory of TS type files with the same exported names

If `lib/api-zod/src/index.ts` exports from both (`export * from "./generated/api"` AND `export * from "./generated/types"`), TypeScript emits TS2308 "already exported" ambiguity errors for every shared name.

**Why:** Both outputs contain the same request/response body type names (e.g. `CreateBlogBody`, `UpdateBlogBody`), one as a Zod schema and one as a TS type — but both exported under the same identifier.

**How to apply:** After any codegen run, ensure `lib/api-zod/src/index.ts` contains only:
```ts
export * from "./generated/api";
```
Remove the `export * from "./generated/types"` line if it appears.
