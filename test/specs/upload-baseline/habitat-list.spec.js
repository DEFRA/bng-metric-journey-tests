import { test, expect } from '@fixtures'
import { STORAGE_STATE, NO_ROLE_STORAGE_STATE, runMode } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const HTTP_BAD_REQUEST = 400
const UPLOAD_TIMEOUT = 60_000
const COMPLETE_BASELINE_FILE = 'Baseline - complete with area refs.gpkg'
// habitat-list validates id as UUID v4 before the role pre-handler fires;
// the all-zeros stub fails that check, so role enforcement must use a valid v4 UUID.
const VALID_UUID_V4 = 'aaaaaaaa-bbbb-4ccc-bddd-eeeeeeeeeeee'
const STUB_PROJECT_ID = '00000000-0000-0000-0000-000000000000'
const PROJECT_LABEL = 'Habitat list test'
const NO_DATA_TEXT = 'No data'

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

test.describe('upload-baseline', { tag: '@upload-baseline' }, () => {
  // Serial mode prevents parallel uploads from contaminating the shared Redis
  // pendingUploadId session across the describe blocks in this file.
  test.describe.configure({ mode: 'serial' })

  // ─── Page display ─────────────────────────────────────────────────────────────

  test.describe('Habitat list — page display', { tag: '@smoke' }, () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test('page renders heading, summary table, habitat tabs and navigation', async ({
      createProjectFlow,
      projectDashboardPage,
      habitatListPage,
      page
    }) => {
      const { id, name } = await setupProject(
        createProjectFlow,
        projectDashboardPage,
        PROJECT_LABEL
      )

      await habitatListPage.open(id)

      // AC2: page title
      expect(await page.title()).toContain('On-site baseline habitats')

      // AC3: page header
      await expect(habitatListPage.heading).toBeVisible()
      await expect(page.getByText(name)).toBeVisible()
      await expect(habitatListPage.summaryHeading).toBeVisible()

      // AC4: summary table column headings
      await expect(
        habitatListPage.summaryTable.getByRole('columnheader', {
          name: 'Unit type'
        })
      ).toBeVisible()
      await expect(
        habitatListPage.summaryTable.getByRole('columnheader', { name: 'Size' })
      ).toBeVisible()
      await expect(
        habitatListPage.summaryTable.getByRole('columnheader', {
          name: 'Units'
        })
      ).toBeVisible()

      // AC5: summary table row labels
      await expect(
        habitatListPage.summaryTable.getByRole('cell', {
          name: 'Area habitats'
        })
      ).toBeVisible()
      await expect(
        habitatListPage.summaryTable.getByRole('cell', { name: 'Hedgerows' })
      ).toBeVisible()
      await expect(
        habitatListPage.summaryTable.getByRole('cell', {
          name: 'Watercourses'
        })
      ).toBeVisible()

      // AC6: habitat details subheading
      await expect(habitatListPage.habitatDetailsHeading).toBeVisible()

      // AC8 / AC9: tab visibility and default aria-selected state
      await expect(habitatListPage.areasTab).toBeVisible()
      await expect(habitatListPage.hedgerowsTab).toBeVisible()
      await expect(habitatListPage.watercoursesTab).toBeVisible()
      await expect(habitatListPage.areasTab).toHaveAttribute(
        'aria-selected',
        'true'
      )
      await expect(habitatListPage.hedgerowsTab).toHaveAttribute(
        'aria-selected',
        'false'
      )
      await expect(habitatListPage.watercoursesTab).toHaveAttribute(
        'aria-selected',
        'false'
      )

      // AC11: back link destination
      await expect(habitatListPage.backLink).toHaveAttribute(
        'href',
        `/add-project-details/${id}`
      )

      // AC12: continue button
      await expect(habitatListPage.continueButton).toBeVisible()

      await expect(habitatListPage.uploadDifferentFileLink).toBeVisible()
      await expect(habitatListPage.uploadDifferentFileLink).toHaveAttribute(
        'href',
        `/projects/${id}/upload-baseline-file`
      )
    })
  })

  // ─── Tab interaction ──────────────────────────────────────────────────────────

  test.describe('Habitat list — tab interaction', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test('clicking Hedgerows tab selects it and deselects Areas', async ({
      createProjectFlow,
      projectDashboardPage,
      habitatListPage
    }) => {
      const { id } = await setupProject(
        createProjectFlow,
        projectDashboardPage,
        PROJECT_LABEL
      )

      await habitatListPage.open(id)
      await habitatListPage.hedgerowsTab.click()

      await expect(habitatListPage.hedgerowsTab).toHaveAttribute(
        'aria-selected',
        'true'
      )
      await expect(habitatListPage.areasTab).toHaveAttribute(
        'aria-selected',
        'false'
      )
    })
  })

  // ─── Route parameter validation ──────────────────────────────────────────────

  test.describe('Habitat list — route parameter validation', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test('non-UUID id path param returns 400', async ({ page }) => {
      const response = await page.goto('/projects/not-a-uuid/baseline-habitat-list')
      expect(response.status()).toBe(HTTP_BAD_REQUEST)
    })
  })

  // ─── Summary units after upload ──────────────────────────────────────────────

  test.describe('Habitat list — summary units after upload', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)
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
  })

  // ─── Summary "No data" — no hedgerow features ────────────────────────────────

  test.describe('Habitat list — summary "No data" when no hedgerow features', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)
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
      await page.goto(`/projects/${noHedgerowsProjectId}/baseline-habitat-list`)
      await expect(habitatListPage.hedgerowUnitsCell).toHaveText(NO_DATA_TEXT)
    })
  })

  // ─── Summary "No data" — no watercourse features ─────────────────────────────

  test.describe('Habitat list — summary "No data" when no watercourse features', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)
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

      await expect(habitatListPage.watercourseSizeCell).toHaveText(NO_DATA_TEXT)
    })

    test('watercourse units show "No data" when no watercourse features exist', async ({
      habitatListPage,
      page
    }) => {
      await page.goto(`/projects/${noWatercoursesProjectId}/baseline-habitat-list`)
      await expect(habitatListPage.watercourseUnitsCell).toHaveText(
        NO_DATA_TEXT
      )
    })
  })

  // ─── Area habitats table ──────────────────────────────────────────────────────

  test.describe('Habitat list — area habitats table', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)
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

      await expect(
        habitatListPage.areaHabitatsTable.getByRole('columnheader', {
          name: 'Ref'
        })
      ).toBeVisible()
      await expect(
        habitatListPage.areaHabitatsTable.getByRole('columnheader', {
          name: 'Habitat type'
        })
      ).toBeVisible()
      await expect(
        habitatListPage.areaHabitatsTable.getByRole('columnheader', {
          name: 'Area (ha)'
        })
      ).toBeVisible()
      await expect(
        habitatListPage.areaHabitatsTable.getByRole('columnheader', {
          name: 'Distinctiveness'
        })
      ).toBeVisible()
      await expect(
        habitatListPage.areaHabitatsTable.getByRole('columnheader', {
          name: 'Condition'
        })
      ).toBeVisible()
      await expect(
        habitatListPage.areaHabitatsTable.getByRole('columnheader', {
          name: 'Units'
        })
      ).toBeVisible()
      await expect(
        habitatListPage.areaHabitatsTable.getByRole('columnheader', {
          name: 'Status'
        })
      ).toBeVisible()
      await expect(habitatListPage.areaHabitatsTable).toHaveAttribute(
        'data-module',
        'moj-sortable-table'
      )
    })

    test('data row shows a linked ref, populated fields, and numeric area and units', async ({
      habitatListPage,
      page
    }) => {
      await page.goto(`/projects/${projectId}/baseline-habitat-list`)
      const firstRow = habitatListPage.areaHabitatsTable.getByRole('row').nth(1)

      const refLink = firstRow.getByRole('cell').nth(0).getByRole('link')
      await expect(refLink).toBeVisible()
      await expect(refLink).toHaveAttribute('href', /baseline-habitat-details/)

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
      const firstRow = habitatListPage.areaHabitatsTable.getByRole('row').nth(1)
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
          name: 'Habitat type'
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
      await page.goto(`/projects/${projectId}/baseline-habitat-list`)
      const header = habitatListPage.areaHabitatsTable.getByRole(
        'columnheader',
        {
          name: 'Habitat type'
        }
      )
      await header.getByRole('button').click()
      await expect(header).toHaveAttribute('aria-sort', 'ascending')
    })

    test('clicking an ascending column header sorts rows descending', async ({
      habitatListPage,
      page
    }) => {
      await page.goto(`/projects/${projectId}/baseline-habitat-list`)
      const header = habitatListPage.areaHabitatsTable.getByRole(
        'columnheader',
        {
          name: 'Habitat type'
        }
      )
      await header.getByRole('button').click()
      await header.getByRole('button').click()
      await expect(header).toHaveAttribute('aria-sort', 'descending')
    })

    test('clicking a descending column header toggles back to ascending', async ({
      habitatListPage,
      page
    }) => {
      await page.goto(`/projects/${projectId}/baseline-habitat-list`)
      const header = habitatListPage.areaHabitatsTable.getByRole(
        'columnheader',
        {
          name: 'Habitat type'
        }
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
  })

  // ─── Role enforcement ────────────────────────────────────────────────────────

  test.describe('Habitat list — role enforcement', () => {
    test.use({ storageState: NO_ROLE_STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test(
      'authenticated user without BNG Completer role is redirected to /auth/forbidden',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto(`/projects/${VALID_UUID_V4}/baseline-habitat-list`)
        await expect(page).toHaveURL(/\/auth\/forbidden/)
      }
    )
  })

  // ─── Unauthenticated access ──────────────────────────────────────────────────

  test.describe('Habitat list — unauthenticated access', () => {
    test(
      'GET /projects/{id}/baseline-habitat-list redirects to sign-in',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto(`/projects/${STUB_PROJECT_ID}/baseline-habitat-list`)
        await expect(page).not.toHaveURL(/\/baseline-habitat-list/)
        await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
      }
    )
  })
})
