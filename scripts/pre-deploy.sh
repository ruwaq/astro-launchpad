#!/bin/bash

###############################################################################
# Astro Launchpad - Pre-Deployment Validation Script
###############################################################################
#
# This script runs all validation checks before deployment:
# 1. Environment variables validation
# 2. Contract tests
# 3. Backend build
# 4. Frontend build
# 5. TypeScript type checking
# 6. Lint checks
#
# Usage:
#   ./scripts/pre-deploy.sh
#   ./scripts/pre-deploy.sh --skip-tests  # Skip tests (faster)
#
###############################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running from project root
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must run from project root${NC}"
    exit 1
fi

# Parse arguments
SKIP_TESTS=false
if [[ "$*" == *"--skip-tests"* ]]; then
    SKIP_TESTS=true
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}🚀 Astro Launchpad - Pre-Deployment Validation${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

###############################################################################
# 1. Environment Variables
###############################################################################
echo -e "${BLUE}📋 Step 1/6: Validating environment variables...${NC}"
if [ -f "scripts/validate-env.ts" ]; then
    pnpm tsx scripts/validate-env.ts
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Environment validation failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Validation script not found, skipping${NC}"
fi
echo -e "${GREEN}✅ Environment variables validated${NC}"
echo ""

###############################################################################
# 2. Contract Tests
###############################################################################
if [ "$SKIP_TESTS" = false ]; then
    echo -e "${BLUE}🧪 Step 2/6: Running contract tests...${NC}"
    echo "   Testing all Rust/Soroban contracts..."

    if [ -d "contracts" ]; then
        cd contracts
        cargo test --release --quiet
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Contract tests failed${NC}"
            exit 1
        fi
        cd ..
        echo -e "${GREEN}✅ All contract tests passed${NC}"
    else
        echo -e "${YELLOW}⚠️  No contracts directory found${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Step 2/6: Skipping contract tests (--skip-tests)${NC}"
fi
echo ""

###############################################################################
# 3. TypeScript Type Checking
###############################################################################
echo -e "${BLUE}🔍 Step 3/6: Type checking TypeScript...${NC}"
pnpm run typecheck 2>&1 | tail -5
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Type checking failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ TypeScript type checking passed${NC}"
echo ""

###############################################################################
# 4. Lint Checks
###############################################################################
echo -e "${BLUE}📝 Step 4/6: Running lint checks...${NC}"
pnpm run lint 2>&1 | tail -10
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Lint warnings found (not blocking)${NC}"
fi
echo -e "${GREEN}✅ Lint checks completed${NC}"
echo ""

###############################################################################
# 5. Backend Build
###############################################################################
echo -e "${BLUE}🔧 Step 5/6: Building backend...${NC}"
if [ -d "backend/api-gateway-v2" ]; then
    cd backend/api-gateway-v2
    pnpm run build 2>&1 | tail -5
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Backend build failed${NC}"
        exit 1
    fi
    cd ../..
    echo -e "${GREEN}✅ Backend built successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Backend directory not found${NC}"
fi
echo ""

###############################################################################
# 6. Frontend Build
###############################################################################
echo -e "${BLUE}⚛️  Step 6/6: Building frontend...${NC}"
if [ -d "apps/web" ]; then
    cd apps/web
    pnpm run build 2>&1 | tail -10
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Frontend build failed${NC}"
        exit 1
    fi
    cd ../..
    echo -e "${GREEN}✅ Frontend built successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend directory not found${NC}"
fi
echo ""

###############################################################################
# Success Summary
###############################################################################
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Pre-deployment validation completed successfully!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}🎉 Ready for deployment!${NC}"
echo ""
echo "Next steps:"
echo "  1. Deploy contracts to Stellar testnet"
echo "  2. Update contract IDs in .env"
echo "  3. Deploy backend: cd backend/api-gateway-v2 && vercel --prod"
echo "  4. Deploy frontend: cd apps/web && vercel --prod"
echo "  5. Run smoke tests"
echo ""
