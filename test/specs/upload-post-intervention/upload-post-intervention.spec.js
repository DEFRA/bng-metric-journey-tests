import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import { assertRejectedFileError } from '@utils/error-file-assertions.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const PROJECT_LABEL = 'Upload post-intervention flow test'

// CDP Uploader must be running; meta-refresh polling can take up to 120 s in the
// worst case (esp. the real uploader in e2e), so allow the full window.
const UPLOAD_TIMEOUT = 120_000
const COMPLETE_FILE = 'Post-intervention - complete.gpkg'
const STRUCTURAL_ERROR_FILE =
  'Post-intervention (missing data) - fails validation.gpkg'
const FORMAT_ERROR_FILE = 'Not a valid geopackage.gpkg'

// ─── E2E happy path ─────────────────────────────────────────────────────────

function describeHappyPath() {
  test.describe(
    'Upload post-intervention — happy path',
    { tag: '@smoke' },
    () => {
      test('uploading a valid .gpkg file reaches the post-intervention habitat list', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadPostInterventionFileFlow,
        postInterventionHabitatListPage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )

        await uploadPostInterventionFileFlow.uploadFile(id, COMPLETE_FILE)

        await page.waitForURL(
          new RegExp(`/projects/${id}/post-intervention-habitat-list`),
          { timeout: UPLOAD_TIMEOUT }
        )

        await expect(postInterventionHabitatListPage.heading).toBeVisible()
        await expect(
          postInterventionHabitatListPage.summaryHeading
        ).toBeVisible()
      })
    }
  )
}

// ─── No pending upload ───────────────────────────────────────────────────────

function describeNoPendingUpload() {
  test.describe(
    'Post-intervention upload received — no pending upload',
    { tag: '@regression' },
    () => {
      test('visiting the received page without a pending upload redirects to the upload form', async ({
        createProjectFlow,
        projectDashboardPage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )

        // No upload has been initiated, so the session holds no
        // postInterventionPendingUploadId; the handler must bounce the user
        // back to the upload form.
        await page.goto(`/projects/${id}/post-intervention-upload-received`)

        await expect(page).toHaveURL(
          new RegExp(`/projects/${id}/upload-post-intervention-file`)
        )
      })
    }
  )
}

// ─── Format error ────────────────────────────────────────────────────────────

function describeFormatError() {
  test.describe(
    'Upload post-intervention — format error',
    { tag: '@regression' },
    () => {
      test('uploading a non-GeoPackage file shows flash error on the upload form', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadPostInterventionFileFlow,
        uploadPostInterventionFilePage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )

        await uploadPostInterventionFileFlow.uploadFile(id, FORMAT_ERROR_FILE)

        await page.waitForURL(
          new RegExp(`/projects/${id}/upload-post-intervention-file`),
          { timeout: UPLOAD_TIMEOUT }
        )

        await expect(uploadPostInterventionFilePage.errorSummary).toBeVisible()
        await expect(uploadPostInterventionFilePage.errorSummary).toContainText(
          'The selected file must be a GeoPackage (.gpkg)'
        )
      })
    }
  )
}

// ─── Structural validation errors ────────────────────────────────────────────

function describeStructuralErrors() {
  test.describe(
    'Upload post-intervention — structural validation errors',
    { tag: '@regression' },
    () => {
      test('uploading a .gpkg file with content errors shows the post-intervention error-file page', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadPostInterventionFileFlow,
        errorFilePage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )

        await uploadPostInterventionFileFlow.uploadFile(
          id,
          STRUCTURAL_ERROR_FILE
        )

        await page.waitForURL('/error-file', { timeout: UPLOAD_TIMEOUT })

        await assertRejectedFileError(
          errorFilePage,
          errorFilePage.postInterventionRejectedHeading,
          id,
          'upload-post-intervention-file'
        )
      })
    }
  )
}

// ─── Suite ───────────────────────────────────────────────────────────────────

test.describe(
  'upload-post-intervention',
  { tag: '@upload-post-intervention' },
  () => {
    // Serial mode: all flow tests mutate the same shared Redis session
    // (postInterventionPendingUploadId). Running them in parallel causes
    // session contamination.
    test.describe.configure({ mode: 'serial' })
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    describeHappyPath()
    describeNoPendingUpload()
    describeFormatError()
    describeStructuralErrors()
  }
)
