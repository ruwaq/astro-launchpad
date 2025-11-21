#!/bin/bash

# Build all Soroban smart contracts
# This script compiles and optimizes all contracts for deployment

set -e

echo "🔨 Building Soroban Smart Contracts..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if soroban CLI is installed
if ! command -v soroban &> /dev/null; then
    echo -e "${RED}Error: soroban CLI not found${NC}"
    echo "Install it with: cargo install --locked soroban-cli"
    exit 1
fi

# Array of contracts to build
CONTRACTS=(
    "sac-factory"
    "token-factory"
    "amm-pair"
)

# Build each contract
for CONTRACT in "${CONTRACTS[@]}"; do
    if [ -d "contracts/$CONTRACT" ]; then
        echo -e "${BLUE}Building $CONTRACT...${NC}"

        cd "contracts/$CONTRACT"

        # Build the contract
        soroban contract build

        # Optimize the WASM
        if [ -f "target/wasm32-unknown-unknown/release/${CONTRACT//-/_}.wasm" ]; then
            soroban contract optimize \
                --wasm "target/wasm32-unknown-unknown/release/${CONTRACT//-/_}.wasm"

            echo -e "${GREEN}✓ $CONTRACT built and optimized${NC}"
        else
            echo -e "${RED}✗ Build failed for $CONTRACT${NC}"
            exit 1
        fi

        cd ../..
    else
        echo -e "${RED}Contract directory not found: contracts/$CONTRACT${NC}"
    fi
done

echo -e "${GREEN}✓ All contracts built successfully${NC}"
