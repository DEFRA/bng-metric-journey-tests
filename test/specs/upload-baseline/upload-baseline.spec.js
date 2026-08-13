import { test, expect } from '@fixtures'
import {
  STORAGE_STATE,
  NO_PROJECTS_STORAGE_STATE,
  skipInE2e,
  baseUrl
} from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import { CreateProjectFlow } from '@flows/project-management/create-project.flow.js'
import { UploadBaselineFileFlow } from '@flows/upload-baseline/upload-baseline-file.flow.js'
import { ProjectDashboardPage } from '@pages/project-dashboard.page.js'
import { ErrorFilePage } from '@pages/error-file.page.js'

const TASK_BASELINE_HABITATS = 'On-site baseline habitats'
const TASK_POST_INTERVENTION = 'On-site post intervention habitats'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const PROJECT_LABEL = 'Upload baseline flow test'

// CDP Uploader must be running; meta-refresh polling can take up to 120 s in the
// worst case (esp. the real uploader in e2e), so allow the full window.
const UPLOAD_TIMEOUT = 120_000
const COMPLETE_BASELINE_FILE = 'Baseline - complete with area refs.gpkg'
const COMPLETE_POST_INTERVENTION_FILE = 'Post-intervention - complete.gpkg'
const NATURAL_ENGLAND_MISMATCH_COPY =
  'The layer names and column names do not match what is required by Natural England'

// ─── E2E happy path ─────────────────────────────────────────────────────────

async function uploadToHabitatList(fixtures, fixture) {
  const {
    createProjectFlow,
    projectDashboardPage,
    uploadBaselineFileFlow,
    page
  } = fixtures
  const { id } = await setupProject(
    createProjectFlow,
    projectDashboardPage,
    PROJECT_LABEL
  )
  await uploadBaselineFileFlow.uploadFile(id, fixture)
  await page.waitForURL(new RegExp(`/projects/${id}/baseline-habitat-list`), {
    timeout: UPLOAD_TIMEOUT
  })
  return id
}

function describeHappyPath() {
  test.describe(
    'Upload baseline — happy path',
    { tag: ['@smoke', '@happy-path'] },
    () => {
      test('uploading a valid .gpkg file reaches the habitat list and marks task list item as Completed', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        habitatListPage,
        projectTaskListPage,
        page
      }) => {
        const id = await uploadToHabitatList(
          {
            createProjectFlow,
            projectDashboardPage,
            uploadBaselineFileFlow,
            page
          },
          COMPLETE_BASELINE_FILE
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
    }
  )
}

// ─── Baseline replacement discards post-intervention data ────────────────────

// Backend BMD-850 (PR#219) made setProjectBaseline delete the postIntervention
// key in the same JSONB update that writes the new baseline, replacing the old
// re-enrichment behaviour. That is silent data loss from the user's point of
// view, and the task list is where it surfaces — so it is worth pinning.
function describeBaselineReplacement() {
  test.describe(
    'Upload baseline — replacing an existing baseline',
    { tag: '@regression' },
    () => {
      test('re-uploading a baseline discards the post-intervention data and resets its task list row', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        uploadPostInterventionFileFlow,
        projectTaskListPage,
        page
      }) => {
        // Three real uploads back this test.
        test.setTimeout(UPLOAD_TIMEOUT * 3)

        const id = await uploadToHabitatList(
          {
            createProjectFlow,
            projectDashboardPage,
            uploadBaselineFileFlow,
            page
          },
          COMPLETE_BASELINE_FILE
        )

        await uploadPostInterventionFileFlow.uploadFile(
          id,
          COMPLETE_POST_INTERVENTION_FILE
        )
        await page.waitForURL(
          new RegExp(`/projects/${id}/post-intervention-habitat-list`),
          { timeout: UPLOAD_TIMEOUT }
        )

        // Both habitat tasks are Completed before the replacement.
        await projectTaskListPage.open(id)
        await expect(projectTaskListPage.taskStatus('Completed')).toHaveCount(3)
        await projectTaskListPage.assertTaskStatus(
          TASK_POST_INTERVENTION,
          'Completed'
        )

        await uploadBaselineFileFlow.uploadFile(id, COMPLETE_BASELINE_FILE)
        await page.waitForURL(
          new RegExp(`/projects/${id}/baseline-habitat-list`),
          { timeout: UPLOAD_TIMEOUT }
        )

        // The replacement dropped the post-intervention document: its row is
        // back to Not yet started and points at the file-type selection page,
        // while the baseline itself stays Completed.
        await projectTaskListPage.open(id)
        await projectTaskListPage.assertTaskStatus(
          TASK_POST_INTERVENTION,
          'Not yet started'
        )
        await expect(
          projectTaskListPage.taskItem(TASK_POST_INTERVENTION)
        ).toHaveAttribute('href', `/projects/${id}/upload-file`)
        await projectTaskListPage.assertTaskStatus(
          TASK_BASELINE_HABITATS,
          'Completed'
        )
        await expect(projectTaskListPage.taskStatus('Completed')).toHaveCount(2)
      })
    }
  )
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

