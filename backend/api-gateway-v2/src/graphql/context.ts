/**
 * GraphQL Context for Apollo Server
 * Optimized for Vercel Serverless with proper typing
 */

import type { NextRequest } from 'next/server';
import { prisma } from '../lib/prisma.js';
import type { PrismaClientWithAdapter } from '../lib/prisma.js';
import { createLoaders, type DataLoaders } from './loaders.js';

/**
 * GraphQL Context Interface
 * Available in all resolvers via the context parameter
 */
export interface GraphQLContext {
  prisma: PrismaClientWithAdapter;
  request: NextRequest;
  loaders: DataLoaders;
  user?: {
    address: string;
    authenticated: boolean;
  };
}

/**
 * Create GraphQL context for each request
 * This runs once per GraphQL request
 *
 * @param request - Next.js request object
 * @returns Context object passed to all resolvers
 */
export async function createContext(
  request: NextRequest
): Promise<GraphQLContext> {
  // Extract authentication if present
  const user = extractUser(request);

  // Create context with Prisma client and DataLoaders
  // DataLoaders are created fresh for each request to ensure proper batching
  return {
    prisma,
    request,
    loaders: createLoaders(prisma),
    user,
  };
}

/**
 * Extract user information from request
 * Currently returns undefined - implement authentication as needed
 */
function extractUser(request: NextRequest): { address: string; authenticated: boolean } | undefined {
  // TODO: Implement authentication
  // Example:
  // const authHeader = request.headers.get('authorization');
  // if (authHeader?.startsWith('Bearer ')) {
  //   const token = authHeader.substring(7);
  //   const decoded = verifyToken(token);
  //   return { address: decoded.address, authenticated: true };
  // }
  
  return undefined;
}

/**
 * Extract client IP address from request
 * Handles proxies and forwarded headers
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  return request.ip || 'unknown';
}

/**
 * Extract user agent from request
 */
export function getUserAgent(request: NextRequest): string | undefined {
  return request.headers.get('user-agent') || undefined;
}

/**
 * Check if request is authenticated
 */
export function isAuthenticated(context: GraphQLContext): boolean {
  return context.user?.authenticated ?? false;
}

/**
 * Require authentication - throws error if not authenticated
 */
export function requireAuth(context: GraphQLContext): void {
  if (!isAuthenticated(context)) {
    throw new Error('Authentication required');
  }
}

/**
 * Get user address from context - throws if not authenticated
 */
export function getUserAddress(context: GraphQLContext): string {
  requireAuth(context);
  return context.user!.address;
}