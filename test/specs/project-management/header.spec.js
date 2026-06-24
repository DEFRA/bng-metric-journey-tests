import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

test.describe('project-management', { tag: '@project-management' }, () => {
  // ─── Structure ───────────────────────────────────────────────────────────────

  test.describe('Header — structure', () => {
    test(
      'GOV.UK header, service name, and beta banner are visible',
      { tag: '@smoke' },
      async ({ layoutPage, page }) => {
        await page.goto('/')

        await expect(layoutPage.govUkHeader).toBeVisible()
        await expect(layoutPage.serviceNameLink).toBeVisible()
        await expect(layoutPage.betaTag).toBeVisible()
        await expect(layoutPage.phaseBannerText).toBeVisible()
      }
    )

    test(
      '"Projects" nav link is hidden for unauthenticated users',
      { tag: '@smoke' },
      async ({ layoutPage, page }) => {
        await page.goto('/')

        await expect(layoutPage.projectsNavLink).toBeHidden()
      }
    )
  })

  // ─── Navigation ──────────────────────────────────────────────────────────────

  test.describe('Header — "Projects" nav link', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'clicking "Projects" link loads the project management area',
      { tag: '@smoke' },
      async ({ layoutPage, page }) => {
        await page.goto('/')
        await layoutPage.projectsNavLink.click()

        await expect(page).toHaveURL(/\/(manage-projects|project-name)/)
      }
    )
  })
})
