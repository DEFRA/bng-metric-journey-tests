import { defineConfig } from '@playwright/test'

const runMode = process.env.RUN_MODE ?? 'local'
const environment = process.env.ENVIRONMENT ?? 'dev'

const baseUrls = {
  local: 'http://localhost:3000',
  github: 'http://localhost:3000',
  e2e: `https://bng-metric-frontend.${environment}.cdp-int.defra.cloud`
}

const baseURL = process.env.BASE_URL ?? baseUrls[runMode] ?? baseUrls.local

export default defineConfig({
  testDir: './test',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,

  // CDP Portal hard-kills runs at 2 hours
  globalTimeout: 2 * 60 * 60 * 1000,
  timeout: 60 * 1000,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list']
  ],

  use: {
    baseURL,
    headless: process.env.HEADED !== 'true',
    browserName: /** @type {any} */ (process.env.BROWSER ?? 'chromium'),

    // CDP Portal outbound proxy (HTTP, no auth). Set HTTP_PROXY=http://localhost:3128 in portal runs.
    ...(process.env.HTTP_PROXY && {
      proxy: { server: process.env.HTTP_PROXY }
    }),

    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure'
  },

  // PROFILE env var maps to Playwright grep — use test titles or @tags to filter
  grep: process.env.PROFILE ? new RegExp(process.env.PROFILE) : undefined
})
