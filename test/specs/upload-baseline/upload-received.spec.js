import { test, expect } from '@fixtures'
import { NO_ROLE_STORAGE_STATE, runMode } from '@utils/env.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

test.describe('upload-baseline', { tag: '@upload-baseline' }, () => {
  // ─── Role enforcement ────────────────────────────────────────────────────────

  test.describe('Upload received — role enforcement', () => {
    test.use({ storageState: NO_ROLE_STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test('authenticated user without BNG Completer role is redirected to /auth/forbidden', async ({
      page
    }) => {
      await page.goto(
        '/projects/00000000-0000-0000-0000-000000000000/upload-received'
      )

      await expect(page).toHaveURL(/\/auth\/forbidden/)
    })
  })

  // ─── Unauthenticated access ──────────────────────────────────────────────────

  test.describe('Upload received — unauthenticated access', () => {
    test('GET /projects/{id}/upload-received redirects to sign-in', async ({
      page
    }) => {
      await page.goto(
        '/projects/00000000-0000-0000-0000-000000000000/upload-received'
      )

      await expect(page).not.toHaveURL(/\/upload-received/)
      await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
    })
  })
})
