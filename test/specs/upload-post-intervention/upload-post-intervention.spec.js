import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const PROJECT_LABEL = 'Upload post-intervention flow test'

// CDP Uploader must be running; meta-refresh polling can take up to 120 s in the
// worst case (esp. the real uploader in e2e), so allow the full window.
const UPLOAD_TIMEOUT = 120_000
const COMPLETE_FILE = 'Post-intervention - complete.gpkg'
const STRUCTURAL_ERROR_FILE =
  'Post-intervention (missing data) - fails validation.gpkg'
const FORMAT_ERROR_FILE = 'Not a valid geopackage.gpkg'
const RLB_NO_GEOMETRY_FILE =
  'Post-intervention - no geometry column in RLB layer.gpkg'
const RLB_MULTIPLE_GEOMETRY_FILE =
  'Post-intervention - multiple geometry columns in RLB layer.gpkg'
const RLB_WRONG_GEOMETRY_FILE =
  'Post-intervention - wrong geometry in RLB layer.gpkg'
const SLIVERS_FILE = 'Post-intervention - complete with slivers.gpkg'

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

        await expect(errorFilePage.errorSummary).toBeVisible()
        await expect(errorFilePage.errorSummary).toContainText(
          'There is a problem with your file'
        )
        await expect(
          errorFilePage.postInterventionRejectedHeading
        ).toBeVisible()
        await expect(errorFilePage.uploadDifferentFileLink).toBeVisible()
        await expect(errorFilePage.uploadDifferentFileLink).toHaveAttribute(
          'href',
          `/projects/${id}/upload-post-intervention-file`
        )
        await expect(errorFilePage.backToProjectLink).toBeVisible()
        await expect(errorFilePage.backToProjectLink).toHaveAttribute(
          'href',
          `/add-project-details/${id}`
        )
      })
    }
  )
}

// ─── Content validation errors (structure + data quality) ────────────────────

function describeContentValidationErrors() {
  // Each fixture exercises a distinct post-intervention validation failure that
  // surfaces on the shared error-file dropout page. Expected text confirmed by
  // manual validation. Note: the slivers message is baseline-worded in the
  // shared backend copy (says "Baseline file …" on a post-intervention upload).
  const cases = [
    {
      name: 'a Red Line Boundary layer with no geometry column',
      file: RLB_NO_GEOMETRY_FILE,
      expected: 'Missing required feature layer in GeoPackage'
    },
    {
      name: 'a Red Line Boundary layer with multiple geometry columns',
      file: RLB_MULTIPLE_GEOMETRY_FILE,
      expected:
        'expected exactly one geometry column in gpkg_geometry_columns but found 2'
    },
    {
      name: 'a Red Line Boundary layer with the wrong geometry type',
      file: RLB_WRONG_GEOMETRY_FILE,
      expected: 'Zero red line boundaries in GeoPackage (expecting one)'
    },
    {
      name: 'slivers inside the redline boundary',
      file: SLIVERS_FILE,
      expected:
        'slivers inside the redline boundary that are not covered by any area habitat polygon'
    }
  ]

  test.describe(
    'Upload post-intervention — content validation errors',
    { tag: '@regression' },
    () => {
      for (const { name, file, expected } of cases) {
        test(`uploading ${name} is rejected on the error-file page`, async ({
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

          await uploadPostInterventionFileFlow.uploadFile(id, file)
          await page.waitForURL('/error-file', { timeout: UPLOAD_TIMEOUT })

          await expect(
            errorFilePage.postInterventionRejectedHeading
          ).toBeVisible()
          await expect(errorFilePage.errorSummary).toBeVisible()
          await expect(page.getByText(expected).first()).toBeVisible()
        })
      }
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
    describeContentValidationErrors()
  }
)
