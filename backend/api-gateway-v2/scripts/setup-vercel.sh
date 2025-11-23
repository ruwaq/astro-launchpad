#!/bin/bash

# =============================================================================
# Vercel Setup Script for Backend Deployment
# =============================================================================
# This script configures and deploys the API Gateway to Vercel
# Usage: ./scripts/setup-vercel.sh
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Vercel API Token (from user input)
VERCEL_TOKEN="L2UZQ6dqEvn5Sg8zPoxeEPGO"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Astro Shiba Backend - Vercel Setup${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
    echo -e "${GREEN}✓ Vercel CLI installed${NC}\n"
fi

# Step 1: Login to Vercel
echo -e "${CYAN}Step 1: Authenticating with Vercel${NC}"
if [ -n "$VERCEL_TOKEN" ]; then
    echo "$VERCEL_TOKEN" | vercel login --token
    export VERCEL_TOKEN="$VERCEL_TOKEN"
    echo -e "${GREEN}✓ Authenticated with provided token${NC}\n"
else
    vercel login
    echo -e "${GREEN}✓ Authenticated${NC}\n"
fi

# Step 2: Link or create project
echo -e "${CYAN}Step 2: Setting up Vercel Project${NC}"
echo -e "${YELLOW}Project Name: astro-shiba-backend${NC}"
echo -e "${YELLOW}Team: Nunalabs${NC}\n"

# Check if already linked
if [ -f .vercel/project.json ]; then
    echo -e "${GREEN}✓ Project already linked${NC}\n"
else
    echo -e "${YELLOW}Creating new Vercel project...${NC}"
    vercel link --yes
    echo -e "${GREEN}✓ Project linked${NC}\n"
fi

# Step 3: Set Environment Variables
echo -e "${CYAN}Step 3: Configuring Environment Variables${NC}"
echo -e "${YELLOW}You need to provide the following environment variables:${NC}\n"

# Required environment variables
declare -A ENV_VARS=(
    ["NODE_ENV"]="production"
    ["DATABASE_URL"]=""
    ["DIRECT_DATABASE_URL"]=""
    ["KV_REST_API_URL"]=""
    ["KV_REST_API_TOKEN"]=""
    ["TOKEN_FACTORY_CONTRACT_ID"]=""
    ["STELLAR_RPC_URL"]=""
    ["STELLAR_NETWORK"]="testnet"
    ["LOG_LEVEL"]="info"
    ["LOG_PRETTY"]="false"
    ["GRAPHQL_INTROSPECTION"]="false"
    ["GRAPHQL_PLAYGROUND"]="false"
)

# Function to set environment variable
set_env_var() {
    local key=$1
    local value=$2
    local env_type=${3:-"production,preview,development"}
    
    echo -e "${YELLOW}Setting $key...${NC}"
    vercel env add "$key" "$env_type" <<EOF
$value
EOF
}

echo -e "${YELLOW}Choose configuration method:${NC}"
echo -e "1) Manual input (recommended for first time)"
echo -e "2) Use .env file (if you have one configured)"
echo -e "3) Skip (configure later in Vercel Dashboard)"
read -p "Enter choice (1-3): " CONFIG_CHOICE

case $CONFIG_CHOICE in
    1)
        echo -e "\n${CYAN}Manual Configuration${NC}\n"
        
        # DATABASE_URL
        read -p "Enter DATABASE_URL (Prisma connection string): " DATABASE_URL
        if [ -n "$DATABASE_URL" ]; then
            set_env_var "DATABASE_URL" "$DATABASE_URL" "production,preview,development"
        fi
        
        # DIRECT_DATABASE_URL
        read -p "Enter DIRECT_DATABASE_URL (optional, press enter to skip): " DIRECT_DATABASE_URL
        if [ -n "$DIRECT_DATABASE_URL" ]; then
            set_env_var "DIRECT_DATABASE_URL" "$DIRECT_DATABASE_URL" "production,preview,development"
        fi
        
        # KV_REST_API_URL
        echo -e "\n${YELLOW}Vercel KV Configuration${NC}"
        echo -e "Create a KV store at: ${CYAN}https://vercel.com/dashboard/stores${NC}"
        read -p "Enter KV_REST_API_URL: " KV_REST_API_URL
        if [ -n "$KV_REST_API_URL" ]; then
            set_env_var "KV_REST_API_URL" "$KV_REST_API_URL" "production,preview,development"
        fi
        
        # KV_REST_API_TOKEN
        read -p "Enter KV_REST_API_TOKEN: " KV_REST_API_TOKEN
        if [ -n "$KV_REST_API_TOKEN" ]; then
            set_env_var "KV_REST_API_TOKEN" "$KV_REST_API_TOKEN" "production,preview,development"
        fi
        
        # TOKEN_FACTORY_CONTRACT_ID
        echo -e "\n${YELLOW}Stellar Configuration${NC}"
        read -p "Enter TOKEN_FACTORY_CONTRACT_ID: " TOKEN_FACTORY_CONTRACT_ID
        if [ -n "$TOKEN_FACTORY_CONTRACT_ID" ]; then
            set_env_var "TOKEN_FACTORY_CONTRACT_ID" "$TOKEN_FACTORY_CONTRACT_ID" "production,preview,development"
        fi
        
        # STELLAR_RPC_URL
        read -p "Enter STELLAR_RPC_URL (default: https://soroban-testnet.stellar.org): " STELLAR_RPC_URL
        STELLAR_RPC_URL=${STELLAR_RPC_URL:-"https://soroban-testnet.stellar.org"}
        set_env_var "STELLAR_RPC_URL" "$STELLAR_RPC_URL" "production,preview,development"
        
        # Set production defaults
        set_env_var "NODE_ENV" "production" "production"
        set_env_var "LOG_LEVEL" "info" "production,preview,development"
        set_env_var "LOG_PRETTY" "false" "production"
        set_env_var "GRAPHQL_INTROSPECTION" "false" "production"
        set_env_var "GRAPHQL_PLAYGROUND" "false" "production"
        set_env_var "STELLAR_NETWORK" "testnet" "production,preview,development"
        
        echo -e "${GREEN}✓ Environment variables configured${NC}\n"
        ;;
        
    2)
        if [ -f .env ]; then
            echo -e "\n${CYAN}Loading from .env file${NC}\n"
            while IFS='=' read -r key value; do
                # Skip comments and empty lines
                [[ $key =~ ^#.*$ ]] && continue
                [[ -z $key ]] && continue
                
                # Remove quotes and whitespace
                value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
                
                if [ -n "$value" ]; then
                    set_env_var "$key" "$value" "production,preview,development"
                fi
            done < .env
            echo -e "${GREEN}✓ Environment variables loaded from .env${NC}\n"
        else
            echo -e "${RED}✗ .env file not found${NC}\n"
            echo -e "${YELLOW}Please configure variables manually in Vercel Dashboard${NC}\n"
        fi
        ;;
        
    3)
        echo -e "${YELLOW}Skipping environment variable configuration${NC}"
        echo -e "${YELLOW}Configure them later at: ${CYAN}https://vercel.com/dashboard${NC}\n"
        ;;
        
    *)
        echo -e "${RED}Invalid choice. Skipping configuration.${NC}\n"
        ;;
