import { defineConfig, devices } from '@playwright/test';

// Read-only smoke checks against the deployed Netlify site. They never create accounts or orders.
// LIVE_URL=https://<site>.netlify.app npx playwright test -c playwright.live.config.ts
// LIVE_IP=<ip> pins the host for Chromium when the local DNS filter is flaky.
const LIVE_URL = process.env.LIVE_URL || 'https://wasmi-store.netlify.app';
const host = new URL(LIVE_URL).hostname;
const pin = process.env.LIVE_IP ? [`--host-resolver-rules=MAP ${host} ${process.env.LIVE_IP}`] : [];

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/live-*.spec.ts'],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 2,
  retries: 2,
  reporter: [['list'], ['json', { outputFile: 'test-results/live-results.json' }]],
  use: { baseURL: LIVE_URL, trace: 'retain-on-failure', locale: 'ar-KW', launchOptions: { args: pin } },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
