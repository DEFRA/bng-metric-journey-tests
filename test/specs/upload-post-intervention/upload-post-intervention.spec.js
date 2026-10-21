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
import { findPiRef, openPiTabFor } from '@utils/post-intervention-grid.js'
import { getLinearInterventionTypesProject } from '@utils/summary-projects.js'
import {
  AREA_HABITATS,
  HEDGEROWS,
  TILE_BASELINE
} from '@utils/unit-type-labels.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const PROJECT_LABEL = 'Upload post-intervention flow test'

// CDP Uploader must be running; meta-refresh polling can take up to 120 s in the
// worst case (esp. the real uploader in e2e), so allow the full window.
const UPLOAD_TIMEOUT = 120_000
const COMPLETE_FILE = 'Post-intervention - complete.gpkg'
// BMD-850 AC6 replacement pair: HEDGEROWS_FILE adds a Hedgerows layer
// (HR1-HR3, all Retained) that COMPLETE_FILE does not have.
// HEDGEROW_BASELINE_FILE is the baseline carrying the matching refs.
const HEDGEROWS_FILE = 'Post-intervention - complete with hedgerows.gpkg'
const HEDGEROW_BASELINE_FILE = 'Baseline - complete with hedgerow refs.gpkg'
const REPLACED_HEDGEROW_REF = 'HR3'
const COMPLETE_FILE_AREA_REF = 'H1'
// REMOVED 2026-09-01: STRUCTURAL_ERROR_FILE / the 'structural validation
// errors' describe. The fixture was
// 'Post-intervention (missing data) - fails validation.gpkg', a rename of the
// harness file 'Post-intervention - missing proposed habitat data.gpkg'
// (identical md5) — and the rename introduced the PARENTHESES that were doing
// all the rejecting. The backend gates the filename on SAFE_FILENAME_RE before
// reading a byte of content, and '(' was not in the whitelist. BMD-958
// (backend PR#280) added '()' so names like 'survey (1).gpkg' work; the name
// then passed, the content was validated for the first time, and it turned out
// to be VALID — the upload was accepted and persisted. The test had never once
// exercised content validation.
//
// Its assertions are all covered by the 'content validation errors' cases
// below, whose three single-layout fixtures each produce exactly one unmapped
// error and the same catch-all copy. Its two unique assertions (the PR#175
// negatives) were folded into that runner's single-error branch.
const FORMAT_ERROR_FILE = 'Not a valid geopackage.gpkg'
const FORMAT_ERROR_MESSAGE = 'The selected file must be a GeoPackage (.gpkg)'
const ERROR_SUMMARY_TITLE = 'There is a problem'
const RLB_NO_GEOMETRY_FILE =
  'Post-intervention - no geometry column in RLB layer.gpkg'
const RLB_MULTIPLE_GEOMETRY_FILE =
  'Post-intervention - multiple geometry columns in RLB layer.gpkg'
const RLB_WRONG_GEOMETRY_FILE =
  'Post-intervention - wrong geometry in RLB layer.gpkg'
// BMD-1060 AC3 (harness import-timing permutation). Every Created/Enhanced
// feature on all four layers sets advance 2 AND delay 3; HG003 is an Enhanced
// hedgerow with explicit 0/0 timing, which is valid and still priced.
const CONFLICTING_TIMING_BASELINE_FILE =
  'invalid-timing-conflicting-created-enhanced-baseline.gpkg'
const CONFLICTING_TIMING_PI_FILE =
  'invalid-timing-conflicting-created-enhanced-post-intervention.gpkg'
const CONFLICTING_TIMING_UNPRICED = [
  ['area', 'H001'],
  ['area', 'H002'],
  ['hedgerow', 'HG001'],
  ['hedgerow', 'HG002'],
  ['watercourse', 'R001'],
  ['watercourse', 'R002']
]
const ZERO_TIMING_HEDGEROW_REF = 'HG003'
const UNITS_2DP = /^\d+\.\d{2}$/
const DISTINCTIVENESS_FILE =
  'Post-intervention - habitat distinctiveness out of scope.gpkg'
