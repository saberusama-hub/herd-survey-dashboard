import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Use the automatic JSX runtime so editorial primitives can be rendered
  // (via react-dom/server.browser) inside `.test.ts` files without needing
  // explicit `import React` at the top of every component.
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: { '@': new URL('./', import.meta.url).pathname },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'out'],
  },
});