// ─── Cross-user access ────────────────────────────────────────────────────────

// The backend correctly denies the persist for a project the requesting user
// doesn't own (persist-baseline.js's visibleToUser(sub) check, 404 on write),
// but the frontend doesn't propagate that: the GET step silently falls back to
// a generic "Project" caption, and the POST /baseline/validate/{uploadId} 404
// is caught by validateHabitatUpload's generic 4xx handler and surfaces as a
// VALIDATION_FAILED error — which has no dedicated single-error copy, so it
// falls through to the AC1 Natural England catch-all. A different user
// uploading a fully VALID file against someone else's project id therefore
// reaches a misleading "your file is invalid" page rather than any access
// error, even though nothing is persisted. Verified directly against the
// running stack (not inferred) before writing these assertions.
function describeCrossUserAccess() {
  test.describe(
    'Upload baseline — cross-user access',
    { tag: '@regression' },
    () => {
      test.skip(
        skipInE2e(NO_PROJECTS_STORAGE_STATE),
        'Requires a second stub-auth profile — not available in e2e mode'
      )

      test('uploading a valid file against another user’s project id reaches the misleading catch-all error page, and nothing is persisted', async ({
        browser
      }) => {
        const ownerContext = await browser.newContext({
          storageState: STORAGE_STATE,
          baseURL: baseUrl
        })
        const ownerPage = await ownerContext.newPage()
        const { id: ownerProjectId } = await setupProject(
          new CreateProjectFlow(ownerPage),
          new ProjectDashboardPage(ownerPage),
          PROJECT_LABEL
        )
        await ownerContext.close()

        const otherContext = await browser.newContext({
          storageState: NO_PROJECTS_STORAGE_STATE,
          baseURL: baseUrl
        })
        try {
          const otherPage = await otherContext.newPage()
          const otherErrorFilePage = new ErrorFilePage(otherPage)

          const getResponse = await otherPage.goto(
            `/projects/${ownerProjectId}/upload-baseline-file`
          )
          // The GET step doesn't block on ownership — it renders the form
          // regardless (see comment above), so this is 200 not 404/403.
          expect(getResponse.status()).toBe(200)

          await new UploadBaselineFileFlow(otherPage).uploadFile(
            ownerProjectId,
            COMPLETE_BASELINE_FILE
          )
          await otherPage.waitForURL('/error-file', {
            timeout: UPLOAD_TIMEOUT
          })

          await expect(otherErrorFilePage.geopackageErrorHeading).toBeVisible()
          await expect(
            otherPage.getByText(NATURAL_ENGLAND_MISMATCH_COPY)
          ).toBeVisible()
        } finally {
          await otherContext.close()
        }
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
      // The fixture trips PARCEL_OVERLAPS alongside distinctiveness and
      // area-sum-mismatch errors, so the multi-error layout renders (the
      // BMD-405 single-error page needs exactly one error).
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
        await expect(errorFilePage.errorSummary).toContainText(
          'One or more area habitat parcels overlap with other parcels'
        )
        // This fixture's shared base data also trips an out-of-scope
        // distinctiveness error, so the multi-error layout's distinctiveness
        // block renders the allowed-bands note.
        await expect(errorFilePage.errorSummary).toContainText(
          'Allowed distinctiveness: Medium, Low and Very low.'
        )
        await expect(errorFilePage.baselineRejectedHeading).toBeVisible()
        await expect(errorFilePage.uploadDifferentFileLink).toBeVisible()
        await expect(errorFilePage.uploadDifferentFileLink).toHaveAttribute(
          'href',
          `/projects/${id}/upload-baseline-file`
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

// ─── AREA_PARCELS_TOO_SMALL (BMD-882) ────────────────────────────────────────

// BMD-882 removed the derived SLIVERS_INSIDE_REDLINE check. Both sides of that
// change are pinned in the backend against a real PostGIS — a sub-tolerance gap
// is accepted ("accepts a small gap left between the parcels and the redline")
// and an oversize one is still caught ("detects area sum mismatch"), both in
// ../bng-metric-backend/integration-tests/postgis-validate-baseline-layers.test.js.
// The browser-level pair that used to sit here added only a second assertion of
// the same two rules, so it was retired; the rendering of the replacement check
// is still covered by describeParcelTooSmall() below.

function describeParcelTooSmall() {
  test.describe(
    'Upload baseline — parcel below the minimum area',
    { tag: '@regression' },
    () => {
      // The replacement for the removed derived-sliver check: a parcel supplied
      // in the file whose own footprint is under 1 m². The fixture leaves the
      // shortfall uncompensated, so AREA_SUM_MISMATCH co-fires and the grouped
      // multi-error layout renders — see the skipped single-error placeholder
      // in SINGLE_ERROR_PENDING_FIXTURE_CASES for the other layout.
      test('a parcel under 1 square metre is rejected, naming the parcel and its area', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        errorFilePage,
        page
      }) => {
        const id = await uploadToErrorFile(
          {
            createProjectFlow,
            projectDashboardPage,
            uploadBaselineFileFlow,
            page
          },
          'Baseline - parcel too small.gpkg'
        )

        await expect(errorFilePage.errorSummary).toBeVisible()
        await expect(errorFilePage.errorSummary).toContainText(
          'One or more area habitat parcels are smaller than 1 square metre'
        )
        // The block lists the offending parcel with its measured area so the
        // user can find the polygon to redraw.
        await expect(
          page.getByText(/Feature Ref \w+ — ~0\.\d+ sq m/)
        ).toBeVisible()
        await expect(errorFilePage.baselineRejectedHeading).toBeVisible()
        await expect(errorFilePage.uploadDifferentFileLink).toHaveAttribute(
          'href',
          `/projects/${id}/upload-baseline-file`
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
      test('uploading a file with High/Very High distinctiveness habitat shows the distinctiveness single-error page', async ({
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

        // BMD-405 AC6a: exactly one HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE error
        // renders the distinctiveness variant with a metric-tool link.
        await expect(errorFilePage.distinctivenessHeading).toBeVisible()
        await expect(errorFilePage.errorSummary).not.toBeVisible()
        await expect(errorFilePage.metricToolLink).toBeVisible()
        await expect(errorFilePage.metricToolLink).toHaveAttribute(
          'href',
          'https://www.gov.uk/government/publications/statutory-biodiversity-metric-tools-and-guides'
        )
        // BMD-405 AC6b: the statutory metric link opens in a new window
        await expect(errorFilePage.metricToolLink).toHaveAttribute(
          'target',
          '_blank'
        )
        // QA fix (frontend PR#175): the single-error layout no longer shows
        // the "Upload a different file" button or "Back to project" link.
        await expect(errorFilePage.uploadDifferentFileLink).not.toBeVisible()
        await expect(errorFilePage.backToProjectLink).not.toBeVisible()
      })
    }
  )
}

// ─── Field and combination validation ─────────────────────────────────────────

async function uploadToErrorFile(fixtures, fixture) {
  const {
    createProjectFlow,
    projectDashboardPage,
    uploadBaselineFileFlow,
    page
  } = fixtures
  const { id } = await setupProject(
    createProjectFlow,
    projectDashboardPage,
    PROJECT_LABEL
  )
  await uploadBaselineFileFlow.uploadFile(id, fixture)
  await page.waitForURL('/error-file', { timeout: UPLOAD_TIMEOUT })
  return id
}

function describeFieldValidation() {
  test.describe(
    'Upload baseline — field and combination validation',
    { tag: '@regression' },
    () => {
      // All three gates are built (backend validation) and route to /error-file.
      // Each test uploads a fixture that violates one rule and asserts the matching
      // rejection heading in the GOV.UK error summary.
      async function expectRejection(
        {
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          errorFilePage,
          page
        },
        fixture,
        expectedText
      ) {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        await uploadBaselineFileFlow.uploadFile(id, fixture)
        await page.waitForURL('/error-file', { timeout: UPLOAD_TIMEOUT })
        await expect(errorFilePage.errorSummary).toBeVisible()
        await expect(errorFilePage.errorSummary).toContainText(expectedText)
        await expect(errorFilePage.uploadDifferentFileLink).toHaveAttribute(
          'href',
          `/projects/${id}/upload-baseline-file`
        )
      }

      // This fixture's incorrect habitat geometry surfaces as a geometry-column
      // schema mismatch, so the readable area parcels come back empty — the page
      // reports "Zero area habitat parcels" alongside the "baseline mismatch".
      test('rejects a habitats layer with incorrect geometry', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        errorFilePage,
        page
      }) => {
        await expectRejection(
          {
            createProjectFlow,
            projectDashboardPage,
            uploadBaselineFileFlow,
            errorFilePage,
            page
          },
          'Baseline - habitats with incorrect geometry.gpkg',
          'Zero area habitat parcels in GeoPackage'
        )
      })

      test('rejects a habitats layer with a missing column', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        errorFilePage,
        page
      }) => {
        await expectRejection(
          {
            createProjectFlow,
            projectDashboardPage,
            uploadBaselineFileFlow,
            errorFilePage,
            page
          },
          'Baseline - missing columns in Habitats.gpkg',
          'baseline mismatch'
        )
      })

      test('rejects a file with duplicate habitat references with the catch-all single-error page', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        errorFilePage,
        page
      }) => {
        const id = await uploadToErrorFile(
          {
            createProjectFlow,
            projectDashboardPage,
            uploadBaselineFileFlow,
            page
          },
          'Baseline - duplicate habitat ref.gpkg'
        )

        // BMD-405: DUPLICATE_HABITAT_REF is a single error with no dedicated
        // AC copy — falls back to the AC1 Natural England catch-all.
        await expect(errorFilePage.geopackageErrorHeading).toBeVisible()
        await expect(errorFilePage.errorSummary).not.toBeVisible()
        await expect(
          page.getByText(NATURAL_ENGLAND_MISMATCH_COPY)
        ).toBeVisible()
        await expect(errorFilePage.uploadNewFileLink).toHaveAttribute(
          'href',
          `/projects/${id}/upload-baseline-file`
        )
      })
    }
  )
}

// ─── Geometric validation gates (multi-error layout) ──────────────────────────

// The gate fixture trips its named geometric check, but also carries side
// errors from the shared base data (out-of-scope distinctiveness,
// area-sum-mismatch), so the grouped multi-error layout renders. The test
// asserts the gate's block heading inside the GOV.UK error summary.
//
// Only the redline-level gate is exercised here. The per-rule detection for
// the parcel, hedgerow, watercourse, tree and outside-England gates lives in
// ../bng-metric-backend/integration-tests/postgis-validate-baseline-layers.test.js,
// and the summary strings themselves are built by the backend
// (src/validation/geopackage/postgis/error-builders.js, unit-tested in
// error-builders.test.js) and rendered verbatim by the frontend — so a browser
// test per gate re-asserted the same two things. describeStructuralErrors()
// above covers the parcel-level side of the same layout.
const GEOMETRIC_GATE_CASES = [
  {
    title: 'rejects a self-intersecting redline boundary',
    fixture: 'Baseline - self intersecting redline.gpkg',
    summaryText: 'Redline boundary geometry is invalid'
  }
]

function describeGeometricGateErrors() {
  test.describe(
    'Upload baseline — geometric validation errors',
    { tag: '@regression' },
    () => {
      for (const { title, fixture, summaryText } of GEOMETRIC_GATE_CASES) {
        test(
          title,
          async ({
            createProjectFlow,
            projectDashboardPage,
            uploadBaselineFileFlow,
            errorFilePage,
            page
          }) => {
            const id = await uploadToErrorFile(
              {
                createProjectFlow,
                projectDashboardPage,
                uploadBaselineFileFlow,
                page
              },
              fixture
            )

            await expect(errorFilePage.errorSummary).toBeVisible()
            await expect(errorFilePage.errorSummary).toContainText(summaryText)
            await expect(errorFilePage.baselineRejectedHeading).toBeVisible()
            await expect(errorFilePage.uploadDifferentFileLink).toHaveAttribute(
              'href',
              `/projects/${id}/upload-baseline-file`
            )
          }
        )
      }
    }
  )
}

// ─── Single validation error dropout pages (BMD-405) ──────────────────────────

const GEOPACKAGE_ERROR_H1 = 'Your Geopackage (.gpkg) file contains an error'

// Each fixture below trips exactly one backend validation error (verified by
// uploading and inspecting the rendered page), so the error-file page renders
// the BMD-405 single-error layout. `heading` is the expected H1 (string =
// substring match, regex for ref-personalised headings); `body` is the copy
// asserted in the paragraph. `placeholder: true` marks AC14 codes whose
// finalised copy is pending BMD-592.
//
// One case per rendered variant, not one per error code. The code → copy map
// itself is a pure function, unit-tested exhaustively over all 20 codes in
// ../bng-metric-frontend/src/server/error-file/single-error-copy.test.js;
// these uploads exist to prove that resolver is wired into the page and that a
// real GeoPackage reaches it. Adding a fixture per code re-ran the upload to
// re-assert a string the unit test already owns.
const SINGLE_ERROR_CASES = [
  {
    // Standard variant. BMD-405 AC13: this case also asserts the inline
    // "upload a new file" link navigates (not just carries the href), folding
    // what was a dedicated nav test into this upload rather than running its own.
    title:
      'missing redline boundary shows the "redline boundary is missing" page',
    fixture: 'Baseline - no rlb polygons.gpkg',
    heading: GEOPACKAGE_ERROR_H1,
    body: 'The redline boundary is missing. Draw the red line boundary and',
    assertNavigation: true
  },
  {
    // Catch-all variant, and one of two single-error fixtures whose defect is
    // structural rather than topological — it exercises the GeoPackage parse
    // path, which the backend's synthetic-geometry PostGIS tests never touch.
    title: 'wrong column names shows the Natural England catch-all page',
    fixture: 'Baseline - wrong column names in Habitats.gpkg',
    heading: GEOPACKAGE_ERROR_H1,
    body: `${NATURAL_ENGLAND_MISMATCH_COPY}. Rename the layers and columns and`
  },
  {
    // KEEP — this is the ONLY test anywhere that proves the backend rejects a
    // GeoPackage carrying more than one red line boundary polygon.
    // GPKG_RLB_TOO_MANY_POLYGONS is raised in the parse layer
    // (src/validation/geopackage/geopackage-internals-validate-features.js) and
    // has no backend unit test, no integration fixture, and no PostGIS test —
    // the integration suite only ships baseline-no-rlb.gpkg for the *missing*
    // case. The frontend unit test covers the copy for this code but is handed a
    // hand-written error object, so it cannot prove the code is ever emitted.
    // Do not delete without adding a >1-polygon RLB fixture to
    // ../bng-metric-backend/integration-tests/fixtures/ first.
    title:
      'multiple redline boundaries shows the "multiple red line boundaries" page',
    fixture: 'Baseline - three rlb polygons.gpkg',
    heading: GEOPACKAGE_ERROR_H1,
    body: 'This file contains multiple red line boundaries. Draw the red line boundary again and'
  },
  {
    // Personalised variant — the H1 interpolates the offending feature ref.
    // Generated by mutating the known-valid "Baseline - complete with area
    // refs.gpkg" so it trips exactly one backend error.
    title:
      'self-intersecting parcel alone shows the personalised "parcel contains an error" page',
    fixture: 'Baseline - only bowtie parcel.gpkg',
    heading: /This parcel .+ contains an error/,
    body: 'This parcel is overlapping itself. Draw the parcel again and'
  },
  {
    // Placeholder variant — AC14 codes with no finalised copy (BMD-592).
    title: 'redline outside England alone shows the placeholder page',
    fixture: 'Baseline - only redline not in england.gpkg',
    placeholder: true,
    body: 'Redline boundary is outside England'
  }
]

function singleErrorTest({
  title,
  fixture,
  heading,
  body,
  placeholder,
  assertNavigation
}) {
  test(
    title,
    async ({
      createProjectFlow,
      projectDashboardPage,
      uploadBaselineFileFlow,
      errorFilePage,
      page
    }) => {
      const id = await uploadToErrorFile(
        {
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          page
        },
        fixture
      )

      // The single-error layout renders no GOV.UK error summary.
      await expect(errorFilePage.errorSummary).not.toBeVisible()
      await expect(page.getByText(body)).toBeVisible()
      if (placeholder) {
        await expect(errorFilePage.placeholderHeading).toBeVisible()
      } else {
        await expect(errorFilePage.singleErrorHeading(heading)).toBeVisible()
        await expect(errorFilePage.uploadNewFileLink).toHaveAttribute(
          'href',
          `/projects/${id}/upload-baseline-file`
        )
      }
      // QA fix (frontend PR#175): the single-error layout no longer shows
      // the "Upload a different file" button or "Back to project" link.
      await expect(errorFilePage.uploadDifferentFileLink).not.toBeVisible()
      await expect(errorFilePage.backToProjectLink).not.toBeVisible()

      // BMD-405 AC13: the inline link navigates, not just carries the href.
      if (assertNavigation) {
        await errorFilePage.uploadNewFileLink.click()
        await expect(page).toHaveURL(
          new RegExp(`/projects/${id}/upload-baseline-file`)
        )
      }
    }
  )
}

function describeSingleErrorDropout() {
  test.describe(
    'Upload baseline — single validation error dropout (BMD-405)',
    { tag: '@regression' },
    () => {
      for (const singleErrorCase of SINGLE_ERROR_CASES) {
        singleErrorTest(singleErrorCase)
      }
    }
  )
}

// ─── Uploader-level rejection (reachability unconfirmed) ──────────────────────

function describeUploaderRejection() {
  test.describe(
    'Upload baseline — CDP Uploader rejection',
    { tag: '@regression' },
    () => {
      // The upload-received controller has a distinct `rejected` branch (clears
      // session, stores an empty error array, redirects to /error-file with the
      // generic "We couldn't accept your file" message) for files the CDP
      // Uploader itself rejects — a different code path from a `ready` status
      // followed by our backend's own GPKG/content validation. No fixture or
      // technique in this repo currently drives that branch (not a virus-scan
      // test file, not an oversized file). To enable:
      //   1. confirm what makes the CDP Uploader return `rejected` (virus scan?
      //      MIME/size limit at the uploader layer specifically) and whether
      //      it's reproducible against the local/github stub
      //   2. add the fixture/technique and remove this test.skip
      test.skip('a file rejected by the CDP Uploader shows the generic error-file message', async () => {})
    }
  )
}

// ─── Upload timeout (impractical without a fast-forward hook) ─────────────────

function describeUploadTimeout() {
  test.describe(
    'Upload baseline — upload check timeout',
    { tag: '@regression' },
    () => {
      // Elapsed > MAX_WAIT_SECONDS (120s, hardcoded in
      // habitat-upload-received-controller.js) clears the session, sets the
      // "The file check timed out. Please try again." flash, and redirects to
      // the upload form. A real 2-minute wait isn't viable in this suite. To
      // enable:
      //   1. make MAX_WAIT_SECONDS env-overridable in the frontend (test-only)
      //   2. drive a `pending` status for longer than the shortened window and
      //      assert the flash + redirect, then remove this test.skip
      test.skip('an upload stuck pending for over 120s shows the timeout flash on the upload form', async () => {})
    }
  )
}

// ─── Irreplaceable habitat (not yet built) ────────────────────────────────────

function describeIrreplaceableHabitat() {
  test.describe(
    'Upload baseline — irreplaceable habitat',
    { tag: '@regression' },
    () => {
      // The irreplaceable-habitat eligibility filter is NOT implemented: there is
      // no error code in ../bng-metric-backend/src/validation/baseline/errors.js
      // and no fixture in ../bng-metric-harness/example-files. The distinctiveness
      // eligibility gate IS covered by describeDistinctivenessError() above.
      // To enable once the filter ships:
      //   1. copy the irreplaceable-habitat fixture into test/example-files/
      //   2. replace the fixture name below and remove this test.skip
      test.skip('uploading a file with an irreplaceable habitat is rejected on the error-file page', async ({
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
          'Baseline - irreplaceable habitat.gpkg'
        )

        await page.waitForURL('/error-file', { timeout: UPLOAD_TIMEOUT })

        await expect(errorFilePage.errorSummary).toBeVisible()
        await expect(errorFilePage.uploadDifferentFileLink).toHaveAttribute(
          'href',
          `/projects/${id}/upload-baseline-file`
        )
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
  describeBaselineReplacement()
  describeNoPendingUpload()
  describeCrossUserAccess()
  describeFormatError()
  describeStructuralErrors()
  describeParcelTooSmall()
  describeSuppression()
  describeDistinctivenessError()
  describeFieldValidation()
  describeGeometricGateErrors()
  describeSingleErrorDropout()
  describeUploaderRejection()
  describeUploadTimeout()
  describeIrreplaceableHabitat()
})
