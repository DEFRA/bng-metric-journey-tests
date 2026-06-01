import { test, expect } from '@fixtures'
import { STORAGE_STATE, NO_ROLE_STORAGE_STATE, runMode } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const HTTP_BAD_REQUEST = 400
// habitat-list validates id as UUID v4 before the role pre-handler fires;
// the all-zeros stub fails that check, so role enforcement must use a valid v4 UUID.
const VALID_UUID_V4 = 'aaaaaaaa-bbbb-4ccc-bddd-eeeeeeeeeeee'
const STUB_PROJECT_ID = '00000000-0000-0000-0000-000000000000'

test.describe('upload-baseline', { tag: '@upload-baseline' }, () => {
  // ─── Page display ─────────────────────────────────────────────────────────────

  test.describe('Habitat list — page display', { tag: '@smoke' }, () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test('page renders heading and habitat tabs', async ({
      createProjectFlow,
      projectDashboardPage,
      habitatListPage
    }) => {
      const { id } = await setupProject(
        createProjectFlow,
        projectDashboardPage,
        'Habitat list test'
      )

      await habitatListPage.open(id)

      await expect(habitatListPage.heading).toBeVisible()
      await expect(habitatListPage.areasTab).toBeVisible()
      await expect(habitatListPage.hedgerowsTab).toBeVisible()
      await expect(habitatListPage.watercoursesTab).toBeVisible()
      await expect(habitatListPage.backLink).toHaveAttribute(
        'href',
        `/add-project-details/${id}`
      )
      await expect(habitatListPage.uploadDifferentFileLink).toBeVisible()
      await expect(habitatListPage.uploadDifferentFileLink).toHaveAttribute(
        'href',
        `/projects/${id}/upload-baseline-file`
      )
    })
  })

  // ─── Route parameter validation ──────────────────────────────────────────────

  test.describe('Habitat list — route parameter validation', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test('non-UUID id path param returns 400', async ({ page }) => {
      const response = await page.goto('/projects/not-a-uuid/habitat-list')
      expect(response.status()).toBe(HTTP_BAD_REQUEST)
    })
  })

  // ─── Role enforcement ────────────────────────────────────────────────────────

  test.describe('Habitat list — role enforcement', () => {
    test.use({ storageState: NO_ROLE_STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test(
      'authenticated user without BNG Completer role is redirected to /auth/forbidden',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto(`/projects/${VALID_UUID_V4}/habitat-list`)
        await expect(page).toHaveURL(/\/auth\/forbidden/)
      }
    )
  })

  // ─── Unauthenticated access ──────────────────────────────────────────────────

  test.describe('Habitat list — unauthenticated access', () => {
    test(
      'GET /projects/{id}/habitat-list redirects to sign-in',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto(`/projects/${STUB_PROJECT_ID}/habitat-list`)
        await expect(page).not.toHaveURL(/\/habitat-list/)
        await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
      }
    )
  })
})
