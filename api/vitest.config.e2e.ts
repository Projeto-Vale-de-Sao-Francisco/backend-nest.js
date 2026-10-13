import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // As suites share the seeded PostgreSQL database, session revocation and
    // mutable domain tests must not race across files.
    fileParallelism: false,
  },
});
