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

      test('selecting a non-.gpkg file shows the wrong-extension error', async ({
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

        await expect(
          uploadBaselineFilePage.clientError(ERROR_WRONG_EXTENSION)
        ).toBeVisible()
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
