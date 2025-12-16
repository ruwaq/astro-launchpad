/**
 * Debug Endpoint - Vercel Serverless Function
 * Shows what files are available at runtime
 */

import { readdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function listDir(dir, depth = 0) {
  const result = [];
  if (depth > 3) return result; // Limit recursion

  try {
    const files = readdirSync(dir);
    for (const file of files.slice(0, 20)) { // Limit files
      const filePath = join(dir, file);
      try {
        const stat = statSync(filePath);
        if (stat.isDirectory()) {
          result.push({ name: file, type: 'dir', children: listDir(filePath, depth + 1) });
        } else {
          result.push({ name: file, type: 'file', size: stat.size });
        }
      } catch (e) {
        result.push({ name: file, type: 'error', error: e.message });
      }
    }
  } catch (e) {
    result.push({ error: e.message });
  }
  return result;
}

export default async function debugHandler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const rootDir = join(__dirname, '..');
  const distDir = join(__dirname, '..', 'dist');
  const srcDir = join(__dirname, '..', 'src');

  const info = {
    timestamp: new Date().toISOString(),
    __dirname,
    __filename,
    cwd: process.cwd(),
    rootDir,
    checks: {
      distExists: existsSync(distDir),
      srcExists: existsSync(srcDir),
      rootExists: existsSync(rootDir),
    },
    env: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
    },
  };

  // List what's in the function directory
  info.functionRoot = listDir(__dirname);

  // List parent directory
  info.parent = listDir(rootDir);

  // If dist exists, list its contents
  if (info.checks.distExists) {
    info.dist = listDir(distDir);
  }

  res.status(200).json(info);
}

export const config = {
  api: {
    bodyParser: false,
  },
};
