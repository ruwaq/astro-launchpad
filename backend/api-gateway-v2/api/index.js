/**
 * Vercel Serverless Function Handler
 * Optimized for Vercel Edge Runtime with proper error handling
 */

import { createApp } from '../dist/src/app.js';

// Global cache for app instance (warm starts optimization)
let cachedApp = null;
let isInitializing = false;
let initializationPromise = null;

/**
 * Initialize Fastify app with proper error handling
 */
async function initializeApp() {
  if (cachedApp) {
    return cachedApp;
  }

  if (isInitializing && initializationPromise) {
    return initializationPromise;
  }

  isInitializing = true;
  initializationPromise = (async () => {
    try {
      console.log('[Vercel] Cold start: initializing Fastify app...');
      const app = await createApp();
      await app.ready();
      console.log('[Vercel] App initialized successfully');
      cachedApp = app;
      return app;
    } catch (error) {
      console.error('[Vercel] Failed to initialize app:', error);
      cachedApp = null;
      throw error;
    } finally {
      isInitializing = false;
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

/**
 * Main Vercel handler function
 * Compatible with Vercel's Node.js runtime
 */
export default async function handler(req, res) {
  const startTime = Date.now();

  try {
    // Add CORS headers immediately
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // Initialize or get cached app
    const app = await initializeApp();

    // Handle request with Fastify
    // Fastify uses Node.js HTTP server interface
    await new Promise((resolve, reject) => {
      // Set up response handlers
      const originalEnd = res.end.bind(res);
      const originalWrite = res.write.bind(res);

      let isResolved = false;

      res.end = function (...args) {
        if (!isResolved) {
          isResolved = true;
          resolve();
        }
        return originalEnd(...args);
      };

      res.write = function (...args) {
        return originalWrite(...args);
      };

      // Let Fastify handle the request
      try {
        app.server.emit('request', req, res);
      } catch (err) {
        if (!isResolved) {
          isResolved = true;
          reject(err);
        }
      }

      // Timeout safety
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          reject(new Error('Request timeout'));
        }
      }, 9000); // 9s timeout (below Vercel's 10s limit)
    });

    const duration = Date.now() - startTime;
    console.log(`[Vercel] Request completed in ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Vercel] Handler error:', error);
    console.error('[Vercel] Request failed after', duration, 'ms');

    // Only send error response if headers haven't been sent
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : error.message,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV !== 'production' && {
          stack: error.stack,
          duration: `${duration}ms`
        })
      });
    }
  }
}

/**
 * Export named function for compatibility
 */
export { handler };