import { defineConfig, devices } from '@playwright/test';

// The DB-level checks inside the tests (bcrypt prefix, Atlas price edit) need the same server env as the app.
for (const f of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(f);
  } catch {
    /* optional */
  }
}

// Local end-to-end checks against the production build (`npm run build` first) and the REAL Atlas database
// (MONGODB_URI from .env.local). These tests create throwaway accounts (…@example.test) and orders.
const PORT = 4399;

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/live-*.spec.ts'],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 2,
  retries: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'ar-KW',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `node --env-file-if-exists=.env --env-file-if-exists=.env.local node_modules/next/dist/bin/next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
