#!/bin/bash

set -e

PROJECT="/var/www/Legal-Gateway"
FRONTEND="$PROJECT/artifacts/lawfirm"
PUBLIC="/home/legalfilingindia/public_html"

echo "======================================"
echo "LEGAL FILING INDIA DEPLOYMENT"
echo "======================================"

echo ""
echo "1. Going to project..."
cd "$PROJECT"

echo ""
echo "2. Pulling latest code..."
git pull origin main

echo ""
echo "3. Installing dependencies..."
pnpm install

echo ""
echo "4. Building Frontend..."
cd "$FRONTEND"
pnpm run build

echo ""
echo "5. Copying frontend..."
cp -rf dist/public/* "$PUBLIC/"

echo ""
echo "6. Restarting Node API..."
pm2 restart legalgateway

echo ""
echo "7. Waiting..."
sleep 5

echo ""
echo "8. Health Check"
curl https://legalfilingindia.com/api/health

echo ""
echo ""
echo "======================================"
echo "DEPLOYMENT SUCCESSFUL"
echo "======================================"
