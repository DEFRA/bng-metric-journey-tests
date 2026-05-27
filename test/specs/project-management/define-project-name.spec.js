import { test, expect } from '@fixtures'
import { STORAGE_STATE, NO_ROLE_STORAGE_STATE, runMode } from '@utils/env.js'

const PROJECT_NAME_MAX_LENGTH = 1000
const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

test.describe('project-management', { tag: '@project-management' }, () => {
  // ─── Form display ───────────────────────────────────────────────────────────

  test.describe('Define project name — form display', () => {
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
  })

  // ─── Validation ─────────────────────────────────────────────────────────────

  test.describe('Define project name — validation', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

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

    test('on validation error the input is pre-filled with the submitted value', async ({
      defineProjectNamePage
    }) => {
      const oversizedName = 'a'.repeat(PROJECT_NAME_MAX_LENGTH + 1)
      await defineProjectNamePage.open()
      await defineProjectNamePage.enterProjectName(oversizedName)
      await defineProjectNamePage.submit()

      await expect(defineProjectNamePage.nameInput).toHaveValue(oversizedName)
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
  })

  // ─── Back link ──────────────────────────────────────────────────────────────

  test.describe('Define project name — back link', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test('clicking "Back" link navigates to /manage-projects', async ({
      createProjectFlow,
      defineProjectNamePage,
      page
    }) => {
      await createProjectFlow.createProject(`Back link test ${Date.now()}`)
      await defineProjectNamePage.open()
      await defineProjectNamePage.backLink.click()

      await expect(page).toHaveURL(/\/manage-projects/)
    })
  })

  // ─── Role enforcement ────────────────────────────────────────────────────────

  test.describe('Define project name — role enforcement', () => {
    test.use({ storageState: NO_ROLE_STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test(
      'authenticated user without bng completer role is redirected to /auth/forbidden',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto('/project-name')

        await expect(page).toHaveURL(/\/auth\/forbidden/)
      }
    )
  })

  // ─── Unauthenticated access ──────────────────────────────────────────────────

  test.describe('Define project name — unauthenticated access', () => {
    test('GET /project-name redirects to sign-in', async ({ page }) => {
      await page.goto('/project-name')

      await expect(page).not.toHaveURL(/\/project-name/)
      await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
    })
  })
})
