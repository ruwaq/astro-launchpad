#!/usr/bin/env tsx
/**
 * Environment Variable Validation Script
 *
 * Validates that all required environment variables are set before deployment
 * Run this before deploying to production/testnet
 *
 * Usage:
 *   pnpm tsx scripts/validate-env.ts
 *   pnpm tsx scripts/validate-env.ts --strict  # Fail on warnings
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

// Load .env file
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

interface ValidationRule {
  key: string;
  required: boolean;
  validate?: (value: string) => boolean;
  description: string;
  default?: string;
}

const VALIDATION_RULES: ValidationRule[] = [
  // Stellar Network
  {
    key: 'STELLAR_NETWORK',
    required: true,
    validate: (v) => ['testnet', 'mainnet'].includes(v),
    description: 'Stellar network (testnet or mainnet)',
  },
  {
    key: 'STELLAR_RPC_URL',
    required: true,
    validate: (v) => v.startsWith('https://'),
    description: 'Stellar Soroban RPC URL',
  },
  {
    key: 'STELLAR_HORIZON_URL',
    required: true,
    validate: (v) => v.startsWith('https://'),
    description: 'Stellar Horizon API URL',
  },

  // Contracts
  {
    key: 'TOKEN_FACTORY_CONTRACT_ID',
    required: true,
    validate: (v) => v.length === 56 && v.startsWith('C'),
    description: 'SAC Factory contract ID',
  },
  {
    key: 'ASTRO_TOKEN_ADDRESS',
    required: false,
    validate: (v) => v.length === 56 && v.startsWith('C'),
    description: 'ASTRO token contract address',
  },
  {
    key: 'XLM_SAC_ADDRESS',
    required: true,
    validate: (v) => v.length === 56 && v.startsWith('C'),
    description: 'Native XLM SAC address',
    default: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  },

  // Database
  {
    key: 'DATABASE_URL',
    required: true,
    validate: (v) => v.startsWith('postgresql://'),
    description: 'PostgreSQL database connection string',
  },

  // Redis
  {
    key: 'REDIS_URL',
    required: false,
    validate: (v) => v.startsWith('redis://') || v.startsWith('rediss://'),
    description: 'Redis cache connection string',
  },

  // Security
  {
    key: 'JWT_SECRET',
    required: true,
    validate: (v) => v.length >= 32 && v !== 'CHANGE_THIS_TO_A_RANDOM_SECRET',
    description: 'JWT secret (min 32 characters, use openssl rand -base64 32)',
  },

  // IPFS/Pinata
  {
    key: 'PINATA_JWT',
    required: true,
    validate: (v) => v.length > 20 && v !== 'YOUR_PINATA_JWT',
    description: 'Pinata JWT for IPFS metadata uploads',
  },

  // Next.js Public Variables
  {
    key: 'NEXT_PUBLIC_NETWORK',
    required: true,
    validate: (v) => ['testnet', 'mainnet'].includes(v),
    description: 'Public network identifier',
  },
  {
    key: 'NEXT_PUBLIC_STELLAR_RPC_URL',
    required: true,
    validate: (v) => v.startsWith('https://'),
    description: 'Public Stellar RPC URL',
  },
  {
    key: 'NEXT_PUBLIC_TOKEN_FACTORY_CONTRACT_ID',
    required: true,
    validate: (v) => v.length === 56 && v.startsWith('C'),
    description: 'Public SAC Factory contract ID',
  },
  {
    key: 'NEXT_PUBLIC_API_URL',
    required: true,
    validate: (v) => v.startsWith('http://') || v.startsWith('https://'),
    description: 'GraphQL API URL',
  },
  {
    key: 'NEXT_PUBLIC_IPFS_GATEWAY',
    required: true,
    validate: (v) => v.startsWith('https://'),
    description: 'IPFS gateway URL',
  },

  // Optional: Monitoring
  {
    key: 'NEXT_PUBLIC_SENTRY_DSN',
    required: false,
    validate: (v) => v.startsWith('https://'),
    description: 'Sentry DSN for error tracking (optional but recommended)',
  },
];

interface ValidationResult {
  key: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
}

function validateEnv(strict: boolean = false): {
  results: ValidationResult[];
  hasErrors: boolean;
  hasWarnings: boolean;
} {
  const results: ValidationResult[] = [];
  let hasErrors = false;
  let hasWarnings = false;

  console.log('🔍 Validating environment variables...\n');

  for (const rule of VALIDATION_RULES) {
    const value = process.env[rule.key];

    // Check if variable is set
    if (!value || value.trim() === '') {
      if (rule.required) {
        hasErrors = true;
        results.push({
          key: rule.key,
          status: 'error',
          message: `❌ Missing required variable: ${rule.description}`,
        });
      } else {
        hasWarnings = true;
        results.push({
          key: rule.key,
          status: 'warning',
          message: `⚠️  Optional variable not set: ${rule.description}`,
        });
      }
      continue;
    }

    // Validate format if validator provided
    if (rule.validate && !rule.validate(value)) {
      hasErrors = true;
      results.push({
        key: rule.key,
        status: 'error',
        message: `❌ Invalid format: ${rule.description}`,
      });
      continue;
    }

    // Check if using default/placeholder values
    if (
      value.includes('YOUR_') ||
      value.includes('CHANGE_THIS') ||
      (rule.default && value === rule.default && rule.key !== 'XLM_SAC_ADDRESS')
    ) {
      if (rule.required) {
        hasErrors = true;
        results.push({
          key: rule.key,
          status: 'error',
          message: `❌ Using placeholder value: ${rule.description}`,
        });
      } else {
        hasWarnings = true;
        results.push({
          key: rule.key,
          status: 'warning',
          message: `⚠️  Using placeholder value: ${rule.description}`,
        });
      }
      continue;
    }

    // All good
    results.push({
      key: rule.key,
      status: 'ok',
      message: `✅ ${rule.key}`,
    });
  }

  return { results, hasErrors, hasWarnings: strict ? hasWarnings : false };
}

function main() {
  const strict = process.argv.includes('--strict');

  console.log('━'.repeat(80));
  console.log('🚀 Astro Launchpad - Environment Validation');
  console.log('━'.repeat(80));
  console.log();

  // Check if .env exists
  if (!existsSync(envPath)) {
    console.error('❌ .env file not found!');
    console.error('   Copy .env.example to .env and fill in the values.');
    console.error();
    process.exit(1);
  }

  // Validate
  const { results, hasErrors, hasWarnings } = validateEnv(strict);

  // Print results
  const errors = results.filter((r) => r.status === 'error');
  const warnings = results.filter((r) => r.status === 'warning');
  const ok = results.filter((r) => r.status === 'ok');

  if (ok.length > 0) {
    console.log('✅ Valid Variables:');
    ok.forEach((r) => console.log(`   ${r.message}`));
    console.log();
  }

  if (warnings.length > 0) {
    console.log('⚠️  Warnings:');
    warnings.forEach((r) => console.log(`   ${r.key}: ${r.message}`));
    console.log();
  }

  if (errors.length > 0) {
    console.log('❌ Errors:');
    errors.forEach((r) => console.log(`   ${r.key}: ${r.message}`));
    console.log();
  }

  // Summary
  console.log('━'.repeat(80));
  console.log('Summary:');
  console.log(`  ✅ Valid: ${ok.length}`);
  console.log(`  ⚠️  Warnings: ${warnings.length}`);
  console.log(`  ❌ Errors: ${errors.length}`);
  console.log('━'.repeat(80));
  console.log();

  // Exit code
  if (hasErrors || hasWarnings) {
    console.error('❌ Environment validation failed!');
    console.error('   Fix the errors above before deploying.');
    console.error();
    process.exit(1);
  }

  console.log('✅ Environment validation passed!');
  console.log('   Ready for deployment.');
  console.log();
  process.exit(0);
}

if (require.main === module) {
  main();
}

export { validateEnv, VALIDATION_RULES };
