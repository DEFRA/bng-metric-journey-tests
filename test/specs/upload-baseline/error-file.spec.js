import { test, expect } from '@fixtures'
import { STORAGE_STATE, runMode } from '@utils/env.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

test.describe('upload-baseline', { tag: '@upload-baseline' }, () => {
  // ─── Page display (no session data) ──────────────────────────────────────────

  test.describe('Error file — page display', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test(
      'navigating directly without session data shows generic error message and "Back to start" link',
      { tag: '@smoke' },
      async ({ errorFilePage, page }) => {
        await errorFilePage.open()

        await expect(errorFilePage.genericHeading).toBeVisible()
        await expect(
          page.getByText("We couldn't accept your file. Please try again.")
        ).toBeVisible()
        await expect(errorFilePage.backToStartLink).toBeVisible()
        await expect(errorFilePage.uploadDifferentFileLink).not.toBeVisible()
        await expect(errorFilePage.backToProjectLink).not.toBeVisible()
      }
    )
  })

  // ─── Unauthenticated access ──────────────────────────────────────────────────

  test.describe('Error file — unauthenticated access', () => {
    test(
      'GET /error-file redirects to sign-in',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto('/error-file')

        await expect(page).not.toHaveURL(/\/error-file/)
        await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
      }
    )
  })
})
