import { test, expect } from '@fixtures'
import { STORAGE_STATE, NO_ROLE_STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import { ProjectDashboardPage } from '@pages/project-dashboard.page.js'
import { CreateProjectFlow } from '@flows/project-management/create-project.flow.js'
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

// BMD-531: no shipped post-intervention fixture passes validation while
// missing unit-calculation values, so this is a copy of the backend
// integration fixture `baseline-complete.gpkg` held in this repo's
// test/example-files/. Its Retained parcel H1 calculates units (Complete);
// its Enhanced parcels H2/H3 lack proposed type/condition and its linear
// features lack retention categories, so their units cannot be calculated
// (Incomplete).
const MIXED_STATUS_FILE =
  'Post-intervention - mixed complete and incomplete.gpkg'

// Areas-table columns: Ref(0) Habitat type(1) Area(2) Distinctiveness(3)
// Condition(4) Units(5) Status(6). UNITS_COL (5) and STATUS_COL (6) are
// shared by the Hedgerows and Watercourses tables, which use the same
// column layout.
const AREAS_HABITAT_TYPE_COL = 1
const AREAS_AREA_COL = 2
const UNITS_COL = 5
const STATUS_COL = 6
const UNITS_VALUE_PATTERN = /^\d+\.\d{2}$/

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
          const { name } = await uploadAndNavigateToHabitatList(
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

          // AC5: secondary upload button
          await expect(
            postInterventionHabitatListPage.uploadDifferentFileButton
          ).toBeVisible()
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
            const summarySize = (
              await postInterventionHabitatListPage.areaHabitatSizeCell.innerText()
            ).trim()
            const tableTotal = (
              await postInterventionHabitatListPage.areaTableTotalSizeCell.innerText()
            ).trim()
            expect(summarySize).toBe(tableTotal)
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

      test.describe('file with missing unit-calculation values', () => {
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
          'hedgerows and watercourses missing values show Incomplete with no units',
          { tag: '@regression' },
          async ({ postInterventionHabitatListPage, page }) => {
            await postInterventionHabitatListPage.open(projectId)

            // Hedgerows have no retention category → Incomplete.
            await postInterventionHabitatListPage.hedgerowsTab.click()
            for (const ref of ['H1', 'H2']) {
              await expect(
                postInterventionHabitatListPage
                  .hedgerowRowByRef(ref)
                  .getByRole('cell')
                  .nth(STATUS_COL)
              ).toHaveText('Incomplete')
            }
            await expectStatusUnitsPairing(
              postInterventionHabitatListPage.hedgerowsTable,
              page
            )

            // The watercourse has retention category "Null" → Incomplete.
            await postInterventionHabitatListPage.watercoursesTab.click()
            await expect(
              postInterventionHabitatListPage
                .watercourseRowByRef('R1')
                .getByRole('cell')
                .nth(STATUS_COL)
            ).toHaveText('Incomplete')
            await expectStatusUnitsPairing(
              postInterventionHabitatListPage.watercoursesTable,
              page
            )
          }
        )
      })
    })
  }
)
