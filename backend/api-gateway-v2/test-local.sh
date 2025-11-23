#!/bin/bash
set -e

echo "🧪 TEST WORKFLOW PARA VERCEL - SIN RATE LIMITS"
echo "================================================"

echo ""
echo "📦 Step 1: Install dependencies"
npm install --legacy-peer-deps

echo ""
echo "🔧 Step 2: Generate Prisma Client"
npx prisma generate --schema=./prisma/schema.prisma

echo ""
echo "🏗️  Step 3: Build TypeScript"
rm -rf dist
npm run build

echo ""
echo "✅ Step 4: Verify build output"
ls -la dist/api/
ls -la api/

echo ""
echo "🎯 Step 5: Simulate Vercel build (local)"
echo "Using pre-compiled JS files"

echo ""
echo "✨ BUILD EXITOSO!"
echo "Archivos listos para deploy:"
find api dist -name "*.js" -type f | head -10

echo ""
echo "🚀 Ahora puedes hacer push sin rate limit:"
echo "   git push origin main"
