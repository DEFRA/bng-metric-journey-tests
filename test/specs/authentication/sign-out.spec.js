import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

test.describe('authentication', { tag: '@authentication' }, () => {
  // ─── Header link ─────────────────────────────────────────────────────────────
  // The "Sign out" link is the entry point to the logout journey. We assert it
  // is present and targets /auth/logout. The actual click-through is NOT tested:
  // the OIDC session is stored server-side, so /auth/logout's yar.reset() would
  // destroy the shared completer session and cascade failures across every other
  // authenticated test in the run. The destination it returns to — /auth/signed-out
  // — is asserted independently in signed-out.spec.js.

  test.describe('Sign out — header link', { tag: '@regression' }, () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test('header shows a "Sign out" link targeting /auth/logout for an authenticated user', async ({
      homePage,
      layoutPage
    }) => {
      await homePage.open()

      await expect(layoutPage.signOutLink).toBeVisible()
      await expect(layoutPage.signOutLink).toHaveAttribute(
        'href',
        '/auth/logout'
      )
    })
  })
})
