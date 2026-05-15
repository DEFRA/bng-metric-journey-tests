import { test, expect } from '@fixtures'
import {
  STORAGE_STATE,
  NO_PROJECTS_STORAGE_STATE,
  runMode
} from '@utils/env.js'

const PROJECT_NAME_MAX_LENGTH = 1000
const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

// ─── Authenticated tests ─────────────────────────────────────────────────────
// These require the cdp-defra-id-stub (see compose.yml). Run with:
//   docker compose up --wait && npm run test:github

test.describe('Create project — project dashboard', () => {
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
    await createProjectFlow.createProject(`Column headings test ${Date.now()}`)

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

test.describe('Create project — project dashboard (empty state)', () => {
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

test.describe('Create project — project name form', () => {
  test.use({ storageState: STORAGE_STATE })
  test.skip(runMode === 'e2e', E2E_SKIP_REASON)

  test(
    'form renders with input, hint, back link, and submit button',
    { tag: '@smoke' },
    async ({ defineProjectNamePage, page }) => {
      await defineProjectNamePage.open()

      await expect(page).toHaveTitle(
        'Define Project Name - Biodiversity Net Gain'
      )
      await expect(defineProjectNamePage.nameInput).toBeVisible()
      await expect(defineProjectNamePage.nameHint).toBeVisible()
      await expect(defineProjectNamePage.backLink).toBeVisible()
      await expect(defineProjectNamePage.saveAndContinueButton).toBeVisible()
    }
  )

  test(
    'submitting empty name shows "Enter a project name" error',
    { tag: '@smoke' },
    async ({ defineProjectNamePage }) => {
      await defineProjectNamePage.open()
      await defineProjectNamePage.submit()

      await defineProjectNamePage.assertNameError('Enter a project name')
    }
  )

  test('submitting whitespace-only name shows "Enter a project name" error', async ({
    defineProjectNamePage
  }) => {
    await defineProjectNamePage.open()
    await defineProjectNamePage.enterProjectName('   ')
    await defineProjectNamePage.submit()

    await defineProjectNamePage.assertNameError('Enter a project name')
  })

  test('submitting name over 1000 characters shows length error', async ({
    defineProjectNamePage
  }) => {
    await defineProjectNamePage.open()
    await defineProjectNamePage.enterProjectName(
      'a'.repeat(PROJECT_NAME_MAX_LENGTH + 1)
    )
    await defineProjectNamePage.submit()

    await defineProjectNamePage.assertNameError(
      'Project name must be 1000 characters or fewer'
    )
  })

  test('submitting name with control characters shows invalid characters error', async ({
    defineProjectNamePage
  }) => {
    await defineProjectNamePage.open()
    await defineProjectNamePage.enterProjectName('Project\x00Name')
    await defineProjectNamePage.submit()

    await defineProjectNamePage.assertNameError(
      'Project name must only contain valid characters'
    )
  })

  test('input enforces 1000-character limit via maxlength attribute', async ({
    defineProjectNamePage
  }) => {
    await defineProjectNamePage.open()

    await expect(defineProjectNamePage.nameInput).toHaveAttribute(
      'maxlength',
      '1000'
    )
  })

  test('clicking "Back" link navigates to /project-dashboard', async ({
    createProjectFlow,
    defineProjectNamePage,
    page
  }) => {
    await createProjectFlow.createProject(`Back link test ${Date.now()}`)
    await defineProjectNamePage.open()
    await defineProjectNamePage.backLink.click()

    await expect(page).toHaveURL(/\/project-dashboard/)
  })
})

test.describe('Create project — happy path', { tag: '@smoke' }, () => {
  test.use({ storageState: STORAGE_STATE })
  test.skip(runMode === 'e2e', E2E_SKIP_REASON)

  test('valid name creates project and redirects to dashboard with project listed', async ({
    createProjectFlow,
    projectDashboardPage,
    page
  }) => {
    const projectName = `Test project ${Date.now()}`

    await createProjectFlow.createProject(projectName)

    await expect(page).toHaveURL(/\/project-dashboard/)
    await expect(projectDashboardPage.projectLink(projectName)).toBeVisible()
    await expect(projectDashboardPage.projectLink(projectName)).toHaveAttribute(
      'href',
      /\/project-task-list\//
    )

    const projectRow = page
      .getByTestId('projects-table')
      .getByRole('row')
      .filter({ hasText: projectName })

    await expect(projectRow.getByRole('cell').nth(1)).toContainText(
      /\d{1,2} \w+ \d{4} at \d{1,2}:\d{2}(am|pm)/
    )
    await expect(projectRow.getByRole('cell').nth(2)).toContainText(
      /\d{1,2} \w+ \d{4}/
    )
  })

  test('clicking project name opens task list with 4 tasks and project name as caption', async ({
    createProjectFlow,
    projectDashboardPage,
    projectTaskListPage,
    page
  }) => {
    const projectName = `Task list project ${Date.now()}`

    await createProjectFlow.createProject(projectName)
    await projectDashboardPage.projectLink(projectName).click()

    await expect(page).toHaveURL(/\/project-task-list\//)
    await expect(projectTaskListPage.heading).toBeVisible()
    await expect(page.getByText(projectName)).toBeVisible()
    await expect(projectTaskListPage.informationParagraph).toBeVisible()
    await expect(projectTaskListPage.taskList).toBeVisible()
    await expect(projectTaskListPage.taskItem('Project Name')).toBeVisible()
    await expect(projectTaskListPage.taskItem('Project Name')).toHaveAttribute(
      'href',
      /\/change-project-name\//
    )
    await expect(projectTaskListPage.taskItem('Project Details')).toBeVisible()
    await expect(
      projectTaskListPage.taskItem('Project Details')
    ).toHaveAttribute('href', /\/project-details\//)
    await expect(
      projectTaskListPage.taskItem('On-site baseline habitats')
    ).toBeVisible()
    await expect(
      projectTaskListPage.taskItem('On-site baseline habitats')
    ).toHaveAttribute('href', /\/projects\/.*\/upload-baseline-file/)
    await expect(projectTaskListPage.taskStatus('Not yet started')).toHaveCount(
      2
    )
    await expect(
      projectTaskListPage.taskStatus('Cannot start yet')
    ).toBeVisible()
  })

  test('clicking "Project Name" task item navigates to the change project name page', async ({
    createProjectFlow,
    projectDashboardPage,
    projectTaskListPage,
    page
  }) => {
    const projectName = `Task list nav test ${Date.now()}`

    await createProjectFlow.createProject(projectName)
    await projectDashboardPage.projectLink(projectName).click()
    await projectTaskListPage.taskItem('Project Name').click()

    await expect(page).toHaveURL(/\/change-project-name\//)
  })

  test('clicking "Project Details" task item navigates to the project details page', async ({
    createProjectFlow,
    projectDashboardPage,
    projectTaskListPage,
    page
  }) => {
    test.skip(
      true,
      '/project-details/{id} route not yet registered in router.js — remove this skip once the BMD-276 placeholder route is implemented'
    )

    const projectName = `Project details nav test ${Date.now()}`

    await createProjectFlow.createProject(projectName)
    await projectDashboardPage.projectLink(projectName).click()
    await projectTaskListPage.taskItem('Project Details').click()

    await expect(page).toHaveURL(/\/project-details\//)
  })

  test('clicking "On-site baseline habitats" task item navigates to the baseline upload page', async ({
    createProjectFlow,
    projectDashboardPage,
    projectTaskListPage,
    page
  }) => {
    const projectName = `Baseline habitats nav test ${Date.now()}`

    await createProjectFlow.createProject(projectName)
    await projectDashboardPage.projectLink(projectName).click()
    await projectTaskListPage.taskItem('On-site baseline habitats').click()

    await expect(page).toHaveURL(/\/upload-baseline-file/)
  })
})

test.describe('Create project — task list error state', () => {
  test.use({ storageState: STORAGE_STATE })
  test.skip(runMode === 'e2e', E2E_SKIP_REASON)

  test('unknown project UUID hides the task list body', async ({
    projectTaskListPage
  }) => {
    await projectTaskListPage.open('00000000-0000-0000-0000-000000000000')

    await expect(projectTaskListPage.heading).toBeVisible()
    await expect(projectTaskListPage.informationParagraph).not.toBeVisible()
    await expect(projectTaskListPage.taskList).not.toBeVisible()
  })
})

// ─── Unauthenticated tests ────────────────────────────────────────────────────

test.describe('Create project — unauthenticated access', () => {
  test(
    'GET /project-dashboard redirects to sign-in',
    { tag: '@smoke' },
    async ({ page }) => {
      await page.goto('/project-dashboard')

      await expect(page).not.toHaveURL(/\/project-dashboard/)
      await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
    }
  )

  test('GET /define-project-name redirects to sign-in', async ({ page }) => {
    await page.goto('/define-project-name')

    await expect(page).not.toHaveURL(/\/define-project-name/)
    await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
  })

  test('GET /project-task-list/{id} redirects to sign-in', async ({ page }) => {
    await page.goto('/project-task-list/00000000-0000-0000-0000-000000000000')

    await expect(page).not.toHaveURL(/\/project-task-list/)
    await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
  })
})
