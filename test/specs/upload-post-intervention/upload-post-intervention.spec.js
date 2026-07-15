import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const PROJECT_LABEL = 'Upload post-intervention flow test'

// CDP Uploader must be running; meta-refresh polling can take up to 120 s in the
// worst case (esp. the real uploader in e2e), so allow the full window.
const UPLOAD_TIMEOUT = 120_000
const COMPLETE_FILE = 'Post-intervention - complete.gpkg'
const TASK_POST_INTERVENTION = 'On-site post intervention habitats'
const STRUCTURAL_ERROR_FILE =
  'Post-intervention (missing data) - fails validation.gpkg'
const FORMAT_ERROR_FILE = 'Not a valid geopackage.gpkg'
const FORMAT_ERROR_MESSAGE = 'The selected file must be a GeoPackage (.gpkg)'
const ERROR_SUMMARY_TITLE = 'There is a problem'
const RLB_NO_GEOMETRY_FILE =
  'Post-intervention - no geometry column in RLB layer.gpkg'
const RLB_MULTIPLE_GEOMETRY_FILE =
  'Post-intervention - multiple geometry columns in RLB layer.gpkg'
const RLB_WRONG_GEOMETRY_FILE =
  'Post-intervention - wrong geometry in RLB layer.gpkg'
const SLIVERS_FILE = 'Post-intervention - complete with slivers.gpkg'
const NATURAL_ENGLAND_MISMATCH_COPY =
  'The layer names and column names do not match what is required by Natural England'

// ─── E2E happy path ─────────────────────────────────────────────────────────

function describeHappyPath() {
  test.describe(
    'Upload post-intervention — happy path',
    { tag: '@smoke' },
    () => {
      test('uploading a valid .gpkg file reaches the habitat list and marks the task list item as Completed', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadPostInterventionFileFlow,
        postInterventionHabitatListPage,
        projectTaskListPage,
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

        await projectTaskListPage.open(id)

        await expect(
          projectTaskListPage.taskItem(TASK_POST_INTERVENTION)
        ).toHaveAttribute(
          'href',
          `/projects/${id}/post-intervention-habitat-list`
        )
        await projectTaskListPage.assertTaskStatus(
          TASK_POST_INTERVENTION,
          'Completed'
        )
        // After a post-intervention-only upload: Project Name + On-site
        // post intervention are Completed; Project Details + On-site baseline
        // remain Not yet started.
        await expect(projectTaskListPage.taskStatus('Completed')).toHaveCount(2)
        await expect(
          projectTaskListPage.taskStatus('Not yet started')
        ).toHaveCount(2)
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
      test('uploading a non-GeoPackage file shows the error summary with heading and error link', async ({
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

        const summary = uploadPostInterventionFilePage.errorSummary
        await expect(summary).toBeVisible()
        await expect(
          summary.getByRole('heading', { name: ERROR_SUMMARY_TITLE })
        ).toBeVisible()
        await expect(
          summary.getByRole('link', { name: FORMAT_ERROR_MESSAGE })
        ).toBeVisible()
      })

      test('clicking the error-summary link moves focus to the file-selection button', async ({
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

        await uploadPostInterventionFilePage.errorSummary
          .getByRole('link', { name: FORMAT_ERROR_MESSAGE })
          .click()

        await expect(
          uploadPostInterventionFilePage.chooseFileButton
        ).toBeFocused()
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
      // The fixture surfaces exactly one schema error, so the BMD-405
      // single-error catch-all page renders; its inline upload link must
      // target the post-intervention route (validationUploadType routing).
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

        await expect(errorFilePage.geopackageErrorHeading).toBeVisible()
        await expect(errorFilePage.errorSummary).not.toBeVisible()
        await expect(
          page.getByText(NATURAL_ENGLAND_MISMATCH_COPY)
        ).toBeVisible()
        await expect(errorFilePage.uploadNewFileLink).toHaveAttribute(
          'href',
          `/projects/${id}/upload-post-intervention-file`
        )
        await expect(errorFilePage.uploadDifferentFileLink).toBeVisible()
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
  // Each fixture exercises a distinct post-intervention validation failure
  // that surfaces on the shared error-file dropout page. Expected copy is
  // confirmed by uploading and inspecting the rendered page: fixtures that
  // surface exactly one backend error render the BMD-405 single-error layout
  // (`layout: 'single'` — no error summary); fixtures with several errors
  // keep the grouped multi-error layout (`layout: 'multi'`).
  const cases = [
    {
      name: 'a Red Line Boundary layer with no geometry column',
      file: RLB_NO_GEOMETRY_FILE,
      layout: 'single',
      expected: NATURAL_ENGLAND_MISMATCH_COPY
    },
    {
      name: 'a Red Line Boundary layer with multiple geometry columns',
      file: RLB_MULTIPLE_GEOMETRY_FILE,
      layout: 'single',
      expected: NATURAL_ENGLAND_MISMATCH_COPY
    },
    {
      name: 'a Red Line Boundary layer with the wrong geometry type',
      file: RLB_WRONG_GEOMETRY_FILE,
      layout: 'multi',
      expected: 'Zero red line boundaries in GeoPackage (expecting one)'
    },
    {
      // BMD-405 AC9: the slivers fixture trips a single sliver error, so the
      // single-error sliver copy renders (this variant has no reachable
      // baseline fixture — see the upload-baseline pending-fixture skips).
      name: 'slivers inside the redline boundary',
      file: SLIVERS_FILE,
      layout: 'single',
      expected: 'This parcel is a sliver (a thin strip of land)'
    }
  ]

  test.describe(
    'Upload post-intervention — content validation errors',
    { tag: '@regression' },
    () => {
      for (const { name, file, layout, expected } of cases) {
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

          if (layout === 'single') {
            await expect(errorFilePage.geopackageErrorHeading).toBeVisible()
            await expect(errorFilePage.errorSummary).not.toBeVisible()
            await expect(errorFilePage.uploadNewFileLink).toHaveAttribute(
              'href',
              `/projects/${id}/upload-post-intervention-file`
            )
          } else {
            await expect(
              errorFilePage.postInterventionRejectedHeading
            ).toBeVisible()
            await expect(errorFilePage.errorSummary).toBeVisible()
          }
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
