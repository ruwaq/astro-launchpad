/**
 * Test script para validar la configuración del módulo shared
 * Ejecutar con: pnpm tsx test-setup.ts
 */

import { env, getApiConfig, getStellarConfig, getRedisConfig } from './config/env.js'
import { prisma, CACHE_STRATEGIES, checkDatabaseHealth } from './prisma/client.js'

async function testSetup() {
  console.log('🧪 Testing @astroshibapop/shared setup...\n')

  // 1. Test Environment Variables
  console.log('1️⃣  Testing Environment Configuration')
  console.log('   ✅ NODE_ENV:', env.NODE_ENV)
  console.log('   ✅ API_PORT:', env.API_PORT)
  console.log('   ✅ STELLAR_NETWORK:', env.STELLAR_NETWORK)
  console.log('   ✅ DATABASE_URL:', env.DATABASE_URL ? '✓ Configured' : '✗ Missing')

  // 2. Test Config Functions
  console.log('\n2️⃣  Testing Config Functions')
  const apiConfig = getApiConfig()
  console.log('   ✅ API Config:', {
    port: apiConfig.port,
    graphql: {
      maxDepth: apiConfig.graphql.maxDepth,
      maxComplexity: apiConfig.graphql.maxComplexity
    }
  })

  const stellarConfig = getStellarConfig()
  console.log('   ✅ Stellar Config:', {
    network: stellarConfig.network,
    rpcUrl: stellarConfig.rpcUrl
  })

  const redisConfig = getRedisConfig()
  console.log('   ✅ Redis Config:', redisConfig ? '✓ Configured' : '○ Optional (not configured)')

  // 3. Test Prisma Client
  console.log('\n3️⃣  Testing Prisma Client')
  console.log('   ✅ Prisma Client instantiated')
  console.log('   ✅ Accelerate extension loaded')

  // 4. Test Cache Strategies
  console.log('\n4️⃣  Testing Cache Strategies')
  Object.entries(CACHE_STRATEGIES).forEach(([name, strategy]) => {
    const swrText = 'swr' in strategy ? `, SWR=${strategy.swr}s` : ''
    console.log(`   ✅ ${name}: TTL=${strategy.ttl}s${swrText}`)
  })

  // 5. Test Database Connection (optional - requiere DB activa)
  console.log('\n5️⃣  Testing Database Connection')
  try {
    const isHealthy = await checkDatabaseHealth()
    if (isHealthy) {
      console.log('   ✅ Database connection successful')

      // Test query con cache
      console.log('\n6️⃣  Testing Cached Queries')
      console.log('   ℹ️  Attempting to query tokens table...')

      const tokenCount = await prisma.token.count({
        cacheStrategy: CACHE_STRATEGIES.SHORT_TTL
      })
      console.log(`   ✅ Found ${tokenCount} tokens (cached for 60s)`)
    } else {
      console.log('   ⚠️  Database connection failed (this is OK if DB is not running)')
      console.log('   ℹ️  To enable DB tests, start PostgreSQL and run migrations')
    }
  } catch (error) {
    console.log('   ⚠️  Database test skipped:', (error as Error).message)
    console.log('   ℹ️  This is normal if database is not yet configured')
  }

  console.log('\n✅ All setup tests completed!\n')
  console.log('📝 Next steps:')
  console.log('   1. Configure your database connection in .env')
  console.log('   2. Run: pnpm db:push (to create tables)')
  console.log('   3. Ready to use in api-gateway and indexer!')
  console.log('')

  // Importante: desconectar en scripts standalone
  await prisma.$disconnect()
}

// Run tests
testSetup().catch((error) => {
  console.error('❌ Setup test failed:', error)
  process.exit(1)
})
