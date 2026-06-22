import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import {
  describeRoleEnforcement,
  describeUnauthenticatedAccess
} from '@utils/access-checks.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

test.describe(
  'upload-post-intervention',
  { tag: '@upload-post-intervention' },
  () => {
    // ─── Form display ──────────────────────────────────────────────────────────

    test.describe('Upload post-intervention file — form display', () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test(
        'form renders with heading, instruction text, file input, and Continue button',
        { tag: '@smoke' },
        async ({
          createProjectFlow,
          projectDashboardPage,
          uploadPostInterventionFilePage
        }) => {
          const { id } = await setupProject(
            createProjectFlow,
            projectDashboardPage,
            'Upload post-intervention test'
          )
          await uploadPostInterventionFilePage.open(id)

          await expect(uploadPostInterventionFilePage.heading).toBeVisible()
          await expect(
            uploadPostInterventionFilePage.instructionText
          ).toBeVisible()
          await expect(
            uploadPostInterventionFilePage.noFileChosenText
          ).toBeVisible()
          await expect(
            uploadPostInterventionFilePage.continueButton
          ).toBeVisible()
          await expect(uploadPostInterventionFilePage.backLink).toBeVisible()
        }
      )
    })

    // ─── Role enforcement ──────────────────────────────────────────────────────

    describeRoleEnforcement(
      'Upload post-intervention file',
      'upload-post-intervention-file',
      { smoke: true }
    )

    // ─── Unauthenticated access ──────────────────────────────────────────────────

    describeUnauthenticatedAccess(
      'Upload post-intervention file',
      'upload-post-intervention-file'
    )

    // ─── Received route — role enforcement ───────────────────────────────────────

    describeRoleEnforcement(
      'Post-intervention upload received',
      'post-intervention-upload-received'
    )

    // ─── Received route — unauthenticated access ─────────────────────────────────

    describeUnauthenticatedAccess(
      'Post-intervention upload received',
      'post-intervention-upload-received',
      { smoke: false }
    )
  }
)
