import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // Same '@/…' alias as tsconfig paths.
      { find: /^@\//, replacement: root },
      // 'server-only' is aliased internally by Next.js; outside Next (vitest) it resolves to an empty stub.
      { find: /^server-only$/, replacement: fileURLToPath(new URL('./test/server-only-stub.ts', import.meta.url)) },
    ],
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
