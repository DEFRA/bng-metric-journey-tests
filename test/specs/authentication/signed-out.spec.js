import { test, expect } from '@fixtures'

test.describe('authentication', { tag: '@authentication' }, () => {
  // ─── Page content ────────────────────────────────────────────────────────────
  // /auth/signed-out is a public GET (no session) — the confirmation page the
  // logout round-trip returns to. Asserted directly here, independently of the
  // interactive logout journey (covered in sign-out.spec.js).

  test.describe('Signed-out page — page content', { tag: '@smoke' }, () => {
    test('renders the signed-out confirmation with heading, body and return link', async ({
      signedOutPage,
      page
    }) => {
      await signedOutPage.open()

      await expect(page).toHaveTitle('Signed out - Biodiversity Net Gain')
      await expect(signedOutPage.heading).toBeVisible()
      await expect(signedOutPage.body).toBeVisible()
      await expect(signedOutPage.returnHomeLink).toBeVisible()
    })

    test('return link navigates to the home page', async ({
      signedOutPage,
      page
    }) => {
      await signedOutPage.open()
      await signedOutPage.returnHomeLink.click()

      await expect(page).toHaveTitle('Home - Biodiversity Net Gain')
    })
  })
})
