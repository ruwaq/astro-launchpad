# Dockerfile for Astro-Shiba API Gateway (Apollo GraphQL)
FROM node:20-alpine AS base

# Install pnpm and OpenSSL for Prisma
RUN corepack enable && corepack prepare pnpm@9.7.1 --activate
RUN apk add --no-cache openssl

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/api-gateway-v2/package.json ./backend/api-gateway-v2/
COPY backend/shared/package.json ./backend/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend ./backend

# Copy source code
COPY backend ./backend

# Generate Prisma client
WORKDIR /app/backend/shared
RUN pnpm run db:generate

# Build the API
WORKDIR /app/backend/api-gateway-v2
RUN pnpm run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 api

# Copy built application and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/api-gateway-v2/dist ./dist
COPY --from=builder /app/backend/api-gateway-v2/package.json ./
COPY --from=builder /app/backend/shared ./backend/shared

USER api

EXPOSE 4000

ENV PORT=4000
ENV HOST="0.0.0.0"

CMD ["node", "dist/index.js"]
