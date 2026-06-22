import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import { assertRejectedFileError } from '@utils/error-file-assertions.js'

const TASK_BASELINE_HABITATS = 'On-site baseline habitats'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const PROJECT_LABEL = 'Upload baseline flow test'

// CDP Uploader must be running; meta-refresh polling can take up to 120 s in the
// worst case (esp. the real uploader in e2e), so allow the full window.
const UPLOAD_TIMEOUT = 120_000
const COMPLETE_BASELINE_FILE = 'Baseline - complete with area refs.gpkg'

// ─── E2E happy path ─────────────────────────────────────────────────────────

function describeHappyPath() {
  test.describe('Upload baseline — happy path', { tag: '@smoke' }, () => {
    test('uploading a valid .gpkg file reaches the habitat list and marks task list item as Completed', async ({
      createProjectFlow,
      projectDashboardPage,
      uploadBaselineFileFlow,
      habitatListPage,
      projectTaskListPage,
      page
    }) => {
      const { id } = await setupProject(
        createProjectFlow,
        projectDashboardPage,
        PROJECT_LABEL
      )

      await uploadBaselineFileFlow.uploadFile(id, COMPLETE_BASELINE_FILE)

      await page.waitForURL(
        new RegExp(`/projects/${id}/baseline-habitat-list`),
        {
          timeout: UPLOAD_TIMEOUT
        }
      )

      await expect(habitatListPage.heading).toBeVisible()
      await expect(habitatListPage.firstAreaHabitatLink).toBeVisible()
      await expect(habitatListPage.firstCompleteStatus).toBeVisible()

      await projectTaskListPage.open(id)

      await expect(
        projectTaskListPage.taskItem(TASK_BASELINE_HABITATS)
      ).toHaveAttribute('href', `/projects/${id}/baseline-habitat-list`)
      // After baseline upload: Project Name + On-site baseline are Completed;
      // Project Details + On-site post intervention remain Not yet started.
      await expect(projectTaskListPage.taskStatus('Completed')).toHaveCount(2)
      await expect(
        projectTaskListPage.taskStatus('Not yet started')
      ).toHaveCount(2)
    })
  })
}

// ─── No pending upload ───────────────────────────────────────────────────────

function describeNoPendingUpload() {
  test.describe(
    'Upload received — no pending upload',
    { tag: '@regression' },
    () => {
      test('visiting upload-received without a pending upload redirects to the upload form', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadReceivedPage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )

        // No upload has been initiated, so the session holds no pendingUploadId;
        // the handler must bounce the user back to the upload form.
        await uploadReceivedPage.open(id)

        await expect(page).toHaveURL(
          new RegExp(`/projects/${id}/upload-baseline-file`)
        )
      })
    }
  )
}

// ─── Format error ────────────────────────────────────────────────────────────

function describeFormatError() {
  test.describe(
    'Upload baseline — format error',
    { tag: '@regression' },
    () => {
      test('uploading a non-GeoPackage file shows flash error on the upload form', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        uploadBaselineFilePage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )

        await uploadBaselineFileFlow.uploadFile(
          id,
          'Not a valid geopackage.gpkg'
        )

        await page.waitForURL(
          new RegExp(`/projects/${id}/upload-baseline-file`),
          { timeout: UPLOAD_TIMEOUT }
        )

        await expect(uploadBaselineFilePage.errorSummary).toBeVisible()
        await expect(uploadBaselineFilePage.errorSummary).toContainText(
          'The selected file must be a GeoPackage (.gpkg)'
        )
      })
    }
  )
}

// ─── Structural validation errors ────────────────────────────────────────────

function describeStructuralErrors() {
  test.describe(
    'Upload baseline — structural validation errors',
    { tag: '@regression' },
    () => {
      test('uploading a .gpkg file with content errors shows error summary on the error-file page', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        errorFilePage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )

        await uploadBaselineFileFlow.uploadFile(
          id,
          'Baseline - overlapping parcels.gpkg'
        )

        await page.waitForURL('/error-file', { timeout: UPLOAD_TIMEOUT })

        await assertRejectedFileError(
          errorFilePage,
          errorFilePage.baselineRejectedHeading,
          id,
          'upload-baseline-file'
        )
      })
    }
  )
}

// ─── SLIVERS_OUTSIDE_REDLINE suppression ─────────────────────────────────────

function describeSuppression() {
  test.describe(
    'Upload baseline — SLIVERS_OUTSIDE_REDLINE suppression',
    { tag: '@regression' },
    () => {
      test('when AREA_PARCELS_OUTSIDE_REDLINE is present, SLIVERS_OUTSIDE_REDLINE is suppressed on the error-file page', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        errorFilePage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )

        await uploadBaselineFileFlow.uploadFile(
          id,
          'Baseline - parcel outside redline.gpkg'
        )

        await page.waitForURL('/error-file', { timeout: UPLOAD_TIMEOUT })

        await expect(errorFilePage.errorSummary).toBeVisible()
        await expect(errorFilePage.errorSummary).toContainText(
          'One or more area habitat polygons are not entirely within the redline boundary'
        )
        await expect(errorFilePage.errorSummary).not.toContainText(
          'Baseline file contains habitat parcel parts outside the redline boundary'
        )
        await expect(errorFilePage.uploadDifferentFileLink).toBeVisible()
        await expect(errorFilePage.uploadDifferentFileLink).toHaveAttribute(
          'href',
          `/projects/${id}/upload-baseline-file`
        )
      })
    }
  )
}

