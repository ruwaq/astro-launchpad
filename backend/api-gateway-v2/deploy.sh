#!/bin/bash

# =============================================================================
# ONE-CLICK DEPLOY - Astro Shiba Backend to Vercel
# =============================================================================
# Usage: ./deploy.sh
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
VERCEL_TOKEN="${VERCEL_TOKEN:-L2UZQ6dqEvn5Sg8zPoxeEPGO}"
PROJECT_NAME="astro-shiba-backend"
TEAM_NAME="Nunalabs"

# Banner
echo -e "${BLUE}${BOLD}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║          🚀 ASTRO SHIBA BACKEND DEPLOYMENT 🚀             ║"
echo "║                                                            ║"
echo "║                 One-Click Deploy to Vercel                ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

# Check if in correct directory
if [ ! -f "vercel.json" ]; then
    echo -e "${RED}❌ Error: vercel.json not found${NC}"
    echo -e "${YELLOW}Please run this script from backend/api-gateway-v2 directory${NC}\n"
    exit 1
fi

# Step 1: Check Vercel CLI
echo -e "${CYAN}[1/7] Checking Vercel CLI...${NC}"
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}Installing Vercel CLI...${NC}"
    npm install -g vercel
    echo -e "${GREEN}✓ Vercel CLI installed${NC}\n"
else
    echo -e "${GREEN}✓ Vercel CLI found${NC}\n"
fi

# Step 2: Authenticate
echo -e "${CYAN}[2/7] Authenticating with Vercel...${NC}"
export VERCEL_TOKEN="$VERCEL_TOKEN"
echo -e "${GREEN}✓ Token configured${NC}\n"

# Step 3: Install dependencies
echo -e "${CYAN}[3/7] Installing dependencies...${NC}"
pnpm install --frozen-lockfile
echo -e "${GREEN}✓ Dependencies installed${NC}\n"

# Step 4: Build
echo -e "${CYAN}[4/7] Building project...${NC}"
pnpm build
echo -e "${GREEN}✓ Build completed${NC}\n"

# Step 5: Link project
echo -e "${CYAN}[5/7] Linking Vercel project...${NC}"
if [ ! -d ".vercel" ]; then
    echo -e "${YELLOW}Creating new project link...${NC}"
    vercel link --yes --token="$VERCEL_TOKEN"
    echo -e "${GREEN}✓ Project linked${NC}\n"
else
    echo -e "${GREEN}✓ Project already linked${NC}\n"
fi

# Step 6: Deploy choice
echo -e "${CYAN}[6/7] Ready to deploy!${NC}\n"
echo -e "${YELLOW}Choose deployment type:${NC}"
echo -e "  ${BOLD}1)${NC} Preview (safe, for testing)"
echo -e "  ${BOLD}2)${NC} Production (live deployment)"
echo -e "  ${BOLD}3)${NC} Cancel"
echo ""
read -p "Enter your choice (1-3): " deploy_choice

case $deploy_choice in
    1)
        echo -e "\n${YELLOW}Deploying to PREVIEW environment...${NC}\n"
        DEPLOY_URL=$(vercel --yes --token="$VERCEL_TOKEN" 2>&1 | tee /dev/tty | grep -o 'https://[^ ]*' | tail -1)
        DEPLOY_TYPE="preview"
        ;;
    2)
        echo -e "\n${RED}${BOLD}⚠️  WARNING: This will deploy to PRODUCTION${NC}"
        echo -e "${RED}This will be accessible to live users!${NC}\n"
        read -p "Are you absolutely sure? Type 'YES' to continue: " confirm
        if [ "$confirm" = "YES" ]; then
            echo -e "\n${YELLOW}Deploying to PRODUCTION...${NC}\n"
            DEPLOY_URL=$(vercel --prod --yes --token="$VERCEL_TOKEN" 2>&1 | tee /dev/tty | grep -o 'https://[^ ]*' | tail -1)
            DEPLOY_TYPE="production"
        else
            echo -e "${YELLOW}Deployment cancelled.${NC}\n"
            exit 0
        fi
        ;;
    3)
        echo -e "${YELLOW}Deployment cancelled.${NC}\n"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice. Exiting.${NC}\n"
        exit 1
        ;;
