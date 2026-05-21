import { test, expect } from '@fixtures'
import { STORAGE_STATE, NO_ROLE_STORAGE_STATE, runMode } from '@utils/env.js'

const HTTP_BAD_REQUEST = 400
const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

async function setupProject(createProjectFlow, projectDashboardPage) {
  const name = `Upload received test ${Date.now()}`
  await createProjectFlow.createProject(name)
  const href = await projectDashboardPage.projectLink(name).getAttribute('href')
  const id = href.split('/').pop()
  return { id }
}

test.describe('upload-baseline', { tag: '@upload-baseline' }, () => {
  // ─── Redirect when no pending upload ─────────────────────────────────────────

  test.describe('Upload received — no pending upload', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test('navigating directly without a pending upload redirects to the upload form', async ({
      createProjectFlow,
      projectDashboardPage,
      page
    }) => {
      const { id } = await setupProject(createProjectFlow, projectDashboardPage)
      await page.goto(`/projects/${id}/upload-received`)

      await expect(page).toHaveURL(
        new RegExp(`/projects/${id}/upload-baseline-file`)
      )
    })
  })

  // ─── Role enforcement ────────────────────────────────────────────────────────

  test.describe('Upload received — role enforcement', () => {
    test.use({ storageState: NO_ROLE_STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test('authenticated user without BNG Completer role is redirected to /auth/forbidden', async ({
      page
    }) => {
      await page.goto(
        '/projects/00000000-0000-0000-0000-000000000000/upload-received'
      )

      await expect(page).toHaveURL(/\/auth\/forbidden/)
    })
  })

  // ─── Unauthenticated access ──────────────────────────────────────────────────

  test.describe('Upload received — unauthenticated access', () => {
    test('GET /projects/{id}/upload-received redirects to sign-in', async ({
      page
    }) => {
      await page.goto(
        '/projects/00000000-0000-0000-0000-000000000000/upload-received'
      )

      await expect(page).not.toHaveURL(/\/upload-received/)
      await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
    })
  })

  // ─── Route parameter validation ──────────────────────────────────────────────

  test.describe('Upload received — route parameter validation', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test('non-UUID id path param returns 400', async ({ page }) => {
      const response = await page.goto('/projects/not-a-uuid/upload-received')

      expect(response.status()).toBe(HTTP_BAD_REQUEST)
    })
  })
})
