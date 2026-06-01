import { test, expect } from '@fixtures'
import { STORAGE_STATE, runMode } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'

const TASK_BASELINE_HABITATS = 'On-site baseline habitats'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const PROJECT_LABEL = 'Upload baseline flow test'

// CDP Uploader must be running; meta-refresh polling can take up to 120 s in
// the worst case, so these tests use the full per-test timeout.
const UPLOAD_TIMEOUT = 60_000
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

      await page.waitForURL(new RegExp(`/projects/${id}/habitat-list`), {
        timeout: UPLOAD_TIMEOUT
      })

      await expect(habitatListPage.heading).toBeVisible()
      await expect(habitatListPage.firstAreaHabitatLink).toBeVisible()
      await expect(habitatListPage.firstCompleteStatus).toBeVisible()

      await projectTaskListPage.open(id)

      await expect(
        projectTaskListPage.taskItem(TASK_BASELINE_HABITATS)
      ).toHaveAttribute('href', `/projects/${id}/habitat-list`)
      await expect(projectTaskListPage.taskStatus('Completed')).toHaveCount(2)
      await expect(
        projectTaskListPage.taskStatus('Not yet started')
      ).toHaveCount(1)
    })
  })
}

// ─── Format error ────────────────────────────────────────────────────────────

function describeFormatError() {
  test.describe('Upload baseline — format error', () => {
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

      await uploadBaselineFileFlow.uploadFile(id, 'Not a valid geopackage.gpkg')

      await page.waitForURL(
        new RegExp(`/projects/${id}/upload-baseline-file`),
        { timeout: UPLOAD_TIMEOUT }
      )

      await expect(uploadBaselineFilePage.errorSummary).toBeVisible()
      await expect(uploadBaselineFilePage.errorSummary).toContainText(
        'The selected file must be a GeoPackage (.gpkg)'
      )
    })
  })
}

// ─── Structural validation errors ────────────────────────────────────────────

function describeStructuralErrors() {
  test.describe('Upload baseline — structural validation errors', () => {
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

      await expect(errorFilePage.errorSummary).toBeVisible()
      await expect(errorFilePage.errorSummary).toContainText(
        'There is a problem with your file'
      )
      await expect(errorFilePage.uploadDifferentFileLink).toBeVisible()
      await expect(errorFilePage.uploadDifferentFileLink).toHaveAttribute(
        'href',
        `/projects/${id}/upload-baseline-file`
      )
    })
  })
}

// ─── SLIVERS_OUTSIDE_REDLINE suppression ─────────────────────────────────────

function describeSuppression() {
  test.describe('Upload baseline — SLIVERS_OUTSIDE_REDLINE suppression', () => {
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
  })
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
  test.describe('Baseline habitat details — after upload', () => {
    test('page renders with heading, form fields, and navigation links', async ({
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

      await uploadBaselineFileFlow.uploadFile(id, COMPLETE_BASELINE_FILE)

      await page.waitForURL(new RegExp(`/projects/${id}/habitat-list`), {
        timeout: UPLOAD_TIMEOUT
      })

      const href =
        await habitatListPage.firstAreaHabitatLink.getAttribute('href')
      const habitatId = new URL(`http://localhost${href}`).searchParams.get(
        'habitatId'
      )

      await baselineHabitatDetailsPage.open(id, habitatId)

      await expect(baselineHabitatDetailsPage.heading).toBeVisible()
      await expect(
        baselineHabitatDetailsPage.baselineDetailsHeading
      ).toBeVisible()
      await expect(baselineHabitatDetailsPage.broadHabitatSelect).toBeVisible()
      await expect(baselineHabitatDetailsPage.habitatTypeSelect).toBeVisible()
      await expect(baselineHabitatDetailsPage.conditionSelect).toBeVisible()
      await expect(baselineHabitatDetailsPage.saveButton).toBeVisible()
      await expect(baselineHabitatDetailsPage.backLink).toBeVisible()
      await expect(baselineHabitatDetailsPage.cancelLink).toBeVisible()
    })

    test('saving habitat details redirects to habitat list with habitat anchor', async ({
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

      await uploadBaselineFileFlow.uploadFile(id, COMPLETE_BASELINE_FILE)

      await page.waitForURL(new RegExp(`/projects/${id}/habitat-list`), {
        timeout: UPLOAD_TIMEOUT
      })

      const href =
        await habitatListPage.firstAreaHabitatLink.getAttribute('href')
      const habitatId = new URL(`http://localhost${href}`).searchParams.get(
        'habitatId'
      )

      await baselineHabitatDetailsPage.open(id, habitatId)
      await baselineHabitatDetailsPage.saveButton.click()

      await expect(page).toHaveURL(
        new RegExp(`/projects/${id}/habitat-list#habitat-${habitatId}`)
      )
    })
  })
}

// ─── Suite ───────────────────────────────────────────────────────────────────

test.describe('upload-baseline', { tag: '@upload-baseline' }, () => {
  // Serial mode: all flow tests mutate the same shared Redis session
  // (pendingUploadId). Running them in parallel causes session contamination.
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: STORAGE_STATE })
  test.skip(runMode === 'e2e', E2E_SKIP_REASON)

  describeHappyPath()
  describeFormatError()
  describeStructuralErrors()
  describeSuppression()
  describeDistinctivenessError()
  describeBaselineHabitatDetailsFlow()
})
