import { randomUUID } from 'node:crypto'
import { test, expect } from '@fixtures'
import { setupProject } from '@utils/project-helpers.js'
import { AREA_REFS_BASELINE_FILE } from '@utils/summary-projects.js'
import { noBaselineSummaryRedirectHref } from '@utils/upload-file-navigation.js'
import { SUMMARY } from '@utils/unit-type-labels.js'
import {
  STORAGE_STATE,
  NO_ROLE_STORAGE_STATE,
  NO_PROJECTS_STORAGE_STATE,
  baseUrl,
  skipInE2e
} from '@utils/env.js'
import { CreateProjectFlow } from '@flows/project-management/create-project.flow.js'
import { UploadBaselineFileFlow } from '@flows/upload-baseline/upload-baseline-file.flow.js'
import { ProjectDashboardPage } from '@pages/project-dashboard.page.js'
import {
  LPA_PLACEHOLDER,
  PROJECT_DETAILS_NAV_ITEM,
  ProjectDetailsPage
} from '@pages/project-details.page.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const HTTP_BAD_REQUEST = 400
const HTTP_NOT_FOUND = 404
const UPLOAD_TIMEOUT = 120_000
const PROJECT_LABEL = 'Project details test'
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
// The inputs' maxlength, as the description's Input Formats table sets them.
const MAX_LENGTHS = {
  projectNameInput: '1000',
  surveyCompletersInput: '255',
  dayInput: '2',
  monthInput: '2',
  yearInput: '4',
  applicantInput: '255',
  planningApplicationReferenceInput: '50',
  planningApplicationTypeInput: '100'
}

const ALL_DETAILS = {
  surveyCompleters: 'J. Smith, A. Jones',
  day: '15',
  month: '3',
  year: '2026',
  applicant: 'Acme Developments Ltd',
  localPlanningAuthority: BATH_LPA.name,
  planningApplicationReference: '24/01234/FUL',
  planningApplicationType: 'Outline planning permission'
}

// setupProject names a project by the millisecond, and this spec's tests run
// in parallel under one user, so a random part keeps two projects made in the
// same millisecond apart.
function uniqueLabel() {
  return `${PROJECT_LABEL} ${randomUUID().slice(0, 8)}`
}

function newProject(createProjectFlow, projectDashboardPage) {
  return setupProject(createProjectFlow, projectDashboardPage, uniqueLabel())
}

// With no returnUrl and no baseline, Save and Cancel go to the project
// summary, which sends a project with no baseline on to /upload-file
// (BMD-1076).
async function fillAndSave(projectDetailsPage, page, id, values) {
  await projectDetailsPage.open(id)
  await projectDetailsPage.fill(values)
  await projectDetailsPage.submit()
  await expect(page).toHaveURL(noBaselineSummaryRedirectHref(id))
}

async function assertDetailsMatch(projectDetailsPage, expected) {
  const fields = {
    projectName: projectDetailsPage.projectNameInput,
    surveyCompleters: projectDetailsPage.surveyCompletersInput,
    day: projectDetailsPage.dayInput,
    month: projectDetailsPage.monthInput,
    year: projectDetailsPage.yearInput,
    applicant: projectDetailsPage.applicantInput,
    localPlanningAuthorityReference:
      projectDetailsPage.localPlanningAuthoritySelect,
    planningApplicationReference:
      projectDetailsPage.planningApplicationReferenceInput,
    planningApplicationType: projectDetailsPage.planningApplicationTypeInput
  }
  for (const [key, value] of Object.entries(expected)) {
    await expect(fields[key], key).toHaveValue(value)
  }
}

