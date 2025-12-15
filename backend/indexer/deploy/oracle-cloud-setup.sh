#!/bin/bash
# =============================================================================
# Oracle Cloud VM Setup Script for Astro Indexer
# Run this on a fresh Ubuntu 22.04 VM
# =============================================================================

set -e

echo "🚀 Setting up Astro Indexer on Oracle Cloud..."

# Update system
echo "📦 Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y

# Install required packages
echo "📦 Installing required packages..."
sudo apt-get install -y \
    curl \
    git \
    build-essential \
    ca-certificates \
    gnupg \
    lsb-release

# Install Node.js 20 LTS
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
echo "📦 Installing pnpm..."
sudo npm install -g pnpm

# Verify installations
echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"
echo "✅ pnpm version: $(pnpm --version)"

# Create app directory
echo "📁 Creating app directory..."
sudo mkdir -p /opt/astro-indexer
sudo chown $USER:$USER /opt/astro-indexer

# Clone repository (or copy files)
echo "📥 Cloning repository..."
cd /opt/astro-indexer
git clone https://github.com/nunalabs/astro-launchpad.git .

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --filter @astroshibapop/indexer --filter @astroshibapop/shared

# Build the indexer
echo "🔨 Building indexer..."
cd backend/indexer
pnpm build

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Create .env file: nano /opt/astro-indexer/backend/indexer/.env"
echo "2. Start indexer: pnpm start"
echo "3. Or use systemd service (see below)"
