#!/usr/bin/env node
/**
 * Frontend Integration Test
 *
 * Verifies that the frontend is correctly configured to work with testnet contracts.
 * Run: node scripts/test-integration.mjs
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

// Expected contract addresses from 2026-03-19 deployment
const EXPECTED_CONTRACTS = {
  tokenFactory: 'CCQ4IMTQR3PIXQBLEZPFFUEPGMSHUE5AAD2CB6PXBOVR5G3EQKGTHUPD',
  dexFactory: 'CCIWIAARHLGLOXFZZJZVA42JWJRB3UCB25S6K6462SM27L5YNODDS2TW',
  dexRouter: 'CDDAPQKLLP2WMH2LJELHM4E5NTZ7KEVEFV5GFE7EIPTUVD4K4YUUZQQV',
  dexBridge: 'CC5XKGMINSIETOQU664ZJQXTZCJYA2KJFUV34UDEVRJNSMQOPKFEHWGM',
  dexStaking: 'CD7TGTMPW4TZAGC6AYEHCK4SMVHP6NC4X4UGTK242GEAXHPPOKWSILG4',
  tokenWasm: '5b16326c97ec63333ecb39ded110a63385a4c6e38c746c76c781b4b737c846dc',
  pairWasm: '251b80d004a806aa1eeb63c80b1582d5942df2702d707beb85c12067e1a0a941',
  xlmSac: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
};

// Test counter
let passed = 0;
let failed = 0;

/**
 * Test 1: Check root .env file exists and has correct addresses
 */
function testRootEnv() {
  logInfo('\n=== Test 1: Root .env Configuration ===');

  try {
    const envPath = join(__dirname, '../../../.env');
    const envContent = readFileSync(envPath, 'utf-8');

    // Check for required variables
    const checks = [
      { name: 'NEXT_PUBLIC_NETWORK', expected: 'testnet', required: true },
      { name: 'NEXT_PUBLIC_TOKEN_FACTORY_CONTRACT_ID', expected: EXPECTED_CONTRACTS.tokenFactory, required: true },
      { name: 'NEXT_PUBLIC_DEX_FACTORY_CONTRACT_ID', expected: EXPECTED_CONTRACTS.dexFactory, required: true },
      { name: 'NEXT_PUBLIC_DEX_ROUTER_CONTRACT_ID', expected: EXPECTED_CONTRACTS.dexRouter, required: true },
      { name: 'NEXT_PUBLIC_DEX_BRIDGE_CONTRACT_ID', expected: EXPECTED_CONTRACTS.dexBridge, required: true },
      { name: 'NEXT_PUBLIC_DEX_STAKING_CONTRACT_ID', expected: EXPECTED_CONTRACTS.dexStaking, required: true },
      { name: 'NEXT_PUBLIC_TOKEN_WASM_HASH', expected: EXPECTED_CONTRACTS.tokenWasm, required: true },
      { name: 'NEXT_PUBLIC_DEX_PAIR_WASM_HASH', expected: EXPECTED_CONTRACTS.pairWasm, required: true },
      { name: 'NEXT_PUBLIC_XLM_SAC_ADDRESS', expected: EXPECTED_CONTRACTS.xlmSac, required: true },
    ];

    let testPassed = true;

    for (const check of checks) {
      const regex = new RegExp(`${check.name}=(.+)`, 'm');
      const match = envContent.match(regex);

      if (!match) {
        if (check.required) {
          logError(`Missing: ${check.name}`);
          testPassed = false;
        } else {
          logWarning(`Optional: ${check.name} not set`);
        }
        continue;
      }

      const value = match[1].trim();

      if (check.expected && value !== check.expected) {
        logError(`${check.name}: Expected ${check.expected}, got ${value}`);
        testPassed = false;
      } else {
        logSuccess(`${check.name}: ${value.substring(0, 20)}...`);
      }
    }

    if (testPassed) {
      passed++;
      logSuccess('\nRoot .env configuration is correct!');
    } else {
      failed++;
      logError('\nRoot .env configuration has issues!');
    }
  } catch (error) {
    failed++;
    logError(`Failed to read .env: ${error.message}`);
  }
}

/**
 * Test 2: Check config.ts has correct fallbacks
 */
function testConfigFallbacks() {
  logInfo('\n=== Test 2: config.ts Fallback Addresses ===');

  try {
    const configPath = join(__dirname, '../src/lib/stellar/config.ts');
    const configContent = readFileSync(configPath, 'utf-8');

    const checks = [
      { name: 'tokenFactory', expected: EXPECTED_CONTRACTS.tokenFactory },
      { name: 'dexFactory', expected: EXPECTED_CONTRACTS.dexFactory },
      { name: 'dexRouter', expected: EXPECTED_CONTRACTS.dexRouter },
      { name: 'dexPairWasmHash', expected: EXPECTED_CONTRACTS.pairWasm },
      { name: 'xlmSacAddress', expected: EXPECTED_CONTRACTS.xlmSac },
    ];

    let testPassed = true;

    for (const check of checks) {
      if (configContent.includes(check.expected)) {
        logSuccess(`${check.name}: ${check.expected.substring(0, 20)}...`);
      } else {
        logError(`${check.name}: Missing or incorrect fallback`);
        testPassed = false;
      }
    }

    // Check version comment
    if (configContent.includes('V2.0.0 - March 19, 2026')) {
      logSuccess('Version comment is up to date');
    } else {
      logWarning('Version comment may be outdated');
    }

    if (testPassed) {
      passed++;
      logSuccess('\nconfig.ts fallbacks are correct!');
    } else {
      failed++;
      logError('\nconfig.ts fallbacks have issues!');
    }
  } catch (error) {
    failed++;
    logError(`Failed to read config.ts: ${error.message}`);
  }
}

