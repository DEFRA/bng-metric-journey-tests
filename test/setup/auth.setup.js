import fs from 'fs/promises'
import path from 'path'
import { chromium, firefox, webkit } from '@playwright/test'
import {
  baseUrl,
  runMode,
  STORAGE_STATE,
  NO_ROLE_STORAGE_STATE,
  NO_PROJECTS_STORAGE_STATE,
  defraIdUsername,
  defraIdPassword
} from '../utils/env.js'
import { DefraIdLoginFlow } from '../flows/authentication/defra-id-login.flow.js'

// Unauthenticated state: used in e2e mode where the stub is not available.
const EMPTY_STATE = JSON.stringify({ cookies: [], origins: [] })

async function registerAndLogin(page, email, { withBngCompleterRole }) {
  // Navigate to login — frontend redirects to the stub's authorize endpoint.
  await page.goto(`${baseUrl}/auth/login`)

  const landingUrl = page.url()
  const authorizeUrl = landingUrl.includes('/register')
    ? decodeURIComponent(new URL(landingUrl).searchParams.get('redirect_uri'))
    : landingUrl

  await page.goto(
    `http://localhost:3200/cdp-defra-id-stub/register?redirect_uri=${encodeURIComponent(authorizeUrl)}`
  )

  // ── Step 1: /register ──────────────────────────────────────────────────────
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('First name').fill('BNG')
  await page.getByLabel('Last name').fill('Tester')
  await page.getByLabel('Enrolments').fill('1')
  await page.getByLabel('Enrolment Requests').fill('1')
  await page.getByRole('button', { name: 'Continue' }).click()

  // ── Step 2: /relationship — add relationship ───────────────────────────────
  await page.waitForURL(/\/relationship(?:\?|$)/)
  await page.getByLabel('Relationship ID').fill('12345')
  await page.getByLabel('Organisation ID').fill('54321')
  await page.getByLabel('Organisation Name').fill('Test Org SG')
  // Relationship role is pre-selected as Employee — no action needed
  await page.getByRole('button', { name: 'Add relationship' }).click()

  if (withBngCompleterRole) {
    // ── Step 3: /relationship — add role name & status ─────────────────────
    await page.waitForURL(/\/relationship(?:\?|$)/)
    await page.getByRole('link', { name: 'Add role name & status' }).click()

    // ── Step 4: /role-name ─────────────────────────────────────────────────
    // Role name must contain 'bng completer' at index 1 when split by ':' —
    // verify-role.js does a case-insensitive check.
    await page.waitForURL(/\/role-name/)
    await page.getByLabel('Role Name').fill('BNG completer')
    await page.getByLabel('Role Status').selectOption({ value: 'complete' })
    await page.getByRole('button', { name: 'Add role' }).click()
  }

  // ── Step 5: /relationship — Finish ────────────────────────────────────────
  await page.waitForURL(/\/relationship(?:\?|$)/)
  await page.getByRole('link', { name: 'Finish' }).click()

  // ── Step 6: /summary — Login ───────────────────────────────────────────────
  await page.waitForURL(/\/summary/)
  await page.getByRole('link', { name: 'Login' }).click()
}

export default async function globalSetup() {
  await fs.mkdir(path.dirname(STORAGE_STATE), { recursive: true })

  // In e2e mode the suite runs against a deployed environment that uses real
  // Defra ID. Sign in once as the main completer user via the real Government
  // Gateway flow and save that session. The no-role and no-projects profiles
  // cannot be reproduced from a single account, so they are written empty and
  // their describes skip in e2e (see skipInE2e in utils/env.js).
  if (runMode === 'e2e') {
    if (!defraIdUsername || !defraIdPassword) {
      throw new Error(
        'e2e mode requires DEFRA_ID_USERNAME and DEFRA_ID_PASSWORD to be set'
      )
    }

    const loginBrowser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    try {
      // baseURL lets the login page object navigate with a relative path.
      const context = await loginBrowser.newContext({ baseURL: baseUrl })
      const page = await context.newPage()
      await new DefraIdLoginFlow(page).login(defraIdUsername, defraIdPassword)
      await context.storageState({ path: STORAGE_STATE })
      await context.close()
    } finally {
      await loginBrowser.close()
    }

    await Promise.all([
      fs.writeFile(NO_ROLE_STORAGE_STATE, EMPTY_STATE),
      fs.writeFile(NO_PROJECTS_STORAGE_STATE, EMPTY_STATE)
    ])
    return
  }

  const browserName = process.env.BROWSER ?? 'chromium'
  const browserType = { chromium, firefox, webkit }[browserName] ?? chromium

  // Launch options are browser-specific — the CI workflow adds custom hostnames
  // (cdp-defra-id-stub) to /etc/hosts for Firefox and WebKit since they have
  // no equivalent of Chromium's --host-resolver-rules.
  const launchOptions =
    {
      chromium: {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--host-resolver-rules=MAP cdp-defra-id-stub 127.0.0.1,MAP localhost 127.0.0.1'
        ]
      },
      firefox: {
        // Disable IPv6 DNS preference — GitHub Actions runners can resolve
        // localhost as ::1 (IPv6) while Docker services only bind 127.0.0.1.
        firefoxUserPrefs: { 'network.dns.disableIPv6': true }
      },
      webkit: {}
    }[browserName] ?? {}

  const browser = await browserType.launch(launchOptions)

  try {
    // ── BNG completer user ─────────────────────────────────────────────────
    const context1 = await browser.newContext()
    const page1 = await context1.newPage()
    await registerAndLogin(page1, `bng-test-${Date.now()}@example.com`, {
      withBngCompleterRole: true
    })
    await page1.waitForURL(/\/manage-projects|\/project-name/)
    await context1.storageState({ path: STORAGE_STATE })
    await context1.close()

    // ── No-role user — authenticated session without bng completer role ────
    const context2 = await browser.newContext()
    const page2 = await context2.newPage()
    await registerAndLogin(page2, `bng-norole-${Date.now()}@example.com`, {
      withBngCompleterRole: false
    })
    // Without the bng completer role the post-login redirect to /project-dashboard
    // is intercepted by requireBngCompleterRole, which redirects to /auth/forbidden.
    await page2.waitForURL(/\/auth\/forbidden|\/manage-projects/)
    await context2.storageState({ path: NO_ROLE_STORAGE_STATE })
    await context2.close()

    // ── No-projects user — BNG completer with a clean account; no test ever
    //    calls createProjectFlow with this session, preserving the empty state.
    const context3 = await browser.newContext()
    const page3 = await context3.newPage()
    await registerAndLogin(page3, `bng-noprojects-${Date.now()}@example.com`, {
      withBngCompleterRole: true
    })
    await page3.waitForURL(/\/manage-projects|\/project-name/)
    await context3.storageState({ path: NO_PROJECTS_STORAGE_STATE })
    await context3.close()
  } finally {
    await browser.close()
  }
}
