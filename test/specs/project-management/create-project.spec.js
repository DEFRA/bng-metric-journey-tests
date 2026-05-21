import { test, expect } from '@fixtures'
import { STORAGE_STATE, runMode } from '@utils/env.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

test.describe('project-management', { tag: '@project-management' }, () => {
  // ─── Happy path ─────────────────────────────────────────────────────────────

  test.describe('Create project — happy path', { tag: '@smoke' }, () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test('valid name creates project and redirects to dashboard with project listed', async ({
      createProjectFlow,
      projectDashboardPage,
      page
    }) => {
      const projectName = `Test project ${Date.now()}`

      await createProjectFlow.createProject(projectName)

      await expect(page).toHaveURL(/\/manage-projects/)
      await expect(projectDashboardPage.projectLink(projectName)).toBeVisible()
      await expect(
        projectDashboardPage.projectLink(projectName)
      ).toHaveAttribute('href', /\/add-project-details\//)

      const projectRow = page
        .getByTestId('projects-table')
        .getByRole('row')
        .filter({ hasText: projectName })

      await expect(projectRow.getByRole('cell').nth(1)).toContainText(
        /\d{1,2} \w+ \d{4} at \d{1,2}:\d{2}(am|pm)/
      )
      await expect(projectRow.getByRole('cell').nth(2)).toContainText(
        /\d{1,2} \w+ \d{4}/
      )
    })
  })
})
