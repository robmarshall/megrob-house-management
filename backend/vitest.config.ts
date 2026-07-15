import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Run test files sequentially so DB-backed tests that TRUNCATE shared
    // tables cannot race and truncate each other's fixtures mid-run.
    fileParallelism: false,
    env: {
      // Ensure both the code-under-test (singleton db) and fixtures use the
      // dedicated test database. Set before any module loads; dotenv in
      // src/db/index.ts does not override an already-set env var.
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ||
        'postgresql://postgres:postgres@localhost:5432/homemanagement_test',
    },
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/middleware/**'],
      reporter: ['text', 'text-summary'],
    },
  },
});
