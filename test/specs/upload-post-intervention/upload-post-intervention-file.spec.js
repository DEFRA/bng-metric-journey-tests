import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import {
  describeRoleEnforcement,
  describeUnauthenticatedAccess
} from '@utils/access-checks.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const PROJECT_LABEL = 'Upload post-intervention test'

test.describe(
  'upload-post-intervention',
  { tag: '@upload-post-intervention' },
  () => {
    // ─── Form display ──────────────────────────────────────────────────────────

    test.describe('Upload post-intervention file — form display', () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test(
        'form renders with heading, caption, instruction, file input, Continue and Cancel',
        { tag: ['@smoke', '@happy-path'] },
        async ({
          createProjectFlow,
          projectDashboardPage,
          uploadPostInterventionFilePage,
          page
        }) => {
          const { id, name } = await setupProject(
            createProjectFlow,
            projectDashboardPage,
            PROJECT_LABEL
          )
          const response = await uploadPostInterventionFilePage.open(id)

          // The form's action is a short-lived CDP Uploader URL minted per
          // render, so the response must never be cached — a served-from-cache
          // form would post to a dead upload session.
          expect(response.headers()['cache-control']).toContain('no-store')

          await expect(uploadPostInterventionFilePage.heading).toBeVisible()
          await expect(page.getByText(name)).toBeVisible()
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
          await expect(uploadPostInterventionFilePage.cancelLink).toBeVisible()
        }
      )
    })

    // ─── Form navigation and client-side validation ───────────────────────────
    //
    // Not repeated here: Back/Cancel and the client-side checks (no file,
    // wrong extension, disallowed filename). Both upload forms are built by one
    // controller factory (createUploadFileController) and render one template
    // (common/templates/upload-geopackage-file.njk); Back and Cancel share one
    // computed `selectionHref`, and the validation script is loaded on every
    // page by application.js. The `uploadType` the factory is handed changes
    // only the copy and the session keys, which the form-display test above
    // and the upload journeys in upload-post-intervention.spec.js witness. See
    // upload-baseline-file.spec.js for the shared behaviour.

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
