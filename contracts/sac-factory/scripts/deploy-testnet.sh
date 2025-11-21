#!/bin/bash
# SAC Factory - Testnet Deployment Script
#
# Prerequisites:
# - stellar CLI installed (v23+)
# - Identity configured: stellar keys generate testnet-deployer
# - Testnet funded: https://laboratory.stellar.org/#account-creator?network=testnet

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}SAC Factory - Testnet Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Configuration
NETWORK="testnet"
IDENTITY="testnet-deployer"
WASM_PATH="target/wasm32-unknown-unknown/release/sac_factory.wasm"
TREASURY_ADDRESS=""  # Will be set to deployer address

# Step 1: Verify prerequisites
echo -e "${YELLOW}[1/6] Verifying prerequisites...${NC}"

if ! command -v stellar &> /dev/null; then
    echo -e "${RED}❌ stellar CLI not found${NC}"
    echo "Install from: https://developers.stellar.org/docs/tools/developer-tools"
    exit 1
fi

echo "✅ stellar CLI: $(stellar --version | head -1)"

# Check if identity exists
if ! stellar keys address $IDENTITY &> /dev/null; then
    echo -e "${RED}❌ Identity '$IDENTITY' not found${NC}"
    echo "Create with: stellar keys generate $IDENTITY --network $NETWORK"
    exit 1
fi

DEPLOYER_ADDRESS=$(stellar keys address $IDENTITY)
echo "✅ Deployer identity: $IDENTITY"
echo "   Address: $DEPLOYER_ADDRESS"

# Treasury will be the same as deployer for testnet
TREASURY_ADDRESS=$DEPLOYER_ADDRESS

# Check if WASM exists
if [ ! -f "$WASM_PATH" ]; then
    echo -e "${RED}❌ WASM not found at $WASM_PATH${NC}"
    echo "Build with: cargo build --release --target wasm32-unknown-unknown"
    exit 1
fi

WASM_SIZE=$(ls -lh $WASM_PATH | awk '{print $5}')
echo "✅ WASM built: $WASM_SIZE"

echo ""

# Step 2: Fund account (if needed)
echo -e "${YELLOW}[2/6] Checking account balance...${NC}"

BALANCE=$(stellar account balance --id $DEPLOYER_ADDRESS --network $NETWORK 2>&1 || echo "0")

if [[ "$BALANCE" == *"account not found"* ]] || [[ "$BALANCE" == "0" ]]; then
    echo -e "${YELLOW}⚠️  Account needs funding${NC}"
    echo "Fund your account at:"
    echo "https://laboratory.stellar.org/#account-creator?network=testnet"
    echo "Address: $DEPLOYER_ADDRESS"
    echo ""
    read -p "Press ENTER after funding your account..."
else
    echo "✅ Account balance: $BALANCE XLM"
fi

echo ""

# Step 3: Build contract (ensure latest)
echo -e "${YELLOW}[3/6] Building contract...${NC}"
cargo build --release --target wasm32-unknown-unknown --quiet
echo "✅ Contract built successfully"
echo ""

# Step 4: Deploy WASM
echo -e "${YELLOW}[4/6] Deploying WASM to testnet...${NC}"

CONTRACT_ID=$(stellar contract deploy \
    --wasm $WASM_PATH \
    --source $IDENTITY \
    --network $NETWORK 2>&1 || echo "ERROR")

if [[ "$CONTRACT_ID" == "ERROR" ]] || [[ -z "$CONTRACT_ID" ]]; then
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Contract deployed!${NC}"
echo "   Contract ID: $CONTRACT_ID"
echo ""

# Step 5: Initialize contract
echo -e "${YELLOW}[5/6] Initializing contract...${NC}"

INIT_RESULT=$(stellar contract invoke \
    --id $CONTRACT_ID \
    --source $IDENTITY \
    --network $NETWORK \
    -- initialize \
    --admin $DEPLOYER_ADDRESS \
    --treasury $TREASURY_ADDRESS 2>&1 || echo "ERROR")

if [[ "$INIT_RESULT" == "ERROR" ]] || [[ "$INIT_RESULT" == *"error"* ]]; then
    echo -e "${RED}❌ Initialization failed${NC}"
    echo "$INIT_RESULT"
    exit 1
fi

echo -e "${GREEN}✅ Contract initialized!${NC}"
echo ""

# Step 6: Verify deployment
echo -e "${YELLOW}[6/6] Verifying deployment...${NC}"

TOKEN_COUNT=$(stellar contract invoke \
    --id $CONTRACT_ID \
    --source $IDENTITY \
    --network $NETWORK \
    -- get_token_count 2>&1 || echo "ERROR")

if [[ "$TOKEN_COUNT" == "0" ]]; then
    echo -e "${GREEN}✅ Verification successful!${NC}"
    echo "   Token count: 0 (expected)"
else
    echo -e "${YELLOW}⚠️  Unexpected token count: $TOKEN_COUNT${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 DEPLOYMENT SUCCESSFUL!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "📝 Deployment Details:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Network:      testnet"
echo "Contract ID:  $CONTRACT_ID"
echo "Admin:        $DEPLOYER_ADDRESS"
echo "Treasury:     $TREASURY_ADDRESS"
echo "WASM Size:    $WASM_SIZE"
echo ""
echo "🔗 Explorer:"
echo "https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID"
echo ""
echo "📌 Save these values to .env:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "NEXT_PUBLIC_SAC_FACTORY_ADDRESS=$CONTRACT_ID"
echo "NEXT_PUBLIC_NETWORK=testnet"
echo ""

# Save deployment info
DEPLOYMENT_FILE="deployments/testnet-$(date +%Y%m%d-%H%M%S).json"
mkdir -p deployments

cat > $DEPLOYMENT_FILE << EOF
{
  "network": "testnet",
  "contract_id": "$CONTRACT_ID",
  "admin": "$DEPLOYER_ADDRESS",
  "treasury": "$TREASURY_ADDRESS",
  "wasm_size": "$WASM_SIZE",
  "deployed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "deployer_identity": "$IDENTITY",
  "stellar_version": "$(stellar --version | head -1)"
}
EOF

echo "💾 Deployment info saved to: $DEPLOYMENT_FILE"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Test the contract with: ./scripts/test-contract.sh $CONTRACT_ID"
echo "2. Monitor events on Stellar Explorer"
echo "3. Update frontend .env with contract address"
echo ""
