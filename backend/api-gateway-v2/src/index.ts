/**
 * Development Server Entrypoint
 * Starts the Fastify server for local development
 */

// Load .env from api-gateway-v2 directory BEFORE importing anything
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env'), override: true })

import closeWithGrace from 'close-with-grace'
import { createApp } from './app.js'
import { env } from '@astroshibapop/shared/config'

/**
 * Start the server
 */
async function start() {
  const app = await createApp()

  // Graceful shutdown
  const closeListeners = closeWithGrace(
    { delay: 500 },
    async function ({ signal, err, manual }: any) {
      if (err) {
        app.log.error(err, 'Uncaught error, shutting down gracefully')
      }
      app.log.info(`Received ${signal}, shutting down gracefully`)
      await app.close()
    }
  )

  // Handle SIGTERM/SIGINT
  app.addHook('onClose', async (instance) => {
    closeListeners.uninstall()
  })

  // Start listening
  const port = env.API_PORT
  const host = env.API_HOST

  try {
    await app.listen({ port, host })
    app.log.info(`🚀 Server ready at http://${host}:${port}`)
    app.log.info(`📊 GraphQL endpoint: http://${host}:${port}/graphql`)
    app.log.info(`🏥 Health check: http://${host}:${port}/health`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

// Start the server
start()
