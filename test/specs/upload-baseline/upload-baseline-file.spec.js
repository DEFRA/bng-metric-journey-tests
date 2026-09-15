import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import { uploadFileHref } from '@utils/upload-file-navigation.js'
import {
  describeRoleEnforcement,
  describeUnauthenticatedAccess
} from '@utils/access-checks.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const PROJECT_LABEL = 'Upload baseline test'
const ERROR_NO_FILE = 'Select a GeoPackage (.gpkg) file'
const ERROR_WRONG_EXTENSION = 'The selected file must be a GeoPackage (.gpkg)'
const NON_GPKG_FILE = 'not-a-geopackage.txt'
// BMD-958. Square brackets are outside SAFE_FILENAME_RE, so this is rejected on
// its NAME — the content is a valid GeoPackage.
const INVALID_FILENAME_FILE = 'Baseline [invalid chars].gpkg'
const ERROR_INVALID_FILENAME =
  'The file name can only include letters, numbers, spaces, hyphens, underscores, full stops or brackets'

test.describe('upload-baseline', { tag: '@upload-baseline' }, () => {
  // ─── Form display ────────────────────────────────────────────────────────────

  test.describe('Upload baseline file — form display', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'form renders with heading, caption, instruction text, file input, Continue and Cancel',
      { tag: ['@smoke', '@happy-path'] },
      async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFilePage,
        page
      }) => {
        const { id, name } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        await uploadBaselineFilePage.open(id)

        await expect(uploadBaselineFilePage.heading).toBeVisible()
        await expect(page.getByText(name)).toBeVisible()
        await expect(uploadBaselineFilePage.instructionText).toBeVisible()
        await expect(uploadBaselineFilePage.noFileChosenText).toBeVisible()
        await expect(uploadBaselineFilePage.continueButton).toBeVisible()
        await expect(uploadBaselineFilePage.backLink).toBeVisible()
        await expect(uploadBaselineFilePage.cancelLink).toBeVisible()
      }
    )
  })

  // ─── Form navigation ─────────────────────────────────────────────────────────

  test.describe(
    'Upload baseline file — form navigation',
    { tag: ['@regression', '@happy-path'] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // BMD-850: Back and Cancel now return to the file-type selection page,
      // not the task list. Opening the form with no returnUrl makes the
      // selection page's own Back/Cancel default to the task list, so the
      // journey out is one step longer than it was.
      test('Back link returns to the upload type selection page', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFilePage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        await uploadBaselineFilePage.open(id)
        await uploadBaselineFilePage.backLink.click()

        await expect(page).toHaveURL(
          uploadFileHref(id, `/add-project-details/${id}`)
        )
      })

      test('Cancel link returns to the upload type selection page', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFilePage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        await uploadBaselineFilePage.open(id)
        await uploadBaselineFilePage.cancelLink.click()

        await expect(page).toHaveURL(
          uploadFileHref(id, `/add-project-details/${id}`)
        )
      })
    }
  )

  // ─── Client-side validation ──────────────────────────────────────────────────

  test.describe(
    'Upload baseline file — client-side validation',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('Continue with no file selected shows the required-file error', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFilePage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        await uploadBaselineFilePage.open(id)
        await uploadBaselineFilePage.continueButton.click()

        await expect(
          uploadBaselineFilePage.clientError(ERROR_NO_FILE)
        ).toBeVisible()
        await expect(page).toHaveURL(/\/upload-baseline-file/)
      })

      test('Continue with a non-.gpkg file selected shows the wrong-extension error', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        uploadBaselineFilePage
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        await uploadBaselineFilePage.open(id)
        await uploadBaselineFilePage.fileInput.setInputFiles(
          uploadBaselineFileFlow.filePath(NON_GPKG_FILE)
        )

        // BMD-958 (frontend PR#290) moved client-side validation from the file
        // input's `change` event to form submit. Asserting the negative first is
        // what pins that move: before the change, this error was already on
        // screen at this point, so a revert would fail here rather than silently
        // re-introduce the old behaviour.
        await expect(uploadBaselineFilePage.errorSummary).toBeHidden()

        await uploadBaselineFilePage.continueButton.click()

        await expect(
          uploadBaselineFilePage.clientError(ERROR_WRONG_EXTENSION)
        ).toBeVisible()
      })

      test('Continue with a disallowed filename shows the filename error inline, without uploading', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        uploadBaselineFilePage,
        page
      }) => {
        // Sole witness that the filename rule is wired into the real upload
        // page. The rule itself is unit-tested (frontend
        // src/client/javascripts/file-validation-rules.test.js; backend
        // src/validation/project.test.js), and the DOM shell is tested in JSDOM
        // (file-upload-validation.test.js) — but that shell test builds its own
        // form fixture, so it keeps passing if the Nunjucks template stops
        // rendering the #tpl-error-summary/#tpl-error-message templates the
        // script clones, or if the script stops being loaded on this page.
        //
        // It is also the only check that the file never leaves the browser.
        // Because the frontend now mirrors the backend's SAFE_FILENAME_RE, the
        // backend's own INVALID_FILENAME branch is no longer reachable through
        // the UI at all, and it has no integration-test coverage
        // (../bng-metric-backend/integration-tests/ has none; the unit test at
        // src/validation/geopackage/errors.test.js feeds a fabricated Joi error,
        // which proves mapping, not emission). Deleting this test would leave
        // the whole filename-rejection path unwitnessed end to end.
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )

        const visited = []
        page.on('framenavigated', (frame) => {
          if (frame === page.mainFrame()) {
            visited.push(frame.url())
          }
        })

        await uploadBaselineFilePage.open(id)
        await uploadBaselineFilePage.fileInput.setInputFiles(
          uploadBaselineFileFlow.filePath(INVALID_FILENAME_FILE)
        )
        await uploadBaselineFilePage.continueButton.click()

        // Order matters: this assertion is the synchronisation point. It waits
        // for the client handler to have run, which is what makes the
        // no-navigation check below meaningful — asserted any earlier, that
        // check would pass simply because navigation had not started yet.
        // `soft` so a copy change still reports the upload finding alongside it.
        await expect
          .soft(uploadBaselineFilePage.clientError(ERROR_INVALID_FILENAME))
          .toBeVisible()
        // Inline on the upload page (BMD-958), not the /error-file breakout the
        // backend's rejection branch would have produced.
        await expect(page).toHaveURL(/\/upload-baseline-file/)
        expect(
          visited.filter((url) => url.includes('upload-received'))
        ).toEqual([])
      })
    }
  )

  // ─── Role enforcement ────────────────────────────────────────────────────────

  describeRoleEnforcement('Upload baseline file', 'upload-baseline-file', {
    smoke: true
  })

  // ─── Unauthenticated access ──────────────────────────────────────────────────

  describeUnauthenticatedAccess('Upload baseline file', 'upload-baseline-file')
})
