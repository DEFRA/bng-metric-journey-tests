import { defineConfig } from '@playwright/test'

export default defineConfig({
  globalSetup: './test/setup/auth.setup.js',
  testDir: './test/evidence',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 120 * 1000,
  expect: { timeout: 15 * 1000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    browserName: 'chromium',
    screenshot: 'only-on-failure'
  }
})
