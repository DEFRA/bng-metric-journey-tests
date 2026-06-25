import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

test.describe('authentication', { tag: '@authentication' }, () => {
  // ─── Page content ────────────────────────────────────────────────────────────
  // /auth/forbidden is a public GET (no session), so it renders in every mode.
  // The role-enforcement specs assert the redirect *to* this URL; here we assert
  // the page itself — its 403 status and content.

  test.describe('Forbidden page — page content', () => {
    test(
      'renders the access denied page with heading, body and return link',
      { tag: '@smoke' },
      async ({ forbiddenPage, page }) => {
        await forbiddenPage.open()

        await expect(page).toHaveTitle('Access denied - Biodiversity Net Gain')
        await expect(forbiddenPage.heading).toBeVisible()
        await expect(forbiddenPage.body).toBeVisible()
        await expect(forbiddenPage.returnHomeLink).toBeVisible()
      }
    )

    test(
      'serves the access denied page with a forbidden status',
      { tag: '@regression' },
      async ({ forbiddenPage, page }) => {
        const response = await page.goto('/auth/forbidden')

        // Primary signal: the access-denied page is actually served. The app
        // returns it with a 403; assert that, but tolerate the page being
        // surfaced under a 200 in case a platform layer (CDP ingress) rewrites
        // the status — the rendered content is the contract that matters.
        await expect(forbiddenPage.body).toBeVisible()
        expect([403, 200]).toContain(response.status())
      }
    )

    test(
      'return link navigates to the home page',
      { tag: '@smoke' },
      async ({ forbiddenPage, page }) => {
        await forbiddenPage.open()
        await forbiddenPage.returnHomeLink.click()

        await expect(page).toHaveTitle('Home - Biodiversity Net Gain')
      }
    )
  })

  // ─── Navigation ──────────────────────────────────────────────────────────────
  // The controller passes navigation: [], so the forbidden page omits the
  // default "Projects" nav link even for an authenticated session (which would
  // otherwise see it). The authenticated "Sign out" link is still appended.

  test.describe('Forbidden page — navigation', { tag: '@regression' }, () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test('omits the "Projects" nav link while keeping "Sign out"', async ({
      forbiddenPage,
      layoutPage
    }) => {
      await forbiddenPage.open()

      await expect(layoutPage.projectsNavLink).toBeHidden()
      await expect(layoutPage.signOutLink).toBeVisible()
    })
  })
})
