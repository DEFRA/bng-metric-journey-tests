import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

test.describe('authentication', { tag: '@authentication' }, () => {
  // ─── Authenticated landing ─────────────────────────────────────────────────
  // The interactive sign-in journey (Steps 1–4 of defra-id-login.flow.md) runs
  // through external Government Gateway / B2C pages and is driven once by
  // auth.setup.js to mint the completer session. Here we assert the journey's
  // outcome: a completer session is signed in and reaches the project area.
  // Uses the completer profile, so it runs in e2e too (against the real session).

  test.describe('Defra ID sign-in — authenticated landing', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'completer session is signed in and reaches the project area',
      { tag: '@smoke' },
      async ({ homePage, page }) => {
        await homePage.open()

        await expect(homePage.signedInAs).toBeVisible()

        await page.getByRole('link', { name: 'View all projects' }).click()

        // A completer with no projects yet lands on the create-first-project
        // page (/project-name); otherwise the dashboard (/manage-projects).
        // Either confirms the sign-in produced a working session.
        await expect(page).toHaveURL(/\/manage-projects|\/project-name/)
      }
    )
  })
})
