import fs from 'fs/promises'
import path from 'path'
import { chromium } from '@playwright/test'
import { baseUrl, STORAGE_STATE } from '../utils/env.js'

export default async function globalSetup() {
  await fs.mkdir(path.dirname(STORAGE_STATE), { recursive: true })

  // On Linux, Chromium's network sandbox blocks custom DNS rules and prevents
  // route interception. --no-sandbox disables it; --host-resolver-rules then
  // maps Docker service names to 127.0.0.1 so the browser can reach them via
  // their exposed host ports without relying on system DNS.
  const browser = await chromium.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--host-resolver-rules=MAP cdp-defra-id-stub 127.0.0.1,MAP localhost 127.0.0.1'
    ]
  })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Navigate to the app login — frontend redirects to the stub's authorize endpoint.
    await page.goto(`${baseUrl}/auth/login`)

    // After goto() the browser has landed on one of two stub pages:
    //   (a) /register?redirect_uri=<authorizeUrl>  — no users registered yet
    //   (b) /authorize?...                         — existing users, login page shown
    //
    // In both cases we need the authorize URL (with its state/nonce/code_challenge)
    // so that the OIDC flow completes correctly at the end.
    const landingUrl = page.url()
    const authorizeUrl = landingUrl.includes('/register')
      ? decodeURIComponent(new URL(landingUrl).searchParams.get('redirect_uri'))
      : landingUrl

    // Always navigate directly to the register page with a unique email address.
    // Using a unique email avoids collisions when the stub already has users from
    // a previous run, and ensures the registration path is always taken.
    await page.goto(
      `http://localhost:3200/cdp-defra-id-stub/register?redirect_uri=${encodeURIComponent(authorizeUrl)}`
    )

    // ── Step 1: /register ────────────────────────────────────────────────────
    await page
      .getByLabel('Email address')
      .fill(`bng-test-${Date.now()}@example.com`)
    await page.getByLabel('First name').fill('BNG')
    await page.getByLabel('Last name').fill('Tester')
    await page.getByLabel('Enrolments').fill('1')
    await page.getByLabel('Enrolment Requests').fill('1')
    await page.getByRole('button', { name: 'Continue' }).click()

    // ── Step 2: /relationship — add relationship ─────────────────────────────
    // All stub redirect URLs carry ?redirect_uri=... so regexes must not use $.
    await page.waitForURL(/\/relationship(?:\?|$)/)
    await page.getByLabel('Relationship ID').fill('12345')
    await page.getByLabel('Organisation ID').fill('54321')
    await page.getByLabel('Organisation Name').fill('Test Org SG')
    // Relationship role is pre-selected as Employee — no action needed
    await page.getByRole('button', { name: 'Add relationship' }).click()

    // ── Step 3: relationship page reloads; click "Add role name & status" ────
    await page.waitForURL(/\/relationship(?:\?|$)/)
    await page.getByRole('link', { name: 'Add role name & status' }).click()

    // ── Step 4: /role-name ───────────────────────────────────────────────────
    // The role name must contain 'bng completer' at index 1 when split by ':' —
    // verify-role.js does a case-insensitive check.
    await page.waitForURL(/\/role-name/)
    await page.getByLabel('Role Name').fill('BNG completer')
    await page.getByLabel('Role Status').selectOption({ value: 'complete' })
    await page.getByRole('button', { name: 'Add role' }).click()

    // ── Step 5: back on relationship page — click Finish ─────────────────────
    await page.waitForURL(/\/relationship(?:\?|$)/)
    await page.getByRole('link', { name: 'Finish' }).click()

    // ── Step 6: summary page — click Login to complete the OIDC flow ─────────
    // The Login link calls the authorize endpoint with user=<email>.
    // The org-picker auto-selects the single relationship and redirects to
    // /auth/callback, which the frontend exchanges for a session token.
    await page.waitForURL(/\/summary/)
    await page.getByRole('link', { name: 'Login' }).click()

    // ── Final: /auth/callback → /project-dashboard ───────────────────────────
    await page.waitForURL(/\/project-dashboard/)

    await context.storageState({ path: STORAGE_STATE })
  } finally {
    await browser.close()
  }
}
