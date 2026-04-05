#!/bin/bash
# Script para configurar variables de entorno en Vercel usando API
# Usage: ./setup-vercel-env.sh

set -e

VERCEL_TOKEN="${VERCEL_TOKEN}"
PROJECT_ID="prj_EJfm9FKM9wNWOYH8hp3TMfaJMn2o"
TEAM_ID="team_WWWCdgHNWlHrbpK6IBj761Dr"

if [ -z "$VERCEL_TOKEN" ]; then
  echo "❌ Error: VERCEL_TOKEN no está configurado"
  exit 1
fi

echo "🚀 Configurando variables de entorno en Vercel..."

# Function to add/update environment variable via API
add_env_var() {
  local key=$1
  local value=$2
  local env_type=${3:-production}

  echo "➕ Configurando $key..."

  curl -s -X POST "https://api.vercel.com/v10/projects/$PROJECT_ID/env?teamId=$TEAM_ID" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"type\": \"encrypted\",
      \"key\": \"$key\",
      \"value\": \"$value\",
      \"target\": [\"$env_type\"]
    }" | grep -q "error" && echo "⚠️  $key existe o error" || echo "✅ $key configurado"
}

# Database
add_env_var "DATABASE_URL" "postgresql://postgres:wankaroots@db.labldncxergymabwcpah.supabase.co:5432/postgres"
add_env_var "DIRECT_DATABASE_URL" "postgresql://postgres:wankaroots@db.labldncxergymabwcpah.supabase.co:5432/postgres"

# Redis
add_env_var "UPSTASH_REDIS_REST_URL" "https://leading-goshawk-32655.upstash.io"
add_env_var "UPSTASH_REDIS_REST_TOKEN" "AX-PAAIncDI4M2YzMzhhODc3Yzg0YTA1OWM3OGNjZGJiYmVkMWQyZnAyMzI2NTU"
add_env_var "KV_REST_API_URL" "https://leading-goshawk-32655.upstash.io"
add_env_var "KV_REST_API_TOKEN" "AX-PAAIncDI4M2YzMzhhODc3Yzg0YTA1OWM3OGNjZGJiYmVkMWQyZnAyMzI2NTU"

# Stellar
add_env_var "STELLAR_NETWORK" "testnet"
add_env_var "STELLAR_RPC_URL" "https://soroban-testnet.stellar.org"
add_env_var "STELLAR_NETWORK_PASSPHRASE" "Test SDF Network ; September 2015"

# Contracts
add_env_var "TOKEN_FACTORY_CONTRACT_ID" "CCQ4IMTQR3PIXQBLEZPFFUEPGMSHUE5AAD2CB6PXBOVR5G3EQKGTHUPD"
add_env_var "DEX_FACTORY_CONTRACT_ID" "CCIWIAARHLGLOXFZZJZVA42JWJRB3UCB25S6K6462SM27L5YNODDS2TW"
add_env_var "DEX_ROUTER_CONTRACT_ID" "CDDAPQKLLP2WMH2LJELHM4E5NTZ7KEVEFV5GFE7EIPTUVD4K4YUUZQQV"
add_env_var "DEX_BRIDGE_CONTRACT_ID" "CC5XKGMINSIETOQU664ZJQXTZCJYA2KJFUV34UDEVRJNSMQOPKFEHWGM"
add_env_var "DEX_STAKING_CONTRACT_ID" "CD7TGTMPW4TZAGC6AYEHCK4SMVHP6NC4X4UGTK242GEAXHPPOKWSILG4"
add_env_var "XLM_SAC_ADDRESS" "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"

# Security
add_env_var "ADMIN_API_KEY" "astro-protocol-admin-secure-key-2026-production-testnet-v1"
add_env_var "CORS_ORIGIN" "https://astro-launchpad-topaz.vercel.app,https://web-nunalabs-projects.vercel.app,https://frontend-two-eta-66.vercel.app,https://astro-swap-nunalabs-projects.vercel.app"

# GraphQL
add_env_var "GRAPHQL_INTROSPECTION" "false"
add_env_var "GRAPHQL_PLAYGROUND" "false"
add_env_var "GRAPHQL_DEPTH_LIMIT" "10"
add_env_var "GRAPHQL_COMPLEXITY_LIMIT" "5000"

# Rate Limiting
add_env_var "RATE_LIMIT_WINDOW_MS" "60000"
add_env_var "RATE_LIMIT_MAX_REQUESTS" "100"
add_env_var "RATE_LIMIT_MAX" "100"

# Logging
add_env_var "LOG_LEVEL" "info"
add_env_var "LOG_PRETTY" "false"
add_env_var "NODE_ENV" "production"

echo ""
echo "✅ Configuración completada!"
echo "🔄 Ahora triggering redeploy..."
