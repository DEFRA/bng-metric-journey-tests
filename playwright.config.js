import { defineConfig } from '@playwright/test'

const runMode = process.env.RUN_MODE ?? 'local'
const environment = process.env.ENVIRONMENT ?? 'dev'

const baseUrls = {
  local: 'http://localhost:3000',
  github: 'http://localhost:3000',
  e2e: `https://bng-metric-frontend.${environment}.cdp-int.defra.cloud`
}

// In e2e mode the CDP Portal injects BASE_URL pointing to the portal gateway,
// not the service — ignore it and always use the constructed service URL.
const baseURL =
  runMode === 'e2e'
    ? baseUrls.e2e
    : (process.env.BASE_URL ?? baseUrls[runMode] ?? baseUrls.local)

export default defineConfig({
  testDir: './test',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,

  // CDP Portal hard-kills runs at 2 hours
  globalTimeout: 2 * 60 * 60 * 1000,
  timeout: 60 * 1000,
  expect: { timeout: 15 * 1000 },

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list']
  ],

  use: {
    baseURL,
    headless: process.env.HEADED !== 'true',
    browserName: /** @type {any} */ (process.env.BROWSER ?? 'chromium'),

    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure'
  },

  // PROFILE env var maps to Playwright grep — use test titles or @tags to filter
  grep: process.env.PROFILE ? new RegExp(process.env.PROFILE) : undefined
})