// ─── High distinctiveness validation error ────────────────────────────────────

function describeDistinctivenessError() {
  test.describe(
    'Upload baseline — high distinctiveness habitat',
    { tag: '@smoke' },
    () => {
      test('uploading a file with High/Very High distinctiveness habitat shows error with habitat reference on error-file page', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        errorFilePage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )

        await uploadBaselineFileFlow.uploadFile(
          id,
          'Baseline - habitat distinctiveness out of scope.gpkg'
        )

        await page.waitForURL('/error-file', { timeout: UPLOAD_TIMEOUT })

        await expect(errorFilePage.errorSummary).toBeVisible()
        await expect(errorFilePage.errorSummary).toContainText(
          'One or more habitats have a distinctiveness that is out of scope'
        )
        await expect(page.getByText(/Feature Ref/).first()).toBeVisible()
        await expect(errorFilePage.uploadDifferentFileLink).toBeVisible()
        await expect(errorFilePage.uploadDifferentFileLink).toHaveAttribute(
          'href',
          `/projects/${id}/upload-baseline-file`
        )
      })
    }
  )
}

// ─── Baseline habitat details flow ───────────────────────────────────────────

function describeBaselineHabitatDetailsFlow() {
  test.describe(
    'Baseline habitat details — after upload',
    { tag: '@regression' },
    () => {
      let projectId
      let featureId

      test.beforeEach(
        async ({
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          habitatListPage,
          baselineHabitatDetailsPage,
          page
        }) => {
          const { id } = await setupProject(
            createProjectFlow,
            projectDashboardPage,
            PROJECT_LABEL
          )
          projectId = id

          await uploadBaselineFileFlow.uploadFile(id, COMPLETE_BASELINE_FILE)

          await page.waitForURL(
            new RegExp(`/projects/${id}/baseline-habitat-list`),
            {
              timeout: UPLOAD_TIMEOUT
            }
          )

          const href =
            await habitatListPage.firstAreaHabitatLink.getAttribute('href')
          featureId = new URL(`http://localhost${href}`).searchParams.get(
            'featureId'
          )

          await baselineHabitatDetailsPage.open(id, featureId)
        }
      )

      test('page renders with heading, form fields, and navigation links', async ({
        baselineHabitatDetailsPage
      }) => {
        await expect(baselineHabitatDetailsPage.heading).toBeVisible()
        await expect(
          baselineHabitatDetailsPage.baselineDetailsHeading
        ).toBeVisible()
        await expect(
          baselineHabitatDetailsPage.broadHabitatSelect
        ).toBeVisible()
        await expect(baselineHabitatDetailsPage.habitatTypeSelect).toBeVisible()
        await expect(baselineHabitatDetailsPage.conditionSelect).toBeVisible()
        await expect(baselineHabitatDetailsPage.saveButton).toBeVisible()
        await expect(baselineHabitatDetailsPage.backLink).toBeVisible()
        await expect(baselineHabitatDetailsPage.cancelLink).toBeVisible()
      })

      test('saving habitat details redirects to habitat list with habitat anchor', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.saveButton.click()

        await expect(page).toHaveURL(
          new RegExp(
            `/projects/${projectId}/baseline-habitat-list#habitat-${featureId}`
          )
        )
      })

      test('changing habitat type triggers conditions proxy and updates condition options', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        // Select the first real broad habitat option (index 1 skips "Choose broad habitat")
        await baselineHabitatDetailsPage.broadHabitatSelect.selectOption({
          index: 1
        })

        // Client-side JS updates habitat type options from embedded reference data;
        // wait for at least one selectable option to appear
        await expect(
          baselineHabitatDetailsPage.habitatTypeSelect.locator('option').nth(1)
        ).toBeAttached()

        // Set up response watcher before selecting habitat type
        const conditionsResponse = page.waitForResponse(
          /\/api\/reference\/conditions/
        )

        // Selecting a habitat type fires a fetch to the conditions proxy
        await baselineHabitatDetailsPage.habitatTypeSelect.selectOption({
          index: 1
        })

        await conditionsResponse

        // Condition select must have at least one selectable option beyond the default
        await expect(
          baselineHabitatDetailsPage.conditionSelect.locator('option').nth(1)
        ).toBeAttached()
      })
    }
  )
}

// ─── Suite ───────────────────────────────────────────────────────────────────

test.describe('upload-baseline', { tag: '@upload-baseline' }, () => {
  // Serial mode: all flow tests mutate the same shared Redis session
  // (pendingUploadId). Running them in parallel causes session contamination.
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: STORAGE_STATE })
  test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

  describeHappyPath()
  describeNoPendingUpload()
  describeFormatError()
  describeStructuralErrors()
  describeSuppression()
  describeDistinctivenessError()
  describeBaselineHabitatDetailsFlow()
})
