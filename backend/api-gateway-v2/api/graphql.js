/**
 * GraphQL API Endpoint - Vercel Serverless Function
 *
 * This is a thin wrapper that re-exports the compiled handler from src/handlers/vercel.ts
 * All logic is in src/graphql/ (SINGLE SOURCE OF TRUTH)
 *
 * Architecture:
 * - Schema & Resolvers: src/graphql/
 * - Handler Logic: src/handlers/vercel.ts
 * - Compiled Output: dist/src/handlers/vercel.js
 *
 * @see src/handlers/vercel.ts for the actual implementation
 * @see src/graphql/ for schema and resolvers
 * @version 2.1.0
 */

// Re-export the handler from compiled TypeScript source
// This allows us to maintain a single source of truth in TypeScript
// while still working with Vercel's serverless function discovery in api/
export { default } from '../dist/src/handlers/vercel.js';
export { config } from '../dist/src/handlers/vercel.js';
