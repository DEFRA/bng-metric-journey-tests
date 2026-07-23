import { test, expect } from '@fixtures'
import {
  STORAGE_STATE,
  NO_ROLE_STORAGE_STATE,
  NO_PROJECTS_STORAGE_STATE,
  skipInE2e,
  baseUrl
} from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import { ProjectDashboardPage } from '@pages/project-dashboard.page.js'
import { CreateProjectFlow } from '@flows/project-management/create-project.flow.js'
import { UploadBaselineFileFlow } from '@flows/upload-baseline/upload-baseline-file.flow.js'
import { UploadPostInterventionFileFlow } from '@flows/upload-post-intervention/upload-post-intervention-file.flow.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const UPLOAD_TIMEOUT = 120_000
const COMPLETE_POST_INTERVENTION_FILE = 'Post-intervention - complete.gpkg'
// BNG-529: no shipped post-intervention fixture contains hedgerows, so this is a
// synthesised file (Hedgerows layer added to the complete area fixture) held
// only in this repo's test/example-files/. Provisional — replace with a real
// surveyed post-intervention-with-hedgerows GeoPackage when one is available.
const HEDGEROWS_FILE = 'Post-intervention - complete with hedgerows.gpkg'
// BNG-530: as with hedgerows, no shipped post-intervention fixture contains
// watercourses, so this is a synthesised file (Rivers layer added to the
// complete area fixture) held only in this repo's test/example-files/.
// Provisional — replace with a real surveyed post-intervention-with-watercourses
// GeoPackage when one is available.
const WATERCOURSES_FILE = 'Post-intervention - complete with watercourses.gpkg'
// BMD-845: HEDGEROWS_FILE/WATERCOURSES_FILE are all-Retained, so they cannot
// prove the Intervention type column's Enhanced/Created value mapping. These
// mutate a copy of each (Retention Category only — HR1/WC1 stay Retained,
// HR2/WC2 Enhanced, HR3/WC3 Created) to close that gap.
const HEDGEROWS_MIXED_FILE =
  'Post-intervention - hedgerows mixed retention.gpkg'
const WATERCOURSES_MIXED_FILE =
  'Post-intervention - watercourses mixed retention.gpkg'
// BMD-722: baseline counterparts for HEDGEROWS_FILE/WATERCOURSES_FILE (Parcel
// Refs HR1/HR2 and WC1), the same baseline fixtures
// test/specs/habitat-details/post-intervention-habitat-details.spec.js uses.
// Their overlapping refs give Area habitats, Hedgerows and Watercourses each
// a non-zero baseline total, needed to populate the Summary table's Baseline
// units (and the net-change columns derived from it).
const HEDGEROW_BASELINE_FILE = 'Baseline - complete with hedgerow refs.gpkg'
const WATERCOURSE_BASELINE_FILE =
  'Baseline - complete with watercourse refs.gpkg'
const HTTP_BAD_REQUEST = 400
const VALID_UUID_V4 = 'aaaaaaaa-bbbb-4ccc-bddd-eeeeeeeeeeee'
const STUB_PROJECT_ID = '00000000-0000-0000-0000-000000000000'
const PROJECT_LABEL = 'Post-intervention habitat list test'

// Individual-tree fixtures (BNG-587). Notional per-size tree areas (ha):
// Small 0.0041, Medium 0.0163, Large 0.0366, Very large 0.0765.
const TREES_ALL_SIZES_FILE = 'Post-intervention - urban trees all sizes.gpkg'
const TREES_RURAL_URBAN_FILE = 'Post-intervention - rural and urban trees.gpkg'
const TREES_COMPLETE_FILE = 'Post-intervention - complete with trees.gpkg'
// TREES_COMPLETE_FILE holds 3 Medium trees → 3 × 0.0163 = 0.0489 ha total.
const TREES_COMPLETE_TOTAL_HA = 0.0489
// TREES_COMPLETE_FILE with tree T007's Retention Category set to Lost, so the
// backend drops it at import: T005/T006 remain, T007 is excluded (BMD-531/534).
const TREE_LOST_FILE = 'Post-intervention - trees with a lost tree.gpkg'

// BMD-531: Retained parcel H1 calculates units from the baseline side
// (Complete); Enhanced parcels H2/H3 lack proposed type/condition so their
// units cannot be calculated (Incomplete). The fixture's hedgerows (H1/H2) and
// river (R1) carry Retention Category "Lost", so the backend excludes them at
// import (BMD-531/534) — the file passes validation and those layers are empty.
const MIXED_STATUS_FILE =
  'Post-intervention - mixed complete and incomplete.gpkg'

// Post-intervention Areas-table columns (BMD-845 added the "Intervention
// type" column at index 1): Ref(0) Intervention type(1) Habitat type(2)
// Area(3) Distinctiveness(4) Condition(5) Units(6) Status(7). UNITS_COL (6)
// and STATUS_COL (7) are shared by the Hedgerows and Watercourses tables,
// which use the same column layout.
const INTERVENTION_TYPE_COL = 1
const AREAS_HABITAT_TYPE_COL = 2
const AREAS_AREA_COL = 3
const UNITS_COL = 6
const STATUS_COL = 7
const UNITS_VALUE_PATTERN = /^\d+\.\d{2}$/

