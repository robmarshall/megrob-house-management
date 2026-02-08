import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/**',
        'src/components/atoms/**',
        'src/hooks/**',
        'src/components/molecules/**',
        'src/components/organisms/**',
        'src/pages/**',
      ],
      reporter: ['text', 'text-summary'],
    },
  },
});
