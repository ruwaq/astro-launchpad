# API Directory - Vercel Serverless Functions

## Overview

This directory contains JavaScript handlers for Vercel's serverless function discovery.
The actual logic is written in TypeScript at `src/` and compiled to `dist/`.

## Architecture

```
api/                          <- Vercel serverless entry points
├── graphql.js                <- GraphQL handler
├── health.js                 <- Health check endpoint
└── index.js                  <- Root endpoint (API info)

src/                          <- TypeScript source code
├── graphql/                  <- GraphQL implementation
│   ├── schema.ts             <- Schema definition
│   ├── resolvers/            <- Modular resolvers
│   ├── context.ts            <- Request context with auth
│   ├── loaders.ts            <- DataLoaders (N+1 prevention)
│   └── validation.ts         <- Rate limiting, complexity
├── lib/                      <- Shared utilities
│   ├── prisma.ts             <- Database client
│   ├── cache.ts              <- Redis/KV cache
│   └── logger.ts             <- Pino logger
└── config/
    └── env.ts                <- Environment validation (Zod)

dist/                         <- Compiled JavaScript (from tsc)
└── src/                      <- Mirrors src/ structure
```

## How It Works

1. **TypeScript Compilation**: `pnpm build` runs `tsc` to compile `src/` → `dist/`
2. **Vercel Function Discovery**: Vercel looks for files in `api/` directory
3. **Runtime Imports**: `api/*.js` handlers import from compiled `dist/src/`
4. **vercel.json**: Configured to include `dist/**/*` in function bundle

```
Request → api/graphql.js → dist/src/graphql/schema.js
                         → dist/src/graphql/resolvers/
                         → dist/src/lib/prisma.js
```

## Endpoints

| Endpoint | Handler | Description |
|----------|---------|-------------|
| `/graphql` | `api/graphql.js` | Apollo GraphQL API |
| `/health` | `api/health.js` | Health check with DB/cache status |
| `/api` | `api/index.js` | API info and version |

## Development

```bash
# Build TypeScript
pnpm build

# Test locally
pnpm dev

# Test GraphQL endpoint
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ health { status database } }"}'
```

## Deployment

Vercel automatically:
1. Runs `pnpm install`
2. Runs `pnpm vercel-build` (which runs `tsc`)
3. Deploys `api/*.js` with `dist/**/*` included

## Key Configuration

**vercel.json**:
```json
{
  "functions": {
    "api/*.js": {
      "memory": 1024,
      "maxDuration": 30,
      "includeFiles": "dist/**/*"
    }
  }
}
```

## Features

- Apollo Server with `@as-integrations/next`
- DataLoaders (N+1 query prevention)
- Rate limiting per IP
- Query complexity validation
- CORS with origin whitelist
- Pino structured logging
- Prisma database access
- Redis/Vercel KV cache support
- Soft-delete filtering (automatic)