test.describe('project-management', { tag: '@project-management' }, () => {
  // ─── Form display (AC2, AC4, AC5) ────────────────────────────────────────────

  test.describe('Project details — form display', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'with only the name saved, the form shows the name and every other field empty',
      { tag: ['@smoke', '@happy-path'] },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage
      }) => {
        const { id, name } = await newProject(
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

        await assertDetailsMatch(projectDetailsPage, {
          projectName: name,
          surveyCompleters: '',
          day: '',
          month: '',
          year: '',
          applicant: '',
          localPlanningAuthorityReference: '',
          planningApplicationReference: '',
          planningApplicationType: ''
        })
        await expect(
          projectDetailsPage.localPlanningAuthorityOption(LPA_PLACEHOLDER)
        ).toHaveJSProperty('selected', true)
        // The options come from the backend's LPA list: each shows the name
        // and carries the Planning Data reference as its value.
        await expect(
          projectDetailsPage.localPlanningAuthorityOption(ADUR_LPA.name)
        ).toHaveAttribute('value', ADUR_LPA.reference)

        await expect(projectDetailsPage.saveButton).toBeVisible()
        await expect(projectDetailsPage.cancelLink).toBeVisible()
        await expect(projectDetailsPage.errorSummary).toHaveCount(0)
      }
    )

    test(
      'the fields are in the order AC2 lists them',
      { tag: '@regression' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage
      }) => {
        const { id } = await newProject(createProjectFlow, projectDashboardPage)
        await projectDetailsPage.open(id)

        const tops = []
        for (const field of projectDetailsPage.fieldsInOrder()) {
          tops.push((await field.boundingBox()).y)
        }
        // Day, month and year share a row.
        expect(tops).toEqual([...tops].sort((a, b) => a - b))
      }
    )

    test(
      'each input stops at its maximum length',
      { tag: '@regression' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage
      }) => {
        const { id } = await newProject(createProjectFlow, projectDashboardPage)
        await projectDetailsPage.open(id)

        for (const [field, max] of Object.entries(MAX_LENGTHS)) {
          await expect(projectDetailsPage[field], field).toHaveAttribute(
            'maxlength',
            max
          )
        }
        await projectDetailsPage.planningApplicationReferenceInput.pressSequentially(
          'a'.repeat(Number(MAX_LENGTHS.planningApplicationReferenceInput) + 5)
        )
        await expect(
          projectDetailsPage.planningApplicationReferenceInput
        ).toHaveValue(
          'a'.repeat(Number(MAX_LENGTHS.planningApplicationReferenceInput))
        )
      }
    )
  })

  // ─── Validation (AC10) ───────────────────────────────────────────────────────

  test.describe('Project details — validation', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'a blank project name is refused, nothing is saved and every value is kept',
      { tag: '@smoke' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage,
        page
      }) => {
        const { id, name } = await newProject(
          createProjectFlow,
          projectDashboardPage
        )
        await projectDetailsPage.open(id)
        await projectDetailsPage.fill({ ...ALL_DETAILS, projectName: '   ' })
        await projectDetailsPage.submit()

        await expect(page).toHaveTitle(/^Error: Project details/)
        await projectDetailsPage.assertFieldError('Enter a project name')
        await projectDetailsPage.assertErrorSummaryFocused()
        await assertDetailsMatch(projectDetailsPage, {
          surveyCompleters: ALL_DETAILS.surveyCompleters,
          localPlanningAuthorityReference: BATH_LPA.reference,
          planningApplicationType: ALL_DETAILS.planningApplicationType
        })

        // All updates are rejected, the valid ones included.
        await projectDetailsPage.open(id)
        await assertDetailsMatch(projectDetailsPage, {
          projectName: name,
          surveyCompleters: '',
          localPlanningAuthorityReference: ''
        })
      }
    )

    test(
      'every failed rule is listed at once, each linking to its field',
      { tag: '@regression' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage
      }) => {
        const { id } = await newProject(createProjectFlow, projectDashboardPage)
        await projectDetailsPage.open(id)
        await projectDetailsPage.fill({
          projectName: '',
          day: '15',
          month: '',
          year: '2026'
        })
        await projectDetailsPage.submit()

        // In the order the page shows the fields.
        await expect(
          projectDetailsPage.errorSummary.getByRole('link')
        ).toHaveText([
          'Enter a project name',
          'Survey date must include a month'
        ])
        await projectDetailsPage.errorSummary
          .getByRole('link', { name: 'Survey date must include a month' })
          .click()
        await expect(projectDetailsPage.monthInput).toBeFocused()
      }
    )

    for (const { rule, date, message } of [
      {
        rule: 'missing one part',
        date: { day: '15', month: '3', year: '' },
        message: 'Survey date must include a year'
      },
      {
        rule: 'missing two parts',
        date: { day: '15', month: '', year: '' },
        message: 'Survey date must include month and year'
      },
      {
        rule: 'not numeric',
        date: { day: '1a', month: '3', year: '2026' },
        message: 'Survey date must only include numbers'
      },
      {
        rule: 'not a real date',
        date: { day: '31', month: '2', year: '2026' },
        message: 'Survey date must be a real date'
      },
      {
        rule: 'in the future',
        date: { day: '1', month: '1', year: '2999' },
        message: 'Survey date must be today or in the past'
      }
    ]) {
      test(
        `a survey date ${rule} is refused`,
        { tag: '@regression' },
        async ({
          createProjectFlow,
          projectDashboardPage,
          projectDetailsPage
        }) => {
          const { id } = await newProject(
            createProjectFlow,
            projectDashboardPage
          )
          await projectDetailsPage.open(id)
          await projectDetailsPage.fill({
            ...date,
            surveyCompleters: 'J. Smith'
          })
          await projectDetailsPage.submit()

          await projectDetailsPage.assertFieldError(message)
          await expect(projectDetailsPage.surveyCompletersInput).toHaveValue(
            'J. Smith'
          )
        }
      )
    }

    // Local Planning Authority is a select since BMD-1012, so no free-text
    // rule is reachable from the UI. A malformed reference is rejected by the
    // frontend alone and unit-tested there (controller.test.js).
    //
    // Sole witness that the backend's real 400 for an unknown LPA reference
    // reaches the frontend's re-render branch. The backend integration suite
    // proves the 400 (project-details.test.js "rejects invalid LPA selection")
    // and the frontend unit suite renders the error from a mocked 400; nothing
    // else joins the two. Do not delete without an integration-level check of
    // that contract. Since BMD-849 it is also the witness that the name sent
    // with that refused save is not saved either.
    test(
      'a Local Planning Authority no longer on the list shows an error and saves nothing',
      { tag: '@regression' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage,
        page
      }) => {
        const { id, name } = await newProject(
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
          projectName: `${name} renamed`,
          localPlanningAuthority: ADUR_LPA.name,
          surveyCompleters: 'J. Smith'
        })
        await projectDetailsPage.submit()

        await projectDetailsPage.assertFieldError(
          'Select a local planning authority from the list'
        )
        await expect(projectDetailsPage.surveyCompletersInput).toHaveValue(
          'J. Smith'
        )

        await projectDetailsPage.open(id)
        await assertDetailsMatch(projectDetailsPage, {
          projectName: name,
          localPlanningAuthorityReference: BATH_LPA.reference,
          surveyCompleters: ''
        })
      }
    )
  })

  // ─── Persistence (AC3, AC8) ──────────────────────────────────────────────────

  test.describe('Project details — persistence', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'saved details pre-fill the form, and saving again overwrites them',
      { tag: ['@smoke', '@happy-path'] },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage,
        page
      }) => {
        const { id, name } = await newProject(
          createProjectFlow,
          projectDashboardPage
        )

        await fillAndSave(projectDetailsPage, page, id, {
          ...ALL_DETAILS,
          applicant: '  Acme Developments Ltd  '
        })

        await projectDetailsPage.open(id)
        // Leading and trailing spaces are removed before saving.
        await assertDetailsMatch(projectDetailsPage, {
          projectName: name,
          surveyCompleters: ALL_DETAILS.surveyCompleters,
          day: '15',
          month: '03',
          year: '2026',
          applicant: 'Acme Developments Ltd',
          localPlanningAuthorityReference: BATH_LPA.reference,
          planningApplicationReference:
            ALL_DETAILS.planningApplicationReference,
          planningApplicationType: ALL_DETAILS.planningApplicationType
        })

        await fillAndSave(projectDetailsPage, page, id, {
          surveyCompleters: 'R. Patel',
          day: '22',
          month: '7',
          year: '2025',
          localPlanningAuthority: ADUR_LPA.name,
          planningApplicationType: 'Technical details consent'
        })

        await projectDetailsPage.open(id)
        await assertDetailsMatch(projectDetailsPage, {
          surveyCompleters: 'R. Patel',
          day: '22',
          month: '07',
          year: '2025',
          applicant: 'Acme Developments Ltd',
          localPlanningAuthorityReference: ADUR_LPA.reference,
          planningApplicationType: 'Technical details consent'
        })
      }
    )

    test(
      'clearing a field, or choosing the placeholder, clears its saved value',
      { tag: ['@regression', '@happy-path'] },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage,
        page
      }) => {
        const { id } = await newProject(createProjectFlow, projectDashboardPage)
        await fillAndSave(projectDetailsPage, page, id, ALL_DETAILS)

        await fillAndSave(projectDetailsPage, page, id, {
          surveyCompleters: '',
          day: '',
          month: '',
          year: '',
          localPlanningAuthority: LPA_PLACEHOLDER
        })

        await projectDetailsPage.open(id)
        await assertDetailsMatch(projectDetailsPage, {
          surveyCompleters: '',
          day: '',
          month: '',
          year: '',
          localPlanningAuthorityReference: '',
          applicant: ALL_DETAILS.applicant
        })
      }
    )

    test(
      'a renamed project shows its new name on the dashboard, at the top',
      { tag: ['@regression', '@happy-path'] },
      async ({
        createProjectFlow,
        projectDashboardPage,
        projectDetailsPage,
        page
      }) => {
        const first = await newProject(createProjectFlow, projectDashboardPage)
        const second = await newProject(createProjectFlow, projectDashboardPage)
        const renamed = `${first.name} renamed`

        await fillAndSave(projectDetailsPage, page, first.id, {
          projectName: renamed
        })

        await projectDashboardPage.open()
        await expect(projectDashboardPage.projectLink(renamed)).toBeVisible()
        // Other workers share this user and may add projects at any time, so
        // compare this test's two projects rather than reading the first row.
        const names = await projectDashboardPage.projectsTable
          .getByRole('link')
          .allTextContents()
        expect(names.indexOf(renamed)).toBeLessThan(names.indexOf(second.name))
      }
    )
  })

  // ─── Navigation (AC1, AC8, AC9) ──────────────────────────────────────────────
  //
  // A project with a baseline, so the left navigation has pages to come from.
  // Its own upload, not the shared summary project: the saves here change it.

  test.describe(
    'Project details — navigation',
    { tag: ['@regression', '@happy-path'] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      let project
      test.beforeAll(async ({ browser }) => {
        // An upload polls the CDP Uploader for up to two minutes.
        test.setTimeout(UPLOAD_TIMEOUT + 60_000)
        const context = await browser.newContext({
          storageState: STORAGE_STATE,
          baseURL: baseUrl
        })
        const page = await context.newPage()
        try {
          project = await setupProject(
            new CreateProjectFlow(page),
            new ProjectDashboardPage(page),
            uniqueLabel()
          )
          await new UploadBaselineFileFlow(page).uploadFileAndWaitForSummary(
            project.id,
            AREA_REFS_BASELINE_FILE
          )
        } finally {
          await context.close()
        }
      })

      test('the left navigation links to Project details, which keeps the navigation', async ({
        areaSummaryPage,
        projectDetailsPage,
        page
      }) => {
        await areaSummaryPage.open(project.id)
        await areaSummaryPage.navLink(PROJECT_DETAILS_NAV_ITEM).click()

        await expect(page).toHaveURL(
          new RegExp(`/project-details/${project.id}\\?returnUrl=`)
        )
        await expect(projectDetailsPage.heading).toBeVisible()
        await expect(projectDetailsPage.currentNavItem).toHaveAttribute(
          'aria-current',
          'page'
        )
        await expect(
          projectDetailsPage.navigation.getByRole('link', { name: SUMMARY })
        ).toHaveAttribute('href', `/projects/${project.id}/project-summary`)
      })

      test('Cancel returns to the page the link was followed from, saving nothing', async ({
        areaSummaryPage,
        projectDetailsPage,
        page
      }) => {
        await areaSummaryPage.open(project.id)
        await areaSummaryPage.navLink(PROJECT_DETAILS_NAV_ITEM).click()
        await projectDetailsPage.fill({ surveyCompleters: 'Never saved' })
        await projectDetailsPage.cancelLink.click()

        await expect(page).toHaveURL(`/projects/${project.id}/area-summary`)
        await projectDetailsPage.open(project.id)
        await expect(projectDetailsPage.surveyCompletersInput).toHaveValue('')
      })

      // A returnUrl that leaves the site is ignored: Cancel and Save go to the
      // project summary instead.
      for (const offSite of ['https://example.com/', '//example.com']) {
        test(`an off-site returnUrl (${offSite}) falls back to the project summary`, async ({
          projectDetailsPage,
          page
        }) => {
          await projectDetailsPage.open(project.id, offSite)
          await expect(projectDetailsPage.cancelLink).toHaveAttribute(
            'href',
            `/projects/${project.id}/project-summary`
          )
          await projectDetailsPage.submit()
          await expect(page).toHaveURL(
            `${baseUrl}/projects/${project.id}/project-summary`
          )
        })
      }

      // Mutating: last in the serial block.
      test('Save returns to the page the link was followed from, with the new name shown', async ({
        areaSummaryPage,
        projectDetailsPage,
        page
      }) => {
        const renamed = `${project.name} renamed`
        await areaSummaryPage.open(project.id)
        await areaSummaryPage.navLink(PROJECT_DETAILS_NAV_ITEM).click()
        await projectDetailsPage.fill({ projectName: renamed })
        await projectDetailsPage.submit()

        await expect(page).toHaveURL(`/projects/${project.id}/area-summary`)
        await expect(page.getByText(renamed, { exact: true })).toBeVisible()
        await expect(page.getByRole('alert')).toHaveCount(0)
      })
    }
  )

  // ─── Cross-user visibility ───────────────────────────────────────────────────

  test.describe(
    'Project details — cross-user visibility',
    { tag: '@regression' },
    () => {
      test.skip(skipInE2e(NO_PROJECTS_STORAGE_STATE), E2E_SKIP_REASON)

      test("a project's details can be neither seen nor changed by a different user", async ({
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
          const creatorDetails = new ProjectDetailsPage(creatorPage)
          const { id, name } = await setupProject(
            new CreateProjectFlow(creatorPage),
            new ProjectDashboardPage(creatorPage),
            uniqueLabel()
          )
          await fillAndSave(creatorDetails, creatorPage, id, {
            localPlanningAuthority: BATH_LPA.name,
            applicant: 'Isolation Developments Ltd'
          })

          const otherPage = await otherContext.newPage()
          const response = await otherPage.goto(`/project-details/${id}`)
          expect(response.status()).toBe(HTTP_NOT_FOUND)
          await expect(
            otherPage.getByText('Isolation Developments Ltd')
          ).toBeHidden()

          // A save posted straight to the route, with the other user's own
          // CSRF token, changes nothing.
          await otherPage.goto('/')
          const crumb = (await otherContext.cookies()).find(
            (cookie) => cookie.name === 'crumb'
          )
          const post = await otherPage.request.post(`/project-details/${id}`, {
            form: {
              crumb: crumb.value,
              projectName: 'Taken over',
              applicant: 'Someone else'
            },
            maxRedirects: 0
          })
          expect(post.status()).toBe(HTTP_NOT_FOUND)

          await creatorDetails.open(id)
          await assertDetailsMatch(creatorDetails, {
            projectName: name,
            applicant: 'Isolation Developments Ltd'
          })
        } finally {
          await creatorContext.close()
          await otherContext.close()
        }
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
})
