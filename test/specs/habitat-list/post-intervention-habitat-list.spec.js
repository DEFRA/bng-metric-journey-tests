import { test, expect } from '@fixtures'
import { STORAGE_STATE, NO_ROLE_STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import { ProjectDashboardPage } from '@pages/project-dashboard.page.js'
import { CreateProjectFlow } from '@flows/project-management/create-project.flow.js'
import { UploadPostInterventionFileFlow } from '@flows/upload-post-intervention/upload-post-intervention-file.flow.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const UPLOAD_TIMEOUT = 120_000
const COMPLETE_POST_INTERVENTION_FILE = 'Post-intervention - complete.gpkg'
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

// Areas-table columns: Ref(0) Habitat type(1) Area(2) Distinctiveness(3)
// Condition(4) Units(5) Status(6).
const TREE_TYPE_COL = 1
const TREE_AREA_COL = 2
const TREE_UNITS_COL = 5

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
                row.getByRole('cell').nth(TREE_AREA_COL)
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
                .nth(TREE_UNITS_COL)
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
                .nth(TREE_TYPE_COL)
            ).toHaveText('Rural tree')
            await expect(
              postInterventionHabitatListPage
                .treeRowByRef('R002')
                .getByRole('cell')
                .nth(TREE_TYPE_COL)
            ).toHaveText('Rural tree')
            await expect(
              postInterventionHabitatListPage
                .treeRowByRef('U001')
                .getByRole('cell')
                .nth(TREE_TYPE_COL)
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
  }
)
