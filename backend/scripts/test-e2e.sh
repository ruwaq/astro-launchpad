#!/bin/bash
# Backend End-to-End Testing Script
# Tests complete flow: Contract → Indexer → Database → API Gateway

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Backend E2E Testing - Testnet${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Configuration
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACT_DIR="$BACKEND_DIR/../contracts/sac-factory"
TEST_RESULTS_DIR="$BACKEND_DIR/test-results"
mkdir -p "$TEST_RESULTS_DIR"

# Test results file
RESULTS_FILE="$TEST_RESULTS_DIR/e2e-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$RESULTS_FILE") 2>&1

echo "📝 Test results will be saved to: $RESULTS_FILE"
echo ""

# ============================================
# Phase 0: Cleanup & Port Check
# ============================================
echo -e "${BLUE}[Phase 0/7] Environment Cleanup${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Function to kill process on port
kill_port() {
    local port=$1
    local name=$2
    local pid=$(lsof -t -i:$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}⚠️  Port $port ($name) is in use by PID $pid. Killing...${NC}"
        kill -9 $pid 2>/dev/null || true
        echo "   Port $port freed."
    else
        echo "   Port $port is free."
    fi
}

kill_port 9090 "Indexer"
kill_port 4000 "API Gateway"

echo ""

# Check stellar CLI
if ! command -v stellar &> /dev/null; then
    echo -e "${RED}❌ stellar CLI not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ stellar CLI installed${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node --version)${NC}"

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  psql not found (optional)${NC}"
else
    echo -e "${GREEN}✅ PostgreSQL client installed${NC}"
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL not set${NC}"
    echo "   Using default from .env file"
fi

echo ""

# ============================================
# Phase 2: Database Setup
# ============================================
echo -e "${BLUE}[Phase 2/7] Database Setup${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$BACKEND_DIR/shared"

echo "Pushing Prisma schema to database..."
if npx prisma db push --skip-generate --accept-data-loss 2>&1 | grep -q "error"; then
    echo -e "${RED}❌ Database push failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Database schema updated${NC}"

echo "Generating Prisma client..."
if ! npx prisma generate 2>&1 | grep -q "Generated Prisma Client"; then
    echo -e "${RED}❌ Prisma client generation failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Prisma client generated${NC}"

echo ""

# ============================================
# Phase 3: Contract Deployment (if needed)
# ============================================
echo -e "${BLUE}[Phase 3/7] Contract Verification${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$CONTRACT_DIR"

# Check if contract is already deployed or configured
if [ -f "$BACKEND_DIR/.env.test" ]; then
    source "$BACKEND_DIR/.env.test"
fi

if [ -n "$TOKEN_FACTORY_CONTRACT_ID" ]; then
    CONTRACT_ID=$TOKEN_FACTORY_CONTRACT_ID
    echo "Using configured contract: $CONTRACT_ID"
    
    # Verify contract is accessible
    if stellar contract info --id "$CONTRACT_ID" --network testnet &> /dev/null; then
        echo -e "${GREEN}✅ Contract verified on testnet${NC}"
    else
        echo -e "${YELLOW}⚠️  Contract verification failed, but proceeding...${NC}"
    fi
elif [ -f ".stellar/contract-id" ]; then
    CONTRACT_ID=$(cat .stellar/contract-id)
    echo "Found existing contract: $CONTRACT_ID"
    
    # Verify contract is accessible
    if stellar contract info --id "$CONTRACT_ID" --network testnet &> /dev/null; then
        echo -e "${GREEN}✅ Contract verified on testnet${NC}"
    else
        echo -e "${YELLOW}⚠️  Contract not found, will deploy new one${NC}"
        CONTRACT_ID=""
    fi
else
    echo "No contract deployment found"
    CONTRACT_ID=""
fi

# Deploy if needed
if [ -z "$CONTRACT_ID" ]; then
    echo "Deploying contract to testnet..."
    echo -e "${YELLOW}This may take a few minutes...${NC}"
    
    if ! bash scripts/deploy-testnet.sh; then
        echo -e "${RED}❌ Contract deployment failed${NC}"
        exit 1
    fi
    
    # Get contract ID from deployment
    CONTRACT_ID=$(cat .stellar/contract-id 2>/dev/null || echo "")
    
    if [ -z "$CONTRACT_ID" ]; then
        echo -e "${RED}❌ Could not find contract ID after deployment${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Contract deployed: $CONTRACT_ID${NC}"
fi

