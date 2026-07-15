import { defineConfig } from '@playwright/test'

// Two uploads at up to ~120 s of meta-refresh polling each, plus navigation.
const TIMEOUT_MS = 360_000
const EXPECT_TIMEOUT_MS = 15_000

// Local-only happy-path screenshot capture for UCD — run via
// `npm run screenshots`. See test/flows/happy-path/capture-happy-path.flow.md.
export default defineConfig({
  globalSetup: './test/setup/auth.setup.js',
  testDir: './test/screenshots',
  // workers: 1 + fullyParallel: false are load-bearing: the spec's shared
  // screenshot-numbering counter assumes strictly sequential test execution.
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
    // Fixed viewport so every exported PNG has the same width for Mural.
    viewport: { width: 1280, height: 800 },
    screenshot: 'off'
  }
})
