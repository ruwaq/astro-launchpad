#!/bin/bash
# Script para configurar variables de entorno en Vercel
# Usage: ./configure-vercel-env.sh
# Requires: VERCEL_TOKEN environment variable set

set -e

if [ -z "$VERCEL_TOKEN" ]; then
  echo "❌ Error: VERCEL_TOKEN no está configurado"
  echo "💡 Configúralo con: source ../../../../.credentials.local"
  exit 1
fi

PROJECT="api-gateway-v2"

echo "🚀 Configurando variables de entorno para $PROJECT en Vercel..."

# Function to add environment variable
add_env() {
  local key=$1
  local value=$2
  local env_type=${3:-production}

  echo "➕ Añadiendo $key ($env_type)..."
  echo "$value" | vercel env add "$key" "$env_type" --token "$VERCEL_TOKEN" --yes 2>/dev/null || echo "⚠️  $key ya existe, actualizando..."
}

# Database
add_env "DATABASE_URL" "postgresql://postgres:wankaroots@db.labldncxergymabwcpah.supabase.co:5432/postgres"
add_env "DIRECT_DATABASE_URL" "postgresql://postgres:wankaroots@db.labldncxergymabwcpah.supabase.co:5432/postgres"

# Redis
add_env "UPSTASH_REDIS_REST_URL" "https://leading-goshawk-32655.upstash.io"
add_env "UPSTASH_REDIS_REST_TOKEN" "AX-PAAIncDI4M2YzMzhhODc3Yzg0YTA1OWM3OGNjZGJiYmVkMWQyZnAyMzI2NTU"
add_env "KV_REST_API_URL" "https://leading-goshawk-32655.upstash.io"
add_env "KV_REST_API_TOKEN" "AX-PAAIncDI4M2YzMzhhODc3Yzg0YTA1OWM3OGNjZGJiYmVkMWQyZnAyMzI2NTU"

# Stellar
add_env "STELLAR_NETWORK" "testnet"
add_env "STELLAR_RPC_URL" "https://soroban-testnet.stellar.org"
add_env "STELLAR_NETWORK_PASSPHRASE" "Test SDF Network ; September 2015"

# Contracts
add_env "TOKEN_FACTORY_CONTRACT_ID" "CCQ4IMTQR3PIXQBLEZPFFUEPGMSHUE5AAD2CB6PXBOVR5G3EQKGTHUPD"
add_env "DEX_FACTORY_CONTRACT_ID" "CCIWIAARHLGLOXFZZJZVA42JWJRB3UCB25S6K6462SM27L5YNODDS2TW"
add_env "DEX_ROUTER_CONTRACT_ID" "CDDAPQKLLP2WMH2LJELHM4E5NTZ7KEVEFV5GFE7EIPTUVD4K4YUUZQQV"
add_env "DEX_BRIDGE_CONTRACT_ID" "CC5XKGMINSIETOQU664ZJQXTZCJYA2KJFUV34UDEVRJNSMQOPKFEHWGM"
add_env "DEX_STAKING_CONTRACT_ID" "CD7TGTMPW4TZAGC6AYEHCK4SMVHP6NC4X4UGTK242GEAXHPPOKWSILG4"
add_env "XLM_SAC_ADDRESS" "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"

# Security
add_env "ADMIN_API_KEY" "astro-protocol-admin-secure-key-2026-production-testnet-v1"
add_env "CORS_ORIGIN" "https://astro-launchpad-topaz.vercel.app,https://web-nunalabs-projects.vercel.app,https://frontend-two-eta-66.vercel.app,https://astro-swap-nunalabs-projects.vercel.app"

# GraphQL
add_env "GRAPHQL_INTROSPECTION" "false"
add_env "GRAPHQL_PLAYGROUND" "false"
add_env "GRAPHQL_DEPTH_LIMIT" "10"
add_env "GRAPHQL_COMPLEXITY_LIMIT" "5000"

# Rate Limiting
add_env "RATE_LIMIT_WINDOW_MS" "60000"
add_env "RATE_LIMIT_MAX_REQUESTS" "100"
add_env "RATE_LIMIT_MAX" "100"

# Logging
add_env "LOG_LEVEL" "info"
add_env "LOG_PRETTY" "false"

# Node Environment
add_env "NODE_ENV" "production"

echo "✅ Variables de entorno configuradas exitosamente!"
echo "🔄 Ahora puedes hacer deploy con: vercel --prod"
