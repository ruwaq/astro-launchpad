/**
 * Vercel Serverless Handler
 * Handles GraphQL requests in Vercel serverless environment
 */

import { createApp } from '../src/app.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Cache the app instance across invocations (warm starts)
let app: Awaited<ReturnType<typeof createApp>> | null = null

/**
 * Vercel serverless function handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Initialize app on cold start
  if (!app) {
    app = await createApp()
    await app.ready()
  }

  // Handle the request
  app.server.emit('request', req, res)
}
