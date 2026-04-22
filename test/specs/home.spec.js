import { test, expect } from '@fixtures'

test.describe('Home page', () => {
  test('unauthenticated visitor sees sign-in button @smoke', async ({
    homePage,
    page
  }) => {
    await homePage.open()

    await expect(page).toHaveTitle('Home - Biodiversity Net Gain')
    await expect(homePage.heading).toBeVisible()
    await expect(homePage.pageBody).toBeVisible()
    await expect(homePage.signInButton).toBeVisible()
  })

  test.skip('authenticated user sees project dashboard link @smoke', async ({
    homePage
  }) => {
    // Auth setup not yet implemented — skipped until OIDC session fixture is added
    await homePage.open()

    await expect(homePage.signedInAs).toBeVisible()
  })
})