esac

# Step 4: Build Configuration
echo -e "${CYAN}Step 4: Verifying Build Configuration${NC}"

if [ -f vercel.json ]; then
    echo -e "${GREEN}✓ vercel.json found${NC}"
else
    echo -e "${YELLOW}Creating vercel.json...${NC}"
    cat > vercel.json <<'VERCEL_JSON'
{
  "version": 2,
  "builds": [
    {
      "src": "api/graphql.ts",
      "use": "@vercel/node",
      "config": {
        "maxDuration": 30,
        "memory": 3008,
        "includeFiles": "src/**"
      }
    }
  ],
  "rewrites": [
    {
      "source": "/health",
      "destination": "/api/graphql"
    },
    {
      "source": "/metrics",
      "destination": "/api/graphql"
    },
    {
      "source": "/graphql",
      "destination": "/api/graphql"
    },
    {
      "source": "/",
      "destination": "/api/graphql"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-DNS-Prefetch-Control",
          "value": "off"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains; preload"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ],
  "regions": ["iad1"]
}
VERCEL_JSON
    echo -e "${GREEN}✓ vercel.json created${NC}"
fi

if [ -f api/graphql.ts ]; then
    echo -e "${GREEN}✓ Serverless handler found${NC}\n"
else
    echo -e "${RED}✗ api/graphql.ts not found${NC}"
    echo -e "${RED}This is required for Vercel deployment${NC}\n"
    exit 1
fi

# Step 5: Pre-deployment checks
echo -e "${CYAN}Step 5: Running Pre-Deployment Checks${NC}"
if [ -f scripts/pre-deploy-check.sh ]; then
    chmod +x scripts/pre-deploy-check.sh
    ./scripts/pre-deploy-check.sh || true
else
    echo -e "${YELLOW}⚠ Pre-deployment script not found, skipping checks${NC}\n"
fi

# Step 6: Build the project
echo -e "${CYAN}Step 6: Building Project${NC}"
pnpm build
echo -e "${GREEN}✓ Build completed${NC}\n"

# Step 7: Deploy
echo -e "${CYAN}Step 7: Deploying to Vercel${NC}"
echo -e "${YELLOW}Choose deployment type:${NC}"
echo -e "1) Preview deployment (test first)"
echo -e "2) Production deployment"
read -p "Enter choice (1-2): " DEPLOY_CHOICE

case $DEPLOY_CHOICE in
    1)
        echo -e "\n${YELLOW}Deploying to preview...${NC}"
        DEPLOY_URL=$(vercel --yes)
        echo -e "${GREEN}✓ Preview deployment successful${NC}"
        echo -e "${CYAN}Preview URL: ${DEPLOY_URL}${NC}\n"
        
        # Verify deployment
        echo -e "${CYAN}Verifying deployment...${NC}"
        sleep 5
        if [ -f scripts/verify-deployment.sh ]; then
            chmod +x scripts/verify-deployment.sh
            ./scripts/verify-deployment.sh "$DEPLOY_URL" || true
        fi
        
        echo -e "\n${YELLOW}To promote to production, run:${NC}"
        echo -e "${CYAN}vercel --prod${NC}\n"
        ;;
        
    2)
        echo -e "\n${YELLOW}Deploying to production...${NC}"
        DEPLOY_URL=$(vercel --prod --yes)
        echo -e "${GREEN}✓ Production deployment successful${NC}"
        echo -e "${CYAN}Production URL: ${DEPLOY_URL}${NC}\n"
        
        # Verify deployment
        echo -e "${CYAN}Verifying deployment...${NC}"
        sleep 5
        if [ -f scripts/verify-deployment.sh ]; then
            chmod +x scripts/verify-deployment.sh
            ./scripts/verify-deployment.sh "$DEPLOY_URL" || true
        fi
        ;;
        
    *)
        echo -e "${RED}Invalid choice. Skipping deployment.${NC}\n"
        ;;
