# API Directory - Vercel Serverless Functions

> **Architecture**: Thin wrappers that re-export compiled TypeScript handlers

## Overview

This directory contains thin JavaScript wrappers for Vercel's serverless function discovery.
The actual logic lives in TypeScript at `src/handlers/` and is compiled to `dist/src/handlers/`.

## UNIFIED ARCHITECTURE (v2.1.0)

**Single Source of Truth**: All GraphQL logic is now in `src/graphql/` (TypeScript).

```
api/                          <- Vercel serverless functions
├── graphql.js                <- GraphQL handler (imports from src/)
├── health.js                 <- Health check (imports from src/)
└── index.js                  <- Root endpoint (API info)

src/graphql/                  <- SINGLE SOURCE OF TRUTH
├── schema.ts                 <- GraphQL schema definition
├── resolvers/                <- Modular resolvers
├── context.ts                <- Request context with auth
├── loaders.ts                <- DataLoaders (N+1 prevention)
└── validation.ts             <- Rate limiting, complexity

src/lib/                      <- Shared utilities
├── prisma.ts                 <- Database client
├── cache.ts                  <- Redis cache
├── logger.ts                 <- Pino logger
└── sentry.ts                 <- Error tracking
```

## Architecture

1. **Vercel's function discovery** looks for files in `api/` directory
2. **api/*.js handlers** import directly from `src/` TypeScript files
3. **Vercel compiles** everything during deployment

## Flow

```
Request → api/graphql.js → src/graphql/schema.ts
                         → src/graphql/resolvers/
                         → src/graphql/context.ts
                         → src/lib/prisma.ts
                         → src/lib/cache.ts
```

## Endpoints

| Endpoint | Handler | Description |
|----------|---------|-------------|
| `/graphql` | `api/graphql.js` | Apollo GraphQL API |
| `/health` | `api/health.js` | Health check |
| `/api` | `api/index.js` | API info |

## Development

```bash
# Build TypeScript
pnpm run build

# Test locally with Vercel CLI
npx vercel dev

# Test GraphQL endpoint
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ health { status database tokenStats { activeTokens } } }"}'
```

## Important Notes

1. **All GraphQL logic lives in `src/graphql/`** - Schema, resolvers, context, loaders
2. **api/*.js handlers import from `src/`** - Vercel compiles TypeScript automatically
3. **No manual build needed** - Vercel runs `vercel-build` during deployment
4. **Local development** uses `pnpm dev` which runs Express with same `src/` files

## Features Included

- DataLoaders (N+1 prevention)
- Rate limiting
- Query complexity validation
- CORS with origin whitelist
- Sentry error tracking
- Structured logging (Pino)
- Prisma database access
- Redis cache support
- Soft-delete filtering (automatic)

## Soft-Delete Implementation

Tokens and Pools support soft-delete via the `deletedAt` field.
The filtering is handled automatically in `src/graphql/resolvers/` using raw SQL queries
that always include `WHERE "deletedAt" IS NULL`.

---

*Updated: 2024-12-16 - Unified architecture v2.1.0*
