import { test, expect } from '@fixtures'

test.describe('project-management', { tag: '@project-management' }, () => {
  test.describe('Home page', () => {
    test(
      'unauthenticated visitor sees sign-in button',
      { tag: '@smoke' },
      async ({ homePage, layoutPage, page }) => {
        await homePage.open()

        await expect(page).toHaveTitle('Home - Biodiversity Net Gain')
        await expect(homePage.heading).toBeVisible()
        await expect(homePage.pageBody).toBeVisible()
        await expect(homePage.signInButton).toBeVisible()
        await expect(homePage.signInButton).toHaveAttribute(
          'href',
          '/auth/login'
        )
        await expect(layoutPage.signOutLink).toBeHidden()
      }
    )

    // The authenticated home page — "Signed in as" and the "View all projects"
    // link, followed through to the project area — is asserted in
    // authentication/defra-id-login.spec.js.
  })
})
