import { test, expect } from '@fixtures'
import {
  STORAGE_STATE,
  NO_PROJECTS_STORAGE_STATE,
  NO_ROLE_STORAGE_STATE,
  runMode
} from '@utils/env.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

test.describe('project-management', { tag: '@project-management' }, () => {
  // ─── Page content ───────────────────────────────────────────────────────────

  test.describe('Project dashboard — page content', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test(
      'authenticated user sees dashboard with "Create project" button',
      { tag: '@smoke' },
      async ({ createProjectFlow, projectDashboardPage, page }) => {
        await createProjectFlow.createProject(
          `Dashboard smoke test ${Date.now()}`
        )

        await expect(page).toHaveTitle('Projects - Biodiversity Net Gain')
        await expect(projectDashboardPage.heading).toBeVisible()
        await expect(projectDashboardPage.createProjectButton).toBeVisible()
      }
    )

    test('clicking "Create project" button navigates to /define-project-name', async ({
      createProjectFlow,
      projectDashboardPage,
      page
    }) => {
      await createProjectFlow.createProject(`Setup ${Date.now()}`)
      await projectDashboardPage.open()
      await projectDashboardPage.createProjectButton.click()

      await expect(page).toHaveURL(/\/define-project-name/)
    })

    test('projects table has "Project name", "Last modified", and "Date created" column headings', async ({
      createProjectFlow,
      page
    }) => {
      await createProjectFlow.createProject(
        `Column headings test ${Date.now()}`
      )

      const table = page.getByTestId('projects-table')
      await expect(
        table.getByRole('columnheader', { name: 'Project name' })
      ).toBeVisible()
      await expect(
        table.getByRole('columnheader', { name: 'Last modified' })
      ).toBeVisible()
      await expect(
        table.getByRole('columnheader', { name: 'Date created' })
      ).toBeVisible()
    })
  })

  // ─── Empty state ─────────────────────────────────────────────────────────────

  test.describe('Project dashboard — empty state', () => {
    test.use({ storageState: NO_PROJECTS_STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test(
      'user with no projects is redirected from dashboard to /define-project-name',
      { tag: '@smoke' },
      async ({ projectDashboardPage, page }) => {
        await projectDashboardPage.open()

        await expect(page).toHaveURL(/\/define-project-name/)
      }
    )
  })

  // ─── Default sort order ──────────────────────────────────────────────────────

  test.describe('Project dashboard — default sort order', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test('projects are sorted by last modified descending', async ({
      createProjectFlow,
      page
    }) => {
      const nameA = `Sort-A ${Date.now()}`
      await createProjectFlow.createProject(nameA)

      const nameB = `Sort-B ${Date.now()}`
      await createProjectFlow.createProject(nameB)

      const projectLinks = page.getByTestId('projects-table').getByRole('link')
      const names = await projectLinks.allTextContents()
      const indexA = names.findIndex((n) => n.includes('Sort-A'))
      const indexB = names.findIndex((n) => n.includes('Sort-B'))
      expect(indexB).toBeLessThan(indexA)
    })
  })

  // ─── Role enforcement ────────────────────────────────────────────────────────

  test.describe('Project dashboard — role enforcement', () => {
    test.use({ storageState: NO_ROLE_STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test(
      'authenticated user without bng completer role is redirected to /auth/forbidden',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto('/project-dashboard')

        await expect(page).toHaveURL(/\/auth\/forbidden/)
      }
    )
  })

  // ─── Unauthenticated access ──────────────────────────────────────────────────

  test.describe('Project dashboard — unauthenticated access', () => {
    test(
      'GET /project-dashboard redirects to sign-in',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto('/project-dashboard')

        await expect(page).not.toHaveURL(/\/project-dashboard/)
        await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
      }
    )
  })

  // ─── Backend error ───────────────────────────────────────────────────────────

  test.describe('Project dashboard — backend error', () => {
    test.use({ storageState: STORAGE_STATE })

    test.skip('backend error ≥ 400 on GET /users/{userId}/projects renders an error page', async () => {
      // The frontend calls GET /users/{userId}/projects server-side via wreck.
      // Playwright page.route() only intercepts browser-initiated requests, so
      // this backend call cannot be mocked at the E2E layer. A network-level
      // proxy or a test-specific backend stub endpoint is needed to reproduce
      // this path reliably.
    })
  })
})
