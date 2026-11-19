import { test, expect } from '@fixtures'
import { projectIdFromHref } from '@utils/project-helpers.js'
import { noBaselineSummaryRedirectHref } from '@utils/upload-file-navigation.js'
import {
  STORAGE_STATE,
  NO_PROJECTS_STORAGE_STATE,
  NO_ROLE_STORAGE_STATE,
  baseUrl,
  skipInE2e
} from '@utils/env.js'
import {
  ALL_UNIT_TYPES_PI_FILE,
  buildPostInterventionOnlyProject,
  getAllUnitTypesPostInterventionProject
} from '@utils/summary-projects.js'
import { CreateProjectFlow } from '@flows/project-management/create-project.flow.js'
import { ProjectDashboardPage } from '@pages/project-dashboard.page.js'
import {
  LPA_DEFAULT_OPTION,
  PROJECT_DETAILS,
  ProjectDetailsPage
} from '@pages/project-details.page.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const HTTP_BAD_REQUEST = 400
const HTTP_NOT_FOUND = 404
// Create + post-intervention upload, run in beforeAll.
const UPLOAD_BUILD_TIMEOUT = 180_000
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
// Matches the reference pattern the frontend checks, but is not in the list.
const UNKNOWN_LPA_REFERENCE = 'E60099999'
// BMD-849 error wording. Only the project name's is confirmed; the rest is
// interim in the frontend's error-text.yaml.
const NAME_REQUIRED = 'Enter a project name'
const SURVEY_COMPLETED_BY_INVALID =
  'Survey completed by must only contain valid characters'
const DATE_MISSING_MONTH_AND_YEAR = 'Survey date must include month and year'
const LPA_NOT_IN_LIST = 'Select a local planning authority from the list'
const ERROR_CLASS = /govuk-input--error/
const HEDGEROWS_POST_INTERVENTION = 'hedgerows-post-intervention'

async function setupProject(createProjectFlow, projectDashboardPage) {
  const name = `Project details test ${Date.now()}`
  await createProjectFlow.createProject(name)
  const href = await projectDashboardPage.projectLink(name).getAttribute('href')
  const id = projectIdFromHref(href)
  return { id, name }
}

// Opened by URL, so there is no returnUrl: Save falls back to the project
// summary, which passes a project with no baseline on to /upload-file
// (BMD-1076).
async function fillAndSave(projectDetailsPage, page, id, values) {
  await projectDetailsPage.open(id)
  await projectDetailsPage.fill(values)
  await projectDetailsPage.submit()
  await expect(page).toHaveURL(noBaselineSummaryRedirectHref(id))
}

function hedgerowsPostInterventionPath(id) {
  return `/projects/${id}/${HEDGEROWS_POST_INTERVENTION}`
}

// The page's own "Project details" nav link, as BMD-849 adds it to every page
// with the left navigation: it names the page as returnUrl.
async function openDetailsFromHedgerowsPostIntervention(
  hedgerowsPostInterventionPage,
  page,
  id
) {
  await hedgerowsPostInterventionPage.open(id)
  const link = hedgerowsPostInterventionPage.navLink(PROJECT_DETAILS)
  await expect(link).toHaveAttribute(
    'href',
    `/project-details/${id}?returnUrl=${encodeURIComponent(hedgerowsPostInterventionPath(id))}`
  )
  await link.click()
  await expect(page).toHaveURL(new RegExp(`/project-details/${id}\\?`))
}

