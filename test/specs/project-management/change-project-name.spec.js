import { test, expect } from '@fixtures'
import { STORAGE_STATE, NO_ROLE_STORAGE_STATE, skipInE2e } from '@utils/env.js'

const PROJECT_NAME_MAX_LENGTH = 1000
const HTTP_BAD_REQUEST = 400
const HTTP_NOT_FOUND = 404
const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

async function setupProject(createProjectFlow, projectDashboardPage) {
  const name = `Change name test ${Date.now()}`
  await createProjectFlow.createProject(name)
  const href = await projectDashboardPage.projectLink(name).getAttribute('href')
  const id = href.split('/').pop()
  return { id, name }
}

test.describe('project-management', { tag: '@project-management' }, () => {
  // ─── Form display ────────────────────────────────────────────────────────────

  test.describe('Change project name — form display', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'form renders pre-populated with existing project name',
      { tag: '@smoke' },
      async ({
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
        await expect(changeProjectNamePage.nameHint).toBeVisible()
        await expect(changeProjectNamePage.backLink).toBeVisible()
        await expect(changeProjectNamePage.saveAndContinueButton).toBeVisible()
      }
    )
  })

  // ─── Validation ──────────────────────────────────────────────────────────────

  test.describe('Change project name — validation', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'submitting empty name shows "Enter a project name" error',
      { tag: '@smoke' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        changeProjectNamePage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await changeProjectNamePage.open(id)
        await changeProjectNamePage.enterName('')
        await changeProjectNamePage.submit()

        await expect(page).toHaveTitle(
          'Error: Project Name - Biodiversity Net Gain'
        )
        await expect(page).toHaveURL(new RegExp(`/change-project-name/${id}`))
        await changeProjectNamePage.assertNameError('Enter a project name')
      }
    )

    test(
      'submitting whitespace-only name shows "Enter a project name" error',
      { tag: '@regression' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        changeProjectNamePage
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await changeProjectNamePage.open(id)
        await changeProjectNamePage.enterName('   ')
        await changeProjectNamePage.submit()

        await changeProjectNamePage.assertNameError('Enter a project name')
      }
    )

    test(
      'submitting name over 1000 characters shows length error',
      { tag: '@regression' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        changeProjectNamePage
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await changeProjectNamePage.open(id)
        await changeProjectNamePage.enterName(
          'a'.repeat(PROJECT_NAME_MAX_LENGTH + 1)
        )
        await changeProjectNamePage.submit()

        await changeProjectNamePage.assertNameError(
          'Project name must be 1000 characters or fewer'
        )
      }
    )

    test(
      'submitting name with control characters shows invalid characters error',
      { tag: '@regression' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        changeProjectNamePage
      }) => {
        test.skip(
          process.env.BROWSER === 'firefox',
          'Firefox automation strips all C0 control characters (0x00–0x1f) from text inputs before form submission; backend validation covered by Chromium and WebKit runs'
        )
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await changeProjectNamePage.open(id)
        await changeProjectNamePage.enterName('Project\x01Name')
        await changeProjectNamePage.submit()

        await changeProjectNamePage.assertNameError(
          'Project name must only contain valid characters'
        )
      }
    )
  })

  // ─── Happy path ──────────────────────────────────────────────────────────────

  test.describe('Change project name — happy path', { tag: '@smoke' }, () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

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

      await expect(page).toHaveURL(new RegExp(`/add-project-details/${id}`))
      await expect(page.getByText(newName)).toBeVisible()

      await projectDashboardPage.open()
      const projectRow = page
        .getByTestId('projects-table')
        .getByRole('row')
        .filter({ hasText: newName })
      await expect(projectRow.getByRole('cell').nth(1)).toContainText(
        /\d{1,2} \w+ \d{4} at \d{1,2}:\d{2}(am|pm)/
      )
    })
  })

  // ─── Back link ───────────────────────────────────────────────────────────────

  test.describe(
    'Change project name — back link',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('clicking "Back" navigates to the project task list', async ({
        createProjectFlow,
        projectDashboardPage,
        changeProjectNamePage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await changeProjectNamePage.open(id)
        await changeProjectNamePage.backLink.click()

        await expect(page).toHaveURL(new RegExp(`/add-project-details/${id}`))
      })
    }
  )

  // ─── Role enforcement ────────────────────────────────────────────────────────

  test.describe(
    'Change project name — role enforcement',
    { tag: '@regression' },
    () => {
      test.use({ storageState: NO_ROLE_STORAGE_STATE })
      test.skip(skipInE2e(NO_ROLE_STORAGE_STATE), E2E_SKIP_REASON)

      test('authenticated user without bng completer role is redirected to /auth/forbidden', async ({
        page
      }) => {
        await page.goto(
          '/change-project-name/00000000-0000-0000-0000-000000000000'
        )

        await expect(page).toHaveURL(/\/auth\/forbidden/)
      })
    }
  )

  // ─── Unauthenticated access ──────────────────────────────────────────────────

  test.describe('Change project name — unauthenticated access', () => {
    test(
      'GET /change-project-name/{id} redirects to sign-in',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto(
          '/change-project-name/00000000-0000-0000-0000-000000000000'
        )

        await expect(page).not.toHaveURL(/\/change-project-name/)
        await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
      }
    )
  })

  // ─── Route parameter validation ──────────────────────────────────────────────

  test.describe(
    'Change project name — route parameter validation',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('non-UUID id path param returns 400', async ({ page }) => {
        const response = await page.goto('/change-project-name/not-a-uuid')

        expect(response.status()).toBe(HTTP_BAD_REQUEST)
      })
    }
  )

  // ─── Project not found ───────────────────────────────────────────────────────

  test.describe(
    'Change project name — project not found',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('valid but unknown project UUID shows an error page, not the form', async ({
        changeProjectNamePage,
        page
      }) => {
        // Unlike the task list route, this handler has no graceful 404 render.
        // Wreck throws a Boom carrying the backend's 404, which propagates
        // uncaught from the handler, so the user gets a 404 error page.
        const response = await page.goto(
          '/change-project-name/00000000-0000-0000-0000-000000000000'
        )

        expect(response.status()).toBe(HTTP_NOT_FOUND)
        await expect(changeProjectNamePage.nameInput).not.toBeVisible()
      })
    }
  )
})
