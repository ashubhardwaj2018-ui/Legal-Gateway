---
name: Drizzle DB index syntax
description: Correct syntax for adding indexes in Drizzle pgTable definitions
---

Use the object callback form (not array) for Drizzle `pgTable` index definitions:

```typescript
export const locationsTable = pgTable("locations", {
  ...columns
}, (table) => ({
  slugIdx: index("locations_slug_idx").on(table.slug),
  stateIdx: index("locations_state_idx").on(table.state),
}));
```

**Why:** The array form `(table) => [...]` is only supported in newer Drizzle versions. The object form `(table) => ({...})` works across versions in this project.