const NATURAL_ENGLAND_MISMATCH_COPY =
  'The layer names and column names do not match what is required by Natural England'
// BMD-1058. One habitat's Parcel Ref is SQL NULL. Interim copy, pending UCD.
const MISSING_HABITAT_REF_FILE = 'Post-intervention - missing habitat ref.gpkg'
const HABITAT_REF_MISSING_COPY = 'All habitats must have a reference'
// BMD-1066 (harness PR#161). The valid all-types post-intervention file with
// the Baseline type cleared on five Retained or Enhanced rows: H002 (blank),
// H004 (N/A), HG011 ((no selection)), R003 (Null), T002 (blank).
const MISSING_BASELINE_TYPE_FILE =
  'Post-intervention - blank and placeholder baseline types on every layer.gpkg'
const BASELINE_TYPE_MISSING_COPY =
  'Some retained or enhanced habitats have no baseline habitat type'
const BASELINE_HEDGEROW_REFS = ['HR1', 'HR2']

// BMD-1066's Lost/Created split, read from the PI half of
// `getLinearInterventionTypesProject` (`Post-intervention - created linear
// features.gpkg`). The project uploads `Baseline - created linear features.gpkg`
// first, and that file carries the Created refs below too, so their absence
// is what proves the derived baseline replaced it.
const SPLIT_LOST_HEDGEROW_REFS = ['HG001', 'HG002', 'HG003', 'HG011', 'HG014']
const SPLIT_CREATED_HEDGEROW_REFS = ['HG005', 'HG010', 'HG013', 'HG018']
const SPLIT_BASELINE_HEDGEROW_COUNT = 14
const SPLIT_BASELINE_WATERCOURSE_REFS = ['R001', 'R002']
const SPLIT_LOST_TREE_REFS = [
  'T001',
  'T006',
  'T009',
  'T010',
  'T015',
  'T016',
  'T019',
  'T022'
]
const SPLIT_CREATED_TREE_REF = 'T005'
const SPLIT_BASELINE_TREE_COUNT = 26
const TREE_REF = /^T\d+$/
// One Lost row per type, as its Baseline columns read in the PI file. Sizes
// are geometry-derived, so they are compared to the Length column loosely.
const SPLIT_LOST_HEDGEROW = {
  ref: 'HG002',
  habitatType: 'Native hedgerow with trees',
  condition: 'Good (3)',
  km: 0.145
}
const SPLIT_LOST_WATERCOURSE = {
  ref: 'R002',
  habitatType: 'Canals',
  condition: 'Good (3)',
  km: 0.083
}
// BNG-587: a Small tree's size is the band's fixed area.
const SPLIT_LOST_TREE = {
  ref: 'T001',
  size: '0.0041ha',
  condition: 'Fairly Good (2.5)'
}
const KM_PRECISION = 2
const METRIC_TOOL_URL =
  'https://www.gov.uk/government/publications/statutory-biodiversity-metric-tools-and-guides'
const ERROR_FILE_URL = '/error-file'

// ─── E2E happy path ─────────────────────────────────────────────────────────

