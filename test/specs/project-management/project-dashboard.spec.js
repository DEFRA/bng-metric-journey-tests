import { test, expect } from '@fixtures'
import {
  STORAGE_STATE,
  NO_PROJECTS_STORAGE_STATE,
  NO_ROLE_STORAGE_STATE,
  baseUrl,
  skipInE2e
} from '@utils/env.js'
import { CreateProjectFlow } from '@flows/project-management/create-project.flow.js'
import { ProjectDashboardPage } from '@pages/project-dashboard.page.js'
import { ProjectTaskListPage } from '@pages/project-task-list.page.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

test.describe('project-management', { tag: '@project-management' }, () => {
  // ─── Page content ───────────────────────────────────────────────────────────

  test.describe('Project dashboard — page content', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

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

    test(
      'clicking "Create project" button navigates to /project-name',
      { tag: '@regression' },
      async ({ createProjectFlow, projectDashboardPage, page }) => {
        await createProjectFlow.createProject(`Setup ${Date.now()}`)
        await projectDashboardPage.open()
        await projectDashboardPage.createProjectButton.click()

        await expect(page).toHaveURL(/\/project-name/)
      }
    )

    test(
      'projects table has "Project name", "Last modified", and "Date created" column headings',
      { tag: '@regression' },
      async ({ createProjectFlow, page }) => {
        const name = `Column headings test ${Date.now()}`
        await createProjectFlow.createProject(name)

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

        // Last modified: "8 July 2026 at 2:05pm"; Date created: "8 July 2026".
        // \s* absorbs template whitespace — toHaveText only normalizes it for
        // string expectations, not RegExp ones.
        const row = table.getByRole('row').filter({ hasText: name })
        await expect(row.getByRole('cell').nth(1)).toHaveText(
          /^\s*\d{1,2} [A-Z][a-z]+ \d{4} at \d{1,2}:\d{2}(am|pm)\s*$/
        )
        await expect(row.getByRole('cell').nth(2)).toHaveText(
          /^\s*\d{1,2} [A-Z][a-z]+ \d{4}\s*$/
        )
      }
    )

    test(
      'clicking a project name navigates to its task list',
      { tag: '@regression' },
      async ({ createProjectFlow, projectDashboardPage, page }) => {
        const name = `Row link test ${Date.now()}`
        await createProjectFlow.createProject(name)
        await projectDashboardPage.open()
        await projectDashboardPage.projectLink(name).click()

        await expect(page).toHaveURL(/\/add-project-details\//)
      }
    )
  })

  // ─── Empty state ─────────────────────────────────────────────────────────────

  test.describe('Project dashboard — empty state', () => {
    test.use({ storageState: NO_PROJECTS_STORAGE_STATE })
    test.skip(skipInE2e(NO_PROJECTS_STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'user with no projects is redirected from dashboard to /project-name',
      { tag: '@smoke' },
      async ({ projectDashboardPage, page }) => {
        await projectDashboardPage.open()

        await expect(page).toHaveURL(/\/project-name/)
      }
    )
  })

  // ─── Cross-user visibility ───────────────────────────────────────────────────
  // DoD: a project created by one user must not be visible to any other user.
  // Drives two sessions in one test — the completer creates a uniquely-named
  // project, a different (no-projects) user must not see it.

  test.describe(
    'Project dashboard — cross-user visibility',
    { tag: '@regression' },
    () => {
      test.skip(skipInE2e(NO_PROJECTS_STORAGE_STATE), E2E_SKIP_REASON)

      test('a project created by one user is not visible to a different user', async ({
        browser
      }) => {
        const projectName = `Isolation ${Date.now()}`

        const creatorContext = await browser.newContext({
          storageState: STORAGE_STATE,
          baseURL: baseUrl
        })
        const otherContext = await browser.newContext({
          storageState: NO_PROJECTS_STORAGE_STATE,
          baseURL: baseUrl
        })

        try {
          const creatorPage = await creatorContext.newPage()
          const creatorDashboard = new ProjectDashboardPage(creatorPage)
          await new CreateProjectFlow(creatorPage).createProject(projectName)
          await creatorDashboard.open()
          await expect(creatorDashboard.projectLink(projectName)).toBeVisible()

          const otherPage = await otherContext.newPage()
          await otherPage.goto('/manage-projects')
          await expect(
            otherPage.getByRole('link', { name: projectName })
          ).toBeHidden()
        } finally {
          await creatorContext.close()
          await otherContext.close()
        }
      })

      test('a project created by one user cannot be opened directly by a different user', async ({
        browser
      }) => {
        const projectName = `Isolation direct ${Date.now()}`

        const creatorContext = await browser.newContext({
          storageState: STORAGE_STATE,
          baseURL: baseUrl
        })
        const otherContext = await browser.newContext({
          storageState: NO_PROJECTS_STORAGE_STATE,
          baseURL: baseUrl
        })

        try {
          const creatorPage = await creatorContext.newPage()
          const creatorDashboard = new ProjectDashboardPage(creatorPage)
          await new CreateProjectFlow(creatorPage).createProject(projectName)
          await creatorDashboard.open()
          const href = await creatorDashboard
            .projectLink(projectName)
            .getAttribute('href')
          const projectId = href.split('/').pop()

          // The other user opens the creator's project URL directly. The backend
          // scopes GET /projects/{id} by owner (visibleToUser), so it 404s and the
          // task list renders its "Project not found" state: heading only, no body
          // and — critically — none of the creator's project content.
          const otherPage = await otherContext.newPage()
          const otherTaskList = new ProjectTaskListPage(otherPage)
          await otherTaskList.open(projectId)

          await expect(otherTaskList.heading).toBeVisible()
          await expect(otherPage.getByText(projectName)).toBeHidden()
          await expect(otherTaskList.informationParagraph).toBeHidden()
          await expect(otherTaskList.taskList).toBeHidden()
        } finally {
          await creatorContext.close()
          await otherContext.close()
        }
      })
    }
  )

  // ─── Default sort order ──────────────────────────────────────────────────────

  test.describe(
    'Project dashboard — default sort order',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('projects are sorted by last modified descending', async ({
        createProjectFlow,
        projectDashboardPage
      }) => {
        const nameA = `Sort-A ${Date.now()}`
        await createProjectFlow.createProject(nameA)

        const nameB = `Sort-B ${Date.now()}`
        await createProjectFlow.createProject(nameB)

        await projectDashboardPage.open()
        const projectLinks =
          projectDashboardPage.projectsTable.getByRole('link')
        const names = await projectLinks.allTextContents()
        const indexA = names.findIndex((n) => n.includes('Sort-A'))
        const indexB = names.findIndex((n) => n.includes('Sort-B'))
        expect(indexB).toBeLessThan(indexA)
      })
    }
  )

  // ─── Role enforcement ────────────────────────────────────────────────────────

  test.describe('Project dashboard — role enforcement', () => {
    test.use({ storageState: NO_ROLE_STORAGE_STATE })
    test.skip(skipInE2e(NO_ROLE_STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'authenticated user without bng completer role is redirected to /auth/forbidden',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto('/manage-projects')

        await expect(page).toHaveURL(/\/auth\/forbidden/)
      }
    )
  })

  // ─── Unauthenticated access ──────────────────────────────────────────────────

  test.describe('Project dashboard — unauthenticated access', () => {
    test(
      'GET /manage-projects redirects to sign-in',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto('/manage-projects')

        await expect(page).not.toHaveURL(/\/manage-projects/)
        await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
      }
    )
  })

  // ─── Backend error ───────────────────────────────────────────────────────────

  test.describe(
    'Project dashboard — backend error',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })

      test.skip('backend error ≥ 400 on GET /users/{userId}/projects renders an error page', async () => {
        // The frontend calls GET /users/{userId}/projects server-side via wreck.
        // Playwright page.route() only intercepts browser-initiated requests, so
        // this backend call cannot be mocked at the E2E layer. A network-level
        // proxy or a test-specific backend stub endpoint is needed to reproduce
        // this path reliably.
      })
    }
  )
})
