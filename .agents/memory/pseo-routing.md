---
name: pSEO routing
description: How the /:serviceSlug/:locationSlug catch-all route is wired without breaking existing /services/* routes
---

The wouter Switch evaluates routes in order. The pSEO wildcard `/:serviceSlug/:locationSlug` must come AFTER all specific routes:

```tsx
<Route path="/" component={Home} />
<Route path="/services/:catId/:slug" component={ServiceDetail} />
<Route path="/services/:id" component={ServiceCategory} />
<Route path="/:serviceSlug/:locationSlug" component={ServiceLocation} />  // last
<Route component={NotFound} />
```

This works because `/services/foo/bar` is a 3-segment path and won't match the 2-segment `/:a/:b` pattern. Admin routes are in a separate outer Switch before the public Layout wrapper, so they are matched before the wildcard is ever evaluated.

**Why:** Without this ordering, `/services/business-setup` would match `/:serviceSlug/:locationSlug` as serviceSlug=services, locationSlug=business-setup, causing a wrong page to render.

**How to apply:** Any new 2-segment public routes should be added before the pSEO wildcard in the inner Switch.