function describeHappyPath() {
  test.describe(
    'Upload post-intervention — happy path',
    { tag: ['@smoke', '@happy-path'] },
    () => {
      // BMD-1043 (frontend PR#352): a successful upload lands on the project
      // summary, and the project task list and post-intervention habitat list
      // are gone. The upload is made over a baseline because without one the
      // summary redirects to the upload-type page (BMD-1076) and the
      // post-intervention pages redirect — nothing would show the upload was
      // stored.
      test('uploading a valid .gpkg file reaches the project summary and lists its habitats', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        uploadPostInterventionFileFlow,
        projectSummaryPage,
        page
      }) => {
        // Two real uploads back this test.
        test.setTimeout(UPLOAD_TIMEOUT * 2)

        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        await uploadBaselineFileFlow.uploadFileAndWaitForSummary(
          id,
          HEDGEROW_BASELINE_FILE
        )
        await expect(
          projectSummaryPage.uploadPostInterventionLink(AREA_HABITATS)
        ).toBeVisible()
        await expect(projectSummaryPage.unitSection(HEDGEROWS)).toBeVisible()

        await uploadPostInterventionFileFlow.uploadFileAndWaitForSummary(
          id,
          COMPLETE_FILE
        )

        // BMD-1056 AC6: the upload replaced the uploaded baseline with one
        // derived from COMPLETE_FILE, which has no Hedgerows layer. The
        // baseline file's HR1/HR2 are gone rather than kept alongside it.
        await expect(projectSummaryPage.unitSection(HEDGEROWS)).toHaveCount(0)

        // The post-intervention document is stored: the summary stops offering
        // its upload, and the file's parcels are listed on the area habitats
        // post-intervention page.
        await expect(projectSummaryPage.heading).toBeVisible()
        await expect(
          projectSummaryPage.uploadPostInterventionLink(AREA_HABITATS)
        ).toHaveCount(0)
        const { unitPage, label } = await openPiTabFor(
          page,
          id,
          'area',
          COMPLETE_FILE_AREA_REF
        )
        await expect(
          unitPage.refLink(label, COMPLETE_FILE_AREA_REF)
        ).toBeVisible()
      })
    }
  )
}

// ─── Replacing an existing post-intervention upload ──────────────────────────

// BMD-850 AC6: a second post-intervention upload replaces the stored document
// wholesale — features in the old file and absent from the new one disappear,
// along with their units. Since BMD-1056/BMD-1066 (backend PR #478) it also
// replaces the baseline, derived again from the new file's non-Created rows.
//
// Sole browser witness for that. The backend counterpart
// (../bng-metric-backend/integration-tests/post-intervention-persistence.test.js,
// "AC6 replaces PI while leaving baseline unchanged") uploads the same fixture
// twice, so it can only assert the uploadId changed and the row counts match;
// it can neither show which file's features ended up stored nor that the pages
// re-render from them. The two fixtures below differ by a whole layer, which
// is what makes a replace distinguishable from a merge or a no-op.
function describePostInterventionReplacement() {
  test.describe(
    'Upload post-intervention — replacing an existing upload',
    { tag: '@regression' },
    () => {
      test('re-uploading replaces the post-intervention habitats and re-derives the baseline from the new file', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadPostInterventionFileFlow,
        hedgerowsBaselinePage,
        page
      }) => {
        // Two real uploads back this test. No baseline upload: the
        // post-intervention file derives its own (BMD-1056/BMD-1066).
        test.setTimeout(UPLOAD_TIMEOUT * 2)

        const { id, name } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )

        await uploadPostInterventionFileFlow.uploadFileAndWaitForSummary(
          id,
          HEDGEROWS_FILE
        )
        expect(
          await findPiRef(page, id, 'hedgerow', REPLACED_HEDGEROW_REF)
        ).not.toBeNull()
        // HR3 is Retained, so the derived baseline carries it too.
        await hedgerowsBaselinePage.open(id)
        await expect(
          hedgerowsBaselinePage.refLink(REPLACED_HEDGEROW_REF)
        ).toBeVisible()

        // COMPLETE_FILE carries no Hedgerows layer at all.
        await uploadPostInterventionFileFlow.uploadFileAndWaitForSummary(
          id,
          COMPLETE_FILE
        )

        // The new file's area habitats render...
        expect(
          await findPiRef(page, id, 'area', COMPLETE_FILE_AREA_REF)
        ).not.toBeNull()
        // ...and the previous file's hedgerows are gone rather than merged in,
        // from the post-intervention document and the derived baseline alike.
        expect(
          await findPiRef(page, id, 'hedgerow', REPLACED_HEDGEROW_REF)
        ).toBeNull()
        await hedgerowsBaselinePage.open(id)
        await expect(hedgerowsBaselinePage.heading).toBeVisible()
        await expect(
          hedgerowsBaselinePage.refLink(REPLACED_HEDGEROW_REF)
        ).toHaveCount(0)

        // BMD-1043 made every dashboard row link to the summary. Asserted here
        // for a project carrying both documents from real uploads; the
        // summary's own rendering for such a project is covered in
        // test/specs/project-management/project-summary.spec.js.
        await projectDashboardPage.open()
        await expect(projectDashboardPage.projectLink(name)).toHaveAttribute(
          'href',
          `/projects/${id}/project-summary`
        )
      })
    }
  )
}