test.describe('project-management', { tag: '@project-management' }, () => {
  // ─── Form display ────────────────────────────────────────────────────────────

  test.describe('Project details — form display', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'form renders the heading, help text and fields in order, with only the project name filled',
      { tag: ['@smoke', '@happy-path'] },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage
      }) => {
        const { id, name } = await setupProject(
          createProjectFlow,
          projectDashboardPage
        )
        await projectDetailsPage.open(id)

        await expect(projectDetailsPage.heading).toBeVisible()
        await expect(projectDetailsPage.helpText).toBeVisible()
        await expect(projectDetailsPage.currentNavItem).toHaveAttribute(
          'aria-current',
          'page'
        )
        await projectDetailsPage.assertFieldsInOrder()
        await projectDetailsPage.assertValues({ projectName: name })
        // The options come from the backend's LPA list: the default option
        // first, then each authority by name, carrying its Planning Data
        // reference as its value.
        await expect(
          projectDetailsPage.localPlanningAuthoritySelect.getByRole('option')
        ).not.toHaveCount(1)
        await expect(
          projectDetailsPage.localPlanningAuthoritySelect
            .getByRole('option')
            .first()
        ).toHaveText(LPA_DEFAULT_OPTION)
        await expect(
          projectDetailsPage.localPlanningAuthorityOption(ADUR_LPA.name)
        ).toHaveAttribute('value', ADUR_LPA.reference)
        await expect(projectDetailsPage.saveButton).toBeVisible()
        await expect(projectDetailsPage.cancelLink).toBeVisible()
        await expect(projectDetailsPage.errorSummary).toHaveCount(0)
      }
    )
  })

  // ─── Validation ──────────────────────────────────────────────────────────────

  test.describe('Project details — validation', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    // BMD-849 AC10. Each rule is unit-tested in the frontend (validation.js,
    // controller.test.js); this is the browser witness that they are all
    // shown at once, in field order, that the date input highlights only the
    // parts at fault, and that a refusal saves nothing, a valid change
    // included.
    test(
      'a blank name, an invalid character and a partial date are refused together, saving nothing',
      { tag: '@smoke' },
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
        await projectDetailsPage.fill({
          projectName: '   ',
          surveyCompletedBy: 'Jane\tEcologist',
          day: '3',
          applicant: 'Acme Developments Ltd'
        })
        await projectDetailsPage.submit()

        await expect(page).toHaveURL(new RegExp(`/project-details/${id}`))
        await expect(page).toHaveTitle(/^Error:/)
        await projectDetailsPage.assertErrorSummaryFocused()
        const errors = [
          [NAME_REQUIRED, '#projectName'],
          [SURVEY_COMPLETED_BY_INVALID, '#surveyCompleters'],
          // GOV.UK date input: the link goes to the first box at fault.
          [DATE_MISSING_MONTH_AND_YEAR, '#surveyCompletionDate-month']
        ]
        await expect(projectDetailsPage.errorSummaryLinks).toHaveText(
          errors.map(([text]) => text)
        )
        for (const [text, href] of errors) {
          await expect(
            projectDetailsPage.errorSummaryLinks.filter({ hasText: text })
          ).toHaveAttribute('href', href)
          await expect(projectDetailsPage.inlineError(text)).toBeVisible()
        }
        await expect(projectDetailsPage.dayInput).not.toHaveClass(ERROR_CLASS)
        await expect(projectDetailsPage.monthInput).toHaveClass(ERROR_CLASS)
        await expect(projectDetailsPage.yearInput).toHaveClass(ERROR_CLASS)
        await projectDetailsPage.assertValues({
          projectName: '   ',
          surveyCompletedBy: 'Jane\tEcologist',
          day: '3',
          applicant: 'Acme Developments Ltd'
        })

        await projectDetailsPage.open(id)
        await projectDetailsPage.assertValues({ projectName: name })
      }
    )

    // Sole witness that the backend's real 400 for an unknown LPA reference
    // reaches the frontend's re-render branch. The backend integration suite
    // proves the 400 (project-details.test.js "rejects invalid LPA selection")
    // and the frontend unit suite renders the error from a mocked 400; nothing
    // else joins the two. Do not delete without an integration-level check of
    // that contract.
    test(
      'a local planning authority no longer on the list shows an error and keeps the saved one',
      { tag: '@regression' },
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
          surveyCompletedBy: 'J. Smith'
        })
        await projectDetailsPage.submit()

        await expect(projectDetailsPage.errorSummaryLinks).toHaveText([
          LPA_NOT_IN_LIST
        ])
        await expect(
          projectDetailsPage.inlineError(LPA_NOT_IN_LIST)
        ).toBeVisible()
        await expect(projectDetailsPage.surveyCompletedByInput).toHaveValue(
          'J. Smith'
        )

        await projectDetailsPage.open(id)
        await projectDetailsPage.assertValues({
          projectName: name,
          localPlanningAuthority: BATH_LPA.name
        })
      }
    )
  })

  // ─── Persistence ─────────────────────────────────────────────────────────────

  test.describe('Project details — persistence', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'form pre-fills every saved value trimmed, and resubmitting updates them (not create-only)',
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

        await fillAndSave(projectDetailsPage, page, id, {
          projectName: `  ${name}  `,
          surveyCompletedBy: '  J. Smith, A. Jones ',
          day: '15',
          month: '3',
          year: '2026',
          applicant: ' Acme Developments Ltd  ',
          localPlanningAuthority: BATH_LPA.name,
          planningApplicationReference: '  24/01234/FUL',
          planningApplicationType: 'Outline planning permission   '
        })

        await projectDetailsPage.open(id)
        await projectDetailsPage.assertValues({
          projectName: name,
          surveyCompletedBy: 'J. Smith, A. Jones',
          day: '15',
          month: '03',
          year: '2026',
          applicant: 'Acme Developments Ltd',
          localPlanningAuthority: BATH_LPA.name,
          planningApplicationReference: '24/01234/FUL',
          planningApplicationType: 'Outline planning permission'
        })

        // Resubmit with different values — must UPDATE the same record, not
        // create a second one or leave the old values in place.
        const renamed = `${name} renamed`
        const updated = {
          projectName: renamed,
          surveyCompletedBy: 'R. Patel',
          day: '22',
          month: '7',
          year: '2025',
          applicant: 'Updated Developments Ltd',
          localPlanningAuthority: ADUR_LPA.name,
          planningApplicationReference: 'APP/25/0099',
          planningApplicationType: 'Full planning permission – minor'
        }
        await fillAndSave(projectDetailsPage, page, id, updated)

        await projectDetailsPage.open(id)
        await projectDetailsPage.assertValues({ ...updated, month: '07' })
      }
    )

    test(
      'blank fields and the default authority clear every saved value but the name',
      { tag: ['@regression', '@happy-path'] },
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
        await fillAndSave(projectDetailsPage, page, id, {
          surveyCompletedBy: 'J. Smith',
          day: '15',
          month: '3',
          year: '2026',
          applicant: 'Acme Developments Ltd',
          localPlanningAuthority: BATH_LPA.name,
          planningApplicationReference: '24/01234/FUL',
          planningApplicationType: 'Outline planning permission'
        })

        await fillAndSave(projectDetailsPage, page, id, {
          surveyCompletedBy: '',
          day: '',
          month: '',
          year: '',
          applicant: '  ',
          localPlanningAuthority: LPA_DEFAULT_OPTION,
          planningApplicationReference: '',
          planningApplicationType: ''
        })

        await projectDetailsPage.open(id)
        await projectDetailsPage.assertValues({ projectName: name })
      }
    )
  })

  // ─── Left navigation ─────────────────────────────────────────────────────────

  test.describe(
    'Project details — left navigation',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ timeout: UPLOAD_BUILD_TIMEOUT })

      let project

      test.beforeAll(async ({ browser }) => {
        project = await getAllUnitTypesPostInterventionProject(browser)
      })

      // BMD-849 AC1 and AC9. Sole witness that a real page's nav link carries
      // its own path as returnUrl, and that Cancel follows it: the frontend's
      // navigation and controller tests build and follow the link without a
      // real project. Saves nothing, so the shared project is untouched.
      test('the nav link opens Project details as the current page, and Cancel returns to the page it came from, saving nothing', async ({
        hedgerowsPostInterventionPage,
        projectDetailsPage,
        page
      }) => {
        const { id, name } = project
        await openDetailsFromHedgerowsPostIntervention(
          hedgerowsPostInterventionPage,
          page,
          id
        )
        await expect(projectDetailsPage.currentNavItem).toHaveAttribute(
          'aria-current',
          'page'
        )
        await projectDetailsPage.assertValues({ projectName: name })

        await projectDetailsPage.fill({
          projectName: 'Not saved',
          applicant: 'Not saved either',
          day: '2',
          localPlanningAuthority: ADUR_LPA.name
        })
        await projectDetailsPage.cancelLink.click()

        await expect(page).toHaveURL(hedgerowsPostInterventionPath(id))
        await expect(hedgerowsPostInterventionPage.caption(name)).toBeVisible()
        await openDetailsFromHedgerowsPostIntervention(
          hedgerowsPostInterventionPage,
          page,
          id
        )
        await projectDetailsPage.assertValues({ projectName: name })
      })
    }
  )

  // ─── Save and return ─────────────────────────────────────────────────────────

  test.describe(
    'Project details — save and return',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ timeout: UPLOAD_BUILD_TIMEOUT })

      let project

      // Its own project: the save renames it.
      test.beforeAll(async ({ browser }) => {
        project = await buildPostInterventionOnlyProject(
          browser,
          ALL_UNIT_TYPES_PI_FILE
        )
      })

      // BMD-849 AC8. Sole witness for a save following a real page's
      // returnUrl, and for the new name reaching that page and the dashboard:
      // the frontend's controller tests redirect to a mocked returnUrl, and
      // the backend's integration test saves the name through the API.
      test('saving returns to the page the link was followed from, under the new name', async ({
        hedgerowsPostInterventionPage,
        projectDashboardPage,
        projectDetailsPage,
        page
      }) => {
        const { id } = project
        const renamed = `Project details saved ${Date.now()}`
        await openDetailsFromHedgerowsPostIntervention(
          hedgerowsPostInterventionPage,
          page,
          id
        )
        await projectDetailsPage.fill({
          projectName: renamed,
          applicant: 'Riverside Homes Ltd'
        })
        await projectDetailsPage.submit()

        await expect(page).toHaveURL(hedgerowsPostInterventionPath(id))
        await expect(
          hedgerowsPostInterventionPage.caption(renamed)
        ).toBeVisible()

        await projectDashboardPage.open()
        await expect(projectDashboardPage.projectLink(renamed)).toHaveAttribute(
          'href',
          new RegExp(id)
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
      test('GET /project-details/{id} redirects to access denied', async ({
        page
      }) => {
        await page.goto(`/project-details/${VALID_UUID_V4}`)

        await expect(page).not.toHaveURL(/\/project-details/)
        await expect(page).toHaveURL(/\/auth\/forbidden$/)
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
          // The details must be saved, or a 404 below would prove nothing.
          await expect(creatorPage).toHaveURL(noBaselineSummaryRedirectHref(id))
          await creatorDetails.open(id)
          await expect(creatorDetails.applicantInput).toHaveValue(
            'Isolation Developments Ltd'
          )

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