// Summary table cell-value patterns (BMD-722): Baseline/Post-intervention
// units and Net unit change are signed decimals; Net % change is signed and
// %-suffixed; Size is ha-suffixed for Area habitats or km-suffixed for
// Hedgerows/Watercourses.
const SUMMARY_UNITS_PATTERN = /^-?\d+\.\d{2}$/
const SUMMARY_PERCENT_PATTERN = /^-?\d+(\.\d+)?%$/
const SUMMARY_AREA_SIZE_PATTERN = /^\d+(\.\d+)?ha$/
const SUMMARY_LENGTH_SIZE_PATTERN = /^\d+(\.\d+)?km$/

// BMD-839 AC1/AC2/AC3: each tab's headings and column order must be
// identical to the baseline-equivalent tab, plus the PI-only "Intervention
// type" column BMD-845 inserted at index 1. The size-column label differs
// per feature type (Area/Length/Size), matching the baseline tables.
const AREA_TABLE_COLUMNS = [
  'Ref',
  'Intervention type',
  'Habitat type',
  'Area',
  'Distinctiveness',
  'Condition',
  'Units',
  'Status'
]
const HEDGEROW_TABLE_COLUMNS = [
  'Ref',
  'Intervention type',
  'Habitat type',
  'Length',
  'Distinctiveness',
  'Condition',
  'Units',
  'Status'
]
const WATERCOURSE_TABLE_COLUMNS = [
  'Ref',
  'Intervention type',
  'Habitat type',
  'Size',
  'Distinctiveness',
  'Condition',
  'Units',
  'Status'
]

async function uploadAndNavigateToHabitatList(
  createProjectFlow,
  projectDashboardPage,
  uploadPostInterventionFileFlow,
  page,
  label
) {
  const { id, name } = await setupProject(
    createProjectFlow,
    projectDashboardPage,
    label
  )
  await uploadPostInterventionFileFlow.uploadFile(
    id,
    COMPLETE_POST_INTERVENTION_FILE
  )
  await page.waitForURL(
    new RegExp(`/projects/${id}/post-intervention-habitat-list`),
    { timeout: UPLOAD_TIMEOUT }
  )
  return { id, name }
}

// Create a project and upload a fixture once in its own context, returning the
// project id for read-only tests to navigate to. Sharing a single upload per
// fixture avoids CDP-uploader contention from many parallel uploads.
async function uploadFixtureInNewContext(browser, label, file) {
  const context = await browser.newContext({ storageState: STORAGE_STATE })
  const page = await context.newPage()
  try {
    const { id } = await setupProject(
      new CreateProjectFlow(page),
      new ProjectDashboardPage(page),
      label
    )
    await new UploadPostInterventionFileFlow(page).uploadFile(id, file)
    await page.waitForURL(
      new RegExp(`/projects/${id}/post-intervention-habitat-list`),
      { timeout: UPLOAD_TIMEOUT }
    )
    return id
  } finally {
    await context.close()
  }
}

// BMD-722: as uploadFixtureInNewContext, but uploads a baseline file first —
// needed for the Summary table's Baseline units (and the net-change columns
// derived from it), which every other fixture upload in this file skips.
async function uploadBaselineAndPiFixtureInNewContext(
  browser,
  label,
  baselineFile,
  piFile
) {
  const context = await browser.newContext({ storageState: STORAGE_STATE })
  const page = await context.newPage()
  try {
    const { id } = await setupProject(
      new CreateProjectFlow(page),
      new ProjectDashboardPage(page),
      label
    )
    await new UploadBaselineFileFlow(page).uploadFile(id, baselineFile)
    await page.waitForURL(new RegExp(`/projects/${id}/baseline-habitat-list`), {
      timeout: UPLOAD_TIMEOUT
    })
    await new UploadPostInterventionFileFlow(page).uploadFile(id, piFile)
    await page.waitForURL(
      new RegExp(`/projects/${id}/post-intervention-habitat-list`),
      { timeout: UPLOAD_TIMEOUT }
    )
    return id
  } finally {
    await context.close()
  }
}

// BMD-531 status/units pairing: every data row (rows carrying a ref link,
// which excludes the header and Total rows) shows a status of exactly
// "Complete" or "Incomplete"; a Complete row always shows a calculated
// Units value and an Incomplete row always shows an empty Units cell.
async function expectStatusUnitsPairing(table, page) {
  const dataRows = table
    .getByRole('row')
    .filter({ has: page.getByRole('link') })
  const rowCount = await dataRows.count()
  expect(rowCount).toBeGreaterThan(0)
  for (let i = 0; i < rowCount; i++) {
    const cells = dataRows.nth(i).getByRole('cell')
    const status = (await cells.nth(STATUS_COL).innerText()).trim()
    const units = (await cells.nth(UNITS_COL).innerText()).trim()
    expect(['Complete', 'Incomplete']).toContain(status)
    if (status === 'Complete') {
      expect(units).toMatch(UNITS_VALUE_PATTERN)
    } else {
      expect(units).toBe('')
    }
  }
}

// BMD-722: the Summary table's Size/Baseline units/Post-intervention
// units/Net unit change/Net % change cells (columns 1-5) for a given row
// label are all populated, matching the expected format per column.
async function expectSummaryRowPopulated(table, rowLabel, sizePattern) {
  const row = table.getByRole('row').filter({ hasText: rowLabel })
  const cells = row.getByRole('cell')
  await expect(cells.nth(1)).toHaveText(sizePattern)
  await expect(cells.nth(2)).toHaveText(SUMMARY_UNITS_PATTERN)
  await expect(cells.nth(3)).toHaveText(SUMMARY_UNITS_PATTERN)
  await expect(cells.nth(4)).toHaveText(SUMMARY_UNITS_PATTERN)
  await expect(cells.nth(5)).toHaveText(SUMMARY_PERCENT_PATTERN)
}

