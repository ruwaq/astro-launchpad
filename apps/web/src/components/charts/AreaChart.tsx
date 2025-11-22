'use client';

import { useMemo } from 'react';

interface DataPoint {
  timestamp: string;
  value: number;
}

interface AreaChartProps {
  data: DataPoint[];
  title?: string;
  height?: number;
  color?: string;
}

export function AreaChart({
  data,
  title,
  height = 200,
  color = 'rgb(59, 130, 246)', // blue-500
}: AreaChartProps) {
  const { path, area, min, max } = useMemo(() => {
    if (data.length === 0) return { path: '', area: '', min: 0, max: 0 };

    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const width = 100; // percentage
    const step = width / (data.length - 1 || 1);

    // Generate path for line
    const linePath = data
      .map((point, index) => {
        const x = index * step;
        const y = height - ((point.value - min) / range) * height;
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

    // Generate path for area (same as line but closed to bottom)
    const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

    return { path: linePath, area: areaPath, min, max };
  }, [data, height]);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
        <div className="flex items-center justify-center h-48 text-gray-500">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <div className="text-sm text-gray-600">
            Min: {min.toFixed(2)} | Max: {max.toFixed(2)}
          </div>
        </div>
      )}

      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: `${height}px` }}
      >
        {/* Area fill */}
        <path
          d={area}
          fill={color}
          fillOpacity="0.1"
        />

        {/* Line */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />

        {/* Data points */}
        {data.map((point, index) => {
          const x = (index / (data.length - 1 || 1)) * 100;
          const y = height - ((point.value - min) / (max - min || 1)) * height;

          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="0.8"
              fill={color}
              className="hover:r-2 transition-all"
            >
              <title>{`${point.timestamp}: ${point.value.toFixed(2)}`}</title>
            </circle>
          );
        })}
      </svg>

      {/* X-axis labels */}
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>{data[0]?.timestamp}</span>
        {data.length > 2 && (
          <span>{data[Math.floor(data.length / 2)]?.timestamp}</span>
        )}
        <span>{data[data.length - 1]?.timestamp}</span>
      </div>
    </div>
  );
}
