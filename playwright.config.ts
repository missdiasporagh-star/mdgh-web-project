import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:8788',
    headless: true,
  },
  webServer: {
    command: 'npm run build && npm run wrangler:dev',
    url: 'http://localhost:8788',
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