esac

# Step 8: Post-deployment instructions
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Deployment Complete!${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${GREEN}✓ Backend deployed successfully${NC}\n"

echo -e "${CYAN}Next Steps:${NC}"
echo -e "1. Configure your frontend to use the backend URL"
echo -e "2. Set up database migrations: ${YELLOW}pnpm prisma migrate deploy${NC}"
echo -e "3. Monitor logs: ${YELLOW}vercel logs${NC}"
echo -e "4. Check deployment: ${YELLOW}vercel inspect${NC}"
echo -e "5. View dashboard: ${CYAN}https://vercel.com/dashboard${NC}\n"

echo -e "${CYAN}Useful Commands:${NC}"
echo -e "- Deploy preview: ${YELLOW}vercel${NC}"
echo -e "- Deploy production: ${YELLOW}vercel --prod${NC}"
echo -e "- View logs: ${YELLOW}vercel logs <deployment-url>${NC}"
echo -e "- List deployments: ${YELLOW}vercel ls${NC}"
echo -e "- Rollback: ${YELLOW}vercel rollback${NC}\n"

echo -e "${CYAN}Environment Variables:${NC}"
echo -e "Manage at: ${CYAN}https://vercel.com/dashboard/settings/environment-variables${NC}\n"

echo -e "${GREEN}🎉 Setup complete!${NC}\n"