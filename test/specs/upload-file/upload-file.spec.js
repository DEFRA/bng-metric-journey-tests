import { test, expect } from '@fixtures'
import {
  STORAGE_STATE,
  NO_PROJECTS_STORAGE_STATE,
  skipInE2e,
  baseUrl
} from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import { uploadFileHref } from '@utils/upload-file-navigation.js'
import {
  describeRoleEnforcement,
  describeUnauthenticatedAccess
} from '@utils/access-checks.js'
import { ProjectDashboardPage } from '@pages/project-dashboard.page.js'
import { UploadFilePage } from '@pages/upload-file.page.js'
import { CreateProjectFlow } from '@flows/project-management/create-project.flow.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const PROJECT_LABEL = 'Choose upload type test'
const COMPLETE_BASELINE_FILE = 'Baseline - complete with area refs.gpkg'
const UPLOAD_TIMEOUT = 120_000
const HTTP_BAD_REQUEST = 400
const HTTP_NOT_FOUND = 404
// The route validates {id} as a UUID **v4**, and Hapi runs route validation
// before the role pre-handler — so a non-v4 UUID 400s before the role gate is
// reached. Every id below that must survive validation is a real v4.
const VALID_UUID_V4 = 'aaaaaaaa-bbbb-4ccc-bddd-eeeeeeeeeeee'
const UNKNOWN_UUID_V4 = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'
const NON_UUID_ID = 'not-a-uuid'
const SELECT_TYPE_ERROR = 'Select the type of file you want to upload'
const BASELINE_REQUIRED_ERROR =
  'Upload a baseline file before uploading a post intervention file'

