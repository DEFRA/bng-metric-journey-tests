import { test, expect } from '@fixtures'
import { STORAGE_STATE, NO_ROLE_STORAGE_STATE, runMode } from '@utils/env.js'

const PROJECT_NAME_MAX_LENGTH = 1000
const HTTP_BAD_REQUEST = 400

async function setupProject(createProjectFlow, projectDashboardPage) {
  const name = `Change name test ${Date.now()}`
  await createProjectFlow.createProject(name)
  const href = await projectDashboardPage.projectLink(name).getAttribute('href')
  const id = href.split('/').pop()
  return { id, name }
}

// ─── Form display ─────────────────────────────────────────────────────────────

test.describe('Change project name — form display', () => {
  test.use({ storageState: STORAGE_STATE })
  test.skip(runMode === 'e2e', 'Requires stub auth — not available in e2e mode')

  test('form renders pre-populated with existing project name @smoke', async ({
    createProjectFlow,
    projectDashboardPage,
    changeProjectNamePage,
    page
  }) => {
    const { id, name } = await setupProject(
      createProjectFlow,
      projectDashboardPage
    )

    await changeProjectNamePage.open(id)

    await expect(page).toHaveTitle('Project Name - Biodiversity Net Gain')
    await expect(changeProjectNamePage.nameInput).toBeVisible()
    await expect(changeProjectNamePage.nameInput).toHaveValue(name)
    await expect(changeProjectNamePage.backLink).toBeVisible()
    await expect(changeProjectNamePage.saveAndContinueButton).toBeVisible()
  })
})

// ─── Validation ───────────────────────────────────────────────────────────────

test.describe('Change project name — validation', () => {
  test.use({ storageState: STORAGE_STATE })
  test.skip(runMode === 'e2e', 'Requires stub auth — not available in e2e mode')

  test('submitting empty name shows "Enter a project name" error @smoke', async ({
    createProjectFlow,
    projectDashboardPage,
    changeProjectNamePage,
    page
  }) => {
    const { id } = await setupProject(createProjectFlow, projectDashboardPage)
    await changeProjectNamePage.open(id)
    await changeProjectNamePage.enterName('')
    await changeProjectNamePage.submit()

    await expect(page).toHaveTitle(
      'Error: Project Name - Biodiversity Net Gain'
    )
    await changeProjectNamePage.assertNameError('Enter a project name')
  })

  test('submitting whitespace-only name shows "Enter a project name" error', async ({
    createProjectFlow,
    projectDashboardPage,
    changeProjectNamePage
  }) => {
    const { id } = await setupProject(createProjectFlow, projectDashboardPage)
    await changeProjectNamePage.open(id)
    await changeProjectNamePage.enterName('   ')
    await changeProjectNamePage.submit()

    await changeProjectNamePage.assertNameError('Enter a project name')
  })

  test('submitting name over 1000 characters shows length error', async ({
    createProjectFlow,
    projectDashboardPage,
    changeProjectNamePage
  }) => {
    const { id } = await setupProject(createProjectFlow, projectDashboardPage)
    await changeProjectNamePage.open(id)
    await changeProjectNamePage.enterName(
      'a'.repeat(PROJECT_NAME_MAX_LENGTH + 1)
    )
    await changeProjectNamePage.submit()

    await changeProjectNamePage.assertNameError(
      'Project name must be 1000 characters or fewer'
    )
  })

  test('submitting name with control characters shows invalid characters error', async ({
    createProjectFlow,
    projectDashboardPage,
    changeProjectNamePage
  }) => {
    const { id } = await setupProject(createProjectFlow, projectDashboardPage)
    await changeProjectNamePage.open(id)
    await changeProjectNamePage.enterName('Project\x00Name')
    await changeProjectNamePage.submit()

    await changeProjectNamePage.assertNameError(
      'Project name must only contain valid characters'
    )
  })
})

// ─── Happy path ───────────────────────────────────────────────────────────────

test.describe('Change project name — happy path @smoke', () => {
  test.use({ storageState: STORAGE_STATE })
  test.skip(runMode === 'e2e', 'Requires stub auth — not available in e2e mode')

  test('valid name updates project and redirects to task list', async ({
    createProjectFlow,
    projectDashboardPage,
    changeProjectNamePage,
    page
  }) => {
    const { id } = await setupProject(createProjectFlow, projectDashboardPage)
    const newName = `Renamed project ${Date.now()}`

    await changeProjectNamePage.open(id)
    await changeProjectNamePage.enterName(newName)
    await changeProjectNamePage.submit()

    await expect(page).toHaveURL(new RegExp(`/project-task-list/${id}`))
    await expect(page.getByText(newName)).toBeVisible()
  })
})

// ─── Role enforcement ─────────────────────────────────────────────────────────

test.describe('Change project name — role enforcement', () => {
  test.use({ storageState: NO_ROLE_STORAGE_STATE })
  test.skip(runMode === 'e2e', 'Requires stub auth — not available in e2e mode')

  test('authenticated user without bng completer role is redirected to /auth/forbidden', async ({
    page
  }) => {
    await page.goto('/change-project-name/00000000-0000-0000-0000-000000000000')

    await expect(page).toHaveURL(/\/auth\/forbidden/)
  })
})

// ─── Unauthenticated access ───────────────────────────────────────────────────

test.describe('Change project name — unauthenticated access', () => {
  test('GET /change-project-name/{id} redirects to sign-in', async ({
    page
  }) => {
    await page.goto('/change-project-name/00000000-0000-0000-0000-000000000000')

    await expect(page).not.toHaveURL(/\/change-project-name/)
    await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
  })
})

// ─── Route parameter validation ───────────────────────────────────────────────

test.describe('Change project name — route parameter validation', () => {
  test.use({ storageState: STORAGE_STATE })
  test.skip(runMode === 'e2e', 'Requires stub auth — not available in e2e mode')

  test('non-UUID id path param returns 400', async ({ page }) => {
    const response = await page.goto('/change-project-name/not-a-uuid')

    expect(response.status()).toBe(HTTP_BAD_REQUEST)
  })
})
