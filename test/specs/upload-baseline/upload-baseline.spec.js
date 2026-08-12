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

// ─── Sliver and area checks (BMD-882) ────────────────────────────────────────

// BMD-882 removed the derived SLIVERS_INSIDE_REDLINE check — tiny gaps inside
// the boundary that no parcel covers. These two tests assert the change from
// both sides: a gap below the AREA_SUM_MISMATCH tolerance is now accepted, and
// a gap above it is still rejected, so nothing slipped through the removal.
function describeSubToleranceGapAccepted() {
  test.describe(
    'Upload baseline — sub-tolerance gap between parcels',
    { tag: '@regression' },
    () => {
      test('a 0.32 m² gap inside the redline is accepted and reaches the habitat list', async ({
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
          'Baseline - tiny gap between parcels.gpkg'
        )

        await expect(habitatListPage.heading).toBeVisible()
        await expect(habitatListPage.summaryTable).toBeVisible()

        // The upload was persisted, not merely rendered: the task list counts
        // Project Name + On-site baseline as Completed.
        await projectTaskListPage.open(id)
        await expect(projectTaskListPage.taskStatus('Completed')).toHaveCount(2)
      })
    }
  )
}

function describeOversizeGapStillRejected() {
  test.describe(
    'Upload baseline — gap too large to be a sliver',
    { tag: '@regression' },
    () => {
      // The counterpart to the test above, and the reason BMD-882 could delete
      // the derived check: parcels that genuinely fail to tile the redline are
      // caught by AREA_SUM_MISMATCH, which was left unchanged. Uses the harness
      // fixture built for this rule (parcels do not tile the RLB) rather than
      // the mutated "only area sum mismatch" file, so the gap itself is what
      // trips the check.
      test('parcels that do not tile the redline are rejected by the area-sum comparison', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        errorFilePage,
        page
      }) => {
        await uploadToErrorFile(
          {
            createProjectFlow,
            projectDashboardPage,
            uploadBaselineFileFlow,
            page
          },
          'Baseline - area sum mismatch.gpkg'
        )

        await expect(
          page.getByText(/does not equal redline boundary area/).first()
        ).toBeVisible()
        // AREA_SUM_MISMATCH has no finalised copy yet (BMD-592), so a lone
        // occurrence renders the placeholder variant.
        await expect(errorFilePage.placeholderHeading).toBeVisible()
      })
    }
  )
}

// ─── AREA_PARCELS_TOO_SMALL (BMD-882) ────────────────────────────────────────

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

// ─── Redline outside England ──────────────────────────────────────────────────

