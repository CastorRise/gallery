import { defineConfig,devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4321', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'npm run preview',
      url: 'http://127.0.0.1:4321/gallery/',
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        'node --import tsx scripts/browser-fixture.ts && GALLERY_DATA_DIR="$PWD/.local/browser-fixture" GALLERY_ADMIN_PORT=4174 node --import tsx apps/admin/server.ts',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: false,
    },
  ],
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
  ],
});