# Save contract ID for backend
echo "Updating backend .env with contract ID..."
echo "TOKEN_FACTORY_CONTRACT_ID=$CONTRACT_ID" > "$BACKEND_DIR/.env.test"
echo -e "${GREEN}✅ Contract ID saved${NC}"

echo ""

# ============================================
# Phase 4: Build Backend Services
# ============================================
echo -e "${BLUE}[Phase 4/7] Building Backend Services${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Build Indexer
echo "Building indexer..."
cd "$BACKEND_DIR/indexer"
if ! npm run build > /dev/null 2>&1; then
    echo -e "${RED}❌ Indexer build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Indexer built${NC}"

# Build API Gateway
echo "Building API gateway..."
cd "$BACKEND_DIR/api-gateway-v2"
if ! npm run build > /dev/null 2>&1; then
    echo -e "${RED}❌ API Gateway build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ API Gateway built${NC}"

echo ""

# ============================================
# Phase 5: Start Services
# ============================================
echo -e "${BLUE}[Phase 5/7] Starting Services${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Start Indexer in background
echo "Starting indexer..."
cd "$BACKEND_DIR/indexer"
export TOKEN_FACTORY_CONTRACT_ID="$CONTRACT_ID"
export STELLAR_NETWORK="testnet"
export STELLAR_RPC_URL="https://soroban-testnet.stellar.org:443"
export METRICS_PORT="9090"
# Ensure DATABASE_URL is available
if [ -z "$DATABASE_URL" ] && [ -f "$BACKEND_DIR/.env" ]; then
    export DATABASE_URL=$(grep DATABASE_URL "$BACKEND_DIR/.env" | cut -d '=' -f2-)
fi

# Use dev mode to support TS imports from shared package
npm run dev > "$TEST_RESULTS_DIR/indexer.log" 2>&1 &
INDEXER_PID=$!
echo "Indexer PID: $INDEXER_PID"

# Wait for indexer to start
sleep 10

# Check if indexer is running
if ! kill -0 $INDEXER_PID 2>/dev/null; then
    echo -e "${RED}❌ Indexer failed to start${NC}"
    cat "$TEST_RESULTS_DIR/indexer.log"
    exit 1
fi
echo -e "${GREEN}✅ Indexer started (PID: $INDEXER_PID)${NC}"

# Start API Gateway in background
echo "Starting API Gateway..."
cd "$BACKEND_DIR/api-gateway-v2"

# Ensure env vars are set for API Gateway
export TOKEN_FACTORY_CONTRACT_ID="$CONTRACT_ID"
export API_PORT="4000"
export STELLAR_NETWORK="testnet"
export STELLAR_RPC_URL="https://soroban-testnet.stellar.org:443"

echo "DEBUG: API Gateway Env Vars:"
echo "DATABASE_URL: $DATABASE_URL"
echo "TOKEN_FACTORY_CONTRACT_ID: $TOKEN_FACTORY_CONTRACT_ID"
echo "API_PORT: $API_PORT"

# Use dev mode
npm run dev > "$TEST_RESULTS_DIR/api-gateway.log" 2>&1 &
API_PID=$!
echo "API Gateway PID: $API_PID"

# Wait for API to start
sleep 10

# Check if API is running
if ! kill -0 $API_PID 2>/dev/null; then
    echo -e "${RED}❌ API Gateway failed to start${NC}"
    cat "$TEST_RESULTS_DIR/api-gateway.log"
    kill $INDEXER_PID 2>/dev/null
    exit 1
fi
echo -e "${GREEN}✅ API Gateway started (PID: $API_PID)${NC}"

echo ""

# ============================================
# Phase 6: Run Tests
# ============================================
echo -e "${BLUE}[Phase 6/7] Running Tests${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 1: Health Checks
echo "Test 1: Health checks..."
if curl -s http://localhost:9090/health | grep -q "healthy"; then
    echo -e "${GREEN}✅ Indexer health check passed${NC}"
else
    echo -e "${RED}❌ Indexer health check failed${NC}"
fi

if curl -s http://localhost:4000/api/health | grep -q "ok"; then
    echo -e "${GREEN}✅ API Gateway health check passed${NC}"
else
    echo -e "${RED}❌ API Gateway health check failed${NC}"
fi

# Test 2: GraphQL Query
echo ""
echo "Test 2: GraphQL query..."
GRAPHQL_RESPONSE=$(curl -s -X POST http://localhost:4000/api/graphql \
    -H "Content-Type: application/json" \
    -d '{"query": "{ health { status timestamp } }"}')

