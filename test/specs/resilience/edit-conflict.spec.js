import { test, expect } from '@fixtures'
import { STORAGE_STATE, runMode } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import { lockProject } from '@utils/stack-access.js'

const PROJECT_LABEL = 'Resilience conflict'
const BASELINE_FILE = 'Baseline - complete with area refs.gpkg'
const CONFLICT_MESSAGE = 'Another user is editing this. Please try again.'

// The backend gives up on the lock after 5s (lock_timeout), within the
// frontend's 10s backend timeout.
const MAX_CONFLICT_MS = 25_000
// An upload reaches the lock only once the file check runs, which can take up
// to the frontend's 120s wait (MAX_WAIT_SECONDS) for the uploader.
const MAX_UPLOAD_CONFLICT_MS = 150_000
const UPLOAD_CONFLICT_TEST_TIMEOUT_MS = 300_000

test.describe('resilience', { tag: '@resilience' }, () => {
  test.describe(
    'Edit conflict — baseline habitat details',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(
        runMode === 'e2e',
        'Requires direct Postgres access through Toxiproxy — not available on CDP'
      )
      test.describe.configure({ timeout: 120_000 })

      // A second user's save is simulated by holding the project's row lock, as
      // their transaction would, while this user saves.
      test('saving while another edit holds the project shows the conflict page, then the save works', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        areaBaselinePage,
        baselineHabitatDetailsPage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        await uploadBaselineFileFlow.uploadFileAndWaitForSummary(
          id,
          BASELINE_FILE
        )
        await areaBaselinePage.open(id)
        const href = await areaBaselinePage.detailsTable
          .getByRole('link')
          .first()
          .getAttribute('href')
        const featureId = new URL(href, 'http://localhost').searchParams.get(
          'featureId'
        )
        await baselineHabitatDetailsPage.open(id, featureId)

        const release = await lockProject(id)
        try {
          await baselineHabitatDetailsPage.saveButton.click()
          await expect(page.getByText(CONFLICT_MESSAGE)).toBeVisible({
            timeout: MAX_CONFLICT_MS
          })
        } finally {
          await release()
        }

        await baselineHabitatDetailsPage.open(id, featureId)
        await baselineHabitatDetailsPage.saveButton.click()
        await expect(page).toHaveURL(
          new RegExp(`/projects/${id}/area-baseline`)
        )
      })
    }
  )

  test.describe(
    'Edit conflict — upload baseline',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(
        runMode === 'e2e',
        'Requires direct Postgres access through Toxiproxy — not available on CDP'
      )
      test.describe.configure({ timeout: UPLOAD_CONFLICT_TEST_TIMEOUT_MS })

      // The file check saves the upload under the project's row lock, so another
      // user's save holding it makes the upload wait, then give up. That is not a
      // problem with the file: the user gets the conflict page, not the file
      // error page (BMD-1200).
      test('uploading while another edit holds the project shows the conflict page, then the upload works', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )

        const release = await lockProject(id)
        try {
          await uploadBaselineFileFlow.uploadFile(id, BASELINE_FILE)
          await expect(page.getByText(CONFLICT_MESSAGE)).toBeVisible({
            timeout: MAX_UPLOAD_CONFLICT_MS
          })
          await expect(page).not.toHaveURL(/\/error-file/)
        } finally {
          await release()
        }

        await uploadBaselineFileFlow.uploadFileAndWaitForSummary(
          id,
          BASELINE_FILE
        )
      })
    }
  )
})
