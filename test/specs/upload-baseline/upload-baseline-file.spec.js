import { test, expect } from '@fixtures'
import { STORAGE_STATE, NO_ROLE_STORAGE_STATE, runMode } from '@utils/env.js'

const HTTP_BAD_REQUEST = 400
const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

async function setupProject(createProjectFlow, projectDashboardPage) {
  const name = `Upload baseline test ${Date.now()}`
  await createProjectFlow.createProject(name)
  const href = await projectDashboardPage.projectLink(name).getAttribute('href')
  const id = href.split('/').pop()
  return { id, name }
}

test.describe('upload-baseline', { tag: '@upload-baseline' }, () => {
  // ─── Form display ────────────────────────────────────────────────────────────

  test.describe('Upload baseline file — form display', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test(
      'form renders with heading, instruction text, file input, and Continue button',
      { tag: '@smoke' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFilePage
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await uploadBaselineFilePage.open(id)

        await expect(uploadBaselineFilePage.heading).toBeVisible()
        await expect(uploadBaselineFilePage.instructionText).toBeVisible()
        await expect(uploadBaselineFilePage.fileInput).toBeVisible()
        await expect(uploadBaselineFilePage.continueButton).toBeVisible()
        await expect(uploadBaselineFilePage.backLink).toBeVisible()
      }
    )
  })

  // ─── Role enforcement ────────────────────────────────────────────────────────

  test.describe('Upload baseline file — role enforcement', () => {
    test.use({ storageState: NO_ROLE_STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test(
      'authenticated user without BNG Completer role is redirected to /auth/forbidden',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto(
          '/projects/00000000-0000-0000-0000-000000000000/upload-baseline-file'
        )

        await expect(page).toHaveURL(/\/auth\/forbidden/)
      }
    )
  })

  // ─── Unauthenticated access ──────────────────────────────────────────────────

  test.describe('Upload baseline file — unauthenticated access', () => {
    test(
      'GET /projects/{id}/upload-baseline-file redirects to sign-in',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto(
          '/projects/00000000-0000-0000-0000-000000000000/upload-baseline-file'
        )

        await expect(page).not.toHaveURL(/\/upload-baseline-file/)
        await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
      }
    )
  })

  // ─── Route parameter validation ──────────────────────────────────────────────

  test.describe('Upload baseline file — route parameter validation', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test('non-UUID id path param returns 400', async ({ page }) => {
      const response = await page.goto(
        '/projects/not-a-uuid/upload-baseline-file'
      )

      expect(response.status()).toBe(HTTP_BAD_REQUEST)
    })
  })
})
