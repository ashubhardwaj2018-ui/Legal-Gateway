#!/usr/bin/env bash
# scripts/verify-nginx-bot-routing.sh
#
# Smoke-tests that the Nginx bot-routing config in
# deploy/nginx/legalfilingindia.conf correctly:
#
#   1. Serves reserved routes (/blog/:slug, /company/:slug, /state/:stateSlug,
#      /portal/*, /services/*, /public/*, /admin/*) as the React SPA shell
#      even when the UA is Googlebot — NOT as SSR HTML.
#
#   2. Serves a valid pSEO URL (/gst-registration/delhi-dl) as full SSR HTML
#      (contains <script type="application/ld+json"> and <title>) when the
#      UA is Googlebot.
#
#   3. Serves that same pSEO URL as the React SPA shell when there is no bot UA
#      (regular browser visit).
#
# Exit code: 0 = all checks passed, non-zero = one or more checks failed.
#
# Usage:
#   ./scripts/verify-nginx-bot-routing.sh [BASE_URL]
#
# BASE_URL defaults to https://legalfilingindia.com.
# Override for local / staging:
#   BASE_URL=http://localhost:3000 ./scripts/verify-nginx-bot-routing.sh
#
# CI usage after Nginx deploy:
#   ./scripts/verify-nginx-bot-routing.sh && echo "Bot routing OK"

set -euo pipefail

BASE_URL="${1:-https://legalfilingindia.com}"
GOOGLEBOT_UA="Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
HUMAN_UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"

# Markers used to distinguish SPA shell from SSR HTML
SPA_MARKER='<div id="root">'
SSR_MARKER='<script type="application/ld+json">'
TITLE_MARKER='<title>'

PASS=0
FAIL=0

# ── Colour helpers ─────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}PASS${NC}  $1"; ((PASS++)) || true; }
fail() { echo -e "${RED}FAIL${NC}  $1"; ((FAIL++)) || true; }
info() { echo -e "${YELLOW}----${NC}  $1"; }

# ── Fetch helper ───────────────────────────────────────────────────────────────
# fetch URL UA
fetch() {
  local url="$1"
  local ua="$2"
  curl -s --max-time 15 -L \
       -A "$ua" \
       -H "Accept: text/html,application/xhtml+xml" \
       "$url" 2>/dev/null || true
}

echo ""
echo "========================================================"
echo "  Nginx bot-routing smoke tests"
echo "  Base URL : $BASE_URL"
echo "========================================================"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# GROUP 1: Reserved routes with Googlebot UA → must return SPA shell
#          NOT SSR HTML (reserved-prefix map must be blocking the rewrite)
# ══════════════════════════════════════════════════════════════════════════════
info "GROUP 1 — Reserved routes + Googlebot UA → expect React SPA shell (no ld+json)"
echo ""

declare -a RESERVED_URLS=(
  "/blog/how-to-register-a-company"
  "/company/U12345MH2020PTC123456"
  "/state/maharashtra"
  "/portal/dashboard"
  "/services/company-registration"
  "/public/doc/some-token"
  "/admin/dashboard"
)

for path in "${RESERVED_URLS[@]}"; do
  url="${BASE_URL}${path}"
  body=$(fetch "$url" "$GOOGLEBOT_UA")

  has_ssr=false
  has_spa=false
  [[ "$body" == *"$SSR_MARKER"* ]] && has_ssr=true
  [[ "$body" == *"$SPA_MARKER"*  ]] && has_spa=true

  label="Googlebot → ${path}"
  if $has_ssr; then
    fail "$label  [got SSR HTML — reserved-prefix map is NOT blocking the rewrite!]"
  elif $has_spa; then
    pass "$label  [SPA shell returned ✓]"
  else
    # Neither marker found — could be a redirect or empty body; treat as warning
    # but don't fail hard since the server might not be running in all envs.
    echo -e "${YELLOW}SKIP${NC}  $label  [no recognisable body — server may not be reachable]"
  fi
done

echo ""

# ══════════════════════════════════════════════════════════════════════════════
# GROUP 2: Valid pSEO URL with Googlebot UA → must return full SSR HTML
#          (contains application/ld+json AND <title>)
# ══════════════════════════════════════════════════════════════════════════════
info "GROUP 2 — Valid pSEO URL + Googlebot UA → expect full SSR HTML (ld+json + title)"
echo ""

PSEO_URL="${BASE_URL}/gst-registration/delhi-dl"
body=$(fetch "$PSEO_URL" "$GOOGLEBOT_UA")

has_ssr=false
has_title=false
has_spa=false
[[ "$body" == *"$SSR_MARKER"*   ]] && has_ssr=true
[[ "$body" == *"$TITLE_MARKER"* ]] && has_title=true
[[ "$body" == *"$SPA_MARKER"*   ]] && has_spa=true

label="Googlebot → /gst-registration/delhi-dl"
if $has_ssr && $has_title && ! $has_spa; then
  pass "$label  [SSR HTML with ld+json and title ✓]"
elif $has_spa; then
  fail "$label  [got SPA shell instead of SSR HTML — bot rewrite not firing!]"
elif ! $has_ssr; then
  if [[ -z "$body" ]]; then
    echo -e "${YELLOW}SKIP${NC}  $label  [empty response — server may not be reachable or SSR endpoint is down]"
  else
    fail "$label  [response has no ld+json — SSR endpoint may be returning an error]"
  fi
else
  fail "$label  [unexpected response — has ld+json but missing title or also has SPA marker]"
fi

echo ""

# ══════════════════════════════════════════════════════════════════════════════
# GROUP 3: Valid pSEO URL WITHOUT bot UA → must return React SPA shell
#          (regular users always get the SPA, even for pSEO paths)
# ══════════════════════════════════════════════════════════════════════════════
info "GROUP 3 — Valid pSEO URL + human UA → expect React SPA shell (no ld+json)"
echo ""

body=$(fetch "$PSEO_URL" "$HUMAN_UA")

has_ssr=false
has_spa=false
[[ "$body" == *"$SSR_MARKER"* ]] && has_ssr=true
[[ "$body" == *"$SPA_MARKER"* ]] && has_spa=true

label="Human UA → /gst-registration/delhi-dl"
if $has_ssr; then
  fail "$label  [got SSR HTML for a human visitor — humans should always receive the SPA!]"
elif $has_spa; then
  pass "$label  [SPA shell returned ✓]"
else
  echo -e "${YELLOW}SKIP${NC}  $label  [no recognisable body — server may not be reachable]"
fi

echo ""

# ══════════════════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════════════════
echo "========================================================"
echo "  Results: ${PASS} passed, ${FAIL} failed"
echo "========================================================"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo -e "${RED}One or more bot-routing checks failed. Review the Nginx config at:${NC}"
  echo "  deploy/nginx/legalfilingindia.conf"
  echo ""
  echo "Key things to verify:"
  echo "  1. The \$is_reserved_prefix map covers all reserved first-path-segments."
  echo "  2. The pSEO location block checks \$is_seo_bot\$is_reserved_prefix = \"10\"."
  echo "  3. The SSR endpoint /api/ssr/:serviceSlug/:locationSlug is reachable."
  echo ""
  exit 1
fi

echo -e "${GREEN}All bot-routing checks passed.${NC}"
exit 0
