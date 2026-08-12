import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import { uploadFileHref } from '@utils/upload-file-navigation.js'
import {
  describeRoleEnforcement,
  describeUnauthenticatedAccess
} from '@utils/access-checks.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const PROJECT_LABEL = 'Upload post-intervention test'
const ERROR_NO_FILE = 'Select a GeoPackage (.gpkg) file'
const ERROR_WRONG_EXTENSION = 'The selected file must be a GeoPackage (.gpkg)'
const NON_GPKG_FILE = 'not-a-geopackage.txt'

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

    // ─── Form navigation ───────────────────────────────────────────────────────

    test.describe(
      'Upload post-intervention file — form navigation',
      { tag: ['@regression', '@happy-path'] },
      () => {
        test.use({ storageState: STORAGE_STATE })
        test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

        // BMD-850: Back and Cancel now return to the file-type selection page,
        // not the task list. Opening the form with no returnUrl makes the
        // selection page's own Back/Cancel default to the task list, so the
        // journey out is one step longer than it was.
        test('Back link returns to the upload type selection page', async ({
          createProjectFlow,
          projectDashboardPage,
          uploadPostInterventionFilePage,
          page
        }) => {
          const { id } = await setupProject(
            createProjectFlow,
            projectDashboardPage,
            PROJECT_LABEL
          )
          await uploadPostInterventionFilePage.open(id)
          await uploadPostInterventionFilePage.backLink.click()

          await expect(page).toHaveURL(
            uploadFileHref(id, `/add-project-details/${id}`)
          )
        })

        test('Cancel link returns to the upload type selection page', async ({
          createProjectFlow,
          projectDashboardPage,
          uploadPostInterventionFilePage,
          page
        }) => {
          const { id } = await setupProject(
            createProjectFlow,
            projectDashboardPage,
            PROJECT_LABEL
          )
          await uploadPostInterventionFilePage.open(id)
          await uploadPostInterventionFilePage.cancelLink.click()

          await expect(page).toHaveURL(
            uploadFileHref(id, `/add-project-details/${id}`)
          )
        })
      }
    )

    // ─── Client-side validation ──────────────────────────────────────────────────

    test.describe(
      'Upload post-intervention file — client-side validation',
      { tag: '@regression' },
      () => {
        test.use({ storageState: STORAGE_STATE })
        test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

        test('Continue with no file selected shows the required-file error', async ({
          createProjectFlow,
          projectDashboardPage,
          uploadPostInterventionFilePage,
          page
        }) => {
          const { id } = await setupProject(
            createProjectFlow,
            projectDashboardPage,
            PROJECT_LABEL
          )
          await uploadPostInterventionFilePage.open(id)
          await uploadPostInterventionFilePage.continueButton.click()

          await expect(
            uploadPostInterventionFilePage.clientError(ERROR_NO_FILE)
          ).toBeVisible()
          await expect(page).toHaveURL(/\/upload-post-intervention-file/)
        })

        test('selecting a non-.gpkg file shows the wrong-extension error', async ({
          createProjectFlow,
          projectDashboardPage,
          uploadPostInterventionFileFlow,
          uploadPostInterventionFilePage
        }) => {
          const { id } = await setupProject(
            createProjectFlow,
            projectDashboardPage,
            PROJECT_LABEL
          )
          await uploadPostInterventionFilePage.open(id)
          await uploadPostInterventionFilePage.fileInput.setInputFiles(
            uploadPostInterventionFileFlow.filePath(NON_GPKG_FILE)
          )

          await expect(
            uploadPostInterventionFilePage.clientError(ERROR_WRONG_EXTENSION)
          ).toBeVisible()
        })
      }
    )

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
