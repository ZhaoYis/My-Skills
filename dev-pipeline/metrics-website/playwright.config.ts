import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
  webServer: [
    {
      command: 'node test/mock-api.mjs',
      url: 'http://127.0.0.1:4101/__health',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        AUTH_SECRET: 'playwright-auth-secret-that-is-at-least-32-characters',
        AUTH_TRUST_HOST: 'true',
        OIDC_ISSUER: 'http://127.0.0.1:4101',
        OIDC_CLIENT_ID: 'playwright',
        OIDC_CLIENT_SECRET: 'playwright-secret',
        METRICS_API_URL: 'http://127.0.0.1:4101/api/v1',
        METRICS_DEV_DEVELOPER_ID: '1',
        METRICS_DEV_IS_ADMIN: 'true',
      },
    },
  ],
});
