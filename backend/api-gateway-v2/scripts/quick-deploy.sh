#!/bin/bash

# =============================================================================
# Quick Deploy Script for Astro Shiba Backend
# =============================================================================
# Fast deployment script using Vercel API token
# Usage: ./scripts/quick-deploy.sh [preview|production]
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Vercel API Token
VERCEL_TOKEN="${VERCEL_TOKEN:-L2UZQ6dqEvn5Sg8zPoxeEPGO}"

# Deployment type (default: preview)
DEPLOY_TYPE="${1:-preview}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Astro Shiba Backend - Quick Deploy${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}Installing Vercel CLI...${NC}"
    npm install -g vercel
    echo -e "${GREEN}✓ Vercel CLI installed${NC}\n"
fi

# Export token
export VERCEL_TOKEN="$VERCEL_TOKEN"

# Navigate to backend directory if not already there
if [ ! -f "vercel.json" ]; then
    if [ -d "backend/api-gateway-v2" ]; then
        cd backend/api-gateway-v2
    else
        echo -e "${RED}Error: vercel.json not found. Are you in the correct directory?${NC}"
        exit 1
    fi
fi

echo -e "${CYAN}Current directory: $(pwd)${NC}\n"

# Check for required files
echo -e "${YELLOW}Checking project structure...${NC}"
required_files=("vercel.json" "api/graphql.ts" "package.json" "src/app.ts")
missing_files=()

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ $file${NC}"
    else
        echo -e "${RED}✗ $file (missing)${NC}"
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -ne 0 ]; then
    echo -e "\n${RED}Missing required files. Cannot proceed.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All required files present${NC}\n"

# Install dependencies
echo -e "${CYAN}Installing dependencies...${NC}"
pnpm install --frozen-lockfile
echo -e "${GREEN}✓ Dependencies installed${NC}\n"

# Build project
echo -e "${CYAN}Building project...${NC}"
pnpm build
echo -e "${GREEN}✓ Build completed${NC}\n"

# Check if project is linked
if [ ! -d ".vercel" ]; then
    echo -e "${YELLOW}Project not linked to Vercel. Linking now...${NC}"
    echo -e "${CYAN}Team: Nunalabs${NC}"
    echo -e "${CYAN}Project: astro-shiba-backend${NC}\n"
    
    vercel link --yes --token="$VERCEL_TOKEN"
    echo -e "${GREEN}✓ Project linked${NC}\n"
fi

# Deploy
case $DEPLOY_TYPE in
    production|prod)
        echo -e "${YELLOW}Deploying to PRODUCTION...${NC}"
        echo -e "${RED}⚠️  This will affect live users!${NC}\n"
        read -p "Are you sure? (yes/no): " confirm
        
        if [ "$confirm" = "yes" ]; then
            DEPLOY_URL=$(vercel --prod --yes --token="$VERCEL_TOKEN" 2>&1 | tee /dev/tty | grep -o 'https://[^ ]*' | tail -1)
            echo -e "\n${GREEN}✓ Production deployment successful${NC}"
            echo -e "${CYAN}Production URL: ${DEPLOY_URL}${NC}\n"
        else
            echo -e "${YELLOW}Deployment cancelled${NC}"
            exit 0
        fi
        ;;
        
    preview|*)
        echo -e "${YELLOW}Deploying to PREVIEW...${NC}"
        DEPLOY_URL=$(vercel --yes --token="$VERCEL_TOKEN" 2>&1 | tee /dev/tty | grep -o 'https://[^ ]*' | tail -1)
        echo -e "\n${GREEN}✓ Preview deployment successful${NC}"
        echo -e "${CYAN}Preview URL: ${DEPLOY_URL}${NC}\n"
        ;;
esac

# Wait for deployment to be ready
echo -e "${CYAN}Waiting for deployment to be ready...${NC}"
sleep 10

# Verify deployment
echo -e "${CYAN}Verifying deployment...${NC}\n"

# Test health endpoint
if curl -sf "${DEPLOY_URL}/health" > /dev/null; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
fi

# Test root endpoint
if curl -sf "${DEPLOY_URL}/" > /dev/null; then
    echo -e "${GREEN}✓ Root endpoint accessible${NC}"
else
    echo -e "${RED}✗ Root endpoint failed${NC}"
fi

# Test GraphQL endpoint
if curl -sf -X POST "${DEPLOY_URL}/graphql" \
    -H "Content-Type: application/json" \
    -d '{"query":"{ health { status } }"}' > /dev/null; then
    echo -e "${GREEN}✓ GraphQL endpoint working${NC}"
else
    echo -e "${RED}✗ GraphQL endpoint failed${NC}"
fi

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Deployment Complete!${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${GREEN}🎉 Backend deployed successfully!${NC}\n"

echo -e "${CYAN}Deployment URL:${NC}"
echo -e "${DEPLOY_URL}\n"

echo -e "${CYAN}Endpoints:${NC}"
echo -e "- Health:  ${DEPLOY_URL}/health"
echo -e "- GraphQL: ${DEPLOY_URL}/graphql"
echo -e "- Metrics: ${DEPLOY_URL}/metrics\n"

echo -e "${CYAN}Next Steps:${NC}"
if [ "$DEPLOY_TYPE" = "preview" ]; then
    echo -e "1. Test the preview deployment thoroughly"
    echo -e "2. If everything works, deploy to production:"
    echo -e "   ${YELLOW}./scripts/quick-deploy.sh production${NC}"
else
    echo -e "1. Update frontend environment variables with:"
    echo -e "   ${YELLOW}PUBLIC_API_URL=${DEPLOY_URL}/graphql${NC}"
    echo -e "2. Monitor logs with:"
    echo -e "   ${YELLOW}vercel logs ${DEPLOY_URL}${NC}"
fi

echo -e "\n${CYAN}Useful Commands:${NC}"
echo -e "- View logs: ${YELLOW}vercel logs${NC}"
echo -e "- View deployments: ${YELLOW}vercel ls${NC}"
echo -e "- Rollback: ${YELLOW}vercel rollback${NC}"
echo -e "- Dashboard: ${CYAN}https://vercel.com/dashboard${NC}\n"

echo -e "${GREEN}Done! ✨${NC}\n"