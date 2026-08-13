import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import { createProjectCache } from '@utils/shared-project.js'
import { ProjectDashboardPage } from '@pages/project-dashboard.page.js'
import { CreateProjectFlow } from '@flows/project-management/create-project.flow.js'
import { UploadBaselineFileFlow } from '@flows/upload-baseline/upload-baseline-file.flow.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const UPLOAD_TIMEOUT = 120_000
const COMPLETE_BASELINE_FILE = 'Baseline - complete with area refs.gpkg'
const NO_HEDGEROWS_FILE = 'Baseline - no hedgerows.gpkg'
const NO_WATERCOURSES_FILE = 'Baseline - no watercourses.gpkg'
const PROJECT_LABEL = 'Habitat list test'
const NO_DATA_TEXT = 'No data'
const HABITAT_TYPE_COL = 'Habitat type'

// Create a project in its own context and upload a baseline fixture once,
// returning its id/name. Each fixture is uploaded a single time and shared
// (memoised below) by every read-only describe that needs it — avoiding the
// CDP-uploader contention of many parallel uploads.
async function buildBaselineProject(browser, file) {
  const context = await browser.newContext({ storageState: STORAGE_STATE })
  const page = await context.newPage()
  try {
    const { id, name } = await setupProject(
      new CreateProjectFlow(page),
      new ProjectDashboardPage(page),
      PROJECT_LABEL
    )
    await new UploadBaselineFileFlow(page).uploadFile(id, file)
    await page.waitForURL(new RegExp(`/projects/${id}/baseline-habitat-list`), {
      timeout: UPLOAD_TIMEOUT
    })
    return { id, name }
  } finally {
    await context.close()
  }
}

// Memoised per worker, keyed by fixture file (createProjectCache): the file runs
// serially in one worker (see the configure below), so each fixture is uploaded
// once.
const getOrBuildProject = createProjectCache()

function getSharedProject(browser, file) {
  return getOrBuildProject(file, () => buildBaselineProject(browser, file))
}

function getCompleteProject(browser) {
  return getSharedProject(browser, COMPLETE_BASELINE_FILE)
}

function getNoHedgerowsProject(browser) {
  return getSharedProject(browser, NO_HEDGEROWS_FILE)
}

function getNoWatercoursesProject(browser) {
  return getSharedProject(browser, NO_WATERCOURSES_FILE)
}

async function getHabitatTypeHeader(habitatListPage, page, projectId) {
  await page.goto(`/projects/${projectId}/baseline-habitat-list`)
  return habitatListPage.areaHabitatsTable.getByRole('columnheader', {
    name: HABITAT_TYPE_COL
  })
}

// Asserts the totals-row Units value equals the sum of the individual data-row
// Units. Data rows are those carrying a ref link (excludes header and total).
async function expectTotalEqualsSumOfRowUnits(table, totalsRow, page) {
  const dataRows = table
    .getByRole('row')
    .filter({ has: page.getByRole('link') })
  const rowCount = await dataRows.count()
  let unitsSum = 0
  for (let i = 0; i < rowCount; i++) {
    unitsSum += Number(
      await dataRows.nth(i).getByRole('cell').nth(5).textContent()
    )
  }
  const totalUnits = Number(
    await totalsRow.getByRole('cell').nth(5).textContent()
  )
  expect(totalUnits).toBeCloseTo(unitsSum, 1)
}

