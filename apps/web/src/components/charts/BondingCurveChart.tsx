/**
 * Bonding Curve Chart Component - REAL DATA
 *
 * Displays real-time price chart from actual Stellar transactions
 * NO MOCK DATA - All from GraphQL API
 */

'use client';

import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';

const TOKEN_PRICE_HISTORY = gql`
  query TokenPriceHistory($address: String!) {
    token(address: $address) {
      address
      currentPrice
      transactions(first: 100, orderBy: { field: CREATED_AT, direction: ASC }) {
        edges {
          node {
            id
            type
            amount0
            amount1
            timestamp
            createdAt
          }
        }
      }
    }
  }
`;

interface BondingCurveChartProps {
  tokenAddress: string;
}

export function BondingCurveChart({ tokenAddress }: BondingCurveChartProps) {
  // Fetch real transaction data from GraphQL
  const { data, loading, error } = useQuery(TOKEN_PRICE_HISTORY, {
    variables: { address: tokenAddress },
    pollInterval: 5000, // Update every 5 seconds
  });

  // Transform transaction data into price points
  const priceData = useMemo(() => {
    if (!data?.token?.transactions?.edges) return [];

    const transactions = data.token.transactions.edges;
    let runningPrice = 0;

    return transactions
      .filter((edge: any) =>
        edge.node.type === 'TOKEN_BOUGHT' || edge.node.type === 'TOKEN_SOLD'
      )
      .map((edge: any) => {
        const tx = edge.node;
        const xlmAmount = parseFloat(tx.amount0 || '0');
        const tokenAmount = parseFloat(tx.amount1 || '0');

        // Calculate price: XLM / Tokens
        const price = tokenAmount > 0 ? xlmAmount / tokenAmount : runningPrice;
        runningPrice = price;

        const date = new Date(tx.timestamp || tx.createdAt);
        const timestamp = date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });

        return {
          timestamp,
          value: price,
          type: tx.type,
        };
      });
  }, [data]);

  // Calculate min/max for chart
  const { min, max, path, area } = useMemo(() => {
    if (priceData.length === 0) {
      return { min: 0, max: 0, path: '', area: '' };
    }

    const values = priceData.map((d: { value: number }) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const width = 100;
    const height = 200;
    const step = width / (priceData.length - 1 || 1);

    // Generate path for line
    const linePath = priceData
      .map((point: { value: number }, index: number) => {
        const x = index * step;
        const y = height - ((point.value - min) / range) * height;
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

    // Generate path for area
    const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

    return { min, max, path: linePath, area: areaPath };
  }, [priceData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-700">Failed to load price chart</p>
      </div>
    );
  }

  if (priceData.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8">
        <div className="text-center">
          <p className="text-sm text-ui-text-secondary mb-2">No trading history yet</p>
          <p className="text-xs text-ui-text-tertiary">
            Be the first to trade this token!
          </p>
        </div>
      </div>
    );
  }

  const currentPrice = data?.token?.currentPrice || 0;
  const priceChange = priceData.length > 1
    ? ((priceData[priceData.length - 1].value - priceData[0].value) / priceData[0].value) * 100
    : 0;

  return (
    <div>
      {/* Price Header */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-sm text-ui-text-secondary mb-1">Current Price</p>
          <p className="text-3xl font-bold text-ui-text-primary">
            {parseFloat(currentPrice).toFixed(8)} XLM
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-ui-text-secondary mb-1">Change</p>
          <p
            className={`text-xl font-semibold ${
              priceChange >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {priceChange >= 0 ? '+' : ''}
            {priceChange.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <svg
          viewBox="0 0 100 200"
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: '200px' }}
        >
          {/* Grid lines */}
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            stroke="#e5e7eb"
            strokeWidth="0.3"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="0"
            y1="100"
            x2="100"
            y2="100"
            stroke="#e5e7eb"
            strokeWidth="0.3"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="0"
            y1="150"
            x2="100"
            y2="150"
            stroke="#e5e7eb"
            strokeWidth="0.3"
            vectorEffect="non-scaling-stroke"
          />

          {/* Area fill */}
          <path
            d={area}
            fill={priceChange >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'}
            fillOpacity="0.1"
          />

          {/* Line */}
          <path
            d={path}
            fill="none"
            stroke={priceChange >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'}
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
          />

          {/* Data points */}
          {priceData.map((point: { timestamp: string; value: number; type: string }, index: number) => {
            const x = (index / (priceData.length - 1 || 1)) * 100;
            const y = 200 - ((point.value - min) / (max - min || 1)) * 200;

            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="1"
                fill={priceChange >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'}
                className="hover:r-2 transition-all"
              >
                <title>{`${point.timestamp}: ${point.value.toFixed(8)} XLM`}</title>
              </circle>
            );
          })}
        </svg>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-ui-text-secondary -ml-2">
          <span>{max.toFixed(8)}</span>
          <span>{((max + min) / 2).toFixed(8)}</span>
          <span>{min.toFixed(8)}</span>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between mt-2 text-xs text-ui-text-secondary">
        <span>{priceData[0]?.timestamp}</span>
        {priceData.length > 2 && (
          <span>{priceData[Math.floor(priceData.length / 2)]?.timestamp}</span>
        )}
        <span>{priceData[priceData.length - 1]?.timestamp}</span>
      </div>

      {/* Chart Info */}
      <div className="mt-4 flex items-center justify-between text-xs text-ui-text-secondary">
        <span>{priceData.length} trades</span>
        <span>Real-time data from Stellar Testnet</span>
      </div>
    </div>
  );
}