/**
 * Test 3: Check no mock data in components
 */
function testNoMockData() {
  logInfo('\n=== Test 3: No Mock Data in Components ===');

  try {
    const componentsPath = join(__dirname, '../src/components');

    // Read critical component files
    const files = [
      'trading/TradingInterface.tsx',
      'trading/RecentTrades.tsx',
      'token/TokenHeader.tsx',
    ];

    let testPassed = true;

    for (const file of files) {
      const filePath = join(componentsPath, file);
      const content = readFileSync(filePath, 'utf-8');

      // Check for "REAL DATA" or "NO MOCK DATA" comments
      if (content.includes('REAL DATA') || content.includes('NO MOCK DATA')) {
        logSuccess(`${file}: Using real data`);
      } else {
        logWarning(`${file}: No explicit real data marker`);
      }

      // Check for suspicious mock patterns
      const mockPatterns = [
        /const\s+mockData\s*=/,
        /const\s+MOCK_/,
        /\[\s*{.*mock.*}.*\]/i,
      ];

      for (const pattern of mockPatterns) {
        if (pattern.test(content)) {
          logError(`${file}: Potential mock data found`);
          testPassed = false;
        }
      }
    }

    if (testPassed) {
      passed++;
      logSuccess('\nNo mock data found in components!');
    } else {
      failed++;
      logError('\nPotential mock data found!');
    }
  } catch (error) {
    failed++;
    logError(`Failed to check components: ${error.message}`);
  }
}

/**
 * Test 4: Check error handling setup
 */
function testErrorHandling() {
  logInfo('\n=== Test 4: Error Handling System ===');

  try {
    const errorsPath = join(__dirname, '../src/lib/errors/index.ts');
    const errorsContent = readFileSync(errorsPath, 'utf-8');

    const checks = [
      'class AppError',
      'class StellarError',
      'class ContractCallError',
      'class TransactionError',
      'class InsufficientBalanceError',
      'class MinOutputNotMetError',
      'class ErrorHandler',
      'withRetry',
    ];

    let testPassed = true;

    for (const check of checks) {
      if (errorsContent.includes(check)) {
        logSuccess(`Found: ${check}`);
      } else {
        logError(`Missing: ${check}`);
        testPassed = false;
      }
    }

    if (testPassed) {
      passed++;
      logSuccess('\nError handling system is complete!');
    } else {
      failed++;
      logError('\nError handling system is incomplete!');
    }
  } catch (error) {
    failed++;
    logError(`Failed to check error handling: ${error.message}`);
  }
}

/**
 * Test 5: Check GraphQL client configuration
 */
function testGraphQLClient() {
  logInfo('\n=== Test 5: GraphQL Client Configuration ===');

  try {
    const clientPath = join(__dirname, '../src/lib/graphql/client.ts');
    const clientContent = readFileSync(clientPath, 'utf-8');

    const checks = [
      { name: 'Error Link', pattern: /onError/ },
      { name: 'Auth Link', pattern: /setContext/ },
      { name: 'Cache Policy', pattern: /InMemoryCache/ },
      { name: 'Relative Endpoint', pattern: /GRAPHQL_ENDPOINT\s*=\s*['"]\/graphql['"]/ },
    ];

    let testPassed = true;

    for (const check of checks) {
      if (check.pattern.test(clientContent)) {
        logSuccess(`${check.name}: Configured`);
      } else {
        logError(`${check.name}: Missing`);
        testPassed = false;
      }
    }

    // Check for localhost hardcoding
    if (clientContent.includes('localhost:4000') && !clientContent.includes('relative path')) {
      logWarning('GraphQL client may have hardcoded localhost URL');
    }

    if (testPassed) {
      passed++;
      logSuccess('\nGraphQL client is properly configured!');
    } else {
      failed++;
      logError('\nGraphQL client configuration has issues!');
    }
  } catch (error) {
    failed++;
    logError(`Failed to check GraphQL client: ${error.message}`);
  }
}

/**
 * Main test runner
 */
function main() {
  log('\n╔═══════════════════════════════════════════════════════════╗', 'blue');
  log('║       Astro Launchpad Frontend Integration Test          ║', 'blue');
  log('║                  Version: v2.0.0                          ║', 'blue');
  log('║                  Network: Stellar Testnet                 ║', 'blue');
  log('╚═══════════════════════════════════════════════════════════╝', 'blue');

  // Run all tests
  testRootEnv();
  testConfigFallbacks();
  testNoMockData();
  testErrorHandling();
  testGraphQLClient();

  // Summary
  log('\n╔═══════════════════════════════════════════════════════════╗', 'blue');
  log('║                      Test Summary                         ║', 'blue');
  log('╚═══════════════════════════════════════════════════════════╝', 'blue');

  log(`\n  Passed: ${passed}`, 'green');
  log(`  Failed: ${failed}`, failed > 0 ? 'red' : 'reset');
  log(`  Total:  ${passed + failed}`);

  if (failed === 0) {
    log('\n✓ All tests passed! Frontend is correctly configured.', 'green');
    log('✓ Ready to test with real transactions on testnet.', 'green');
    process.exit(0);
  } else {
    log('\n✗ Some tests failed. Please review the errors above.', 'red');
    process.exit(1);
  }
}

// Run tests
main();
