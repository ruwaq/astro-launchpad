/**
 * Vercel Serverless Handler
 * Handles GraphQL requests in Vercel serverless environment
 */

import { createApp } from '../dist/src/app.js'

// Cache the app instance across invocations (warm starts)
let app = null

/**
 * Vercel serverless function handler
 */
export default async function handler(req, res) {
  try {
    // Initialize app on cold start
    if (!app) {
      app = await createApp()
      await app.ready()
    }

    // Handle the request
    app.server.emit('request', req, res)
  } catch (error) {
    console.error('Handler error:', error)
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    })
  }
}