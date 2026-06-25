import { test, expect } from '@fixtures'
import { STORAGE_STATE, runMode } from '@utils/env.js'

test.describe('authentication', { tag: '@authentication' }, () => {
  // ─── Eligible user ───────────────────────────────────────────────────────────
  // A user whose token claims satisfy canSelectDifferentOrganisation is offered a
  // header link to switch organisation. The completer profile qualifies via the
  // enrolmentRequestCount branch. Skipped in e2e: the link depends on
  // stub-controlled claims that the single real Defra ID account does not
  // guarantee.

  test.describe('Org reselection — eligible user', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(
      runMode === 'e2e',
      'Org-switch eligibility depends on stub-controlled token claims; the real Defra ID account does not guarantee them'
    )

    test(
      'an eligible user is offered a "Change organisation" link to /auth/login?forceReselection=true',
      { tag: '@smoke' },
      async ({ layoutPage, page }) => {
        await page.goto('/')

        await expect(layoutPage.changeOrganisationLink).toBeVisible()
        await expect(layoutPage.changeOrganisationLink).toHaveAttribute(
          'href',
          '/auth/login?forceReselection=true'
        )
      }
    )
  })
})
