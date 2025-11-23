/**
 * Vercel Serverless Handler
 * Optimized for Vercel serverless environment with Prisma
 */

import { createApp } from '../dist/src/app.js'

// Cache the app instance across invocations (warm starts)
let cachedApp = null

/**
 * Vercel serverless function handler
 */
export default async function handler(req, res) {
  try {
    // Initialize app on cold start
    if (!cachedApp) {
      console.log('Cold start: initializing app...')
      cachedApp = await createApp()
      await cachedApp.ready()
      console.log('App initialized successfully')
    }

    // Handle the request using Fastify's internal request handler
    cachedApp.server.emit('request', req, res)
  } catch (error) {
    console.error('Handler error:', error)
    
    // Return error response
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : error.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
    })
  }
}