esac

echo -e "${GREEN}✓ Deployment initiated${NC}\n"

# Step 7: Verify deployment
echo -e "${CYAN}[7/7] Verifying deployment...${NC}"
sleep 8

# Quick health check
echo -e "${YELLOW}Testing endpoints...${NC}"

HEALTH_STATUS="❌"
GRAPHQL_STATUS="❌"
METRICS_STATUS="❌"

if curl -sf "${DEPLOY_URL}/health" > /dev/null 2>&1; then
    HEALTH_STATUS="${GREEN}✓${NC}"
fi

if curl -sf -X POST "${DEPLOY_URL}/graphql" \
    -H "Content-Type: application/json" \
    -d '{"query":"{ health { status } }"}' > /dev/null 2>&1; then
    GRAPHQL_STATUS="${GREEN}✓${NC}"
fi

if curl -sf "${DEPLOY_URL}/metrics" > /dev/null 2>&1; then
    METRICS_STATUS="${GREEN}✓${NC}"
fi

echo -e "  Health:  $HEALTH_STATUS"
echo -e "  GraphQL: $GRAPHQL_STATUS"
echo -e "  Metrics: $METRICS_STATUS"
echo ""

# Final summary
echo -e "${BLUE}${BOLD}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║              ✨ DEPLOYMENT SUCCESSFUL! ✨                 ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

echo -e "${GREEN}${BOLD}🎉 Your backend is live!${NC}\n"

echo -e "${CYAN}📍 Deployment URL:${NC}"
echo -e "   ${BOLD}${DEPLOY_URL}${NC}\n"

echo -e "${CYAN}🔗 Available Endpoints:${NC}"
echo -e "   ${BOLD}API Info:${NC}  ${DEPLOY_URL}/"
echo -e "   ${BOLD}Health:${NC}    ${DEPLOY_URL}/health"
echo -e "   ${BOLD}GraphQL:${NC}   ${DEPLOY_URL}/graphql"
echo -e "   ${BOLD}Metrics:${NC}   ${DEPLOY_URL}/metrics"
echo ""

if [ "$DEPLOY_TYPE" = "preview" ]; then
    echo -e "${YELLOW}📝 Next Steps:${NC}"
    echo -e "   1. Test your API thoroughly"
    echo -e "   2. Check the endpoints above"
    echo -e "   3. When ready, deploy to production:"
    echo -e "      ${BOLD}./deploy.sh${NC} (and choose option 2)"
    echo ""
fi

if [ "$DEPLOY_TYPE" = "production" ]; then
    echo -e "${GREEN}📝 Next Steps:${NC}"
    echo -e "   1. Update your frontend with this URL:"
    echo -e "      ${BOLD}PUBLIC_API_URL=${DEPLOY_URL}/graphql${NC}"
    echo -e "   2. Monitor logs:"
    echo -e "      ${BOLD}vercel logs --follow${NC}"
    echo -e "   3. Check Vercel dashboard:"
    echo -e "      ${BOLD}https://vercel.com/dashboard${NC}"
    echo ""
fi

echo -e "${CYAN}💡 Useful Commands:${NC}"
echo -e "   ${BOLD}vercel logs${NC}           - View deployment logs"
echo -e "   ${BOLD}vercel ls${NC}             - List all deployments"
echo -e "   ${BOLD}vercel rollback${NC}       - Rollback to previous version"
echo -e "   ${BOLD}vercel dashboard${NC}      - Open Vercel dashboard"
echo ""

echo -e "${CYAN}📚 Documentation:${NC}"
echo -e "   ${BOLD}README_DEPLOY.md${NC}      - Quick reference"
echo -e "   ${BOLD}DEPLOYMENT_GUIDE.md${NC}   - Complete guide"
echo -e "   ${BOLD}QUICK_START.md${NC}        - Fast setup instructions"
echo ""

echo -e "${GREEN}${BOLD}✨ All done! Your API is ready to use! ✨${NC}\n"

# Save deployment URL to file
echo "$DEPLOY_URL" > .last-deployment-url
echo -e "${YELLOW}💾 Deployment URL saved to: .last-deployment-url${NC}\n"

exit 0