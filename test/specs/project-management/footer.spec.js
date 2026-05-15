import { test, expect } from '@fixtures'

const OGL_URL =
  'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/'
const CROWN_COPYRIGHT_URL =
  'https://www.nationalarchives.gov.uk/information-management/re-using-public-sector-information/uk-government-licensing-framework/crown-copyright/'

test.describe('project-management', { tag: '@project-management' }, () => {
  // ─── Structure ───────────────────────────────────────────────────────────────

  test.describe('Footer — structure', () => {
    test(
      'footer with OGL licence link and Crown Copyright link is visible',
      { tag: '@smoke' },
      async ({ layoutPage, page }) => {
        await page.goto('/')

        await expect(layoutPage.footer).toBeVisible()
        await expect(layoutPage.oglLink).toBeVisible()
        await expect(layoutPage.crownCopyrightLink).toBeVisible()
      }
    )
  })

  // ─── OGL link ────────────────────────────────────────────────────────────────

  test.describe('Footer — OGL link', () => {
    test('OGL link points to the National Archives URL in the same window', async ({
      layoutPage,
      page
    }) => {
      await page.goto('/')

      await expect(layoutPage.oglLink).toHaveAttribute('href', OGL_URL)
      await expect(layoutPage.oglLink).not.toHaveAttribute('target', '_blank')
    })
  })

  // ─── Crown Copyright link ────────────────────────────────────────────────────

  test.describe('Footer — Crown Copyright link', () => {
    test('Crown Copyright link points to the National Archives URL in the same window', async ({
      layoutPage,
      page
    }) => {
      await page.goto('/')

      await expect(layoutPage.crownCopyrightLink).toHaveAttribute(
        'href',
        CROWN_COPYRIGHT_URL
      )
      await expect(layoutPage.crownCopyrightLink).not.toHaveAttribute(
        'target',
        '_blank'
      )
    })
  })
})
