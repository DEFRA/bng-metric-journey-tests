import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'

const TASK_BASELINE_HABITATS = 'On-site baseline habitats'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const PROJECT_LABEL = 'Upload baseline flow test'

// CDP Uploader must be running; meta-refresh polling can take up to 120 s in the
// worst case (esp. the real uploader in e2e), so allow the full window.
const UPLOAD_TIMEOUT = 120_000
const COMPLETE_BASELINE_FILE = 'Baseline - complete with area refs.gpkg'
const NATURAL_ENGLAND_MISMATCH_COPY =
  'The layer names and column names do not match what is required by Natural England'

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
        await expect(errorFilePage.uploadDifferentFileLink).toBeVisible()
        await expect(errorFilePage.uploadDifferentFileLink).toHaveAttribute(
          'href',
          `/projects/${id}/upload-baseline-file`
        )
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
    title: 'rejects a file with slivers inside the redline boundary',
    fixture: 'Baseline - sliver.gpkg',
    summaryText: 'Baseline file contains slivers inside the redline boundary'
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
    title:
      'missing redline boundary shows the "redline boundary is missing" page',
    fixture: 'Baseline - no rlb polygons.gpkg',
    heading: GEOPACKAGE_ERROR_H1,
    body: 'The redline boundary is missing. Draw the red line boundary and'
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
    // Slivers are uncovered gap pieces (BMD-300 AC7) carrying no parcel ref,
    // so the page uses the generic H1 rather than "This parcel {ref}…".
    title: 'sliver parcel alone shows the "parcel is a sliver" page',
    fixture: 'Baseline - only sliver.gpkg',
    heading: GEOPACKAGE_ERROR_H1,
    body: 'This parcel is a sliver (a thin strip of land). Draw the parcel again and'
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
  }
]

function singleErrorTest({ title, fixture, heading, body, placeholder }, opts) {
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
      await expect(errorFilePage.uploadDifferentFileLink).toHaveAttribute(
        'href',
        `/projects/${id}/upload-baseline-file`
      )
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

      // BMD-405 AC13: the inline link navigates, not just carries the href
      test('clicking "upload a new file" on the single-error page loads the upload form', async ({
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
          'Baseline - no rlb polygons.gpkg'
        )

        await errorFilePage.uploadNewFileLink.click()

        await expect(page).toHaveURL(
          new RegExp(`/projects/${id}/upload-baseline-file`)
        )
      })
    }
  )
}

// ─── Redline area too large (no fixture yet) ──────────────────────────────────

function describeAreaTooLarge() {
  test.describe(
    'Upload baseline — redline area too large',
    { tag: '@regression' },
    () => {
      // The REDLINE_AREA_TOO_LARGE gate is built (backend error-builders.js emits
      // "...exceeds the 100 sq km limit") but the harness has no >100 sq km fixture.
      // To enable once one exists:
      //   1. copy the >100 sq km fixture into test/example-files/
      //   2. replace the fixture name below and remove this test.skip
      test.skip('uploading a file whose redline area exceeds 100 sq km is rejected on the error-file page', async ({
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
          'Baseline - redline area too large.gpkg'
        )

        await page.waitForURL('/error-file', { timeout: UPLOAD_TIMEOUT })

        await expect(errorFilePage.errorSummary).toContainText(
          'exceeds the 100 sq km limit'
        )
      })
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
  describeFieldValidation()
  describeOutsideEngland()
  describeGeometricGateErrors()
  describeSingleErrorDropout()
  describeAreaTooLarge()
  describeIrreplaceableHabitat()
  describeBaselineHabitatDetailsFlow()
})
