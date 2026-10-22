import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 15_000,
  fullyParallel: false,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8123',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'python3 -m http.server 8123 --bind 127.0.0.1',
    cwd: '.',
    url: 'http://127.0.0.1:8123/akku-tracker/',
    reuseExistingServer: true,
    timeout: 10_000,
  },
});