test.describe('upload-file', { tag: '@upload-file' }, () => {
  // ─── Page display ─────────────────────────────────────────────────────────────

  test.describe('Choose upload type — page display', { tag: '@smoke' }, () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'page renders the heading, project caption, overwrite warning, both file-type options unselected, Continue and Cancel',
      { tag: '@happy-path' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        uploadFilePage,
        page
      }) => {
        const { id, name } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        await uploadFilePage.open(id)

        await expect(page).toHaveTitle(/What would you like to upload\?/)
        await expect(uploadFilePage.heading).toBeVisible()
        await expect(page.getByText(name)).toBeVisible()
        await expect(uploadFilePage.overwriteWarning).toBeVisible()

        await expect(uploadFilePage.baselineRadio).toBeVisible()
        await expect(uploadFilePage.postInterventionRadio).toBeVisible()
        // Neither option is pre-selected — the user must make a choice.
        await expect(uploadFilePage.baselineRadio).not.toBeChecked()
        await expect(uploadFilePage.postInterventionRadio).not.toBeChecked()

        await expect(uploadFilePage.continueButton).toBeVisible()
        await expect(uploadFilePage.cancelLink).toBeVisible()
      }
    )
  })

  // ─── Return navigation ────────────────────────────────────────────────────────

  test.describe(
    'Choose upload type — return navigation',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('Back and Cancel default to the project task list when no returnUrl is supplied', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadFilePage
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        await uploadFilePage.open(id)

        await uploadFilePage.assertReturnLinks(`/add-project-details/${id}`)
      })

      test('Back and Cancel return to the habitat list the user arrived from', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadFilePage
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        // The href a habitat list's "Upload a different file" button carries.
        const listRoute = `/projects/${id}/baseline-habitat-list`
        await uploadFilePage.open(id, listRoute)

        await uploadFilePage.assertReturnLinks(listRoute)
      })

      // safeUploadReturnUrl is an open-redirect guard: anything that is not a
      // single-slash-prefixed relative path is discarded for the task list.
      for (const { label, returnUrl } of [
        { label: 'a protocol-relative URL', returnUrl: '//evil.example/steal' },
        { label: 'an absolute URL', returnUrl: 'https://evil.example/steal' },
        { label: 'a backslash-bearing path', returnUrl: '/\\evil.example' }
      ]) {
        test(`${label} as returnUrl falls back to the project task list`, async ({
          createProjectFlow,
          projectDashboardPage,
          uploadFilePage
        }) => {
          const { id } = await setupProject(
            createProjectFlow,
            projectDashboardPage,
            PROJECT_LABEL
          )
          await uploadFilePage.open(id, returnUrl)

          await uploadFilePage.assertReturnLinks(`/add-project-details/${id}`)
        })
      }
    }
  )

  // ─── Baseline selection ───────────────────────────────────────────────────────

  test.describe(
    'Choose upload type — baseline selection',
    { tag: ['@smoke', '@happy-path'] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('selecting the baseline file type redirects to the baseline upload form', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadFilePage,
        uploadBaselineFilePage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        await uploadFilePage.open(id)
        await uploadFilePage.selectBaseline()
        await uploadFilePage.submit()

        await expect(page).toHaveURL(
          `/projects/${id}/upload-baseline-file?returnUrl=%2Fadd-project-details%2F${id}`
        )
        await expect(uploadBaselineFilePage.heading).toBeVisible()
      })

      test('the returnUrl survives the selection and drives the upload form Back link', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadFilePage,
        uploadBaselineFilePage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        const listRoute = `/projects/${id}/baseline-habitat-list`
        await uploadFilePage.open(id, listRoute)
        await uploadFilePage.selectBaseline()
        await uploadFilePage.submit()

        await expect(page).toHaveURL(
          `/projects/${id}/upload-baseline-file?${new URLSearchParams({ returnUrl: listRoute })}`
        )
        // Back on the upload form returns to the selection page still carrying
        // the original list as its own return target.
        await expect(uploadBaselineFilePage.backLink).toHaveAttribute(
          'href',
          uploadFileHref(id, listRoute)
        )
      })
    }
  )

  // ─── Post-intervention selection ──────────────────────────────────────────────

  test.describe(
    'Choose upload type — post-intervention selection',
    { tag: ['@smoke', '@happy-path'] },
    () => {
      // One real baseline upload backs this describe, so it is serialised with
      // the rest of this file. Note what that does and does not buy: CI and
      // test:github run single-worker (playwright.config.js sets workers: 1
      // when CI is set), which is what actually keeps concurrent uploads from
      // clobbering the shared pendingUploadId session key. Under test:local
      // (multi-worker, fullyParallel) this only orders tests within the file —
      // uploads in other spec files can still run alongside it.
      test.describe.configure({ mode: 'serial' })
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('selecting post-intervention redirects to its upload form once a baseline exists', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        uploadFilePage,
        uploadPostInterventionFilePage,
        page
      }) => {
        test.setTimeout(UPLOAD_TIMEOUT + 60_000)

        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        await uploadBaselineFileFlow.uploadFile(id, COMPLETE_BASELINE_FILE)
        await page.waitForURL(`/projects/${id}/baseline-habitat-list`, {
          timeout: UPLOAD_TIMEOUT
        })

        await uploadFilePage.open(id)
        await uploadFilePage.selectPostIntervention()
        await uploadFilePage.submit()

        await expect(page).toHaveURL(
          `/projects/${id}/upload-post-intervention-file?returnUrl=%2Fadd-project-details%2F${id}`
        )
        await expect(uploadPostInterventionFilePage.heading).toBeVisible()
      })
    }
  )

  // ─── Validation ───────────────────────────────────────────────────────────────

  test.describe('Choose upload type — validation', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'submitting without choosing a file type shows the required-selection error',
      { tag: '@smoke' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        uploadFilePage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        await uploadFilePage.open(id)
        await uploadFilePage.submit()

        await expect(page).toHaveTitle(/Error: What would you like to upload\?/)
        await expect(uploadFilePage.errorSummary).toBeVisible()
        await expect(
          uploadFilePage.errorLink(SELECT_TYPE_ERROR)
        ).toHaveAttribute('href', '#uploadType')
      }
    )

    test(
      'choosing post-intervention before a baseline exists is rejected, and the choice is preserved',
      { tag: '@regression' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        uploadFilePage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        await uploadFilePage.open(id)
        await uploadFilePage.selectPostIntervention()
        await uploadFilePage.submit()

        // Stays on the selection page rather than reaching the upload form.
        await expect(page).toHaveURL(new RegExp(`/projects/${id}/upload-file$`))
        await expect(uploadFilePage.errorSummary).toBeVisible()
        await expect(
          uploadFilePage.errorLink(BASELINE_REQUIRED_ERROR)
        ).toHaveAttribute('href', '#uploadType')
        await expect(uploadFilePage.postInterventionRadio).toBeChecked()
      }
    )

    // Not covered here: an `uploadType` outside the Joi enum → 400. The two
    // radios can only ever post an allowed value, so reaching that branch means
    // either tampering with the rendered form or hand-rolling a POST (which
    // would lack the CSRF crumb and get 403, not the 400 under test). Neither
    // is a journey a user can take — the branch is left to the frontend's own
    // route tests.
  })

  // ─── Route parameter validation ───────────────────────────────────────────────

  test.describe(
    'Choose upload type — route parameter validation',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('non-UUID id path param returns 400', async ({ uploadFilePage }) => {
        const response = await uploadFilePage.open(NON_UUID_ID)
        expect(response.status()).toBe(HTTP_BAD_REQUEST)
      })
    }
  )

  // ─── Unknown project ──────────────────────────────────────────────────────────

  test.describe(
    'Choose upload type — unknown project',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('a valid but unknown project UUID returns 404 rather than the form', async ({
        uploadFilePage
      }) => {
        const response = await uploadFilePage.open(UNKNOWN_UUID_V4)
        expect(response.status()).toBe(HTTP_NOT_FOUND)
        await expect(uploadFilePage.heading).toBeHidden()
      })
    }
  )

  // ─── Cross-user access ────────────────────────────────────────────────────────

  test.describe(
    'Choose upload type — cross-user access',
    { tag: '@regression' },
    () => {
      test.skip(
        skipInE2e(NO_PROJECTS_STORAGE_STATE),
        'Requires a second stub-auth profile — not available in e2e mode'
      )

      test('another user cannot open the selection page for a project they do not own', async ({
        browser
      }) => {
        const ownerContext = await browser.newContext({
          storageState: STORAGE_STATE,
          baseURL: baseUrl
        })
        const ownerPage = await ownerContext.newPage()
        const { id: ownerProjectId, name: ownerProjectName } =
          await setupProject(
            new CreateProjectFlow(ownerPage),
            new ProjectDashboardPage(ownerPage),
            PROJECT_LABEL
          )
        await ownerContext.close()

        const otherContext = await browser.newContext({
          storageState: NO_PROJECTS_STORAGE_STATE,
          baseURL: baseUrl
        })
        try {
          const otherPage = await otherContext.newPage()
          const otherUploadFilePage = new UploadFilePage(otherPage)

          // Backend visibility is scoped to the owner, so the fetch 404s and
          // the frontend turns that into a not-found page — never the form.
          const response = await otherUploadFilePage.open(ownerProjectId)
          expect(response.status()).toBe(HTTP_NOT_FOUND)
          await expect(otherUploadFilePage.heading).toBeHidden()
          await expect(otherPage.getByText(ownerProjectName)).toBeHidden()
        } finally {
          await otherContext.close()
        }
      })
    }
  )

  // ─── Backend failure (not reachable from a browser) ───────────────────────────

  test.describe('Choose upload type — backend error', () => {
    // Unblock: needs a way to make GET /projects/{id} fail for one request —
    // a fault-injection hook in the stub backend, or a compose profile that
    // stops the backend mid-run. Then: open the selection page and assert the
    // shared 502 "Something went wrong" page renders instead of the form.
    // Same constraint as project-dashboard.spec.js's backend-error placeholder.
    test.skip(
      'a backend failure fetching the project shows the 502 error page',
      { tag: '@regression' },
      async () => {}
    )
  })

  // ─── Role enforcement / unauthenticated access ────────────────────────────────

  // A real v4 UUID is required: route validation runs before the role
  // pre-handler, so the helper's all-zeros default would 400 first.
  describeRoleEnforcement('Choose upload type', 'upload-file', {
    smoke: true,
    projectId: VALID_UUID_V4
  })
  describeUnauthenticatedAccess('Choose upload type', 'upload-file')
})
