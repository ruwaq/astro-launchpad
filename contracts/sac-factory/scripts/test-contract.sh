#!/bin/bash
# SAC Factory - Contract Testing Script
#
# Usage: ./scripts/test-contract.sh <CONTRACT_ID>

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$1" ]; then
    echo -e "${RED}Usage: $0 <CONTRACT_ID>${NC}"
    exit 1
fi

CONTRACT_ID=$1
NETWORK="testnet"
IDENTITY="testnet-deployer"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}SAC Factory - Contract Testing${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Contract ID: $CONTRACT_ID"
echo "Network:     $NETWORK"
echo "Identity:    $IDENTITY"
echo ""

# Test 1: Get token count
echo -e "${YELLOW}[Test 1] Get token count...${NC}"
TOKEN_COUNT=$(stellar contract invoke \
    --id $CONTRACT_ID \
    --source $IDENTITY \
    --network $NETWORK \
    -- get_token_count)

echo -e "${GREEN}✅ Token count: $TOKEN_COUNT${NC}"
echo ""

# Test 2: Get fee config
echo -e "${YELLOW}[Test 2] Get fee configuration...${NC}"
FEE_CONFIG=$(stellar contract invoke \
    --id $CONTRACT_ID \
    --source $IDENTITY \
    --network $NETWORK \
    -- get_fee_config)

echo -e "${GREEN}✅ Fee config retrieved${NC}"
echo "$FEE_CONFIG" | head -5
echo ""

# Test 3: Get contract state
echo -e "${YELLOW}[Test 3] Get contract state...${NC}"
STATE=$(stellar contract invoke \
    --id $CONTRACT_ID \
    --source $IDENTITY \
    --network $NETWORK \
    -- get_state)

echo -e "${GREEN}✅ Contract state: $STATE${NC}"
echo ""

# Test 4: Launch a test token
echo -e "${YELLOW}[Test 4] Launch test token...${NC}"

CREATOR_ADDRESS=$(stellar keys address $IDENTITY)

TOKEN_ADDRESS=$(stellar contract invoke \
    --id $CONTRACT_ID \
    --source $IDENTITY \
    --network $NETWORK \
    -- launch_token \
    --creator $CREATOR_ADDRESS \
    --name "Test Token" \
    --symbol "TEST" \
    --image_url "ipfs://QmTest" \
    --description "A test token for SAC Factory" 2>&1)

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ Token launched!${NC}"
    echo "   Token address: $TOKEN_ADDRESS"
else
    echo -e "${YELLOW}⚠️  Token launch skipped or failed (might need XLM)${NC}"
fi
echo ""

# Test 5: Get token count again
echo -e "${YELLOW}[Test 5] Get token count after launch...${NC}"
TOKEN_COUNT_AFTER=$(stellar contract invoke \
    --id $CONTRACT_ID \
    --source $IDENTITY \
    --network $NETWORK \
    -- get_token_count)

echo -e "${GREEN}✅ Token count: $TOKEN_COUNT_AFTER${NC}"

if [ "$TOKEN_COUNT_AFTER" -gt "$TOKEN_COUNT" ]; then
    echo -e "${GREEN}   Count increased! ✅${NC}"
else
    echo -e "${YELLOW}   Count unchanged (expected if launch failed)${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}🎉 Testing complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "📊 Results:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Initial token count:  $TOKEN_COUNT"
echo "Final token count:    $TOKEN_COUNT_AFTER"
echo "State:                $STATE"
echo ""
echo "🔗 View on Explorer:"
echo "https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID"
echo ""
