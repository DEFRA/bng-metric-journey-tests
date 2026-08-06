import { test, expect } from '@fixtures'
import {
  STORAGE_STATE,
  NO_PROJECTS_STORAGE_STATE,
  skipInE2e,
  baseUrl
} from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import { CreateProjectFlow } from '@flows/project-management/create-project.flow.js'
import { UploadPostInterventionFileFlow } from '@flows/upload-post-intervention/upload-post-intervention-file.flow.js'
import { ProjectDashboardPage } from '@pages/project-dashboard.page.js'
import { ErrorFilePage } from '@pages/error-file.page.js'

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
const ADVANCE_AND_DELAY_FILE =
  'Post-intervention - advance and delay both set.gpkg'
const DISTINCTIVENESS_FILE =
  'Post-intervention - habitat distinctiveness out of scope.gpkg'
const NATURAL_ENGLAND_MISMATCH_COPY =
  'The layer names and column names do not match what is required by Natural England'
const ADVANCE_AND_DELAY_COPY =
  'A habitat has both advance and delayed creation set'
const METRIC_TOOL_URL =
  'https://www.gov.uk/government/publications/statutory-biodiversity-metric-tools-and-guides'
const ERROR_FILE_URL = '/error-file'

// ─── E2E happy path ─────────────────────────────────────────────────────────

function describeHappyPath() {
  test.describe(
    'Upload post-intervention — happy path',
    { tag: ['@smoke', '@happy-path'] },
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
      // One upload covers both the error-summary render and the link's
      // focus-move: the format error is a one-time session flash, so a fresh
      // navigation would lose it — the two assertions must share a page session.
      test('uploading a non-GeoPackage file shows the error summary, and its link moves focus to the file-selection button', async ({
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
        const errorLink = summary.getByRole('link', {
          name: FORMAT_ERROR_MESSAGE
        })
        await expect(errorLink).toBeVisible()

        await errorLink.click()

        await expect(
          uploadPostInterventionFilePage.chooseFileButton
        ).toBeFocused()
      })
    }
  )
}

// ─── Structural validation errors ────────────────────────────────────────────

async function uploadToErrorFile(fixtures, fixture) {
  const {
    createProjectFlow,
    projectDashboardPage,
    uploadPostInterventionFileFlow,
    page
  } = fixtures
  const { id } = await setupProject(
    createProjectFlow,
    projectDashboardPage,
    PROJECT_LABEL
  )
  await uploadPostInterventionFileFlow.uploadFile(id, fixture)
  await page.waitForURL(ERROR_FILE_URL, { timeout: UPLOAD_TIMEOUT })
  return id
}

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
        const id = await uploadToErrorFile(
          {
            createProjectFlow,
            projectDashboardPage,
            uploadPostInterventionFileFlow,
            page
          },
          STRUCTURAL_ERROR_FILE
        )

        await expect(errorFilePage.geopackageErrorHeading).toBeVisible()
        await expect(errorFilePage.errorSummary).not.toBeVisible()
        await expect(
          page.getByText(NATURAL_ENGLAND_MISMATCH_COPY)
        ).toBeVisible()
        await expect(errorFilePage.uploadNewFileLink).toHaveAttribute(
          'href',
          `/projects/${id}/upload-post-intervention-file`
        )
        // QA fix (frontend PR#175): the single-error layout no longer shows
        // the "Upload a different file" button or "Back to project" link.
        await expect(errorFilePage.uploadDifferentFileLink).not.toBeVisible()
        await expect(errorFilePage.backToProjectLink).not.toBeVisible()
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
      // BMD-883: the statutory metric rejects a habitat that sets both advance
      // and delayed creation. The check reads the Proposed advance/delay
      // columns, so it applies to a post-intervention file exactly as it does
      // to a baseline one.
      name: 'a habitat with both advance and delayed creation set',
      file: ADVANCE_AND_DELAY_FILE,
      layout: 'single',
      expected: ADVANCE_AND_DELAY_COPY
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
          const id = await uploadToErrorFile(
            {
              createProjectFlow,
              projectDashboardPage,
              uploadPostInterventionFileFlow,
              page
            },
            file
          )

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

// ─── High distinctiveness validation error ───────────────────────────────────

