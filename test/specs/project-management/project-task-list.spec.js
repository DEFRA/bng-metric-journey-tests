import { test, expect } from '@fixtures'
import { STORAGE_STATE, NO_ROLE_STORAGE_STATE, skipInE2e } from '@utils/env.js'

const HTTP_BAD_REQUEST = 400
const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const TASK_PROJECT_NAME = 'Project Name'
const TASK_PROJECT_DETAILS = 'Project Details'
const TASK_BASELINE_HABITATS = 'On-site baseline habitats'
const TASK_POST_INTERVENTION = 'On-site post intervention habitats'

async function setupProject(createProjectFlow, projectDashboardPage) {
  const name = `Task list test ${Date.now()}`
  await createProjectFlow.createProject(name)
  const href = await projectDashboardPage.projectLink(name).getAttribute('href')
  const id = href.split('/').pop()
  return { id, name }
}

test.describe('project-management', { tag: '@project-management' }, () => {
  // ─── Page content ───────────────────────────────────────────────────────────

  test.describe('Project task list — page content', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'task list shows heading, caption, 4 task items with correct hrefs and statuses',
      { tag: '@smoke' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectTaskListPage,
        page
      }) => {
        const { id, name } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )

        await projectTaskListPage.open(id)

        await expect(page).toHaveURL(new RegExp(`/add-project-details/${id}`))
        await expect(projectTaskListPage.heading).toBeVisible()
        await expect(page.getByText(name)).toBeVisible()
        await expect(projectTaskListPage.informationParagraph).toBeVisible()
        await expect(projectTaskListPage.taskList).toBeVisible()
        await projectTaskListPage.assertTaskLink(
          TASK_PROJECT_NAME,
          /\/change-project-name\//
        )
        await projectTaskListPage.assertTaskLink(
          TASK_PROJECT_DETAILS,
          /\/project-details\//
        )
        await projectTaskListPage.assertTaskLink(
          TASK_BASELINE_HABITATS,
          /\/projects\/.*\/upload-baseline-file/
        )
        await projectTaskListPage.assertTaskLink(
          TASK_POST_INTERVENTION,
          /\/projects\/.*\/upload-post-intervention-file/
        )
        // Fresh project: Project Name is Completed; Project Details, On-site
        // baseline and On-site post intervention are all Not yet started.
        await expect(projectTaskListPage.taskStatus('Completed')).toHaveCount(1)
        await expect(
          projectTaskListPage.taskStatus('Not yet started')
        ).toHaveCount(3)
        // Row-scoped: the post-intervention task specifically is Not yet started.
        await projectTaskListPage.assertTaskStatus(
          TASK_POST_INTERVENTION,
          'Not yet started'
        )
      }
    )
  })

  // ─── Task item navigation ────────────────────────────────────────────────────

  test.describe(
    'Project task list — task item navigation',
    { tag: '@smoke' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('clicking "Project Name" task item navigates to the change project name page', async ({
        createProjectFlow,
        projectDashboardPage,
        projectTaskListPage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await projectTaskListPage.open(id)
        await projectTaskListPage.taskItem(TASK_PROJECT_NAME).click()

        await expect(page).toHaveURL(/\/change-project-name\//)
      })

      test('clicking "Project Details" task item navigates to the project details page', async ({
        createProjectFlow,
        projectDashboardPage,
        projectTaskListPage,
        page
      }) => {
        const { id, name } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await projectTaskListPage.open(id)
        await projectTaskListPage.taskItem(TASK_PROJECT_DETAILS).click()

        await expect(page).toHaveURL(/\/project-details\//)
        await expect(
          page.getByRole('heading', { name: 'Project details' })
        ).toBeVisible()
        await expect(page.getByText(name)).toBeVisible()
      })

      test('clicking "On-site baseline habitats" task item navigates to the baseline upload page', async ({
        createProjectFlow,
        projectDashboardPage,
        projectTaskListPage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await projectTaskListPage.open(id)
        await projectTaskListPage.taskItem(TASK_BASELINE_HABITATS).click()

        await expect(page).toHaveURL(/\/upload-baseline-file/)
      })

      test('clicking "On-site post intervention habitats" task item navigates to the post-intervention upload page', async ({
        createProjectFlow,
        projectDashboardPage,
        projectTaskListPage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await projectTaskListPage.open(id)
        await projectTaskListPage.taskItem(TASK_POST_INTERVENTION).click()

        await expect(page).toHaveURL(/\/upload-post-intervention-file/)
      })
    }
  )

  // ─── Error state ─────────────────────────────────────────────────────────────

  test.describe(
    'Project task list — error state',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('unknown project UUID hides the task list body', async ({
        projectTaskListPage,
        page
      }) => {
        await projectTaskListPage.open('00000000-0000-0000-0000-000000000000')

        await expect(projectTaskListPage.heading).toBeVisible()
        await expect(page.getByText('Project not found')).toBeVisible()
        await expect(projectTaskListPage.informationParagraph).not.toBeVisible()
        await expect(projectTaskListPage.taskList).not.toBeVisible()
      })
    }
  )

  // ─── Role enforcement ────────────────────────────────────────────────────────

  test.describe(
    'Project task list — role enforcement',
    { tag: '@smoke' },
    () => {
      test.use({ storageState: NO_ROLE_STORAGE_STATE })
      test.skip(skipInE2e(NO_ROLE_STORAGE_STATE), E2E_SKIP_REASON)

      test('authenticated user without bng completer role is redirected to /auth/forbidden', async ({
        page
      }) => {
        await page.goto(
          '/add-project-details/00000000-0000-0000-0000-000000000000'
        )

        await expect(page).toHaveURL(/\/auth\/forbidden/)
      })
    }
  )

  // ─── Route parameter validation ──────────────────────────────────────────────

  test.describe(
    'Project task list — route parameter validation',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('non-UUID id path param returns 400', async ({ page }) => {
        const response = await page.goto('/add-project-details/not-a-uuid')

        expect(response.status()).toBe(HTTP_BAD_REQUEST)
      })
    }
  )

  // ─── Unauthenticated access ──────────────────────────────────────────────────

  test.describe(
    'Project task list — unauthenticated access',
    { tag: '@smoke' },
    () => {
      test('GET /add-project-details/{id} redirects to sign-in', async ({
        page
      }) => {
        await page.goto(
          '/add-project-details/00000000-0000-0000-0000-000000000000'
        )

        await expect(page).not.toHaveURL(/\/add-project-details/)
        await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
      })
    }
  )
})
