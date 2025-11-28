/**
 * GraphQL Utilities - Helper functions for working with GraphQL data
 */

import type { Edge, Connection } from '@/lib/types/graphql.types';

/**
 * Extract nodes from GraphQL edges array
 * Provides type-safe extraction of node data from connection edges
 *
 * @param edges - Array of edges from GraphQL connection
 * @returns Array of nodes
 *
 * @example
 * const tokens = extractNodes(data.tokens.edges);
 * // tokens is TokenGraphQL[]
 */
export function extractNodes<T>(edges: Edge<T>[] | undefined | null): T[] {
  if (!edges || !Array.isArray(edges)) {
    return [];
  }
  return edges.map((edge) => edge.node).filter(Boolean);
}

/**
 * Extract nodes from a full connection object
 *
 * @param connection - GraphQL connection object
 * @returns Array of nodes
 */
export function extractNodesFromConnection<T>(
  connection: Connection<T> | undefined | null
): T[] {
  if (!connection?.edges) {
    return [];
  }
  return extractNodes(connection.edges);
}

/**
 * Safe get first node from edges
 *
 * @param edges - Array of edges
 * @returns First node or undefined
 */
export function getFirstNode<T>(
  edges: Edge<T>[] | undefined | null
): T | undefined {
  const nodes = extractNodes(edges);
  return nodes[0];
}

/**
 * Check if connection has more pages
 *
 * @param connection - GraphQL connection
 * @returns boolean indicating if there are more pages
 */
export function hasNextPage<T>(
  connection: Connection<T> | undefined | null
): boolean {
  return connection?.pageInfo?.hasNextPage ?? false;
}

/**
 * Get total count from connection
 *
 * @param connection - GraphQL connection
 * @returns Total count or 0
 */
export function getTotalCount<T>(
  connection: Connection<T> | undefined | null
): number {
  return connection?.totalCount ?? connection?.edges?.length ?? 0;
}

/**
 * Map edges to a transformed array
 *
 * @param edges - Array of edges
 * @param mapper - Transform function
 * @returns Transformed array
 */
export function mapEdges<T, R>(
  edges: Edge<T>[] | undefined | null,
  mapper: (node: T, index: number) => R
): R[] {
  const nodes = extractNodes(edges);
  return nodes.map(mapper);
}

/**
 * Filter edges by predicate
 *
 * @param edges - Array of edges
 * @param predicate - Filter function
 * @returns Filtered nodes
 */
export function filterEdges<T>(
  edges: Edge<T>[] | undefined | null,
  predicate: (node: T) => boolean
): T[] {
  const nodes = extractNodes(edges);
  return nodes.filter(predicate);
}

/**
 * Sort edges by comparator
 *
 * @param edges - Array of edges
 * @param comparator - Sort function
 * @returns Sorted nodes
 */
export function sortEdges<T>(
  edges: Edge<T>[] | undefined | null,
  comparator: (a: T, b: T) => number
): T[] {
  const nodes = extractNodes(edges);
  return [...nodes].sort(comparator);
}

/**
 * Reduce edges to a single value
 *
 * @param edges - Array of edges
 * @param reducer - Reduce function
 * @param initial - Initial value
 * @returns Reduced value
 */
export function reduceEdges<T, R>(
  edges: Edge<T>[] | undefined | null,
  reducer: (acc: R, node: T, index: number) => R,
  initial: R
): R {
  const nodes = extractNodes(edges);
  return nodes.reduce(reducer, initial);
}