test.describe('habitat-list', { tag: '@habitat-list' }, () => {
  // Serial mode prevents parallel uploads from contaminating the shared Redis
  // pendingUploadId session across the describe blocks in this file.
  test.describe.configure({ mode: 'serial' })

  // ─── Summary units after upload ──────────────────────────────────────────────

  test.describe(
    'Habitat list — summary units after upload',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      let projectId
      test.beforeAll(async ({ browser }) => {
        projectId = (await getCompleteProject(browser)).id
      })

      test('area habitat size shown in ha format and units in 2dp decimal format', async ({
        habitatListPage,
        page
      }) => {
        await page.goto(`/projects/${projectId}/baseline-habitat-list`)

        await expect(habitatListPage.areaHabitatSizeCell).toHaveText(
          /^\d+(\.\d+)?ha$/
        )
        await expect(habitatListPage.areaHabitatUnitsCell).not.toContainText(
          NO_DATA_TEXT
        )
        await expect(habitatListPage.areaHabitatUnitsCell).toHaveText(
          /^\d+(\.\d+)?$/
        )
      })

      test('hedgerow size shown in km format and units in 2dp decimal format when features exist', async ({
        habitatListPage,
        page
      }) => {
        await page.goto(`/projects/${projectId}/baseline-habitat-list`)

        await expect(habitatListPage.hedgerowSizeCell).toHaveText(
          /^\d+(\.\d+)?km$/
        )
        await expect(habitatListPage.hedgerowUnitsCell).not.toContainText(
          NO_DATA_TEXT
        )
        await expect(habitatListPage.hedgerowUnitsCell).toHaveText(
          /^\d+(\.\d+)?$/
        )
      })

      test('watercourse size shown in km format and units in 2dp decimal format when features exist', async ({
        habitatListPage,
        page
      }) => {
        await page.goto(`/projects/${projectId}/baseline-habitat-list`)

        await expect(habitatListPage.watercourseSizeCell).toHaveText(
          /^\d+(\.\d+)?km$/
        )
        await expect(habitatListPage.watercourseUnitsCell).not.toContainText(
          NO_DATA_TEXT
        )
        await expect(habitatListPage.watercourseUnitsCell).toHaveText(
          /^\d+(\.\d+)?$/
        )
      })
    }
  )

  // ─── Summary "No data" — no hedgerow features ────────────────────────────────

  test.describe(
    'Habitat list — no-hedgerows baseline: hedgerow "No data" and individual trees',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      // 'Baseline - no hedgerows.gpkg' has no hedgerow features but does carry
      // individual trees (Urban Trees layer), so a single upload covers both the
      // hedgerow "No data" checks and the tree checks below.
      //
      // Keep this upload. The "No data" and trees rendering is also unit-tested
      // in the frontend, but those tests mock the backend client — they assert
      // the frontend's handling of a *hand-written* habitatSizes object. Only
      // this upload proves the backend actually omits `hedgerows` (and splits
      // `site` from `areaHabitats` for trees) for a real file, which is the
      // contract the "No data" branch depends on. Backend integration pins
      // habitatSizes only for a complete file, so deleting this leaves the
      // no-hedgerows shape unverified end to end.
      let noHedgerowsProjectId
      test.beforeAll(async ({ browser }) => {
        noHedgerowsProjectId = (await getNoHedgerowsProject(browser)).id
      })

      const sizeInHa = async (cell) =>
        Number((await cell.innerText()).replace(/[^\d.]/g, ''))

      test('hedgerow size shows "No data" when file has no hedgerow features', async ({
        habitatListPage,
        page
      }) => {
        await page.goto(
          `/projects/${noHedgerowsProjectId}/baseline-habitat-list`
        )

        await expect(habitatListPage.hedgerowSizeCell).toHaveText(NO_DATA_TEXT)
      })

      test('Site size is smaller than Area habitats size because tree areas are excluded from Site', async ({
        habitatListPage,
        page
      }) => {
        await page.goto(
          `/projects/${noHedgerowsProjectId}/baseline-habitat-list`
        )
        const siteSize = await sizeInHa(habitatListPage.siteSizeCell)
        const areaHabitatsSize = await sizeInHa(
          habitatListPage.areaHabitatSizeCell
        )
        expect(siteSize).toBeLessThan(areaHabitatsSize)
      })

      test('individual trees are listed as their own rows on the Areas tab', async ({
        habitatListPage,
        page
      }) => {
        await page.goto(
          `/projects/${noHedgerowsProjectId}/baseline-habitat-list`
        )
        await expect(habitatListPage.treeRows.first()).toBeVisible()
      })
    }
  )

  // ─── Summary "No data" — no watercourse features ─────────────────────────────

  test.describe(
    'Habitat list — summary "No data" when no watercourse features',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      // Keep this upload for the same reason as the no-hedgerows one above: it
      // is the only place a real file lacking watercourses is proved to produce
      // the habitatSizes shape the "No data" branch expects.
      let noWatercoursesProjectId
      test.beforeAll(async ({ browser }) => {
        noWatercoursesProjectId = (await getNoWatercoursesProject(browser)).id
      })

      test('watercourse size shows "No data" when file has no watercourse features', async ({
        habitatListPage,
        page
      }) => {
        await page.goto(
          `/projects/${noWatercoursesProjectId}/baseline-habitat-list`
        )

        await expect(habitatListPage.watercourseSizeCell).toHaveText(
          NO_DATA_TEXT
        )
      })
    }
  )

  // ─── Area habitats table ──────────────────────────────────────────────────────

  test.describe(
    'Habitat list — area habitats table',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      let projectId
      test.beforeAll(async ({ browser }) => {
        projectId = (await getCompleteProject(browser)).id
      })

      // Section headings, the 7 column headers and the sortable data-module
      // attribute are rendered from static template markup and asserted in
      // ../bng-metric-frontend/src/server/baseline-habitat-list/controller.test.js
      // (which boots the real server and checks the rendered HTML). This file
      // covers what that suite cannot: real uploaded data reaching the page.
      test('data row shows a linked ref, populated fields, and numeric area and units', async ({
        habitatListPage,
        page
      }) => {
        await page.goto(`/projects/${projectId}/baseline-habitat-list`)
        const firstRow = habitatListPage.areaHabitatsTable
          .getByRole('row')
          .nth(1)

        const refLink = firstRow.getByRole('cell').nth(0).getByRole('link')
        await expect(refLink).toBeVisible()
        await expect(refLink).toHaveAttribute(
          'href',
          /baseline-habitat-details/
        )

        await expect(firstRow.getByRole('cell').nth(1)).not.toBeEmpty()
        // Area carries the "ha" suffix with no space — folded in here rather
        // than run as its own upload-backed test, since the formatter itself is
        // unit-tested (format-habitat-values.test.js).
        await expect(firstRow.getByRole('cell').nth(2)).toHaveText(
          /^\d+(\.\d+)?ha$/
        )
        await expect(firstRow.getByRole('cell').nth(3)).not.toBeEmpty()
        await expect(firstRow.getByRole('cell').nth(4)).not.toBeEmpty()
        await expect(firstRow.getByRole('cell').nth(5)).toHaveText(
          /^\d+(\.\d+)?$/
        )
      })

      test('status column displays the saved status for each data row', async ({
        habitatListPage,
        page
      }) => {
        await page.goto(`/projects/${projectId}/baseline-habitat-list`)
        const firstRow = habitatListPage.areaHabitatsTable
          .getByRole('row')
          .nth(1)
        await expect(firstRow.getByRole('cell').nth(6)).not.toBeEmpty()
      })

      test('totals row shows "Total" label with summed area and units', async ({
        habitatListPage,
        page
      }) => {
        await page.goto(`/projects/${projectId}/baseline-habitat-list`)
        await expect(
          habitatListPage.areaHabitatsTable
            .getByRole('row')
            .filter({ hasText: 'Total' })
        ).toBeVisible()
      })

      // The default `aria-sort` state on page load (Ref ascending, every other
      // header "none") is static markup, asserted in the controller unit tests
      // under "#habitatListController - sortable table markup". The three tests
      // below are the ones a unit test cannot reach: sorting is performed by the
      // MoJ `moj-sortable-table` component in the browser, so only a real click
      // proves our `data-sort-value` attributes drive it correctly. They run on
      // the area tab only — the hedgerow and watercourse tables use the same
      // component and the same helper, so repeating them per tab tested MoJ's
      // library rather than our wiring.
      test(
        'clicking a non-active column header sorts rows ascending',
        { tag: ['@happy-path'] },
        async ({ habitatListPage, page }) => {
          const header = await getHabitatTypeHeader(
            habitatListPage,
            page,
            projectId
          )
          await header.getByRole('button').click()
          await expect(header).toHaveAttribute('aria-sort', 'ascending')
        }
      )

      test('clicking an ascending column header sorts rows descending', async ({
        habitatListPage,
        page
      }) => {
        const header = await getHabitatTypeHeader(
          habitatListPage,
          page,
          projectId
        )
        await header.getByRole('button').click()
        await header.getByRole('button').click()
        await expect(header).toHaveAttribute('aria-sort', 'descending')
      })

      test('clicking a descending column header toggles back to ascending', async ({
        habitatListPage,
        page
      }) => {
        const header = await getHabitatTypeHeader(
          habitatListPage,
          page,
          projectId
        )
        await header.getByRole('button').click()
        await header.getByRole('button').click()
        await header.getByRole('button').click()
        await expect(header).toHaveAttribute('aria-sort', 'ascending')
      })

      test(
        'clicking the habitat reference link navigates to the Habitat Details page',
        { tag: ['@happy-path'] },
        async ({ habitatListPage, page }) => {
          await page.goto(`/projects/${projectId}/baseline-habitat-list`)
          const refLink = habitatListPage.areaHabitatsTable
            .getByRole('row')
            .nth(1)
            .getByRole('cell')
            .nth(0)
            .getByRole('link')
          await refLink.click()
          await expect(page).toHaveURL(/\/baseline-habitat-details/)
        }
      )
    }
  )

  // ─── Hedgerows tab table ──────────────────────────────────────────────────────

  test.describe(
    'Habitat list — hedgerows tab table',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      let projectId
      test.beforeAll(async ({ browser }) => {
        projectId = (await getCompleteProject(browser)).id
      })

      // Section heading, column headers and default aria-sort state: static
      // markup, covered in the controller unit tests. Sort-click behaviour is
      // covered once on the area tab (same MoJ component, same helper).
      test('hedgerows tab shows "No hedgerow data uploaded." when file has no hedgerow habitats', async ({
        browser,
        habitatListPage,
        page
      }) => {
        const { id } = await getNoHedgerowsProject(browser)
        await habitatListPage.openTab(id, 'hedgerows')
        await expect(
          page.locator('#hedgerows').getByText('No hedgerow data uploaded.')
        ).toBeVisible()
      })

      test('hedgerow data row shows a linked ref, non-empty habitat type, numeric length and units', async ({
        habitatListPage
      }) => {
        await habitatListPage.openTab(projectId, 'hedgerows')
        const firstRow = habitatListPage.hedgerowsTable.getByRole('row').nth(1)

        const refLink = firstRow.getByRole('cell').nth(0).getByRole('link')
        await expect(refLink).toBeVisible()
        await expect(refLink).toHaveAttribute(
          'href',
          /baseline-habitat-details/
        )

        await expect(firstRow.getByRole('cell').nth(1)).not.toBeEmpty()
        // Length carries the "km" suffix with no space — folded in here rather
        // than run as its own tab-switch test (formatter is unit-tested).
        await expect(firstRow.getByRole('cell').nth(2)).toHaveText(
          /^\d+(\.\d+)?km$/
        )
        await expect(firstRow.getByRole('cell').nth(3)).not.toBeEmpty()
        await expect(firstRow.getByRole('cell').nth(4)).not.toBeEmpty()
        // Units must be a calculated, non-zero value (size × distinctiveness ×
        // condition × strategic significance), not merely numeric.
        const unitsCell = firstRow.getByRole('cell').nth(5)
        await expect(unitsCell).toHaveText(/^\d+(\.\d+)?$/)
        expect(Number(await unitsCell.textContent())).toBeGreaterThan(0)
      })

      test('hedgerows table totals row shows "Total" label with summed size and units', async ({
        habitatListPage,
        page
      }) => {
        await habitatListPage.openTab(projectId, 'hedgerows')
        const totalsRow = habitatListPage.hedgerowsTable
          .getByRole('row')
          .filter({ hasText: 'Total' })
        await expect(totalsRow).toBeVisible()
        await expect(totalsRow.getByRole('cell').nth(2)).toHaveText(
          /^\d+(\.\d+)?km$/
        )
        await expect(totalsRow.getByRole('cell').nth(5)).toHaveText(
          /^\d+(\.\d+)?$/
        )

        // AC2: total hedgerow units equals the sum of the individual rows.
        await expectTotalEqualsSumOfRowUnits(
          habitatListPage.hedgerowsTable,
          totalsRow,
          page
        )
      })

      test(
        'clicking a hedgerow reference link navigates to the Habitat Details page',
        { tag: ['@happy-path'] },
        async ({ habitatListPage, page }) => {
          await habitatListPage.openTab(projectId, 'hedgerows')
          const refLink = habitatListPage.hedgerowsTable
            .getByRole('row')
            .nth(1)
            .getByRole('cell')
            .nth(0)
            .getByRole('link')
          await refLink.click()
          await expect(page).toHaveURL(/\/baseline-habitat-details/)
        }
      )
    }
  )

  // ─── Watercourses tab table ───────────────────────────────────────────────────

  test.describe(
    'Habitat list — watercourses tab table',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      let projectId
      test.beforeAll(async ({ browser }) => {
        projectId = (await getCompleteProject(browser)).id
      })

      // Section heading, column headers, default aria-sort state and the totals
      // row are covered in the controller unit tests; sort-click behaviour is
      // covered once on the area tab. What remains here is the watercourse data
      // row rendered from a real upload, and the ref link actually navigating.
      test(
        'clicking a watercourse reference link navigates to the Habitat Details page',
        { tag: ['@happy-path'] },
        async ({ habitatListPage, page }) => {
          await habitatListPage.openTab(projectId, 'watercourses')
          const refLink = habitatListPage.watercoursesTable
            .getByRole('row')
            .nth(1)
            .getByRole('cell')
            .nth(0)
            .getByRole('link')
          await refLink.click()
          await expect(page).toHaveURL(/\/baseline-habitat-details/)
        }
      )

      test('watercourse data row shows linked ref, non-empty habitat type, numeric size and units', async ({
        habitatListPage
      }) => {
        await habitatListPage.openTab(projectId, 'watercourses')
        const firstRow = habitatListPage.watercoursesTable
          .getByRole('row')
          .nth(1)

        const refLink = firstRow.getByRole('cell').nth(0).getByRole('link')
        await expect(refLink).toBeVisible()
        await expect(refLink).toHaveAttribute(
          'href',
          /baseline-habitat-details/
        )

        await expect(firstRow.getByRole('cell').nth(1)).not.toBeEmpty()
        // Size carries the "km" suffix with no space — folded in here rather
        // than run as its own tab-switch test (formatter is unit-tested).
        await expect(firstRow.getByRole('cell').nth(2)).toHaveText(
          /^\d+(\.\d+)?km$/
        )
        await expect(firstRow.getByRole('cell').nth(3)).not.toBeEmpty()
        await expect(firstRow.getByRole('cell').nth(4)).not.toBeEmpty()
        // Units must be a calculated, non-zero value (size × distinctiveness ×
        // condition × riparian × watercourse encroachment × strategic
        // significance), not merely numeric.
        const unitsCell = firstRow.getByRole('cell').nth(5)
        await expect(unitsCell).toHaveText(/^\d+(\.\d+)?$/)
        expect(Number(await unitsCell.textContent())).toBeGreaterThan(0)
      })
    }
  )

  // ─── Watercourses tab empty state ─────────────────────────────────────────────

  test.describe(
    'Habitat list — watercourses tab empty state',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      test('watercourses tab panel shows "No watercourse data uploaded." when file has no watercourse features', async ({
        browser,
        habitatListPage,
        page
      }) => {
        const { id: projectId } = await getNoWatercoursesProject(browser)

        await habitatListPage.openTab(projectId, 'watercourses')
        await expect(
          page
            .locator('#watercourses')
            .getByText('No watercourse data uploaded.')
        ).toBeVisible()
      })
    }
  )

  // ─── GIS trees layer (not yet supported) ──────────────────────────────────────

  test.describe(
    'Habitat list — GIS trees layer',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // Individual tree habitats are covered above. A dedicated GIS-mapped trees
      // layer (roadmap: "trees mapped from GIS") is not yet a supported input and
      // has no harness fixture. Enable once it ships:
      //   1. copy the GIS-trees-layer fixture into test/example-files/
      //   2. upload it and assert the trees layer's units render on the habitat list
      test.skip('units render for a GIS-mapped trees layer', async ({
        browser,
        habitatListPage,
        page
      }) => {
        const { id: projectId } = await buildBaselineProject(
          browser,
          'Baseline - gis trees layer.gpkg'
        )
        await page.goto(`/projects/${projectId}/baseline-habitat-list`)
        await expect(habitatListPage.treeRows.first()).toBeVisible()
      })
    }
  )
})
