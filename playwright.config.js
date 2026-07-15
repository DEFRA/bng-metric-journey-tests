import 'dotenv/config'
import { defineConfig } from '@playwright/test'
import { proxyConfig } from './test/utils/env.js'

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
  globalSetup: './test/setup/auth.setup.js',
  testDir: './test',
  // The evidence/ tree holds the throwaway /validate-ac-manual spec; it must
  // never run in the normal suite (CI, regression). The validation command
  // sets EVIDENCE=true to opt that one spec back in. The screenshots/ tree
  // (happy-path capture for UCD) only runs via playwright.screenshots.config.js.
  testIgnore: process.env.EVIDENCE
    ? ['**/screenshots/**']
    : ['**/evidence/**', '**/screenshots/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // e2e runs against a live environment (CDP entrypoint runs test:e2e without
  // CI=true) — give it one retry to absorb transient real-env slowness.
  retries: process.env.CI || runMode === 'e2e' ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,

  // CDP Portal hard-kills runs at 2 hours
  globalTimeout: 2 * 60 * 60 * 1000,
  // Uploads against the real CDP Uploader can poll up to ~120s (UPLOAD_TIMEOUT),
  // so e2e needs a larger per-test budget; local/github (fast stub) keep 60s.
  timeout: runMode === 'e2e' ? 3 * 60 * 1000 : 60 * 1000,
  expect: { timeout: 15 * 1000 },

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list']
  ],

  use: {
    baseURL,
    ...(proxyConfig && {
      proxy: proxyConfig,
      // Force HTTP/1.1 — the CDP egress proxy tunnels via CONNECT and Chromium's
      // HTTP/2-to-origin trips it with ERR_HTTP2_PROTOCOL_ERROR.
      launchOptions: { args: ['--disable-http2'] }
    }),
    headless: process.env.HEADED !== 'true',
    browserName: /** @type {any} */ (process.env.BROWSER ?? 'chromium'),

    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure'
  },

  // PROFILE env var maps to Playwright grep — use test titles or @tags to filter
  grep: process.env.PROFILE ? new RegExp(process.env.PROFILE) : undefined
})