function describeOutsideEngland() {
  test.describe(
    'Upload baseline — redline outside England',
    { tag: '@regression' },
    () => {
      // The fixture trips REDLINE_OUTSIDE_ENGLAND alongside distinctiveness
      // and area-sum-mismatch errors, so the multi-error layout renders (the
      // BMD-405 placeholder variant needs exactly one error).
      test('uploading a file whose redline is outside England is rejected on the error-file page', async ({
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
          'Baseline - redline not in england.gpkg'
        )

        await page.waitForURL('/error-file', { timeout: UPLOAD_TIMEOUT })

        await expect(errorFilePage.errorSummary).toBeVisible()
        await expect(errorFilePage.errorSummary).toContainText(
          'Redline boundary is outside England'
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

// ─── Geometric validation gates (multi-error layout) ──────────────────────────

// Each fixture trips its named geometric gate, but every one also carries
// side errors from the shared base data (out-of-scope distinctiveness,
// area-sum-mismatch), so the grouped multi-error layout renders. The tests
// assert the gate's block heading inside the GOV.UK error summary.
const GEOMETRIC_GATE_CASES = [
  {
    title: 'rejects a self-intersecting redline boundary',
    fixture: 'Baseline - self intersecting redline.gpkg',
    summaryText: 'Redline boundary geometry is invalid'
  },
  {
    title: 'rejects a self-intersecting (bowtie) parcel',
    fixture: 'Baseline - bowtie parcel.gpkg',
    summaryText: 'One or more area habitat polygons have invalid geometry'
  },
  {
    title: 'rejects a hedgerow outside the redline boundary',
    fixture: 'Baseline - hedgerow outside.gpkg',
    summaryText:
      'One or more hedgerow habitats are not entirely within the redline boundary'
  },
  {
    title: 'rejects a watercourse outside the redline boundary',
    fixture: 'Baseline - watercourse outside.gpkg',
    summaryText:
      'One or more watercourse habitats are not entirely within the redline boundary'
  },
  {
    title: 'rejects a tree outside the redline boundary',
    fixture: 'Baseline - tree outside.gpkg',
    summaryText:
      'One or more trees are not entirely within the redline boundary'
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
const SINGLE_ERROR_CASES = [
  {
    // BMD-405 AC13: this case also asserts the inline "upload a new file" link
    // navigates (not just carries the href), folding what was a dedicated nav
    // test into this upload rather than running its own.
    title:
      'missing redline boundary shows the "redline boundary is missing" page',
    fixture: 'Baseline - no rlb polygons.gpkg',
    heading: GEOPACKAGE_ERROR_H1,
    body: 'The redline boundary is missing. Draw the red line boundary and',
    assertNavigation: true
  },
  {
    title:
      'multiple redline boundaries shows the "multiple red line boundaries" page',
    fixture: 'Baseline - three rlb polygons.gpkg',
    heading: GEOPACKAGE_ERROR_H1,
    body: 'This file contains multiple red line boundaries. Draw the red line boundary again and'
  },
  {
    title:
      'file without habitat parcels shows the "doesn\'t contain any parcels" page',
    fixture: 'Baseline - no habitats.gpkg',
    heading: GEOPACKAGE_ERROR_H1,
    body: "The file doesn't contain any parcels. Draw parcels within your red line boundary and"
  },
  {
    title: 'wrong column names shows the Natural England catch-all page',
    fixture: 'Baseline - wrong column names in Habitats.gpkg',
    heading: GEOPACKAGE_ERROR_H1,
    body: `${NATURAL_ENGLAND_MISMATCH_COPY}. Rename the layers and columns and`
  },
  // The "only …" fixtures below were generated by mutating the known-valid
  // "Baseline - complete with area refs.gpkg" so each trips exactly one
  // backend error (verified by uploading and inspecting the rendered page).
  {
    title:
      'self-intersecting redline alone shows the "boundary is overlapping itself" page',
    fixture: 'Baseline - only self intersecting redline.gpkg',
    heading: GEOPACKAGE_ERROR_H1,
    body: 'The redline boundary is overlapping itself. Draw the boundary again and'
  },
  {
    title:
      'self-intersecting parcel alone shows the personalised "parcel contains an error" page',
    fixture: 'Baseline - only bowtie parcel.gpkg',
    heading: /This parcel .+ contains an error/,
    body: 'This parcel is overlapping itself. Draw the parcel again and'
  },
  {
    title:
      'overlapping parcels alone show the personalised "parcels contain an error" page',
    fixture: 'Baseline - only overlapping parcels.gpkg',
    heading: /These parcels .+ contain an error/,
    body: 'These parcels are overlapping. Draw the parcels again and'
  },
  {
    title:
      'hedgerow outside the redline alone shows the personalised hedgerow page',
    fixture: 'Baseline - only hedgerow outside.gpkg',
    heading: /This hedgerow .+ contains an error/,
    body: 'This hedgerow is outside the red line boundary. Draw the hedgerow again and'
  },
  {
    title:
      'watercourse outside the redline alone shows the personalised watercourse page',
    fixture: 'Baseline - only watercourse outside.gpkg',
    heading: /This watercourse .+ contains an error/,
    body: 'This watercourse is outside the red line boundary. Draw the watercourse again and'
  },
  {
    title: 'redline outside England alone shows the placeholder page',
    fixture: 'Baseline - only redline not in england.gpkg',
    placeholder: true,
    body: 'Redline boundary is outside England'
  },
  {
    title: 'area sum mismatch alone shows the placeholder page',
    fixture: 'Baseline - only area sum mismatch.gpkg',
    placeholder: true,
    body: 'does not equal redline boundary area'
  },
  {
    // AREA_PARCELS_OUTSIDE_REDLINE always co-fires with its correlated
    // SLIVERS_OUTSIDE_REDLINE (same escaping geometry, reported from the
    // per-parcel and union-of-parcels angle). Frontend PR#160 fixed the
    // single-error check to compare against the de-duplicated visibleErrors
    // list instead of the raw error array, so this now renders the
    // personalised page (previously blocked — see git history for the
    // original SINGLE_ERROR_PENDING_FIXTURE_CASES entry and rationale).
    title:
      'parcel outside the redline alone shows the personalised parcel page',
    fixture: 'Baseline - only parcel outside redline.gpkg',
    heading: /This parcel .+ contains an error/,
    body: 'This parcel is outside the red line boundary. Draw the parcel again and'
  }
]

// BMD-405 copy that cannot be reached today: the valid base fixture has no
// IGGI or Urban Trees layers to mutate, and every generator fixture trips
// side errors. Needs a valid 5-layer base fixture first.
const SINGLE_ERROR_PENDING_FIXTURE_CASES = [
  {
    // single-error-copy.js maps SLIVERS_OUTSIDE_REDLINE to the "thin strip of
    // land" wording and that code is live, but nothing can reach it alone: the
    // only fixture that fires SLIVERS_OUTSIDE_REDLINE is `Baseline - only
    // parcel outside redline.gpkg`, where the frontend suppresses the sliver in
    // favour of the co-firing AREA_PARCELS_OUTSIDE_REDLINE.
    //
    // The fixture named below does not exist yet. To enable:
    //   1. generate a fixture whose parcels overhang the redline *without*
    //      tripping the per-parcel AREA_PARCELS_OUTSIDE_REDLINE check (the
    //      overhang must come from the dissolved union, not from one parcel)
    //   2. save it to test/example-files/ and move this into SINGLE_ERROR_CASES
    title: 'sliver geometry alone shows the "parcel is a sliver" page',
    fixture: 'Baseline - only parcel overhang.gpkg',
    heading: GEOPACKAGE_ERROR_H1,
    body: 'This parcel is a sliver (a thin strip of land). Draw the parcel again and'
  },
  {
    // BMD-882's replacement check. The multi-error path IS covered — see
    // describeParcelTooSmall() — but the personalised single-error copy is not:
    // `Baseline - parcel too small.gpkg` leaves the missing area uncompensated,
    // so AREA_SUM_MISMATCH co-fires and the grouped layout renders instead.
    //
    // The fixture named below does not exist yet. To enable:
    //   1. generate a variant where the sub-1 m² parcel's shortfall is absorbed
    //      by the neighbouring parcels, so the areas still tile the redline to
    //      within the 0.5 m² AREA_SUM_MISMATCH tolerance
    //   2. save it to test/example-files/ and move this into SINGLE_ERROR_CASES
    title:
      'parcel below the minimum area alone shows the personalised "parcel contains an error" page',
    fixture: 'Baseline - only parcel too small.gpkg',
    heading: /This parcel .+ contains an error/,
    body: 'This parcel is smaller than 1 square metre. Draw the parcel again and'
  },
  {
    title: 'IGGI outside the redline alone shows the placeholder page',
    fixture: 'Baseline - only iggi outside.gpkg',
    placeholder: true,
    body: 'One or more IGGIs are not entirely within the redline boundary'
  },
  {
    title: 'tree outside the redline alone shows the placeholder page',
    fixture: 'Baseline - only tree outside.gpkg',
    placeholder: true,
    body: 'One or more trees are not entirely within the redline boundary'
  },
  {
    // The REDLINE_AREA_TOO_LARGE gate is built (backend error-builders.js
    // emits "...exceeds the 100 sq km limit") but the harness has no >100 sq
    // km fixture yet.
    title: 'redline area too large alone shows the placeholder page',
    fixture: 'Baseline - redline area too large.gpkg',
    placeholder: true,
    body: 'exceeds the 100 sq km limit'
  }
]

function singleErrorTest(
  { title, fixture, heading, body, placeholder, assertNavigation },
  opts
) {
  const testFn = opts?.skip ? test.skip : test
  testFn(
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
      for (const pendingCase of SINGLE_ERROR_PENDING_FIXTURE_CASES) {
        singleErrorTest(pendingCase, { skip: true })
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

// ─── PARCEL_OVERLAPS without both feature refs (reachability unconfirmed) ─────

function describePartialOverlapRefs() {
  test.describe(
    'Upload baseline — overlap without both feature refs',
    { tag: '@regression' },
    () => {
      // single-error-copy.js's PARCEL_OVERLAPS handler falls back to "Some
      // parcels in this file are overlapping…" (generic H1, different body
      // copy from the two-ref case) when the backend sample doesn't carry both
      // feature_ref_a/feature_ref_b (or _a/_b fid). All current overlap
      // fixtures produce refs on both sides, so this branch is unreached. To
      // enable:
      //   1. confirm whether real GeoPackage data can produce an overlap
      //      sample missing a ref (e.g. an unref'd parcel) — may not be
      //      naturally reachable
      //   2. add the fixture and remove this test.skip
      test.skip('overlapping parcels with a missing feature ref show the generic fallback copy', async () => {})
    }
  )
}

// ─── Truncated error sample ("… and N more") ───────────────────────────────────

function describeTruncatedSample() {
  test.describe(
    'Upload baseline — truncated error sample',
    { tag: '@regression' },
    () => {
      // The multi-error layout appends "… and N more" when the backend's
      // details.count exceeds details.sample.length (backend SAMPLE_CAP = 50,
      // e.g. distinctiveness-check.js). No current fixture has 51+ offending
      // features of one type. To enable:
      //   1. generate a fixture with 51+ offenders of a single error type
      //      (e.g. via the mutate-and-verify technique used for the BMD-405
      //      single-defect fixtures)
      //   2. add it to test/example-files/ and remove this test.skip
      test.skip('a fixture with more than 50 offending features shows the "and N more" tail', async () => {})
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
  describeSubToleranceGapAccepted()
  describeOversizeGapStillRejected()
  describeParcelTooSmall()
  describeSuppression()
  describeDistinctivenessError()
  describeFieldValidation()
  describeOutsideEngland()
  describeGeometricGateErrors()
  describeSingleErrorDropout()
  describeUploaderRejection()
  describeUploadTimeout()
  describePartialOverlapRefs()
  describeTruncatedSample()
  describeIrreplaceableHabitat()
})
