import { test, expect } from '@fixtures'
import { STORAGE_STATE, runMode } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const PROJECT_LABEL = 'Upload baseline flow test'

// CDP Uploader must be running; meta-refresh polling can take up to 120 s in
// the worst case, so these tests use the full per-test timeout.
const UPLOAD_TIMEOUT = 60_000

// ─── E2E happy path ─────────────────────────────────────────────────────────

function describeHappyPath() {
  test.describe('Upload baseline — happy path', { tag: '@smoke' }, () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test('uploading a valid .gpkg file reaches the success page', async ({
      createProjectFlow,
      projectDashboardPage,
      uploadBaselineFileFlow,
      uploadResultPage,
      page
    }) => {
      const { id } = await setupProject(
        createProjectFlow,
        projectDashboardPage,
        PROJECT_LABEL
      )

      await uploadBaselineFileFlow.uploadFile(
        id,
        'Baseline - complete with area refs.gpkg'
      )

      await page.waitForURL(new RegExp(`/projects/${id}/upload-result`), {
        timeout: UPLOAD_TIMEOUT
      })

      await expect(uploadResultPage.heading).toBeVisible()
      await expect(uploadResultPage.returnToProjectLink).toBeVisible()
      await expect(uploadResultPage.returnToProjectLink).toHaveAttribute(
        'href',
        `/add-project-details/${id}`
      )
    })
  })
}

// ─── Format error ────────────────────────────────────────────────────────────

function describeFormatError() {
  test.describe('Upload baseline — format error', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

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
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

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
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

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

// ─── Suite ───────────────────────────────────────────────────────────────────

test.describe('upload-baseline', { tag: '@upload-baseline' }, () => {
  // Serial mode: all flow tests mutate the same shared Redis session
  // (pendingUploadId). Running them in parallel causes session contamination.
  test.describe.configure({ mode: 'serial' })

  describeHappyPath()
  describeFormatError()
  describeStructuralErrors()
  describeSuppression()
})
