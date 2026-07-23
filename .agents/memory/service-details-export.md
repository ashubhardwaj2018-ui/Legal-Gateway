---
name: Service details export
description: Correct export name and signature for getServiceDetail in service-details.ts
---

The function exported from `artifacts/lawfirm/src/data/service-details.ts` is:

```typescript
export function getServiceDetail(
  categoryId: string,
  slug: string,
  serviceName: string,
  price: string,
  description: string
): ServiceDetail
```

**Why recorded:** Easy to misremember as `getServiceDetails` (plural) — causes a runtime error that only surfaces on first page load.

**How to apply:** Always call with 5 arguments: categoryId, slug, serviceName, price, description. All come from the ServiceInfo object in service-index.ts.
