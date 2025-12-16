# API Gateway - Vercel Serverless Functions

## CRITICAL ARCHITECTURE NOTE

This directory (`api/`) contains the **actual production code** that Vercel uses for serverless functions.

### Two GraphQL Implementations

There are **two separate GraphQL implementations** in this project:

| Location | Purpose | Used In |
|----------|---------|---------|
| `api/graphql.js` | **Production endpoint** | Vercel (production/preview) |
| `src/graphql/` | Local development | Local Express server |

### Why Two Implementations?

1. **`api/graphql.js`**: A self-contained serverless function optimized for Vercel's serverless runtime. Contains its own schema, resolvers, and Prisma client.

2. **`src/graphql/`**: A more structured codebase with TypeScript, middleware, and modular organization for local development and testing.

### Important Rules

1. **All production fixes MUST be made in `api/graphql.js`**
2. Changes to `src/graphql/` will NOT affect production
3. The build output from `src/` is NOT used by Vercel for the GraphQL endpoint

### Soft-Delete Implementation

Tokens and Pools support soft-delete via the `deletedAt` field:

```javascript
// Active record
{ deletedAt: null }

// Soft-deleted record
{ deletedAt: new Date() }
```

**All token queries MUST include the soft-delete filter:**

```javascript
// Correct - excludes soft-deleted tokens
prisma.token.findMany({
  where: { deletedAt: null },
  // ...
})

// WRONG - includes soft-deleted tokens
prisma.token.findMany({
  // missing deletedAt filter!
})
```

### Files in This Directory

| File | Purpose |
|------|---------|
| `graphql.js` | Main GraphQL endpoint (Apollo Server) |
| `health.js` | Health check endpoint |
| `index.js` | Root endpoint |

### Future Improvements

Consider consolidating these two implementations by either:
1. Using `api/graphql.js` as the single source of truth
2. Or configuring Vercel to use the compiled output from `src/`

For now, keep both in sync manually.
