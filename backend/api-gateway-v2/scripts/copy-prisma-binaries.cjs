#!/usr/bin/env node

/**
 * Copy Prisma Binaries Script
 * 
 * This script ensures that Prisma engine binaries are correctly copied
 * for deployment on Vercel serverless functions.
 * 
 * Vercel's aggressive tree-shaking can sometimes exclude necessary Prisma files,
 * causing runtime errors. This script explicitly copies required files to ensure
 * they're included in the deployment bundle.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const NODE_MODULES_DIR = path.join(ROOT_DIR, 'node_modules');
const PRISMA_DIR = path.join(NODE_MODULES_DIR, '.prisma');
const PRISMA_CLIENT_DIR = path.join(NODE_MODULES_DIR, '@prisma', 'client');
const API_DIR = path.join(ROOT_DIR, 'api');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

/**
 * Recursively copy directory
 */
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

/**
 * Create symlink or copy
 */
function ensureLink(target, link) {
  try {
    if (fs.existsSync(link)) {
      fs.unlinkSync(link);
    }
    
    // Try to create symlink first (faster)
    try {
      fs.symlinkSync(target, link, 'junction');
      console.log(`✓ Created symlink: ${link} -> ${target}`);
    } catch (symlinkError) {
      // If symlink fails (permissions), copy instead
      if (fs.statSync(target).isDirectory()) {
        copyRecursiveSync(target, link);
        console.log(`✓ Copied directory: ${target} -> ${link}`);
      } else {
        fs.copyFileSync(target, link);
        console.log(`✓ Copied file: ${target} -> ${link}`);
      }
    }
  } catch (error) {
    console.error(`✗ Failed to ensure link: ${link}`, error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔧 Copying Prisma binaries for Vercel deployment...\n');

  // Ensure directories exist
  if (!fs.existsSync(PRISMA_CLIENT_DIR)) {
    console.error('✗ Prisma Client not found. Run "npm install" first.');
    process.exit(1);
  }

  if (!fs.existsSync(PRISMA_DIR)) {
    console.error('✗ Prisma generated files not found. Run "prisma generate" first.');
    process.exit(1);
  }

  // Create api/.prisma directory if it doesn't exist
  const apiPrismaDir = path.join(API_DIR, '.prisma');
  if (!fs.existsSync(apiPrismaDir)) {
    fs.mkdirSync(apiPrismaDir, { recursive: true });
    console.log('✓ Created api/.prisma directory');
  }

  // Create dist/.prisma directory if it doesn't exist
  const distPrismaDir = path.join(DIST_DIR, '.prisma');
  if (!fs.existsSync(distPrismaDir)) {
    fs.mkdirSync(distPrismaDir, { recursive: true });
    console.log('✓ Created dist/.prisma directory');
  }

  // Copy .prisma/client to multiple locations
  const clientDir = path.join(PRISMA_DIR, 'client');
  const apiClientDest = path.join(apiPrismaDir, 'client');
  const distClientDest = path.join(distPrismaDir, 'client');
  
  if (fs.existsSync(clientDir)) {
    // Copy to api/.prisma/client
    copyRecursiveSync(clientDir, apiClientDest);
    console.log(`✓ Copied Prisma Client to: ${apiClientDest}`);

    // Copy to dist/.prisma/client
    copyRecursiveSync(clientDir, distClientDest);
    console.log(`✓ Copied Prisma Client to: ${distClientDest}`);
  }

  // Find and copy Prisma engine binaries
  const possibleEnginePaths = [
    'libquery_engine-rhel-openssl-3.0.x.so.node',
    'query_engine-rhel-openssl-3.0.x.so.node',
    'libquery_engine-debian-openssl-3.0.x.so.node',
    'query_engine-debian-openssl-3.0.x.so.node',
  ];

  let engineFound = false;
  for (const engineFile of possibleEnginePaths) {
    const enginePath = path.join(clientDir, engineFile);
    if (fs.existsSync(enginePath)) {
      // Copy to api/.prisma/client/
      fs.copyFileSync(enginePath, path.join(apiClientDest, engineFile));
      console.log(`✓ Copied engine binary: ${engineFile} to api/.prisma/client/`);
      
      // Copy to dist/.prisma/client/
      fs.copyFileSync(enginePath, path.join(distClientDest, engineFile));
      console.log(`✓ Copied engine binary: ${engineFile} to dist/.prisma/client/`);
      
      engineFound = true;
    }
  }

  if (!engineFound) {
    console.warn('⚠ Warning: No Prisma engine binary found. This might cause runtime errors.');
  }

  // Create package.json in .prisma/client directories for proper module resolution
  const prismaClientPackageJson = {
    name: ".prisma/client",
    main: "index.js",
    types: "index.d.ts"
  };

  fs.writeFileSync(
    path.join(apiClientDest, 'package.json'),
    JSON.stringify(prismaClientPackageJson, null, 2)
  );
  console.log('✓ Created package.json in api/.prisma/client/');

  fs.writeFileSync(
    path.join(distClientDest, 'package.json'),
    JSON.stringify(prismaClientPackageJson, null, 2)
  );
  console.log('✓ Created package.json in dist/.prisma/client/');

  console.log('\n✅ Prisma binaries copied successfully!');
  console.log('📦 Ready for Vercel deployment\n');
}

// Handle errors
main().catch(error => {
  console.error('\n❌ Error copying Prisma binaries:', error);
  process.exit(1);
});