// ─── Lost/Created split for hedgerows, watercourses and trees (BMD-1066) ─────

function expectLinearRowMatchesFile(row, expected) {
  expect(row.habitatType).toBe(expected.habitatType)
  expect(row.condition).toBe(expected.condition)
  expect(Number.parseFloat(row.size)).toBeCloseTo(expected.km, KM_PRECISION)
}

// Sole browser witness that a post-intervention upload keeps Lost hedgerows,
// watercourses and trees in the baseline it derives (AC1-AC3), and the only
// journey test that pins a Created tree in a post-intervention grid (AC6).
// The derivation is `derivedBaselineLayers` -> `isBaselineRow(..., { strict:
// true })` in the backend's save-upload-for-project.js / baseline-rows.js.
// `baseline-rows.test.js` covers the rule on hand-built features, and
// integration `post-intervention-persistence.test.js` ("AC5 creates the
// baseline from Lost, Retained and Enhanced rows...") on a real file, but it
// checks refs and counts only: no row's values, and no tree by ref. Deleting
// this test leaves nothing that shows the derived rows reach the baseline
// pages. It becomes redundant once that integration test asserts a Lost row's
// fields per type and the post-intervention tree refs. The Retained/Enhanced/
// Created hedgerow and watercourse grids (AC4, AC5) are covered in their own
// post-intervention specs.
function describeLinearAndTreeSplit() {
  test.describe(
    'Upload post-intervention — Lost/Created split for hedgerows, watercourses and trees',
    { tag: '@regression' },
    () => {
      test('Lost features stay in the derived baseline, Created ones reach only the post-intervention grids', async ({
        browser,
        hedgerowsBaselinePage,
        watercoursesBaselinePage,
        areaBaselinePage,
        areaPostInterventionPage
      }) => {
        // Two real uploads back this project when no earlier spec in the
        // worker has built it.
        test.setTimeout(UPLOAD_TIMEOUT * 2)
        const { id } = await getLinearInterventionTypesProject(browser)

        // AC1: hedgerows.
        await hedgerowsBaselinePage.open(id)
        const hedgerowRefs = await hedgerowsBaselinePage.columnValues('ref')
        expect(hedgerowRefs).toHaveLength(SPLIT_BASELINE_HEDGEROW_COUNT)
        expect(hedgerowRefs).toEqual(
          expect.arrayContaining(SPLIT_LOST_HEDGEROW_REFS)
        )
        for (const ref of SPLIT_CREATED_HEDGEROW_REFS) {
          expect(hedgerowRefs).not.toContain(ref)
        }
        const hedgerow = await hedgerowsBaselinePage.rowValues(
          SPLIT_LOST_HEDGEROW.ref
        )
        expectLinearRowMatchesFile(hedgerow, SPLIT_LOST_HEDGEROW)

        // AC2: watercourses. R003 is Created.
        await watercoursesBaselinePage.open(id)
        expect(await watercoursesBaselinePage.columnValues('ref')).toEqual(
          SPLIT_BASELINE_WATERCOURSE_REFS
        )
        const watercourse = await watercoursesBaselinePage.rowValues(
          SPLIT_LOST_WATERCOURSE.ref
        )
        expectLinearRowMatchesFile(watercourse, SPLIT_LOST_WATERCOURSE)

        // AC3: trees share the area baseline table with the habitat parcels.
        await areaBaselinePage.open(id)
        const treeRefs = (await areaBaselinePage.columnValues('ref')).filter(
          (ref) => TREE_REF.test(ref)
        )
        expect(treeRefs).toHaveLength(SPLIT_BASELINE_TREE_COUNT)
        expect(treeRefs).toEqual(expect.arrayContaining(SPLIT_LOST_TREE_REFS))
        expect(treeRefs).not.toContain(SPLIT_CREATED_TREE_REF)
        const tree = await areaBaselinePage.rowValues(SPLIT_LOST_TREE.ref)
        expect(tree.size).toBe(SPLIT_LOST_TREE.size)
        expect(tree.condition).toBe(SPLIT_LOST_TREE.condition)

        // AC6: the Created tree reaches the Created grid, and no Lost tree
        // reaches any grid.
        await areaPostInterventionPage.open(id)
        for (const label of ['Retained', 'Enhanced', 'Created']) {
          await areaPostInterventionPage.tab(label).click()
          const refs = await areaPostInterventionPage.columnValues(label, 'Ref')
          for (const ref of SPLIT_LOST_TREE_REFS) {
            expect(refs, `Lost ${ref} in the ${label} grid`).not.toContain(ref)
          }
          if (label === 'Created') {
            expect(refs).toContain(SPLIT_CREATED_TREE_REF)
          }
        }
      })
    }
  )
}

