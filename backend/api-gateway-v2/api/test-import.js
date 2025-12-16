/**
 * Test Import Endpoint - Vercel Serverless Function
 * Tests if imports from dist/ work correctly
 */

export default async function testImportHandler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
  };

  // Test 1: Try to import logger
  try {
    const { logger } = await import('../dist/src/lib/logger.js');
    results.tests.push({ name: 'logger', success: true, type: typeof logger });
  } catch (error) {
    results.tests.push({ name: 'logger', success: false, error: error.message });
  }

  // Test 2: Try to import prisma
  try {
    const { prisma } = await import('../dist/src/lib/prisma.js');
    results.tests.push({ name: 'prisma', success: true, type: typeof prisma });
  } catch (error) {
    results.tests.push({ name: 'prisma', success: false, error: error.message });
  }

  // Test 3: Try to import cache
  try {
    const { getCacheStats } = await import('../dist/src/lib/cache.js');
    results.tests.push({ name: 'cache', success: true, type: typeof getCacheStats });
  } catch (error) {
    results.tests.push({ name: 'cache', success: false, error: error.message });
  }

  // Test 4: Try to import schema
  try {
    const { schema } = await import('../dist/src/graphql/schema.js');
    results.tests.push({ name: 'schema', success: true, type: typeof schema });
  } catch (error) {
    results.tests.push({ name: 'schema', success: false, error: error.message });
  }

  // Test 5: Try to import resolvers
  try {
    const { resolvers } = await import('../dist/src/graphql/resolvers/index.js');
    results.tests.push({ name: 'resolvers', success: true, type: typeof resolvers });
  } catch (error) {
    results.tests.push({ name: 'resolvers', success: false, error: error.message });
  }

  results.allPassed = results.tests.every(t => t.success);

  res.status(results.allPassed ? 200 : 500).json(results);
}

export const config = {
  api: {
    bodyParser: false,
  },
};
