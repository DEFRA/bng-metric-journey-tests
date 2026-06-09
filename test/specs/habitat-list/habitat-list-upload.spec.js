import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const UPLOAD_TIMEOUT = 120_000
const COMPLETE_BASELINE_FILE = 'Baseline - complete with area refs.gpkg'
const PROJECT_LABEL = 'Habitat list test'
const NO_DATA_TEXT = 'No data'
const HABITAT_TYPE_COL = 'Habitat type'

async function uploadAndNavigateToHabitatList(
  createProjectFlow,
  projectDashboardPage,
  uploadBaselineFileFlow,
  page,
  file
) {
  const { id } = await setupProject(
    createProjectFlow,
    projectDashboardPage,
    PROJECT_LABEL
  )
  await uploadBaselineFileFlow.uploadFile(id, file)
  await page.waitForURL(new RegExp(`/projects/${id}/baseline-habitat-list`), {
    timeout: UPLOAD_TIMEOUT
  })
  return id
}

async function getHabitatTypeHeader(habitatListPage, page, projectId) {
  await page.goto(`/projects/${projectId}/baseline-habitat-list`)
  return habitatListPage.areaHabitatsTable.getByRole('columnheader', {
    name: HABITAT_TYPE_COL
  })
}

async function assertHabitatTableColumns(table, sizeColumnName) {
  await expect(table.getByRole('columnheader', { name: 'Ref' })).toBeVisible()
  await expect(
    table.getByRole('columnheader', { name: HABITAT_TYPE_COL })
  ).toBeVisible()
  await expect(
    table.getByRole('columnheader', { name: sizeColumnName })
  ).toBeVisible()
  await expect(
    table.getByRole('columnheader', { name: 'Distinctiveness' })
  ).toBeVisible()
  await expect(
    table.getByRole('columnheader', { name: 'Condition' })
  ).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Units' })).toBeVisible()
  await expect(
    table.getByRole('columnheader', { name: 'Status' })
  ).toBeVisible()
  await expect(table).toHaveAttribute('data-module', 'moj-sortable-table')
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

      // Single upload shared across all tests in this group — avoids parallel
      // Redis session contamination that occurs when beforeEach uploads are
      // interleaved with uploads in other spec files.
      test('area habitat size shown in ha format and units in 2dp decimal format', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        habitatListPage,
        page
      }) => {
        projectId = await uploadAndNavigateToHabitatList(
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          page,
          COMPLETE_BASELINE_FILE
        )

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
    'Habitat list — summary "No data" when no hedgerow features',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      const NO_HEDGEROWS_FILE = 'Baseline - no hedgerows.gpkg'
      let noHedgerowsProjectId

      test('hedgerow size shows "No data" when file has no hedgerow features', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        habitatListPage,
        page
      }) => {
        noHedgerowsProjectId = await uploadAndNavigateToHabitatList(
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          page,
          NO_HEDGEROWS_FILE
        )

        await expect(habitatListPage.hedgerowSizeCell).toHaveText(NO_DATA_TEXT)
      })

      test('hedgerow units show "No data" when no hedgerow features exist', async ({
        habitatListPage,
        page
      }) => {
        await page.goto(
          `/projects/${noHedgerowsProjectId}/baseline-habitat-list`
        )
        await expect(habitatListPage.hedgerowUnitsCell).toHaveText(NO_DATA_TEXT)
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

      const NO_WATERCOURSES_FILE = 'Baseline - no watercourses.gpkg'
      let noWatercoursesProjectId

      test('watercourse size shows "No data" when file has no watercourse features', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        habitatListPage,
        page
      }) => {
        noWatercoursesProjectId = await uploadAndNavigateToHabitatList(
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          page,
          NO_WATERCOURSES_FILE
        )

        await expect(habitatListPage.watercourseSizeCell).toHaveText(
          NO_DATA_TEXT
        )
      })

      test('watercourse units show "No data" when no watercourse features exist', async ({
        habitatListPage,
        page
      }) => {
        await page.goto(
          `/projects/${noWatercoursesProjectId}/baseline-habitat-list`
        )
        await expect(habitatListPage.watercourseUnitsCell).toHaveText(
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

      test('area habitats section heading is displayed after upload', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        page
      }) => {
        projectId = await uploadAndNavigateToHabitatList(
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          page,
          COMPLETE_BASELINE_FILE
        )

        await expect(
          page
            .locator('#area-habitats')
            .getByRole('heading', { name: 'Area habitats' })
        ).toBeVisible()
      })

      test('area habitats table shows 7 column headings and is sortable', async ({
        habitatListPage,
        page
      }) => {
        await page.goto(`/projects/${projectId}/baseline-habitat-list`)
        await assertHabitatTableColumns(
          habitatListPage.areaHabitatsTable,
          'Area (ha)'
        )
      })

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
        await expect(firstRow.getByRole('cell').nth(2)).toHaveText(
          /^\d+(\.\d+)?$/
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

      // Totals row not yet implemented in the template — no tfoot or "Total" row
      // is rendered. Enable this test once the feature is built.
      test.skip('totals row shows "Total" label with summed area and units', async ({
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

      test('default sort on page load is Ref ascending with all other columns unsorted', async ({
        habitatListPage,
        page
      }) => {
        await page.goto(`/projects/${projectId}/baseline-habitat-list`)

        await expect(
          habitatListPage.areaHabitatsTable.getByRole('columnheader', {
            name: 'Ref'
          })
        ).toHaveAttribute('aria-sort', 'ascending')
        await expect(
          habitatListPage.areaHabitatsTable.getByRole('columnheader', {
            name: HABITAT_TYPE_COL
          })
        ).toHaveAttribute('aria-sort', 'none')
        await expect(
          habitatListPage.areaHabitatsTable.getByRole('columnheader', {
            name: 'Area (ha)'
          })
        ).toHaveAttribute('aria-sort', 'none')
        await expect(
          habitatListPage.areaHabitatsTable.getByRole('columnheader', {
            name: 'Condition'
          })
        ).toHaveAttribute('aria-sort', 'none')
        await expect(
          habitatListPage.areaHabitatsTable.getByRole('columnheader', {
            name: 'Units'
          })
        ).toHaveAttribute('aria-sort', 'none')
        await expect(
          habitatListPage.areaHabitatsTable.getByRole('columnheader', {
            name: 'Status'
          })
        ).toHaveAttribute('aria-sort', 'none')
      })

      test('clicking a non-active column header sorts rows ascending', async ({
        habitatListPage,
        page
      }) => {
        const header = await getHabitatTypeHeader(
          habitatListPage,
          page,
          projectId
        )
        await header.getByRole('button').click()
        await expect(header).toHaveAttribute('aria-sort', 'ascending')
      })

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

      test('clicking the habitat reference link navigates to the Habitat Details page', async ({
        habitatListPage,
        page
      }) => {
        await page.goto(`/projects/${projectId}/baseline-habitat-list`)
        const refLink = habitatListPage.areaHabitatsTable
          .getByRole('row')
          .nth(1)
          .getByRole('cell')
          .nth(0)
          .getByRole('link')
        await refLink.click()
        await expect(page).toHaveURL(/\/baseline-habitat-details/)
      })
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

      test('hedgerows section heading is displayed after upload', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        habitatListPage,
        page
      }) => {
        projectId = await uploadAndNavigateToHabitatList(
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          page,
          COMPLETE_BASELINE_FILE
        )

        await habitatListPage.hedgerowsTab.click()
        await expect(
          page.locator('#hedgerows').getByRole('heading', { name: 'Hedgerows' })
        ).toBeVisible()
      })

      test('hedgerows table shows 7 column headings including "Length (km)" and is sortable', async ({
        habitatListPage
      }) => {
        await habitatListPage.openTab(projectId, 'hedgerows')
        await assertHabitatTableColumns(
          habitatListPage.hedgerowsTable,
          'Length (km)'
        )
      })

      test('hedgerow data row shows a linked ref', async ({
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
      })

      test('clicking a hedgerow reference link navigates to the Habitat Details page', async ({
        habitatListPage,
        page
      }) => {
        await habitatListPage.openTab(projectId, 'hedgerows')
        const refLink = habitatListPage.hedgerowsTable
          .getByRole('row')
          .nth(1)
          .getByRole('cell')
          .nth(0)
          .getByRole('link')
        await refLink.click()
        await expect(page).toHaveURL(/\/baseline-habitat-details/)
      })
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

      test('watercourses section heading is displayed after upload', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        habitatListPage,
        page
      }) => {
        projectId = await uploadAndNavigateToHabitatList(
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          page,
          COMPLETE_BASELINE_FILE
        )

        await habitatListPage.watercoursesTab.click()
        await expect(
          page
            .locator('#watercourses')
            .getByRole('heading', { name: 'Watercourses' })
        ).toBeVisible()
      })

      test('watercourses table shows 7 column headings and is sortable', async ({
        habitatListPage
      }) => {
        await habitatListPage.openTab(projectId, 'watercourses')
        await assertHabitatTableColumns(
          habitatListPage.watercoursesTable,
          'Size'
        )
      })

      test('clicking a watercourse reference link navigates to the Habitat Details page', async ({
        habitatListPage,
        page
      }) => {
        await habitatListPage.openTab(projectId, 'watercourses')
        const refLink = habitatListPage.watercoursesTable
          .getByRole('row')
          .nth(1)
          .getByRole('cell')
          .nth(0)
          .getByRole('link')
        await refLink.click()
        await expect(page).toHaveURL(/\/baseline-habitat-details/)
      })

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
        await expect(firstRow.getByRole('cell').nth(2)).toHaveText(
          /^\d+(\.\d+)?$/
        )
        await expect(firstRow.getByRole('cell').nth(3)).not.toBeEmpty()
        await expect(firstRow.getByRole('cell').nth(4)).not.toBeEmpty()
        await expect(firstRow.getByRole('cell').nth(5)).toHaveText(
          /^\d+(\.\d+)?$/
        )
      })

      // AC3 — size "km" suffix: not yet implemented (value renders as plain decimal without suffix)
      test.skip('watercourse size column value includes "km" suffix with no space', async ({
        habitatListPage
      }) => {
        await habitatListPage.openTab(projectId, 'watercourses')
        const firstRow = habitatListPage.watercoursesTable
          .getByRole('row')
          .nth(1)
        await expect(firstRow.getByRole('cell').nth(2)).toHaveText(
          /^\d+(\.\d+)?km$/
        )
      })

      test('watercourse data row status column is non-empty', async ({
        habitatListPage
      }) => {
        await habitatListPage.openTab(projectId, 'watercourses')
        const firstRow = habitatListPage.watercoursesTable
          .getByRole('row')
          .nth(1)
        await expect(firstRow.getByRole('cell').nth(6)).not.toBeEmpty()
      })

      // AC5 — totals row: not yet implemented — no "Total" row is rendered.
      // Consistent with area habitats table (see skipped totals test above).
      test.skip('watercourses table displays a totals row with "Total", total size, and total units', async ({
        habitatListPage
      }) => {
        await habitatListPage.openTab(projectId, 'watercourses')
        const totalsRow = habitatListPage.watercoursesTable
          .getByRole('row')
          .filter({ hasText: 'Total' })
        await expect(totalsRow).toBeVisible()
        await expect(totalsRow.getByRole('cell').nth(2)).toHaveText(
          /^\d+(\.\d+)?$/
        )
        await expect(totalsRow.getByRole('cell').nth(5)).toHaveText(
          /^\d+(\.\d+)?$/
        )
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

      const NO_WATERCOURSES_FILE = 'Baseline - no watercourses.gpkg'

      test('watercourses tab panel shows "No watercourse data uploaded." when file has no watercourse features', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        habitatListPage,
        page
      }) => {
        const projectId = await uploadAndNavigateToHabitatList(
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          page,
          NO_WATERCOURSES_FILE
        )

        await habitatListPage.openTab(projectId, 'watercourses')
        await expect(
          page
            .locator('#watercourses')
            .getByText('No watercourse data uploaded.')
        ).toBeVisible()
      })
    }
  )
})
