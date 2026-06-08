import { test, expect } from '@fixtures'
import { STORAGE_STATE, NO_ROLE_STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const HTTP_BAD_REQUEST = 400
// habitat-list validates id as UUID v4 before the role pre-handler fires;
// the all-zeros stub fails that check, so role enforcement must use a valid v4 UUID.
const VALID_UUID_V4 = 'aaaaaaaa-bbbb-4ccc-bddd-eeeeeeeeeeee'
const STUB_PROJECT_ID = '00000000-0000-0000-0000-000000000000'
const PROJECT_LABEL = 'Habitat list test'

test.describe('habitat-list', { tag: '@habitat-list' }, () => {
  // ─── Page display ─────────────────────────────────────────────────────────────

  test.describe('Habitat list — page display', { tag: '@smoke' }, () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

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

      // AC1: pathname
      expect(page.url()).toContain('baseline-habitat-list')

      // AC2: page title
      const title = await page.title()
      expect(title).toContain('On-site baseline habitats')
      expect(title).toMatch(/On-site baseline habitats - .+/)

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

  test.describe(
    'Habitat list — tab interaction',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('clicking Hedgerows tab selects it and deselects the other two tabs', async ({
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
        await expect(habitatListPage.watercoursesTab).toHaveAttribute(
          'aria-selected',
          'false'
        )
      })

      test('clicking Watercourses tab selects it and deselects the other two tabs', async ({
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
        await habitatListPage.watercoursesTab.click()

        await expect(habitatListPage.watercoursesTab).toHaveAttribute(
          'aria-selected',
          'true'
        )
        await expect(habitatListPage.areasTab).toHaveAttribute(
          'aria-selected',
          'false'
        )
        await expect(habitatListPage.hedgerowsTab).toHaveAttribute(
          'aria-selected',
          'false'
        )
      })
    }
  )

  // ─── Show map button (not yet implemented) ───────────────────────────────────

  test.describe(
    'Habitat list — show map button',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // AC7: "Show map" button — not yet implemented in the template.
      // Enable and implement once BMD builds the map view feature.
      test.skip('page displays a "Show map" button', async ({
        createProjectFlow,
        projectDashboardPage,
        habitatListPage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        await habitatListPage.open(id)
        await expect(
          page.getByRole('button', { name: 'Show map' })
        ).toBeVisible()
      })
    }
  )

  // ─── Continue button navigation (not yet implemented) ────────────────────────

  test.describe(
    'Habitat list — continue button navigation',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // AC12: "Continue" button navigation — button currently has href="#" (stub).
      // Enable and implement once BMD-247 wires up the task list redirect.
      test.skip('clicking "Continue" navigates to the project task list', async ({
        createProjectFlow,
        projectDashboardPage,
        habitatListPage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        await habitatListPage.open(id)
        await habitatListPage.continueButton.click()
        await expect(page).toHaveURL(new RegExp(`/add-project-details/${id}`))
      })
    }
  )

  // ─── Route parameter validation ──────────────────────────────────────────────

  test.describe(
    'Habitat list — route parameter validation',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('non-UUID id path param returns 400', async ({ page }) => {
        const response = await page.goto(
          '/projects/not-a-uuid/baseline-habitat-list'
        )
        expect(response.status()).toBe(HTTP_BAD_REQUEST)
      })
    }
  )

  // ─── Role enforcement ────────────────────────────────────────────────────────

  test.describe('Habitat list — role enforcement', () => {
    test.use({ storageState: NO_ROLE_STORAGE_STATE })
    test.skip(skipInE2e(NO_ROLE_STORAGE_STATE), E2E_SKIP_REASON)

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
