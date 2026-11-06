import { randomUUID } from 'node:crypto'
import { test, expect } from '@fixtures'
import { baseUrl, runMode } from '@utils/env.js'
import { reportPdfPath } from '@utils/report-navigation.js'
import {
  breakBackendToken,
  expireSession,
  signInThrowawayUser
} from '@utils/stack-access.js'
import { SessionExpiredPage } from '@pages/session-expired.page.js'

const SESSION_EXPIRED_URL = /\/auth\/session-expired$/

// Each test signs in its own user and breaks that user's session in Redis, so
// the shared STORAGE_STATE session is never touched.
async function openWithDeadSession(browser, path, killSession) {
  const { storageState, sessionKey } =
    await signInThrowawayUser('resilience-expiry')
  await killSession(sessionKey)

  const context = await browser.newContext({ baseURL: baseUrl, storageState })
  const page = await context.newPage()
  await page.goto(path)
  return { context, page }
}

test.describe('resilience', { tag: '@resilience' }, () => {
  test.describe(
    'Session expiry — sign-in that cannot be renewed',
    { tag: '@regression' },
    () => {
      test.skip(
        runMode === 'e2e',
        'Requires stub sign-in and direct Redis access — not available on CDP'
      )

      test('an expired session on a protected page is sent to the signed-out page', async ({
        browser
      }) => {
        const { context, page } = await openWithDeadSession(
          browser,
          '/manage-projects',
          expireSession
        )
        const sessionExpiredPage = new SessionExpiredPage(page)

        try {
          await expect(page).toHaveURL(SESSION_EXPIRED_URL)
          await expect(sessionExpiredPage.heading).toBeVisible()
          await expect(sessionExpiredPage.body).toBeVisible()
          await expect(sessionExpiredPage.signInAgainButton).toBeVisible()
          await expect(sessionExpiredPage.returnHomeLink).toBeVisible()
        } finally {
          await context.close()
        }
      })

      // Proves the PDF route's own service (report.js) passes a dead session on
      // to catchAll instead of turning it into a 502. The sign-in is left in
      // date, so the request gets past the auth scheme and the backend's
      // rejection of the token reaches the service. The backend rejects the
      // token before looking up the project, so any project id will do.
      test('a session the backend rejects on the report PDF route is sent to the signed-out page', async ({
        browser
      }) => {
        const { context, page } = await openWithDeadSession(
          browser,
          reportPdfPath(randomUUID()),
          breakBackendToken
        )

        try {
          await expect(page).toHaveURL(SESSION_EXPIRED_URL)
        } finally {
          await context.close()
        }
      })
    }
  )
})
