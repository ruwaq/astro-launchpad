#!/bin/bash
set -e

echo "🔨 Building API Gateway V2..."

# Step 1: Generate Prisma Client
echo "📦 Generating Prisma Client..."
cd ../shared
npx prisma generate
echo "✅ Prisma Client generated"

# Step 2: Install TypeScript if not present
cd ../api-gateway-v2
echo "📦 Installing TypeScript..."
npm install typescript --save-dev --legacy-peer-deps

# Step 3: Build TypeScript
echo "🔨 Compiling TypeScript..."
npm run build

echo "✅ Build completed successfully!"