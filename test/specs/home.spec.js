import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'

test.describe('Home page', { tag: '@home' }, () => {
  test(
    'unauthenticated visitor sees sign-in button',
    { tag: '@smoke' },
    async ({ homePage, layoutPage, page }) => {
      await homePage.open()

      await expect(page).toHaveTitle('Home - Biodiversity Net Gain')
      await expect(homePage.heading).toBeVisible()
      await expect(homePage.pageBody).toBeVisible()
      await expect(homePage.signInButton).toBeVisible()
      await expect(homePage.signInButton).toHaveAttribute('href', '/auth/login')
      await expect(layoutPage.signOutLink).toBeHidden()
    }
  )

  test.describe('authenticated user', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(
      skipInE2e(STORAGE_STATE),
      'Requires stub auth — not available in e2e mode'
    )

    test(
      'sees project dashboard link',
      { tag: '@smoke' },
      async ({ homePage, page }) => {
        await homePage.open()

        await expect(homePage.signedInAs).toBeVisible()
        await expect(
          page.getByRole('link', { name: 'View all projects' })
        ).toBeVisible()
      }
    )
  })
})
