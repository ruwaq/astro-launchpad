#!/bin/bash
set -e

echo "🚀 Deploying API Gateway to Vercel..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Run this script from backend/api-gateway-v2${NC}"
    exit 1
fi

# Step 1: Clean previous builds
echo -e "${YELLOW}🧹 Cleaning previous builds...${NC}"
rm -rf dist .turbo node_modules/.cache
echo -e "${GREEN}✅ Clean completed${NC}"
echo ""

# Step 2: Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install --legacy-peer-deps
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 3: Generate Prisma Client
echo -e "${YELLOW}🔨 Generating Prisma Client...${NC}"
npx prisma generate --schema=./prisma/schema.prisma
echo -e "${GREEN}✅ Prisma Client generated${NC}"
echo ""

# Step 4: Build TypeScript
echo -e "${YELLOW}🔨 Building TypeScript...${NC}"
npm run build
echo -e "${GREEN}✅ TypeScript compiled${NC}"
echo ""

# Step 5: Verify build output
echo -e "${YELLOW}🔍 Verifying build output...${NC}"
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Error: dist directory not found${NC}"
    exit 1
fi

if [ ! -f "dist/src/app.js" ]; then
    echo -e "${RED}❌ Error: dist/src/app.js not found${NC}"
    exit 1
fi

if [ ! -f "api/index.js" ]; then
    echo -e "${RED}❌ Error: api/index.js not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build verification passed${NC}"
echo ""

# Step 6: Check for Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}❌ Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
fi

# Step 7: Deploy to Vercel
echo -e "${YELLOW}🚀 Deploying to Vercel...${NC}"
echo ""
echo "Choose deployment type:"
echo "1) Preview (--prebuilt)"
echo "2) Production (--prod --prebuilt)"
echo ""
read -p "Enter choice (1 or 2): " choice

case $choice in
    1)
        echo -e "${YELLOW}Deploying to preview...${NC}"
        vercel --prebuilt
        ;;
    2)
        echo -e "${YELLOW}Deploying to production...${NC}"
        vercel --prod --prebuilt
        ;;
    *)
        echo -e "${RED}Invalid choice. Defaulting to preview...${NC}"
        vercel --prebuilt
        ;;
esac

echo ""
echo -e "${GREEN}✅ Deployment completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Check the deployment URL provided above"
echo "2. Test the endpoints:"
echo "   - /health"
echo "   - /graphql"
echo "3. Monitor logs in Vercel dashboard"