// ─── Failed replacement preserves the stored project ─────────────────────────

// BMD-1056 AC10: a post-intervention file with dropout errors leaves "the
// project data ... as it was before the failed upload". Every other
// post-intervention rejection in this file starts from an empty project, so
// none of them could tell a no-op from a wipe.
//
// Sole witness that a rejected post-intervention upload writes neither
// document, and the only journey test that reaches BASELINE_TYPE_MISSING. A PI
// upload replaces the baseline and the post-intervention document together
// (setProjectBaselineAndPostIntervention), so a validation step moved after
// that write would silently destroy the stored baseline. That is a different
// path from the baseline equivalent in upload-baseline.spec.js. The backend
// unit test (save-upload-for-project.test.js, "rejects a Retained or Enhanced
// row that has no baseline type") mocks persistence and hand-builds its rows;
// single-error-copy.test.js is handed a fabricated error. Do not delete
// without an integration test that uploads this fixture into a populated
// project and asserts both stored documents are untouched.
function describeFailedReplacement() {
  test.describe(
    'Upload post-intervention — failed replacement',
    { tag: '@regression' },
    () => {
      test('a file with a missing baseline habitat type is rejected and leaves the existing baseline intact', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        uploadPostInterventionFileFlow,
        projectSummaryPage,
        hedgerowsBaselinePage,
        errorFilePage,
        page
      }) => {
        // Two real uploads back this test.
        test.setTimeout(UPLOAD_TIMEOUT * 2)

        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        await uploadBaselineFileFlow.uploadFileAndWaitForSummary(
          id,
          HEDGEROW_BASELINE_FILE
        )
        const baselineUnits = await projectSummaryPage.tileValue(
          AREA_HABITATS,
          TILE_BASELINE
        )

        await uploadPostInterventionFileFlow.uploadFile(
          id,
          MISSING_BASELINE_TYPE_FILE
        )
        await page.waitForURL(ERROR_FILE_URL, { timeout: UPLOAD_TIMEOUT })

        await expect(errorFilePage.geopackageErrorHeading).toBeVisible()
        await expect(page.getByText(BASELINE_TYPE_MISSING_COPY)).toBeVisible()
        await expect(errorFilePage.uploadNewFileLink).toHaveAttribute(
          'href',
          `/projects/${id}/upload-post-intervention-file`
        )

        // Nothing was written: the uploaded baseline is still stored, and no
        // post-intervention document exists, so the summary still offers that
        // upload.
        await projectSummaryPage.open(id)
        expect(
          await projectSummaryPage.tileValue(AREA_HABITATS, TILE_BASELINE)
        ).toBe(baselineUnits)
        await expect(
          projectSummaryPage.uploadPostInterventionLink(AREA_HABITATS)
        ).toBeVisible()
        await hedgerowsBaselinePage.open(id)
        for (const ref of BASELINE_HEDGEROW_REFS) {
          await expect(hedgerowsBaselinePage.refLink(ref)).toBeVisible()
        }
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

// ─── Content validation errors (structure + data quality) ────────────────────

function describeContentValidationErrors() {
  // Each fixture exercises a distinct post-intervention validation failure
  // that surfaces on the shared error-file dropout page. Expected copy is
  // confirmed by uploading and inspecting the rendered page: fixtures that
  // surface exactly one backend error render the BMD-405 single-error layout
  // (`layout: 'single'` — no error summary); fixtures with several errors
  // keep the grouped multi-error layout (`layout: 'multi'`).
  //
  // DO NOT DELETE any of these as "covered by the backend". Checked in full
  // during the integration-overlap workshop (workshop/integration-overlap-ledger.md,
  // chunk 3): every one is the *only* test in any suite — journey, frontend
  // unit, backend unit, backend integration — that proves its error code is
  // ever emitted for a real GeoPackage. Per-case notes below.
  const cases = [
    {
      // Sole witness for GPKG_RLB_NO_GEOMETRY_COLUMN. Raised in the parse layer
      // (backend src/validation/geopackage/geopackage-internals-validate-features.js).
      // No backend unit test and no integration fixture reference the code; the
      // PostGIS suite works on synthetic geometry and never reads a .gpkg.
      name: 'a Red Line Boundary layer with no geometry column',
      file: RLB_NO_GEOMETRY_FILE,
      layout: 'single',
      expected: NATURAL_ENGLAND_MISMATCH_COPY
    },
    {
      // Sole witness for the multiple-geometry-column branch of the same parse
      // layer check — same coverage position as above.
      name: 'a Red Line Boundary layer with multiple geometry columns',
      file: RLB_MULTIPLE_GEOMETRY_FILE,
      layout: 'single',
      expected: NATURAL_ENGLAND_MISMATCH_COPY
    },
    {
      // Sole witness for the wrong-geometry-type branch.
      //
      // Was `layout: 'multi'` expecting "Zero red line boundaries in
      // GeoPackage (expecting one)" alongside the type mismatch. BMD-910
      // (backend PR#268, 2026-08-20) rewrote the parse layer into a
      // single-pass reader whose geometry counting depends on the layer
      // opening successfully — so once gpkg_geometry_columns registers the
      // wrong type, the polygon-count gate never runs and only the root-cause
      // mismatch is reported. The file is still rejected; what changed is that
      // the derived "zero boundaries" consequence no longer piles on, which
      // drops the page from the multi-error layout to the single-error one.
      name: 'a Red Line Boundary layer with the wrong geometry type',
      file: RLB_WRONG_GEOMETRY_FILE,
      layout: 'single',
      expected: NATURAL_ENGLAND_MISMATCH_COPY
    },
    {
      // BMD-1058 AC2. The post-intervention case of HABITAT_REF_MISSING: the
      // check is the same as for a baseline, so this proves the code reaches
      // the post-intervention page and its upload link. The invalid-characters
      // code runs through the same check and page, so it is not repeated.
      name: 'a habitat with no reference',
      file: MISSING_HABITAT_REF_FILE,
      layout: 'single',
      expected: HABITAT_REF_MISSING_COPY
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
            // The inline upload link must target the POST-INTERVENTION route,
            // not the baseline one — this is the validationUploadType routing.
            await expect(errorFilePage.uploadNewFileLink).toHaveAttribute(
              'href',
              `/projects/${id}/upload-post-intervention-file`
            )
            // QA fix (frontend PR#175): the single-error layout no longer
            // shows the "Upload a different file" button or the "Back to
            // project" link. Folded in here on 2026-09-01 from the deleted
            // 'structural validation errors' describe — see the note by
            // STRUCTURAL_ERROR_FILE's removal below.
            await expect(
              errorFilePage.uploadDifferentFileLink
            ).not.toBeVisible()
            await expect(errorFilePage.backToProjectLink).not.toBeVisible()
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

// ─── Conflicting advance and delay timing ────────────────────────────────────

// The Units cell of `ref` in whichever intervention tab holds it.
async function piUnitsCell(page, projectId, type, ref) {
  const { unitPage, label } = await openPiTabFor(page, projectId, type, ref)
  const index = await unitPage.columnIndex(label, 'Units')
  return unitPage
    .featureRows(label)
    .filter({ has: page.getByRole('link', { name: ref, exact: true }) })
    .locator('td')
    .nth(index)
}

function describeConflictingTiming() {
  test.describe(
    'Upload post-intervention — conflicting advance and delay timing',
    { tag: '@regression' },
    () => {
      // BMD-1060 AC3 + BMD-1070, backend PR #498. A Created/Enhanced feature
      // that sets both advance and delay above 0 is no longer rejected (the
      // BMD-883 ADVANCE_AND_DELAY_BOTH_SET check is gone): the upload is
      // accepted and both values are saved as null. Without timing the
      // feature cannot be priced, so it is saved with null units and status
      // Incomplete, and its Units cell is blank.
      //
      // Sole journey witness that a real GeoPackage with conflicting timing is
      // accepted and left unpriced on every linear and area layer. The rule is
      // covered by backend integration-tests/import-combinations.test.js
      // (it.each over timing combinations, asserting null + Incomplete), but
      // nothing else renders the result. HG003 (explicit 0/0) is the control:
      // it proves a zero is not mistaken for a conflict and cleared.
      test('a file whose Created and Enhanced features set both advance and delay is accepted and those features are left unpriced', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        uploadPostInterventionFileFlow,
        page
      }) => {
        // Two real uploads back this test.
        test.setTimeout(UPLOAD_TIMEOUT * 2)

        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        await uploadBaselineFileFlow.uploadFileAndWaitForSummary(
          id,
          CONFLICTING_TIMING_BASELINE_FILE
        )
        await uploadPostInterventionFileFlow.uploadFileAndWaitForSummary(
          id,
          CONFLICTING_TIMING_PI_FILE
        )

        for (const [type, ref] of CONFLICTING_TIMING_UNPRICED) {
          await expect(
            await piUnitsCell(page, id, type, ref),
            `${type} ${ref}`
          ).toHaveText('')
        }
        await expect(
          await piUnitsCell(page, id, 'hedgerow', ZERO_TIMING_HEDGEROW_REF)
        ).toHaveText(UNITS_2DP)
      })
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
      //
      // DO NOT DELETE as "the baseline test already covers distinctiveness".
      // That was proposed during the integration-overlap workshop and withdrawn
      // once the chain was traced (see workshop/integration-overlap-ledger.md,
      // chunk 3) — checkHabitatDistinctiveness is shared but *parameterised*,
      // and the backend has no test at all that the post-intervention route
      // passes variant: 'postIntervention'. Set that call site to 'baseline'
      // and every backend and frontend test still passes; only this upload
      // fails. A shared module is not shared coverage.
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
    describePostInterventionReplacement()
    describeLinearAndTreeSplit()
    describeFailedReplacement()
    describeNoPendingUpload()
    describeFormatError()
    describeContentValidationErrors()
    describeConflictingTiming()
    describeDistinctivenessError()
    describeCrossUserAccess()
    describeUploaderRejection()
    describeUploadTimeout()
  }
)
