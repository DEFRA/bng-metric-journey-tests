import 'dotenv/config'
import { defineConfig } from '@playwright/test'

// Downstream-failure tests — run via `npm run test:resilience`, against the
// stack started with compose.resilience.yml. See
// test/flows/resilience/downstream-failures.flow.md.

const TIMEOUT_MS = 60_000
const EXPECT_TIMEOUT_MS = 15_000

export default defineConfig({
  globalSetup: './test/setup/auth.setup.js',
  testDir: './test/specs/resilience',
  outputDir: 'test-results/resilience',
  // workers: 1 + fullyParallel: false are load-bearing: a fault applies to the
  // whole stack, so a parallel test would fail for an unrelated reason.
  fullyParallel: false,
  workers: 1,
  // A retry could turn a slow or intermittent failure to recover into a pass,
  // which is the behaviour these tests exist to catch.
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: TIMEOUT_MS,
  expect: { timeout: EXPECT_TIMEOUT_MS },
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:3000',
    headless: process.env.HEADED !== 'true',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure'
  }
})
