import { test, expect } from '@fixtures'
import { STORAGE_STATE, runMode } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import {
  describeRoleEnforcement,
  describeUnauthenticatedAccess
} from '@utils/access-checks.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

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
          projectDashboardPage,
          'Check baseline import test'
        )
        await checkBaselineImportPage.open(id)

        await expect(checkBaselineImportPage.heading).toBeVisible()
        await expect(page.getByText(name)).toBeVisible()
      }
    )
  })

  // ─── Role enforcement ────────────────────────────────────────────────────────

  describeRoleEnforcement('Check baseline import', 'check-baseline-import')

  // ─── Unauthenticated access ──────────────────────────────────────────────────

  describeUnauthenticatedAccess(
    'Check baseline import',
    'check-baseline-import'
  )
})
