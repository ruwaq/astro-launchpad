#!/bin/bash
# Database Restoration Script for Astro Protocol
# Run this after restoring the Supabase project from dashboard

set -e

echo "=============================================="
echo "  Astro Protocol - Database Restoration"
echo "=============================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}Loading DATABASE_URL from backend/.env${NC}"
    source backend/api-gateway-v2/.env 2>/dev/null || true
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL not set${NC}"
    echo "Set it in backend/api-gateway-v2/.env or export it"
    exit 1
fi

echo -e "${GREEN}DATABASE_URL found${NC}"

# Test connection
echo ""
echo "Testing database connection..."
cd backend/shared

if npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}Database connection successful!${NC}"
else
    echo -e "${RED}Database connection failed!${NC}"
    echo ""
    echo "Possible issues:"
    echo "  1. Supabase project still paused - restore from dashboard"
    echo "  2. Wrong DATABASE_URL - check credentials"
    echo "  3. IP not whitelisted (shouldn't be an issue with Supabase)"
    exit 1
fi

# Run migrations
echo ""
echo "Running database migrations..."
npx prisma migrate deploy

echo ""
echo -e "${GREEN}Migrations completed!${NC}"

# Generate Prisma client
echo ""
echo "Generating Prisma client..."
npx prisma generate

echo ""
echo -e "${GREEN}Prisma client generated!${NC}"

# Optional: seed from contract
echo ""
echo "Do you want to sync tokens from the contract? (y/n)"
read -r sync_choice

if [ "$sync_choice" = "y" ] || [ "$sync_choice" = "Y" ]; then
    echo "Syncing tokens from contract..."
    pnpm run db:seed-contract || echo -e "${YELLOW}Seed failed - may need manual sync${NC}"
fi

echo ""
echo "=============================================="
echo -e "${GREEN}  Database restoration complete!${NC}"
echo "=============================================="
echo ""
echo "Next steps:"
echo "  1. Redeploy API Gateway: cd backend/api-gateway-v2 && vercel --prod"
echo "  2. Test health endpoint: curl https://api-gateway-v2.vercel.app/health"
echo "  3. Test GraphQL: curl https://api-gateway-v2.vercel.app/graphql"
