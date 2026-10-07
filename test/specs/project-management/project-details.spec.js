import { test, expect } from '@fixtures'
import { projectIdFromHref } from '@utils/project-helpers.js'
import {
  STORAGE_STATE,
  NO_PROJECTS_STORAGE_STATE,
  NO_ROLE_STORAGE_STATE,
  baseUrl,
  skipInE2e
} from '@utils/env.js'
import { CreateProjectFlow } from '@flows/project-management/create-project.flow.js'
import { ProjectDashboardPage } from '@pages/project-dashboard.page.js'
import { ProjectDetailsPage } from '@pages/project-details.page.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const HTTP_BAD_REQUEST = 400
const HTTP_NOT_FOUND = 404
const MAX_TEXT_FIELD_LENGTH = 500
// projectId is validated as a strict UUIDv4 (Joi .guid({ version: 'uuidv4' })),
// unlike other routes' plain .uuid() — the all-zero UUID fails that stricter
// check with 400 before the handler runs, so use a syntactically valid v4.
const VALID_UUID_V4 = 'aaaaaaaa-bbbb-4ccc-bddd-eeeeeeeeeeee'
// Entries from the backend's static Planning Data LPA list (BMD-1012). The
// select shows the name; its value is the Planning Data reference.
const BATH_LPA = {
  name: 'Bath and North East Somerset LPA',
  reference: 'E60000288'
}
const ADUR_LPA = { name: 'Adur LPA', reference: 'E60000281' }
const LPA_PLACEHOLDER = 'Select a Local Planning Authority'
// Matches the reference pattern the frontend checks, but is not in the list.
const UNKNOWN_LPA_REFERENCE = 'E60099999'

async function setupProject(createProjectFlow, projectDashboardPage) {
  const name = `Project details test ${Date.now()}`
  await createProjectFlow.createProject(name)
  const href = await projectDashboardPage.projectLink(name).getAttribute('href')
  const id = projectIdFromHref(href)
  return { id, name }
}

async function fillAndSave(projectDetailsPage, page, id, values) {
  await projectDetailsPage.open(id)
  await projectDetailsPage.fill(values)
  await projectDetailsPage.submit()
  await expect(page).toHaveURL(new RegExp(`/projects/${id}/project-summary`))
}

async function assertDetailsMatch(
  projectDetailsPage,
  {
    localPlanningAuthorityReference,
    surveyCompleters,
    day,
    month,
    year,
    developmentType,
    nsips,
    applicant
  }
) {
  await expect(projectDetailsPage.localPlanningAuthoritySelect).toHaveValue(
    localPlanningAuthorityReference
  )
  await expect(projectDetailsPage.surveyCompletersInput).toHaveValue(
    surveyCompleters
  )
  await expect(projectDetailsPage.dayInput).toHaveValue(day)
  await expect(projectDetailsPage.monthInput).toHaveValue(month)
  await expect(projectDetailsPage.yearInput).toHaveValue(year)
  await expect(
    developmentType === 'Small site'
      ? projectDetailsPage.smallSiteRadio
      : projectDetailsPage.largeSiteRadio
  ).toBeChecked()
  await expect(
    nsips === 'Yes'
      ? projectDetailsPage.nsipsYesRadio
      : projectDetailsPage.nsipsNoRadio
  ).toBeChecked()
  await expect(projectDetailsPage.applicantInput).toHaveValue(applicant)
}

