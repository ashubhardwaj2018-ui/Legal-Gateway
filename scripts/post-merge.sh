#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push --force
# Seed priority cities after every schema push (idempotent — only sets seo_priority=true, never clears it).
# Skipped when DATABASE_URL is absent so the script stays safe in bare-shell environments.
if [ -n "$DATABASE_URL" ]; then
  pnpm --filter @workspace/scripts run seed-priority-cities
fi
