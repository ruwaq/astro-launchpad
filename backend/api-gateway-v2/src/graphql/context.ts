/**
 * GraphQL Context
 * Created for each request, contains Prisma client and DataLoaders
 */

import type { FastifyRequest, FastifyReply } from 'fastify'
import type { MercuriusContext } from 'mercurius'
import { prisma } from '@astroshibapop/shared/prisma'
import type { PrismaClientWithAccelerate } from '@astroshibapop/shared/prisma'
import { createLoaders, type DataLoaders } from './loaders.js'

/**
 * GraphQL Context interface
 * Available in all resolvers via the context parameter
 */
export interface GraphQLContext extends MercuriusContext {
  prisma: PrismaClientWithAccelerate
  request: FastifyRequest
  reply: FastifyReply
  loaders: DataLoaders
}

/**
 * Create GraphQL context for each request
 * This runs once per GraphQL request
 *
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 * @returns Context object passed to all resolvers
 */
export async function createContext(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<GraphQLContext> {
  // Create context with Prisma client and DataLoaders
  // DataLoaders are created fresh for each request to ensure proper batching
  return {
    prisma,
    request,
    reply,
    app: request.server,
    loaders: createLoaders(prisma),
  } as GraphQLContext
}

/**
 * Extract IP address from request
 * Handles proxies and forwarded headers
 */
export function getClientIP(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for']
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]
  }
  return request.ip
}

/**
 * Extract user agent from request
 */
export function getUserAgent(request: FastifyRequest): string | undefined {
  return request.headers['user-agent']
}

/**
 * Check if request is authenticated
 * (Authentication will be implemented later if needed)
 */
export function isAuthenticated(context: GraphQLContext): boolean {
  // TODO: Implement authentication check
  // For now, all requests are allowed
  return true
}
