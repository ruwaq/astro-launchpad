/**
 * GraphQL Query Validation Rules
 * Protects against DoS attacks via deeply nested or expensive queries
 */

import {
  GraphQLError,
  Kind,
  ValidationContext,
  ASTVisitor,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  OperationDefinitionNode,
} from 'graphql';

// Configuration
const MAX_QUERY_DEPTH = 7; // Maximum nesting depth
const MAX_QUERY_COMPLEXITY = 5000; // Maximum query complexity score (increased for token list queries)
const FIELD_COMPLEXITY_DEFAULT = 1;
const LIST_MULTIPLIER = 10; // Lists multiply complexity
const MUTATION_MULTIPLIER = 2; // Mutations cost more

/**
 * Custom validation rule to limit query depth
 * Prevents deeply nested queries that could be used for DoS
 */
export function depthLimitRule(maxDepth: number = MAX_QUERY_DEPTH) {
  return (context: ValidationContext): ASTVisitor => {
    const fragments: { [name: string]: FragmentDefinitionNode } = {};
    const operationDepths: Map<OperationDefinitionNode, number> = new Map();

    return {
      Document: {
        enter(node) {
          // Collect all fragment definitions first
          for (const definition of node.definitions) {
            if (definition.kind === Kind.FRAGMENT_DEFINITION) {
              fragments[definition.name.value] = definition;
            }
          }
        },
      },
      OperationDefinition: {
        enter(operation) {
          const depth = calculateDepth(
            operation.selectionSet,
            fragments,
            0,
            maxDepth,
          );
          operationDepths.set(operation, depth);

          if (depth > maxDepth) {
            context.reportError(
              new GraphQLError(
                `Query depth of ${depth} exceeds maximum allowed depth of ${maxDepth}. ` +
                `This is a security measure to prevent resource exhaustion.`,
                { nodes: operation }
              )
            );
          }
        },
      },
    };
  };
}

/**
 * Calculate the depth of a selection set recursively
 */
function calculateDepth(
  selectionSet: any,
  fragments: { [name: string]: FragmentDefinitionNode },
  currentDepth: number,
  maxDepth: number,
): number {
  if (!selectionSet || currentDepth > maxDepth + 1) {
    return currentDepth;
  }

  let maxChildDepth = currentDepth;

  for (const selection of selectionSet.selections) {
    let depth = currentDepth;

    if (selection.kind === Kind.FIELD) {
      const field = selection as FieldNode;
      // Skip introspection fields
      if (field.name.value.startsWith('__')) {
        continue;
      }
      if (field.selectionSet) {
        depth = calculateDepth(
          field.selectionSet,
          fragments,
          currentDepth + 1,
          maxDepth,
        );
      }
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const spread = selection as FragmentSpreadNode;
      const fragment = fragments[spread.name.value];
      if (fragment) {
        depth = calculateDepth(
          fragment.selectionSet,
          fragments,
          currentDepth,
          maxDepth,
        );
      }
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      const inline = selection as InlineFragmentNode;
      depth = calculateDepth(
        inline.selectionSet,
        fragments,
        currentDepth,
        maxDepth,
      );
    }

    maxChildDepth = Math.max(maxChildDepth, depth);
  }

  return maxChildDepth;
}

/**
 * Query complexity analysis plugin for Apollo Server
 * Assigns costs to fields and enforces a maximum complexity limit
 */
export function createComplexityPlugin(maxComplexity: number = MAX_QUERY_COMPLEXITY) {
  return {
    requestDidStart: async () => ({
      async didResolveOperation({ request, document, operationName }: any) {
        const complexity = calculateQueryComplexity(document, operationName);

        if (complexity > maxComplexity) {
          throw new GraphQLError(
            `Query complexity of ${complexity} exceeds maximum allowed complexity of ${maxComplexity}. ` +
            `Try reducing the number of fields or using pagination with smaller limits.`,
          );
        }

        // Log high complexity queries for monitoring
        if (complexity > maxComplexity * 0.8) {
          console.warn(`[Performance] High complexity query (${complexity}/${maxComplexity}):`,
            request.query?.substring(0, 200));
        }
      },
    }),
  };
}

/**
 * Calculate query complexity based on field costs
 */
function calculateQueryComplexity(document: any, operationName?: string | null): number {
  let totalComplexity = 0;
  const fragments: { [name: string]: FragmentDefinitionNode } = {};

  // Collect fragments
  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments[definition.name.value] = definition;
    }
  }

  // Find the operation
  for (const definition of document.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      // If operationName specified, only analyze that operation
      if (operationName && definition.name?.value !== operationName) {
        continue;
      }

      const isMutation = definition.operation === 'mutation';
      const multiplier = isMutation ? MUTATION_MULTIPLIER : 1;

      totalComplexity += calculateSelectionComplexity(
        definition.selectionSet,
        fragments,
        multiplier,
      );
    }
  }

  return totalComplexity;
}

/**
 * Calculate complexity for a selection set
 */
function calculateSelectionComplexity(
  selectionSet: any,
  fragments: { [name: string]: FragmentDefinitionNode },
  multiplier: number,
): number {
  if (!selectionSet) return 0;

  let complexity = 0;

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      const field = selection as FieldNode;

      // Skip introspection
      if (field.name.value.startsWith('__')) continue;

      // Check for list arguments (limit, first, etc.) which multiply complexity
      let fieldMultiplier = multiplier;
      const limitArg = field.arguments?.find((arg: any) =>
        ['limit', 'first', 'last', 'take'].includes(arg.name.value)
      );
      if (limitArg && limitArg.value.kind === Kind.INT) {
        const limit = parseInt((limitArg.value as any).value, 10);
        fieldMultiplier *= Math.min(limit, 100); // Cap at 100 to prevent abuse
      } else if (isListField(field.name.value)) {
        fieldMultiplier *= LIST_MULTIPLIER;
      }

      // Add base cost
      complexity += FIELD_COMPLEXITY_DEFAULT * fieldMultiplier;

      // Add child complexity
      if (field.selectionSet) {
        complexity += calculateSelectionComplexity(
          field.selectionSet,
          fragments,
          fieldMultiplier,
        );
      }
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const spread = selection as FragmentSpreadNode;
      const fragment = fragments[spread.name.value];
      if (fragment) {
        complexity += calculateSelectionComplexity(
          fragment.selectionSet,
          fragments,
          multiplier,
        );
      }
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      const inline = selection as InlineFragmentNode;
      complexity += calculateSelectionComplexity(
        inline.selectionSet,
        fragments,
        multiplier,
      );
    }
  }

  return complexity;
}

/**
 * Check if a field name typically returns a list
 */
function isListField(fieldName: string): boolean {
  const listFields = [
    'tokens', 'pools', 'users', 'transactions', 'edges',
    'leaderboard', 'trendingTokens', 'achievements',
    'tokensCreated', 'holders'
  ];
  return listFields.includes(fieldName);
}

/**
 * Export validation rules array for Apollo Server
 */
export const validationRules = [
  depthLimitRule(MAX_QUERY_DEPTH),
];
