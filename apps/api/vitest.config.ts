import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Часть тестов поднимает свой контейнер PostgreSQL; при параллельном прогоне это дольше 5 с по умолчанию.
    testTimeout: 30_000,
    include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    setupFiles: ['./src/infra/lib/matchers/matchers.ts'],
  },
});
