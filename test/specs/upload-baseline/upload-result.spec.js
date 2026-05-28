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

  test.describe('Upload result — page display', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test(
      'page renders success heading and "Check your on-site baseline data" link',
      { tag: '@smoke' },
      async ({ createProjectFlow, projectDashboardPage, uploadResultPage }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          'Upload result test'
        )
        await uploadResultPage.open(id)

        await expect(uploadResultPage.heading).toBeVisible()
        await expect(uploadResultPage.checkBaselineDataLink).toBeVisible()
        await expect(uploadResultPage.checkBaselineDataLink).toHaveAttribute(
          'href',
          `/projects/${id}/check-baseline-import`
        )
      }
    )
  })

  // ─── Role enforcement ────────────────────────────────────────────────────────

  describeRoleEnforcement('Upload result', 'upload-result')

  // ─── Unauthenticated access ──────────────────────────────────────────────────

  describeUnauthenticatedAccess('Upload result', 'upload-result')
})
