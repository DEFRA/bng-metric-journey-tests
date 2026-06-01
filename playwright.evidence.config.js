import { defineConfig } from '@playwright/test'

const TIMEOUT_MS = 120_000
const EXPECT_TIMEOUT_MS = 15_000

export default defineConfig({
  globalSetup: './test/setup/auth.setup.js',
  testDir: './test/evidence',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: TIMEOUT_MS,
  expect: { timeout: EXPECT_TIMEOUT_MS },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    browserName: 'chromium',
    screenshot: 'only-on-failure'
  }
})
