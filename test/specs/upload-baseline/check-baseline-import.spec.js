import { test, expect } from '@fixtures'
import { STORAGE_STATE, NO_ROLE_STORAGE_STATE, runMode } from '@utils/env.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

async function setupProject(createProjectFlow, projectDashboardPage) {
  const name = `Check baseline import test ${Date.now()}`
  await createProjectFlow.createProject(name)
  const href = await projectDashboardPage.projectLink(name).getAttribute('href')
  const id = href.split('/').pop()
  return { id, name }
}

test.describe('upload-baseline', { tag: '@upload-baseline' }, () => {
  // ─── Page display ─────────────────────────────────────────────────────────────

  test.describe('Check baseline import — page display', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test(
      'page renders heading and project name caption',
      { tag: '@smoke' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        checkBaselineImportPage,
        page
      }) => {
        const { id, name } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await checkBaselineImportPage.open(id)

        await expect(checkBaselineImportPage.heading).toBeVisible()
        await expect(page.getByText(name)).toBeVisible()
      }
    )
  })

  // ─── Role enforcement ────────────────────────────────────────────────────────

  test.describe('Check baseline import — role enforcement', () => {
    test.use({ storageState: NO_ROLE_STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test('authenticated user without BNG Completer role is redirected to /auth/forbidden', async ({
      page
    }) => {
      await page.goto(
        '/projects/00000000-0000-0000-0000-000000000000/check-baseline-import'
      )

      await expect(page).toHaveURL(/\/auth\/forbidden/)
    })
  })

  // ─── Unauthenticated access ──────────────────────────────────────────────────

  test.describe('Check baseline import — unauthenticated access', () => {
    test(
      'GET /projects/{id}/check-baseline-import redirects to sign-in',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto(
          '/projects/00000000-0000-0000-0000-000000000000/check-baseline-import'
        )

        await expect(page).not.toHaveURL(/\/check-baseline-import/)
        await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
      }
    )
  })
})
