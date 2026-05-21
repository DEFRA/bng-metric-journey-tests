import { test, expect } from '@fixtures'
import { STORAGE_STATE, NO_ROLE_STORAGE_STATE, runMode } from '@utils/env.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

async function setupProject(createProjectFlow, projectDashboardPage) {
  const name = `Upload result test ${Date.now()}`
  await createProjectFlow.createProject(name)
  const href = await projectDashboardPage.projectLink(name).getAttribute('href')
  const id = href.split('/').pop()
  return { id }
}

test.describe('upload-baseline', { tag: '@upload-baseline' }, () => {
  // ─── Page display ─────────────────────────────────────────────────────────────

  test.describe('Upload result — page display', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test(
      'page renders success heading and "Return to project" link',
      { tag: '@smoke' },
      async ({ createProjectFlow, projectDashboardPage, uploadResultPage }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await uploadResultPage.open(id)

        await expect(uploadResultPage.heading).toBeVisible()
        await expect(uploadResultPage.returnToProjectLink).toBeVisible()
        await expect(uploadResultPage.returnToProjectLink).toHaveAttribute(
          'href',
          `/add-project-details/${id}`
        )
      }
    )
  })

  // ─── Role enforcement ────────────────────────────────────────────────────────

  test.describe('Upload result — role enforcement', () => {
    test.use({ storageState: NO_ROLE_STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test('authenticated user without BNG Completer role is redirected to /auth/forbidden', async ({
      page
    }) => {
      await page.goto(
        '/projects/00000000-0000-0000-0000-000000000000/upload-result'
      )

      await expect(page).toHaveURL(/\/auth\/forbidden/)
    })
  })

  // ─── Unauthenticated access ──────────────────────────────────────────────────

  test.describe('Upload result — unauthenticated access', () => {
    test(
      'GET /projects/{id}/upload-result redirects to sign-in',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto(
          '/projects/00000000-0000-0000-0000-000000000000/upload-result'
        )

        await expect(page).not.toHaveURL(/\/upload-result/)
        await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
      }
    )
  })
})
