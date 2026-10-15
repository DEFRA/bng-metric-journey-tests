import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

// The yar session is held in a cookie named "session" (config session.cache.name).
const SESSION_COOKIE = 'session'

test.describe('authentication', { tag: '@authentication' }, () => {
  // ─── Session expiry ──────────────────────────────────────────────────────────
  // A timed-out session (4-hour TTL) leaves the user without a valid session
  // cookie. The silent access-token refresh is unit-tested in the frontend
  // (refresh-session.js); here we cover what happens once the session is gone.
  // Clearing the cookie leaves no `sessionEnded` breadcrumb either, so the
  // auth scheme cannot tell this browser from one that never signed in and
  // sends it to /auth/forbidden — not to /auth/session-expired, which needs the
  // breadcrumb (see session-expired.spec.js).
  // Clearing the cookie client-side mimics expiry without resetting the shared
  // server-side session, so it does not poison STORAGE_STATE for other tests.

  test.describe('Session expiry — forced re-sign-in', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'a protected route is denied once the session cookie is gone',
      { tag: '@regression' },
      async ({ homePage, page }) => {
        await homePage.open()
        await expect(homePage.signedInAs).toBeVisible()

        // Simulate session timeout: drop the session cookie.
        await page.context().clearCookies({ name: SESSION_COOKIE })

        await page.goto('/manage-projects')

        await expect(page).not.toHaveURL(/\/manage-projects/)
        await expect(page).toHaveURL(/\/auth\/forbidden$/)
      }
    )
  })
})
