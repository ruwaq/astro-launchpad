/**
 * Health Check Endpoint - Vercel Serverless Function
 *
 * This is a thin wrapper that re-exports the compiled handler from src/handlers/health.ts
 *
 * Architecture:
 * - Handler Logic: src/handlers/health.ts
 * - Compiled Output: dist/src/handlers/health.js
 *
 * Endpoints:
 * - GET /health - Full health check
 * - GET /health?quick=true - Quick check (no DB)
 * - GET /health?detailed=true - Include token stats
 *
 * @see src/handlers/health.ts for the actual implementation
 * @version 2.1.0
 */

// Re-export the handler from compiled TypeScript source
export { default } from '../dist/src/handlers/health.js';
export { config } from '../dist/src/handlers/health.js';