if echo "$GRAPHQL_RESPONSE" | grep -q "status"; then
    echo -e "${GREEN}✅ GraphQL query successful${NC}"
    echo "Response: $GRAPHQL_RESPONSE"
else
    echo -e "${RED}❌ GraphQL query failed${NC}"
    echo "Response: $GRAPHQL_RESPONSE"
fi

# Test 3: Create Token on Contract
echo ""
echo "Test 3: Creating test token on contract..."
cd "$CONTRACT_DIR"

TOKEN_NAME="E2E Test Token"
TOKEN_SYMBOL="E2E"
CREATOR_ADDRESS=$(stellar keys address testnet-deployer)

echo "Creating token: $TOKEN_NAME ($TOKEN_SYMBOL)"
echo "Creator: $CREATOR_ADDRESS"

# Export secret key for the invocation script
# Try 'stellar keys secret' first (newer CLI), fallback to 'show --show-secret' if needed, or just 'keys secret'
if stellar keys secret --help &> /dev/null; then
    export DEPLOYER_SECRET_KEY=$(stellar keys secret testnet-deployer)
else
    # Fallback for older versions or different CLI structures
    export DEPLOYER_SECRET_KEY=$(stellar keys show testnet-deployer --show-secret)
fi

echo "Invoking launch_token using helper script..."
# Use the helper script to invoke launch_token with complex arguments (XDR)
npx tsx "$BACKEND_DIR/scripts/invoke_launch.ts" > "$TEST_RESULTS_DIR/invoke_launch.log" 2>&1
INVOKE_EXIT_CODE=$?

if [ $INVOKE_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Token created successfully${NC}"
else
    echo -e "${RED}❌ Token creation failed${NC}"
    cat "$TEST_RESULTS_DIR/invoke_launch.log"
    # Don't exit, try to continue to see if indexer picked up anything
fi

# Wait for indexer to process event
echo ""
echo "Waiting 30 seconds for indexer to process event..."
sleep 30

# Test 4: Verify Token in Database
echo ""
echo "Test 4: Verifying token in database..."
cd "$BACKEND_DIR/shared"

TOKEN_COUNT=$(npx prisma db execute \
    --stdin <<< "SELECT COUNT(*) FROM \"Token\"" 2>&1 | grep -o '[0-9]\+' | tail -1 || echo "0")

echo "Tokens in database: $TOKEN_COUNT"
if [ "$TOKEN_COUNT" -gt "0" ]; then
    echo -e "${GREEN}✅ Tokens found in database${NC}"
else
    echo -e "${YELLOW}⚠️  No tokens in database yet${NC}"
fi

# Test 5: Query Tokens via API
echo ""
echo "Test 5: Querying tokens via API..."
TOKENS_RESPONSE=$(curl -s -X POST http://localhost:4000/api/graphql \
    -H "Content-Type: application/json" \
    -d '{"query": "{ tokens(limit: 5) { edges { node { address name symbol } } totalCount } }"}')

if echo "$TOKENS_RESPONSE" | grep -q "totalCount"; then
    echo -e "${GREEN}✅ Tokens query successful${NC}"
    echo "Response: $TOKENS_RESPONSE"
else
    echo -e "${YELLOW}⚠️  Tokens query returned no data${NC}"
    echo "Response: $TOKENS_RESPONSE"
fi

# Test 6: Metrics
echo ""
echo "Test 6: Checking metrics..."
if curl -s http://localhost:9090/metrics | grep -q "indexer_events"; then
    echo -e "${GREEN}✅ Indexer metrics available${NC}"
else
    echo -e "${YELLOW}⚠️  Indexer metrics not found${NC}"
fi

echo ""

# ============================================
# Phase 7: Cleanup
# ============================================
echo -e "${BLUE}[Phase 7/7] Cleanup${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Stopping services..."
kill $INDEXER_PID 2>/dev/null && echo "Indexer stopped"
kill $API_PID 2>/dev/null && echo "API Gateway stopped"

# Wait for graceful shutdown
sleep 2

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 E2E Testing Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "📊 Test Results Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Contract ID: $CONTRACT_ID"
echo "Tokens in DB: $TOKEN_COUNT"
echo "Full logs: $RESULTS_FILE"
echo ""
echo "🔗 Useful Links:"
echo "Contract Explorer: https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID"
echo "Indexer Logs: $TEST_RESULTS_DIR/indexer.log"
echo "API Logs: $TEST_RESULTS_DIR/api-gateway.log"
echo ""
