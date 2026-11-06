import { randomUUID } from 'node:crypto'
import { test, expect } from '@fixtures'
import { baseUrl, runMode } from '@utils/env.js'
import { reportPdfPath } from '@utils/report-navigation.js'
import { expireSession, signInThrowawayUser } from '@utils/stack-access.js'
import { SessionExpiredPage } from '@pages/session-expired.page.js'

const SESSION_EXPIRED_URL = /\/auth\/session-expired$/

// Each test signs in its own user and expires that user's session in Redis, so
// the shared STORAGE_STATE session is never touched.
async function openWithExpiredSession(browser, path) {
  const { storageState, sessionKey } =
    await signInThrowawayUser('resilience-expiry')
  await expireSession(sessionKey)

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
        const { context, page } = await openWithExpiredSession(
          browser,
          '/manage-projects'
        )
        const sessionExpiredPage = new SessionExpiredPage(page)

        await expect(page).toHaveURL(SESSION_EXPIRED_URL)
        await expect(sessionExpiredPage.heading).toBeVisible()
        await expect(sessionExpiredPage.body).toBeVisible()
        await expect(sessionExpiredPage.signInAgainButton).toBeVisible()
        await expect(sessionExpiredPage.returnHomeLink).toBeVisible()
        await context.close()
      })

      test('an expired session on the report PDF route is sent to the signed-out page', async ({
        browser
      }) => {
        const { context, page } = await openWithExpiredSession(
          browser,
          reportPdfPath(randomUUID())
        )

        await expect(page).toHaveURL(SESSION_EXPIRED_URL)
        await context.close()
      })
    }
  )
})