test.describe('project-management', { tag: '@project-management' }, () => {
  // ─── Form display ────────────────────────────────────────────────────────────

  test.describe('Project details — form display', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'form renders with heading, caption, back link and all fields empty',
      { tag: ['@smoke', '@happy-path'] },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage,
        page
      }) => {
        const { id, name } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await projectDetailsPage.open(id)

        await expect(projectDetailsPage.heading).toBeVisible()
        await expect(page.getByText(name)).toBeVisible()
        await expect(projectDetailsPage.backLink).toBeVisible()

        await expect(
          projectDetailsPage.localPlanningAuthoritySelect
        ).toHaveValue('')
        await expect(
          projectDetailsPage.localPlanningAuthorityOption(LPA_PLACEHOLDER)
        ).toHaveJSProperty('selected', true)
        // The options come from the backend's LPA list: each shows the name
        // and carries the Planning Data reference as its value.
        await expect(
          projectDetailsPage.localPlanningAuthorityOption(ADUR_LPA.name)
        ).toHaveAttribute('value', ADUR_LPA.reference)
        await expect(projectDetailsPage.surveyCompletersInput).toHaveValue('')
        await expect(projectDetailsPage.dayInput).toHaveValue('')
        await expect(projectDetailsPage.monthInput).toHaveValue('')
        await expect(projectDetailsPage.yearInput).toHaveValue('')
        await expect(projectDetailsPage.smallSiteRadio).not.toBeChecked()
        await expect(projectDetailsPage.largeSiteRadio).not.toBeChecked()
        await expect(projectDetailsPage.nsipsYesRadio).not.toBeChecked()
        await expect(projectDetailsPage.nsipsNoRadio).not.toBeChecked()
        await expect(projectDetailsPage.applicantInput).toHaveValue('')
        await expect(projectDetailsPage.saveAndContinueButton).toBeVisible()
      }
    )
  })

  // ─── Validation ──────────────────────────────────────────────────────────────

  test.describe('Project details — validation', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'invalid survey completion date shows "must be a real date" error',
      { tag: '@smoke' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await projectDetailsPage.open(id)
        await projectDetailsPage.fill({ day: '31', month: '2', year: '2026' })
        await projectDetailsPage.submit()

        await projectDetailsPage.assertFieldError(
          'Survey completion date must be a real date'
        )
      }
    )

    // Local Planning Authority is a select since BMD-1012, so no free-text
    // length rule is reachable from the UI. A malformed reference is rejected
    // by the frontend alone and unit-tested there (controller.test.js).

    // Sole witness that the backend's real 400 for an unknown LPA reference
    // reaches the frontend's re-render branch. The backend integration suite
    // proves the 400 (project-details.test.js "rejects invalid LPA selection")
    // and the frontend unit suite renders the error from a mocked 400; nothing
    // else joins the two. Do not delete without an integration-level check of
    // that contract.
    test(
      'a Local Planning Authority no longer on the list shows an error and keeps the saved one',
      { tag: '@regression' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await fillAndSave(projectDetailsPage, page, id, {
          localPlanningAuthority: BATH_LPA.name
        })

        await projectDetailsPage.open(id)
        await projectDetailsPage.makeLocalPlanningAuthorityStale(
          ADUR_LPA.name,
          UNKNOWN_LPA_REFERENCE
        )
        await projectDetailsPage.fill({
          localPlanningAuthority: ADUR_LPA.name,
          surveyCompleters: 'J. Smith'
        })
        await projectDetailsPage.submit()

        await projectDetailsPage.assertFieldError(
          'Select a Local Planning Authority from the list'
        )
        await expect(projectDetailsPage.surveyCompletersInput).toHaveValue(
          'J. Smith'
        )

        await projectDetailsPage.open(id)
        await expect(
          projectDetailsPage.localPlanningAuthoritySelect
        ).toHaveValue(BATH_LPA.reference)
      }
    )

    test(
      'Survey completer(s) over 500 characters shows a length error',
      { tag: '@regression' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await projectDetailsPage.open(id)
        await projectDetailsPage.fill({
          surveyCompleters: 'a'.repeat(MAX_TEXT_FIELD_LENGTH + 1)
        })
        await projectDetailsPage.submit()

        await projectDetailsPage.assertFieldError(
          '"surveyCompleters" length must be less than or equal to 500 characters long'
        )
      }
    )

    test(
      'Applicant over 500 characters shows a length error',
      { tag: '@regression' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await projectDetailsPage.open(id)
        await projectDetailsPage.fill({
          applicant: 'a'.repeat(MAX_TEXT_FIELD_LENGTH + 1)
        })
        await projectDetailsPage.submit()

        await projectDetailsPage.assertFieldError(
          '"applicant" length must be less than or equal to 500 characters long'
        )
      }
    )

    test(
      'survey completion date missing one part shows "must include a year" error',
      { tag: '@regression' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await projectDetailsPage.open(id)
        await projectDetailsPage.fill({ day: '15', month: '3' })
        await projectDetailsPage.submit()

        await projectDetailsPage.assertFieldError(
          'Survey completion date must include a year'
        )
      }
    )

    test(
      'survey completion date missing two parts shows "must include month and year" error',
      { tag: '@regression' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await projectDetailsPage.open(id)
        await projectDetailsPage.fill({ day: '15' })
        await projectDetailsPage.submit()

        await projectDetailsPage.assertFieldError(
          'Survey completion date must include month and year'
        )
      }
    )

    test(
      'a validation error preserves previously typed values in other fields',
      { tag: '@regression' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await projectDetailsPage.open(id)
        await projectDetailsPage.fill({
          localPlanningAuthority: BATH_LPA.name,
          surveyCompleters: 'J. Smith',
          day: '31',
          month: '2',
          year: '2026'
        })
        await projectDetailsPage.submit()

        await projectDetailsPage.assertFieldError(
          'Survey completion date must be a real date'
        )
        await expect(
          projectDetailsPage.localPlanningAuthoritySelect
        ).toHaveValue(BATH_LPA.reference)
        await expect(projectDetailsPage.surveyCompletersInput).toHaveValue(
          'J. Smith'
        )
      }
    )
  })

  // ─── Happy path ──────────────────────────────────────────────────────────────

  test.describe(
    'Project details — happy path',
    { tag: ['@smoke', '@happy-path'] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('submitting valid values redirects to the project summary', async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await fillAndSave(projectDetailsPage, page, id, {
          localPlanningAuthority: BATH_LPA.name,
          surveyCompleters: 'J. Smith, A. Jones',
          day: '15',
          month: '3',
          year: '2026',
          developmentType: 'Small site',
          nsips: 'No',
          applicant: 'Acme Developments Ltd'
        })
      })
    }
  )

  // ─── Persistence ─────────────────────────────────────────────────────────────

  test.describe('Project details — persistence', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'form pre-fills from previously saved values, and resubmitting updates them (not create-only)',
      { tag: ['@smoke', '@happy-path'] },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )

        await fillAndSave(projectDetailsPage, page, id, {
          localPlanningAuthority: BATH_LPA.name,
          surveyCompleters: 'J. Smith, A. Jones',
          day: '15',
          month: '3',
          year: '2026',
          developmentType: 'Small site',
          nsips: 'No',
          applicant: 'Acme Developments Ltd'
        })

        await projectDetailsPage.open(id)
        await assertDetailsMatch(projectDetailsPage, {
          localPlanningAuthorityReference: BATH_LPA.reference,
          surveyCompleters: 'J. Smith, A. Jones',
          day: '15',
          month: '03',
          year: '2026',
          developmentType: 'Small site',
          nsips: 'No',
          applicant: 'Acme Developments Ltd'
        })

        // Resubmit with different values — must UPDATE the same record, not
        // create a second one or leave the old values in place.
        await fillAndSave(projectDetailsPage, page, id, {
          localPlanningAuthority: ADUR_LPA.name,
          surveyCompleters: 'R. Patel',
          day: '22',
          month: '7',
          year: '2027',
          developmentType: 'Large site',
          nsips: 'Yes',
          applicant: 'Updated Developments Ltd'
        })

        await projectDetailsPage.open(id)
        await assertDetailsMatch(projectDetailsPage, {
          localPlanningAuthorityReference: ADUR_LPA.reference,
          surveyCompleters: 'R. Patel',
          day: '22',
          month: '07',
          year: '2027',
          developmentType: 'Large site',
          nsips: 'Yes',
          applicant: 'Updated Developments Ltd'
        })
      }
    )

    test(
      'choosing the placeholder clears a saved Local Planning Authority',
      { tag: ['@regression', '@happy-path'] },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await fillAndSave(projectDetailsPage, page, id, {
          localPlanningAuthority: BATH_LPA.name,
          applicant: 'Acme Developments Ltd'
        })

        await fillAndSave(projectDetailsPage, page, id, {
          localPlanningAuthority: LPA_PLACEHOLDER
        })

        await projectDetailsPage.open(id)
        await expect(
          projectDetailsPage.localPlanningAuthoritySelect
        ).toHaveValue('')
        await expect(projectDetailsPage.applicantInput).toHaveValue(
          'Acme Developments Ltd'
        )
      }
    )
  })

  // ─── Back link ───────────────────────────────────────────────────────────────

  test.describe(
    'Project details — back link',
    { tag: ['@regression', '@happy-path'] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('clicking "Back" navigates to the project summary', async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await projectDetailsPage.open(id)
        await projectDetailsPage.backLink.click()

        await expect(page).toHaveURL(
          new RegExp(`/projects/${id}/project-summary`)
        )
      })
    }
  )

  // ─── Role enforcement ────────────────────────────────────────────────────────

  test.describe('Project details — role enforcement', { tag: '@smoke' }, () => {
    test.use({ storageState: NO_ROLE_STORAGE_STATE })
    test.skip(skipInE2e(NO_ROLE_STORAGE_STATE), E2E_SKIP_REASON)

    test('authenticated user without bng completer role is redirected to /auth/forbidden', async ({
      page
    }) => {
      await page.goto(`/project-details/${VALID_UUID_V4}`)

      await expect(page).toHaveURL(/\/auth\/forbidden/)
    })
  })

  // ─── Unauthenticated access ──────────────────────────────────────────────────

  test.describe(
    'Project details — unauthenticated access',
    { tag: '@smoke' },
    () => {
      test('GET /project-details/{id} redirects to sign-in', async ({
        page
      }) => {
        await page.goto(`/project-details/${VALID_UUID_V4}`)

        await expect(page).not.toHaveURL(/\/project-details/)
        await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
      })
    }
  )

  // ─── Route parameter validation ──────────────────────────────────────────────

  test.describe(
    'Project details — route parameter validation',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('non-UUID projectId returns 400', async ({ page }) => {
        const response = await page.goto('/project-details/not-a-uuid')

        expect(response.status()).toBe(HTTP_BAD_REQUEST)
      })
    }
  )

  // ─── Project not found ───────────────────────────────────────────────────────

  test.describe(
    'Project details — project not found',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('valid but unknown project UUID shows an error page, not the form', async ({
        projectDetailsPage,
        page
      }) => {
        const response = await page.goto(`/project-details/${VALID_UUID_V4}`)

        expect(response.status()).toBe(HTTP_NOT_FOUND)
        await expect(
          projectDetailsPage.localPlanningAuthoritySelect
        ).not.toBeVisible()
      })
    }
  )

  // ─── Cross-user visibility ───────────────────────────────────────────────────
  // DoD: a project's details must not be visible to any other user, even when
  // that user opens the project's details URL directly (IDOR).

  test.describe(
    'Project details — cross-user visibility',
    { tag: '@regression' },
    () => {
      test.skip(skipInE2e(NO_PROJECTS_STORAGE_STATE), E2E_SKIP_REASON)

      test("a project's saved details are not visible to a different user via direct URL", async ({
        browser
      }) => {
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
          const creatorDetails = new ProjectDetailsPage(creatorPage)
          const { id } = await setupProject(
            new CreateProjectFlow(creatorPage),
            creatorDashboard
          )
          await creatorDetails.open(id)
          await creatorDetails.fill({
            localPlanningAuthority: BATH_LPA.name,
            applicant: 'Isolation Developments Ltd'
          })
          await creatorDetails.submit()

          const otherPage = await otherContext.newPage()
          const response = await otherPage.goto(`/project-details/${id}`)

          expect(response.status()).toBe(HTTP_NOT_FOUND)
          await expect(
            otherPage.getByText('Isolation Developments Ltd')
          ).toBeHidden()
        } finally {
          await creatorContext.close()
          await otherContext.close()
        }
      })
    }
  )
})