function describeDistinctivenessError() {
  test.describe(
    'Upload post-intervention — high distinctiveness habitat',
    { tag: '@regression' },
    () => {
      // The distinctiveness scope gate reads the *Proposed* habitat columns for
      // a post-intervention file (checkHabitatDistinctiveness is passed the
      // postIntervention variant) — wire it to the Baseline columns by mistake
      // and every baseline test still passes, so this needs its own coverage.
      // The fixture is built by test/example-files/fixture-mutations.py:
      // one parcel's proposed pair is retargeted at "Grassland - Lowland
      // meadows" (V.High), leaving exactly one visible error.
      test('uploading a file whose proposed habitat is High/Very High distinctiveness shows the distinctiveness single-error page', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadPostInterventionFileFlow,
        errorFilePage,
        page
      }) => {
        await uploadToErrorFile(
          {
            createProjectFlow,
            projectDashboardPage,
            uploadPostInterventionFileFlow,
            page
          },
          DISTINCTIVENESS_FILE
        )

        // BMD-405 AC6a: exactly one HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE error
        // renders the distinctiveness variant with a metric-tool link.
        await expect(errorFilePage.distinctivenessHeading).toBeVisible()
        await expect(errorFilePage.errorSummary).not.toBeVisible()
        await expect(errorFilePage.metricToolLink).toHaveAttribute(
          'href',
          METRIC_TOOL_URL
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

// ─── Cross-user access ───────────────────────────────────────────────────────

// The GET on the upload form does not check project ownership — it renders for
// any authenticated completer, because the projectId is only a path segment
// used to build the upload session. Ownership is enforced at validation time:
// the backend scopes the project to the caller's org context, so the save can't
// find it and the frontend surfaces the misleading catch-all error. Verified
// directly against the running stack (not inferred) before writing these
// assertions.
function describeCrossUserAccess() {
  test.describe(
    'Upload post-intervention — cross-user access',
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
            `/projects/${ownerProjectId}/upload-post-intervention-file`
          )
          // The GET step doesn't block on ownership — it renders the form
          // regardless (see comment above), so this is 200 not 404/403.
          expect(getResponse.status()).toBe(200)

          await new UploadPostInterventionFileFlow(otherPage).uploadFile(
            ownerProjectId,
            COMPLETE_FILE
          )
          await otherPage.waitForURL(ERROR_FILE_URL, {
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

// ─── Uploader-level rejection (reachability unconfirmed) ─────────────────────

function describeUploaderRejection() {
  test.describe(
    'Upload post-intervention — CDP Uploader rejection',
    { tag: '@regression' },
    () => {
      // The upload-received controller has a distinct `rejected` branch (clears
      // the session keys, stores an empty postInterventionValidationErrors
      // array, redirects to /error-file with the generic "We couldn't accept
      // your file" message) for files the CDP Uploader itself rejects — a
      // different code path from a `ready` status followed by our backend's own
      // GPKG/content validation. No fixture or technique in this repo currently
      // drives that branch (not a virus-scan test file, not an oversized file);
      // the client-side JS also blocks a non-.gpkg submit. To enable:
      //   1. confirm what makes the CDP Uploader return `rejected` (virus scan?
      //      MIME/size limit at the uploader layer specifically) and whether
      //      it's reproducible against the local/github stub
      //   2. add the fixture/technique and remove this test.skip
      test.skip('a file rejected by the CDP Uploader shows the generic error-file message', async () => {})
    }
  )
}

// ─── Upload timeout (impractical without a fast-forward hook) ────────────────

function describeUploadTimeout() {
  test.describe(
    'Upload post-intervention — upload check timeout',
    { tag: '@regression' },
    () => {
      // Elapsed > MAX_WAIT_SECONDS (120s, hardcoded in
      // habitat-upload-received-controller.js) clears the session, sets the
      // "The file check timed out. Please try again." flash on
      // postInterventionUploadError, and redirects to the upload form. A real
      // 2-minute wait isn't viable in this suite. To enable:
      //   1. make MAX_WAIT_SECONDS env-overridable in the frontend (test-only)
      //   2. drive a `pending` status for longer than the shortened window and
      //      assert the flash + redirect, then remove this test.skip
      test.skip('an upload stuck pending for over 120s shows the timeout flash on the upload form', async () => {})
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
    describeDistinctivenessError()
    describeCrossUserAccess()
    describeUploaderRejection()
    describeUploadTimeout()
  }
)
