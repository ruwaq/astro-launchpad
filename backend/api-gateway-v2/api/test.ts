/**
 * Test Endpoint - Vercel Serverless Function
 * Simple endpoint to verify TypeScript compilation works
 */

import type { NextApiRequest, NextApiResponse } from 'next';

export default async function testHandler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  res.status(200).json({
    success: true,
    message: 'TypeScript handler works!',
    timestamp: new Date().toISOString(),
    node: process.version,
    env: process.env.NODE_ENV || 'development',
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};