async function expectColumnHeaders(table, columns) {
  await expect(table.getByRole('columnheader')).toHaveText(columns)
}

test.describe(
  'post-intervention-habitat-list',
  { tag: '@habitat-list' },
  () => {
    test.describe(
      'Post-intervention habitat list — page display',
      { tag: '@smoke' },
      () => {
        test.use({ storageState: STORAGE_STATE })
        test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

        test('page renders header, summary section and buttons after upload', async ({
          createProjectFlow,
          projectDashboardPage,
          uploadPostInterventionFileFlow,
          postInterventionHabitatListPage,
          page
        }) => {
          const { id, name } = await uploadAndNavigateToHabitatList(
            createProjectFlow,
            projectDashboardPage,
            uploadPostInterventionFileFlow,
            page,
            PROJECT_LABEL
          )

          // AC1: page header — back button, project name, H1 title
          await expect(postInterventionHabitatListPage.backLink).toBeVisible()
          await expect(postInterventionHabitatListPage.caption).toHaveText(name)
          await expect(postInterventionHabitatListPage.heading).toBeVisible()
          await expect(postInterventionHabitatListPage.heading).not.toBeEmpty()

          // AC2: summary section — header, column headings, row labels
          await expect(
            postInterventionHabitatListPage.summaryHeading
          ).toBeVisible()
          await expect(
            postInterventionHabitatListPage.summaryTable
          ).toBeVisible()
          for (const col of [
            'Unit type',
            'Size',
            'Baseline units',
            'Post-intervention units',
            'Net unit change',
            'Net % change',
            'Trading rules satisfied'
          ]) {
            await expect(
              postInterventionHabitatListPage.summaryTable.getByRole(
                'columnheader',
                { name: col }
              )
            ).toBeVisible()
          }
          await expect(
            postInterventionHabitatListPage.summaryTable
              .getByRole('row')
              .filter({ hasText: 'Area habitats' })
          ).toBeVisible()
          await expect(
            postInterventionHabitatListPage.summaryTable
              .getByRole('row')
              .filter({ hasText: 'Hedgerows' })
          ).toBeVisible()
          await expect(
            postInterventionHabitatListPage.summaryTable
              .getByRole('row')
              .filter({ hasText: 'Watercourses' })
          ).toBeVisible()

          // AC4: Continue button
          await expect(
            postInterventionHabitatListPage.continueButton
          ).toBeVisible()
          await expect(
            postInterventionHabitatListPage.continueButton
          ).toHaveAttribute('href', `/add-project-details/${id}`)

          // AC5: secondary upload button
          await expect(
            postInterventionHabitatListPage.uploadDifferentFileButton
          ).toBeVisible()
          await expect(
            postInterventionHabitatListPage.uploadDifferentFileButton
          ).toHaveAttribute(
            'href',
            `/projects/${id}/upload-post-intervention-file`
          )
        })
      }
    )

    test.describe(
      'Post-intervention habitat list — tab interaction',
      { tag: '@regression' },
      () => {
        test.use({ storageState: STORAGE_STATE })
        test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

        test('3 tabs are displayed and tab-switching updates the selected tab', async ({
          createProjectFlow,
          projectDashboardPage,
          uploadPostInterventionFileFlow,
          postInterventionHabitatListPage,
          page
        }) => {
          await uploadAndNavigateToHabitatList(
            createProjectFlow,
            projectDashboardPage,
            uploadPostInterventionFileFlow,
            page,
            PROJECT_LABEL
          )

          // AC3: 3 tabs — Areas, Hedgerows, Watercourses
          await expect(postInterventionHabitatListPage.areasTab).toBeVisible()
          await expect(
            postInterventionHabitatListPage.hedgerowsTab
          ).toBeVisible()
          await expect(
            postInterventionHabitatListPage.watercoursesTab
          ).toBeVisible()

          await postInterventionHabitatListPage.hedgerowsTab.click()
          await expect(
            postInterventionHabitatListPage.hedgerowsTab
          ).toHaveAttribute('aria-selected', 'true')
          await expect(
            postInterventionHabitatListPage.areasTab
          ).toHaveAttribute('aria-selected', 'false')

          await postInterventionHabitatListPage.watercoursesTab.click()
          await expect(
            postInterventionHabitatListPage.watercoursesTab
          ).toHaveAttribute('aria-selected', 'true')
          await expect(
            postInterventionHabitatListPage.hedgerowsTab
          ).toHaveAttribute('aria-selected', 'false')
        })
      }
    )

    test.describe(
      'Post-intervention habitat list — route parameter validation',
      { tag: '@regression' },
      () => {
        test.use({ storageState: STORAGE_STATE })
        test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

        test('non-UUID id path param returns 400', async ({ page }) => {
          const response = await page.goto(
            '/projects/not-a-uuid/post-intervention-habitat-list'
          )
          expect(response.status()).toBe(HTTP_BAD_REQUEST)
        })
      }
    )

    test.describe('Post-intervention habitat list — role enforcement', () => {
      test.use({ storageState: NO_ROLE_STORAGE_STATE })
      test.skip(skipInE2e(NO_ROLE_STORAGE_STATE), E2E_SKIP_REASON)

      test(
        'authenticated user without BNG Completer role is redirected to /auth/forbidden',
        { tag: '@smoke' },
        async ({ page }) => {
          await page.goto(
            `/projects/${VALID_UUID_V4}/post-intervention-habitat-list`
          )
          await expect(page).toHaveURL(/\/auth\/forbidden/)
        }
      )
    })

    test.describe('Post-intervention habitat list — unauthenticated access', () => {
      test(
        'GET /projects/{id}/post-intervention-habitat-list redirects to sign-in',
        { tag: '@smoke' },
        async ({ page }) => {
          await page.goto(
            `/projects/${STUB_PROJECT_ID}/post-intervention-habitat-list`
          )
          await expect(page).not.toHaveURL(/\/post-intervention-habitat-list/)
          await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
        }
      )
    })

    // ─── Cross-user access ────────────────────────────────────────────────────
    // The backend scopes projects by owner (visibleToUser) and 404s a foreign
    // project id, so `fetchProject` resolves to a null habitats document here —
    // the page still renders (200), but with the generic "Project" caption and
    // no habitat rows. Unlike post-intervention-habitat-details (which 404s),
    // this route fails safe by omission rather than by status code, so the
    // assertion is on data non-leakage rather than the response status.

    test.describe(
      'Post-intervention habitat list — cross-user access',
      { tag: '@regression' },
      () => {
        test.skip(skipInE2e(NO_PROJECTS_STORAGE_STATE), E2E_SKIP_REASON)

        test('a different user opening the URL directly does not see the project owner’s habitat data', async ({
          browser
        }) => {
          const projectId = await uploadFixtureInNewContext(
            browser,
            PROJECT_LABEL,
            COMPLETE_POST_INTERVENTION_FILE
          )
          const otherContext = await browser.newContext({
            storageState: NO_PROJECTS_STORAGE_STATE,
            baseURL: baseUrl
          })
          try {
            const otherPage = await otherContext.newPage()
            await otherPage.goto(
              `/projects/${projectId}/post-intervention-habitat-list`
            )

            // None of the creator's project name or habitat data is rendered.
            await expect(otherPage.getByText(PROJECT_LABEL)).toBeHidden()
            await expect(
              otherPage.getByRole('link', { name: 'H1', exact: true })
            ).toBeHidden()
          } finally {
            await otherContext.close()
          }
        })
      }
    )

    // ─── Individual trees (BNG-587) ──────────────────────────────────────────
    // Per-habitat-type stored totals (AC2/AC4) are not surfaced in the UI; those
    // are covered by backend integration tests, not here. Each fixture is
    // uploaded once (beforeAll) and shared by its read-only tests; the section
    // runs serially to avoid CDP-uploader contention from parallel uploads.

    test.describe('Post-intervention habitat list — individual trees (BNG-587)', () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      test.describe('all tree sizes', () => {
        let projectId
        test.beforeAll(async ({ browser }) => {
          projectId = await uploadFixtureInNewContext(
            browser,
            PROJECT_LABEL,
            TREES_ALL_SIZES_FILE
          )
        })

        test(
          'AC1 — each individual tree shows the area for its size band',
          { tag: '@smoke' },
          async ({ postInterventionHabitatListPage }) => {
            await postInterventionHabitatListPage.open(projectId)

            const expectedAreas = [
              ['T001', '0.0041'], // Small
              ['T002', '0.0163'], // Medium
              ['T003', '0.0366'], // Large
              ['T004', '0.0765'] // Very large
            ]
            for (const [ref, area] of expectedAreas) {
              const row = postInterventionHabitatListPage.treeRowByRef(ref)
              await expect(row).toBeVisible()
              await expect(
                row.getByRole('cell').nth(AREAS_AREA_COL)
              ).toContainText(area)
            }
          }
        )

        test(
          'AC3 — each individual tree shows a calculated unit value',
          { tag: '@regression' },
          async ({ postInterventionHabitatListPage }) => {
            await postInterventionHabitatListPage.open(projectId)

            for (const ref of ['T001', 'T002', 'T003', 'T004']) {
              const units = postInterventionHabitatListPage
                .treeRowByRef(ref)
                .getByRole('cell')
                .nth(UNITS_COL)
              // a non-zero unit value is calculated and shown for each tree
              await expect(units).toHaveText(/[1-9]/)
            }
          }
        )
      })

      test.describe('rural and urban trees', () => {
        let projectId
        test.beforeAll(async ({ browser }) => {
          projectId = await uploadFixtureInNewContext(
            browser,
            PROJECT_LABEL,
            TREES_RURAL_URBAN_FILE
          )
        })

        test(
          'AC7 — each tree is listed as its own row, for both urban and rural types',
          { tag: '@regression' },
          async ({ postInterventionHabitatListPage }) => {
            await postInterventionHabitatListPage.open(projectId)

            // Fixture has 3 trees: 2 rural + 1 urban, each its own row.
            await expect(postInterventionHabitatListPage.treeRows).toHaveCount(
              3
            )
            await expect(
              postInterventionHabitatListPage
                .treeRowByRef('R001')
                .getByRole('cell')
                .nth(AREAS_HABITAT_TYPE_COL)
            ).toHaveText('Rural tree')
            await expect(
              postInterventionHabitatListPage
                .treeRowByRef('R002')
                .getByRole('cell')
                .nth(AREAS_HABITAT_TYPE_COL)
            ).toHaveText('Rural tree')
            await expect(
              postInterventionHabitatListPage
                .treeRowByRef('U001')
                .getByRole('cell')
                .nth(AREAS_HABITAT_TYPE_COL)
            ).toHaveText('Urban tree')
          }
        )
      })

      test.describe('lost tree exclusion', () => {
        let projectId
        test.beforeAll(async ({ browser }) => {
          projectId = await uploadFixtureInNewContext(
            browser,
            PROJECT_LABEL,
            TREE_LOST_FILE
          )
        })

        test(
          'a Lost individual tree is excluded from the list',
          { tag: '@regression' },
          async ({ postInterventionHabitatListPage }) => {
            await postInterventionHabitatListPage.open(projectId)

            // T005/T006 are Retained and listed; T007 is Lost, so the backend
            // drops it at import (BMD-531/534).
            await expect(postInterventionHabitatListPage.treeRows).toHaveCount(
              2
            )
            await expect(
              postInterventionHabitatListPage.treeRowByRef('T005')
            ).toHaveCount(1)
            await expect(
              postInterventionHabitatListPage.treeRowByRef('T007')
            ).toHaveCount(0)
          }
        )
      })

      test.describe('summary with trees', () => {
        let projectId
        test.beforeAll(async ({ browser }) => {
          projectId = await uploadFixtureInNewContext(
            browser,
            PROJECT_LABEL,
            TREES_COMPLETE_FILE
          )
        })

        test(
          'AC5 — Area habitats summary "Size" reflects the tree-inclusive Areas total',
          { tag: '@regression' },
          async ({ postInterventionHabitatListPage }) => {
            await postInterventionHabitatListPage.open(projectId)

            // The Areas table lists the trees; the summary Area-habitats Size
            // must equal that table's total, i.e. it includes the tree area.
            await expect(postInterventionHabitatListPage.treeRows).toHaveCount(
              3
            )
            const summarySize = parseFloat(
              (
                await postInterventionHabitatListPage.areaHabitatSizeCell.innerText()
              ).trim()
            )
            const tableTotal = parseFloat(
              (
                await postInterventionHabitatListPage.areaTableTotalSizeCell.innerText()
              ).trim()
            )
            // The summary rounds to 2dp (BMD-722); the table footer shows
            // full precision — compare numerically at the summary's
            // precision rather than requiring an exact string match.
            expect(summarySize).toBeCloseTo(tableTotal, 2)
          }
        )

        test(
          'AC6 — "Site" size excludes the tree hectares that Area habitats includes',
          { tag: '@regression' },
          async ({ postInterventionHabitatListPage }) => {
            await postInterventionHabitatListPage.open(projectId)

            const siteSize = parseFloat(
              (
                await postInterventionHabitatListPage.siteSizeCell.innerText()
              ).trim()
            )
            const areaHabitatsSize = parseFloat(
              (
                await postInterventionHabitatListPage.areaHabitatSizeCell.innerText()
              ).trim()
            )

            // Site excludes the special (tree) hectares Area habitats includes,
            // so Site = Area habitats − tree total. (The AC note's "Site > Area
            // habitats" is inverted; the actual relationship is Site < Area
            // habitats.)
            expect(siteSize).toBeLessThan(areaHabitatsSize)
            expect(areaHabitatsSize - siteSize).toBeCloseTo(
              TREES_COMPLETE_TOTAL_HA,
              4
            )
          }
        )
      })
    })

    // ─── Area habitat units (BNG-528) ────────────────────────────────────────
    // Each standard (non-tree) area habitat carries a calculated BNG unit value
    // (distinctiveness × condition × area), and the Areas-table footer sums
    // them. The persisted project total `postIntervention.units.habitatsTotal`
    // is NOT surfaced in the UI, so it is covered by back-end integration tests,
    // not here. The fixture is uploaded once (beforeAll) and shared by these
    // read-only tests.

    test.describe('Post-intervention habitat list — area habitat units (BNG-528)', () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // Expected calculated units for `Post-intervention - complete.gpkg`:
      // Ref → displayed Units. A V.Low sealed-surface parcel correctly
      // calculates to 0.00; habitats with distinctiveness + condition score
      // above zero.
      const expectedUnitsByRef = [
        ['H2-3', '2.65'], // Other neutral grassland — Medium / Good
        ['H2-2', '0.65'], // Modified grassland — Low / Moderate
        ['H1', '0.00'] // Developed land; sealed surface — V.Low
      ]
      // Footer Total sums the unrounded per-habitat units (4.09, not the 4.08
      // that summing the 2dp display values would give).
      const EXPECTED_UNITS_TOTAL = '4.09'

      let projectId
      test.beforeAll(async ({ browser }) => {
        projectId = await uploadFixtureInNewContext(
          browser,
          PROJECT_LABEL,
          COMPLETE_POST_INTERVENTION_FILE
        )
      })

      test(
        'each area habitat shows its calculated unit value',
        { tag: '@smoke' },
        async ({ postInterventionHabitatListPage }) => {
          await postInterventionHabitatListPage.open(projectId)

          for (const [ref, units] of expectedUnitsByRef) {
            await expect(
              postInterventionHabitatListPage
                .areaRowByRef(ref)
                .getByRole('cell')
                .nth(UNITS_COL)
            ).toHaveText(units)
          }
        }
      )

      test(
        'the Areas table footer Total sums the post-intervention units',
        { tag: '@regression' },
        async ({ postInterventionHabitatListPage }) => {
          await postInterventionHabitatListPage.open(projectId)

          await expect(
            postInterventionHabitatListPage.areaTableTotalUnitsCell
          ).toHaveText(EXPECTED_UNITS_TOTAL)
        }
      )
    })

    // ─── Hedgerow units (BNG-529) ────────────────────────────────────────────
    // Each post-intervention hedgerow carries a calculated BNG unit value
    // (distinctiveness × condition × length), and the Hedgerows-table footer
    // sums them. The persisted project total `postIntervention.units
    // .hedgerowsTotal` is NOT surfaced in the UI, so it is covered by back-end
    // integration tests, not here. PROVISIONAL: uses the synthesised
    // HEDGEROWS_FILE — replace with a real fixture when one exists.

    test.describe('Post-intervention habitat list — hedgerow units (BNG-529)', () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // Expected calculated units for the synthesised hedgerow fixture:
      // Ref → displayed Units (Low/Medium distinctiveness × condition × length).
      const expectedUnitsByRef = [
        ['HR1', '0.36'], // Native hedgerow — Low / Moderate, 0.09km
        ['HR2', '0.60'], // Native hedgerow w/ bank or ditch — Medium / Good, 0.05km
        ['HR3', '0.10'] // Native hedgerow — Low / Moderate, 0.024km
      ]
      const EXPECTED_UNITS_TOTAL = '1.06' // 0.36 + 0.60 + 0.10

      let projectId
      test.beforeAll(async ({ browser }) => {
        projectId = await uploadFixtureInNewContext(
          browser,
          PROJECT_LABEL,
          HEDGEROWS_FILE
        )
      })

      test(
        'each hedgerow shows its calculated unit value',
        { tag: '@smoke' },
        async ({ postInterventionHabitatListPage }) => {
          await postInterventionHabitatListPage.open(projectId)
          // The Hedgerows panel is tab-hidden until selected.
          await postInterventionHabitatListPage.hedgerowsTab.click()

          for (const [ref, units] of expectedUnitsByRef) {
            await expect(
              postInterventionHabitatListPage
                .hedgerowRowByRef(ref)
                .getByRole('cell')
                .nth(UNITS_COL)
            ).toHaveText(units)
          }
        }
      )

      test(
        'the Hedgerows table footer Total sums the post-intervention units',
        { tag: '@regression' },
        async ({ postInterventionHabitatListPage }) => {
          await postInterventionHabitatListPage.open(projectId)
          await postInterventionHabitatListPage.hedgerowsTab.click()

          await expect(
            postInterventionHabitatListPage.hedgerowTableTotalUnitsCell
          ).toHaveText(EXPECTED_UNITS_TOTAL)
        }
      )
    })

    // ─── Watercourse units (BNG-530) ─────────────────────────────────────────
    // Each post-intervention watercourse carries a calculated BNG unit value
    // (distinctiveness × condition × length × encroachment), and the
    // Watercourses-table footer sums them. The persisted project total
    // `postIntervention.units.watercoursesTotal` is NOT surfaced in the UI, so
    // it is covered by back-end integration tests, not here. PROVISIONAL: uses
    // the synthesised WATERCOURSES_FILE — replace with a real fixture when one
    // exists.

    test.describe('Post-intervention habitat list — watercourse units (BNG-530)', () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // Expected calculated units for the synthesised watercourse fixture:
      // Ref → displayed Units (Medium distinctiveness × Moderate condition,
      // no encroachment; units scale with length).
      const expectedUnitsByRef = [
        ['WC1', '0.72'], // Ditches — 0.09km
        ['WC2', '0.40'], // Ditches — 0.05km
        ['WC3', '0.19'] // Ditches — 0.024km
      ]
      const EXPECTED_UNITS_TOTAL = '1.31' // 0.72 + 0.40 + 0.19

      let projectId
      test.beforeAll(async ({ browser }) => {
        projectId = await uploadFixtureInNewContext(
          browser,
          PROJECT_LABEL,
          WATERCOURSES_FILE
        )
      })

      test(
        'each watercourse shows its calculated unit value',
        { tag: '@smoke' },
        async ({ postInterventionHabitatListPage }) => {
          await postInterventionHabitatListPage.open(projectId)
          // The Watercourses panel is tab-hidden until selected.
          await postInterventionHabitatListPage.watercoursesTab.click()

          for (const [ref, units] of expectedUnitsByRef) {
            await expect(
              postInterventionHabitatListPage
                .watercourseRowByRef(ref)
                .getByRole('cell')
                .nth(UNITS_COL)
            ).toHaveText(units)
          }
        }
      )

      test(
        'the Watercourses table footer Total sums the post-intervention units',
        { tag: '@regression' },
        async ({ postInterventionHabitatListPage }) => {
          await postInterventionHabitatListPage.open(projectId)
          await postInterventionHabitatListPage.watercoursesTab.click()

          await expect(
            postInterventionHabitatListPage.watercourseTableTotalUnitsCell
          ).toHaveText(EXPECTED_UNITS_TOTAL)
        }
      )
    })

    // ─── Summary data population (BMD-722) ───────────────────────────────────
    // The Summary table's Size, Baseline units, Post-intervention units, Net
    // unit change and Net % change columns are populated with persisted
    // project data for the Area habitats, Hedgerows and Watercourses rows
    // ("Trading rules satisfied" stays empty — out of scope). Baseline units
    // (and the net-change columns derived from it) are sourced from
    // `project.baseline.units`, so this needs a project that has been through
    // both a baseline and a post-intervention upload — every other describe
    // in this file uploads a post-intervention file only. HEDGEROW_BASELINE_FILE/
    // WATERCOURSE_BASELINE_FILE (Parcel Refs HR1/HR2 and WC1) are the same
    // baseline fixtures test/specs/habitat-details/post-intervention-habitat-details.spec.js
    // uses; paired here with this file's own HEDGEROWS_FILE/WATERCOURSES_FILE
    // (Refs HR1-3/WC1-3), whose overlapping HR1/HR2 and WC1 give Area
    // habitats, Hedgerows and Watercourses each a non-zero baseline total.

    test.describe('Post-intervention habitat list — summary data population (BMD-722)', () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      let hedgerowProjectId
      let watercourseProjectId
      test.beforeAll(async ({ browser }) => {
        hedgerowProjectId = await uploadBaselineAndPiFixtureInNewContext(
          browser,
          PROJECT_LABEL,
          HEDGEROW_BASELINE_FILE,
          HEDGEROWS_FILE
        )
        watercourseProjectId = await uploadBaselineAndPiFixtureInNewContext(
          browser,
          PROJECT_LABEL,
          WATERCOURSE_BASELINE_FILE,
          WATERCOURSES_FILE
        )
      })

      test(
        'AC1 — Area habitats and Hedgerows summary rows are populated with persisted baseline and post-intervention data',
        { tag: '@regression' },
        async ({ postInterventionHabitatListPage }) => {
          await postInterventionHabitatListPage.open(hedgerowProjectId)

          await expectSummaryRowPopulated(
            postInterventionHabitatListPage.summaryTable,
            'Area habitats',
            SUMMARY_AREA_SIZE_PATTERN
          )
          await expectSummaryRowPopulated(
            postInterventionHabitatListPage.summaryTable,
            'Hedgerows',
            SUMMARY_LENGTH_SIZE_PATTERN
          )
        }
      )

      test(
        'AC1 — Watercourses summary row is populated with persisted baseline and post-intervention data',
        { tag: '@regression' },
        async ({ postInterventionHabitatListPage }) => {
          await postInterventionHabitatListPage.open(watercourseProjectId)

          await expectSummaryRowPopulated(
            postInterventionHabitatListPage.summaryTable,
            'Watercourses',
            SUMMARY_LENGTH_SIZE_PATTERN
          )
        }
      )
    })

    // ─── Intervention type column (BMD-845) ──────────────────────────────────
    // BMD-845 added an "Intervention type" column (second column, between Ref
    // and Habitat type) to all three tab tables, showing each feature's
    // normalised retention category. COMPLETE_POST_INTERVENTION_FILE carries a
    // mix (H1 Retained, H2-3 Enhanced, H2-1 Lost imported as Created —
    // BMD-531/534); HEDGEROWS_MIXED_FILE/WATERCOURSES_MIXED_FILE carry the
    // same Retained/Enhanced/Created mix synthesised for hedgerows and
    // watercourses, since no shipped fixture has non-Retained linear features.

    test.describe('Post-intervention habitat list — intervention type column (BMD-845)', () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      test.describe('area habitats — mixed retention categories', () => {
        let projectId
        test.beforeAll(async ({ browser }) => {
          projectId = await uploadFixtureInNewContext(
            browser,
            PROJECT_LABEL,
            COMPLETE_POST_INTERVENTION_FILE
          )
        })

        test(
          'each area habitat shows its normalised retention category',
          { tag: '@smoke' },
          async ({ postInterventionHabitatListPage }) => {
            await postInterventionHabitatListPage.open(projectId)

            // BMD-839 AC1: headings and column order identical to the
            // baseline Areas tab, plus the Intervention type column.
            await expectColumnHeaders(
              postInterventionHabitatListPage.areaHabitatsTable,
              AREA_TABLE_COLUMNS
            )

            const expectedInterventionByRef = [
              ['H1', 'Retained'],
              ['H2-3', 'Enhanced'],
              ['H2-1', 'Created'] // Lost area habitat imported as Created (BMD-531/534)
            ]
            for (const [ref, intervention] of expectedInterventionByRef) {
              await expect(
                postInterventionHabitatListPage
                  .areaRowByRef(ref)
                  .getByRole('cell')
                  .nth(INTERVENTION_TYPE_COL)
              ).toHaveText(intervention)
            }
          }
        )
      })

      test.describe('hedgerows and watercourses — mixed retention categories', () => {
        let hedgerowsProjectId
        let watercoursesProjectId
        test.beforeAll(async ({ browser }) => {
          hedgerowsProjectId = await uploadFixtureInNewContext(
            browser,
            PROJECT_LABEL,
            HEDGEROWS_MIXED_FILE
          )
          watercoursesProjectId = await uploadFixtureInNewContext(
            browser,
            PROJECT_LABEL,
            WATERCOURSES_MIXED_FILE
          )
        })

        test(
          'each hedgerow shows its normalised retention category',
          { tag: '@regression' },
          async ({ postInterventionHabitatListPage }) => {
            await postInterventionHabitatListPage.open(hedgerowsProjectId)
            await postInterventionHabitatListPage.hedgerowsTab.click()

            // BMD-839 AC2: headings and column order identical to the
            // baseline Hedgerows tab, plus the Intervention type column.
            await expectColumnHeaders(
              postInterventionHabitatListPage.hedgerowsTable,
              HEDGEROW_TABLE_COLUMNS
            )
            const expectedInterventionByRef = [
              ['HR1', 'Retained'],
              ['HR2', 'Enhanced'],
              ['HR3', 'Created']
            ]
            for (const [ref, intervention] of expectedInterventionByRef) {
              await expect(
                postInterventionHabitatListPage
                  .hedgerowRowByRef(ref)
                  .getByRole('cell')
                  .nth(INTERVENTION_TYPE_COL)
              ).toHaveText(intervention)
            }
          }
        )

        test(
          'each watercourse shows its normalised retention category',
          { tag: '@regression' },
          async ({ postInterventionHabitatListPage }) => {
            await postInterventionHabitatListPage.open(watercoursesProjectId)
            await postInterventionHabitatListPage.watercoursesTab.click()

            // BMD-839 AC3: headings and column order identical to the
            // baseline Watercourses tab, plus the Intervention type column.
            await expectColumnHeaders(
              postInterventionHabitatListPage.watercoursesTable,
              WATERCOURSE_TABLE_COLUMNS
            )
            const expectedInterventionByRef = [
              ['WC1', 'Retained'],
              ['WC2', 'Enhanced'],
              ['WC3', 'Created']
            ]
            for (const [ref, intervention] of expectedInterventionByRef) {
              await expect(
                postInterventionHabitatListPage
                  .watercourseRowByRef(ref)
                  .getByRole('cell')
                  .nth(INTERVENTION_TYPE_COL)
              ).toHaveText(intervention)
            }
          }
        )
      })
    })

    // ─── Habitat status (BMD-531) ────────────────────────────────────────────
    // At import the backend assigns each feature a status: "Complete" when all
    // values required to calculate units are present, "Incomplete" when one or
    // more are missing — reflected in the Status column of all three tab
    // tables. A Complete row always shows a calculated Units value; an
    // Incomplete row never does. Each fixture is uploaded once (beforeAll) and
    // shared by its read-only tests; the section runs serially to avoid
    // CDP-uploader contention from parallel uploads.

    test.describe('Post-intervention habitat list — habitat status (BMD-531)', () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      test.describe('file with all required values', () => {
        let projectId
        test.beforeAll(async ({ browser }) => {
          projectId = await uploadFixtureInNewContext(
            browser,
            PROJECT_LABEL,
            COMPLETE_POST_INTERVENTION_FILE
          )
        })

        test(
          'every area habitat shows status Complete with a calculated unit value',
          { tag: '@smoke' },
          async ({ postInterventionHabitatListPage, page }) => {
            await postInterventionHabitatListPage.open(projectId)

            for (const ref of ['H1', 'H2-2', 'H2-3']) {
              const row = postInterventionHabitatListPage.areaRowByRef(ref)
              await expect(row.getByRole('cell').nth(STATUS_COL)).toHaveText(
                'Complete'
              )
              await expect(row.getByRole('cell').nth(UNITS_COL)).toHaveText(
                UNITS_VALUE_PATTERN
              )
            }
            await expectStatusUnitsPairing(
              postInterventionHabitatListPage.areaHabitatsTable,
              page
            )
          }
        )
      })

      test.describe('file with incomplete areas and Lost linear features', () => {
        let projectId
        test.beforeAll(async ({ browser }) => {
          projectId = await uploadFixtureInNewContext(
            browser,
            PROJECT_LABEL,
            MIXED_STATUS_FILE
          )
        })

        test(
          'area habitats missing proposed values show Incomplete with no units, alongside a Complete parcel',
          { tag: '@regression' },
          async ({ postInterventionHabitatListPage, page }) => {
            await postInterventionHabitatListPage.open(projectId)

            // H1 (Retained) calculates from baseline values → Complete;
            // H2/H3 (Enhanced) lack proposed type/condition → Incomplete.
            await expect(
              postInterventionHabitatListPage
                .areaRowByRef('H1')
                .getByRole('cell')
                .nth(STATUS_COL)
            ).toHaveText('Complete')
            for (const ref of ['H2', 'H3']) {
              const row = postInterventionHabitatListPage.areaRowByRef(ref)
              await expect(row.getByRole('cell').nth(STATUS_COL)).toHaveText(
                'Incomplete'
              )
              await expect(row.getByRole('cell').nth(UNITS_COL)).toHaveText('')
            }
            await expectStatusUnitsPairing(
              postInterventionHabitatListPage.areaHabitatsTable,
              page
            )
          }
        )

        test(
          'Lost hedgerows and watercourses are excluded from the list',
          { tag: '@regression' },
          async ({ postInterventionHabitatListPage }) => {
            await postInterventionHabitatListPage.open(projectId)

            // The fixture's hedgerows (H1/H2) and river (R1) all carry
            // Retention Category "Lost", so the backend drops them at import
            // (BMD-531/534) — their tabs contain no data rows.
            await postInterventionHabitatListPage.hedgerowsTab.click()
            for (const ref of ['H1', 'H2']) {
              await expect(
                postInterventionHabitatListPage.hedgerowRowByRef(ref)
              ).toHaveCount(0)
            }

            await postInterventionHabitatListPage.watercoursesTab.click()
            await expect(
              postInterventionHabitatListPage.watercourseRowByRef('R1')
            ).toHaveCount(0)
          }
        )
      })
    })
  }
)
