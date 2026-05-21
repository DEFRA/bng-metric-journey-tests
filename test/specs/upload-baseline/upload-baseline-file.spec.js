import { test, expect } from '@fixtures'
import { STORAGE_STATE, runMode } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import {
  describeRoleEnforcement,
  describeUnauthenticatedAccess
} from '@utils/access-checks.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

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
          projectDashboardPage,
          'Upload baseline test'
        )
        await uploadBaselineFilePage.open(id)

        await expect(uploadBaselineFilePage.heading).toBeVisible()
        await expect(uploadBaselineFilePage.instructionText).toBeVisible()
        await expect(uploadBaselineFilePage.noFileChosenText).toBeVisible()
        await expect(uploadBaselineFilePage.continueButton).toBeVisible()
        await expect(uploadBaselineFilePage.backLink).toBeVisible()
      }
    )
  })

  // ─── Role enforcement ────────────────────────────────────────────────────────

  describeRoleEnforcement('Upload baseline file', 'upload-baseline-file', {
    smoke: true
  })

  // ─── Unauthenticated access ──────────────────────────────────────────────────

  describeUnauthenticatedAccess('Upload baseline file', 'upload-baseline-file')
})
