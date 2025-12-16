/**
 * API Root Endpoint - Vercel Serverless Function
 *
 * Returns API information and available endpoints.
 *
 * @version 2.1.0
 */

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  res.status(200).json({
    name: 'Astro Shiba API Gateway',
    version: '2.1.0',
    endpoints: {
      graphql: '/graphql',
      health: '/health',
    },
    documentation: 'https://docs.astroshiba.io/api',
    timestamp: new Date().toISOString(),
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};
