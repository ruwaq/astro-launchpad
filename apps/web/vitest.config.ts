import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/stellar/utils.ts',
        'src/hooks/usePageVisibility.ts',
        'src/hooks/usePrice.ts',
        'src/hooks/useBalance.ts',
        'src/lib/stellar/utils/*.ts',
      ],
      exclude: [
        'node_modules/**',
        '.next/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.*',
        'tests/**',
      ],
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
