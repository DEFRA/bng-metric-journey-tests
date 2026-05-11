import { test, expect } from '@fixtures'
import { STORAGE_STATE, NO_PROJECTS_STORAGE_STATE } from '@utils/env.js'

const PROJECT_NAME_MAX_LENGTH = 1000

// ─── Authenticated tests ─────────────────────────────────────────────────────
// These require the cdp-defra-id-stub (see compose.yml). Run with:
//   docker compose up --wait && npm run test:github

test.describe('Create project — project dashboard', () => {
  test.use({ storageState: STORAGE_STATE })

  test('authenticated user sees dashboard with "Create project" button @smoke', async ({
    projectDashboardPage,
    page
  }) => {
    await projectDashboardPage.open()

    await expect(page).toHaveTitle('Projects - Biodiversity Net Gain')
    await expect(projectDashboardPage.heading).toBeVisible()
    await expect(projectDashboardPage.createProjectButton).toBeVisible()
  })
})

test.describe('Create project — project dashboard (empty state)', () => {
  test.use({ storageState: NO_PROJECTS_STORAGE_STATE })

  test('dashboard shows "No projects started." when user has no projects', async ({
    projectDashboardPage
  }) => {
    await projectDashboardPage.open()

    await expect(projectDashboardPage.noProjectsMessage).toBeVisible()
  })
})

test.describe('Create project — project name form', () => {
  test.use({ storageState: STORAGE_STATE })

  test('form renders with input, hint, back link, and submit button @smoke', async ({
    defineProjectNamePage,
    page
  }) => {
    await defineProjectNamePage.open()

    await expect(page).toHaveTitle(
      'Define Project Name - Biodiversity Net Gain'
    )
    await expect(defineProjectNamePage.nameInput).toBeVisible()
    await expect(defineProjectNamePage.nameHint).toBeVisible()
    await expect(defineProjectNamePage.backLink).toBeVisible()
    await expect(defineProjectNamePage.saveAndContinueButton).toBeVisible()
  })

  test('submitting empty name shows "Enter a project name" error @smoke', async ({
    defineProjectNamePage
  }) => {
    await defineProjectNamePage.open()
    await defineProjectNamePage.submit()

    await defineProjectNamePage.assertNameError('Enter a project name')
  })

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
})

test.describe('Create project — happy path @smoke', () => {
  test.use({ storageState: STORAGE_STATE })

  test('valid name creates project and redirects to dashboard with project listed', async ({
    createProjectFlow,
    projectDashboardPage,
    page
  }) => {
    const projectName = `Test project ${Date.now()}`

    await createProjectFlow.createProject(projectName)

    await expect(page).toHaveURL(/\/project-dashboard/)
    await expect(projectDashboardPage.projectLink(projectName)).toBeVisible()

    const createdCell = page
      .getByTestId('projects-table')
      .getByRole('row')
      .filter({ hasText: projectName })
      .getByRole('cell')
      .nth(2)

    await expect(createdCell).toContainText(/\d{1,2} \w+ \d{4}/)
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
    await expect(projectTaskListPage.taskList).toBeVisible()
    await expect(projectTaskListPage.taskItem('Project Name')).toBeVisible()
    await expect(projectTaskListPage.taskItem('Project Details')).toBeVisible()
    await expect(
      projectTaskListPage.taskItem('On-site baseline habitats')
    ).toBeVisible()
    await expect(
      projectTaskListPage.taskStatus('Cannot start yet')
    ).toBeVisible()
  })
})

test.describe('Create project — task list error state', () => {
  test.use({ storageState: STORAGE_STATE })

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
  test('GET /project-dashboard redirects to sign-in', async ({ page }) => {
    await page.goto('/project-dashboard')

    await expect(page).not.toHaveURL(/\/project-dashboard/)
    await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
  })

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
