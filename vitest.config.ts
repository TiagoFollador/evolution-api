import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

// Aliases are declared here rather than via vite-tsconfig-paths: that plugin is
// ESM-only and this package is CommonJS, so requiring it fails at config load.
// Keep this list in sync with `compilerOptions.paths` in tsconfig.json.
const r = (p: string) => resolve(__dirname, p);

export default defineConfig({
  resolve: {
    alias: {
      '@api': r('src/api'),
      '@cache': r('src/cache'),
      '@config': r('src/config'),
      '@exceptions': r('src/exceptions'),
      '@libs': r('src/libs'),
      '@utils': r('src/utils'),
      '@validate': r('src/validate'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup/env.ts'],
    environment: 'node',
    globals: false,
    // The golden-file suite drives the Meta channel with a recording Prisma
    // double. Nothing here touches a real database or the Graph API.
    testTimeout: 20000,
  },
});
