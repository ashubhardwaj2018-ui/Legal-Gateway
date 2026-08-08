#!/bin/bash
set -e

PROJECT="/var/www/Legal-Gateway"
FRONTEND="$PROJECT/artifacts/lawfirm"
PUBLIC="/home/legalfilingindia/public_html"
APP_NAME="legalgateway"

echo "==============================================="
echo "     LEGAL FILING INDIA DEPLOYMENT"
echo "==============================================="

cd "$PROJECT"

echo ""
echo "Current Git Commit:"
git log --oneline -1

echo ""
echo "Step 1: Checking environment..."
if [ ! -f "$PROJECT/.env" ]; then
    echo "ERROR: .env file missing. Deployment stopped."
    exit 1
fi
echo ".env found"

echo ""
echo "Step 2: Checking PM2 process..."
if ! pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    echo "ERROR: PM2 process $APP_NAME not found."
    exit 1
fi
echo "PM2 process found"

echo ""
echo "Step 3: Pulling latest code from GitHub..."
git pull --ff-only origin main

echo ""
echo "Step 4: Installing dependencies..."
pnpm install

echo ""
echo "Step 5: Building frontend..."
cd "$FRONTEND"
pnpm run build

echo ""
echo "Step 6: Copying frontend to Apache..."
cp -rf dist/public/* "$PUBLIC/"

echo ""
echo "Step 7: Restarting backend..."
cd "$PROJECT"
pm2 restart "$APP_NAME"

echo ""
echo "Step 8: Waiting for application..."
sleep 5

echo ""
echo "Step 9: Checking application health..."
curl -fsS http://127.0.0.1:3000/api/health

echo ""
echo ""
echo "==============================================="
echo "   DEPLOYMENT COMPLETED SUCCESSFULLY"
echo "==============================================="
