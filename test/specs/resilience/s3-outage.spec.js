import { test } from '@fixtures'
import { STORAGE_STATE, runMode } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import { assertErrorPage } from '@utils/resilience-checks.js'

const S3 = 's3'
const PROJECT_LABEL = 'Resilience S3'
const BASELINE_FILE = 'Baseline - complete with area refs.gpkg'

// Includes the status polling before the file check starts, plus the frontend's
// 25s budget for the check itself.
const MAX_ERROR_PAGE_MS = 45_000
const TEST_TIMEOUT_MS = 120_000

// The backend only reads S3 during the file check, so the fault can land before
// the upload page opens. The uploader keeps its own S3 connection, so the upload
// itself still succeeds and only the backend's read of the file fails.
async function assertHandlesOutage({
  injectFault,
  toxiproxy,
  createProjectFlow,
  projectDashboardPage,
  uploadBaselineFileFlow,
  serviceErrorPage,
  page
}) {
  const { id } = await setupProject(
    createProjectFlow,
    projectDashboardPage,
    PROJECT_LABEL
  )

  await injectFault()

  await uploadBaselineFileFlow.uploadFile(id, BASELINE_FILE)
  await assertErrorPage(page, serviceErrorPage, { timeout: MAX_ERROR_PAGE_MS })

  await toxiproxy.reset()

  await uploadBaselineFileFlow.uploadFileAndWaitForSummary(id, BASELINE_FILE)
}

test.describe('resilience', { tag: '@resilience' }, () => {
  test.describe('S3 outage — file check', { tag: '@regression' }, () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(
      runMode === 'e2e',
      'Requires Toxiproxy in the Docker Compose stack — not available on CDP'
    )
    test.describe.configure({ timeout: TEST_TIMEOUT_MS })

    test('S3 refusing connections shows the error page, then the file can be uploaded again', async ({
      toxiproxy,
      createProjectFlow,
      projectDashboardPage,
      uploadBaselineFileFlow,
      serviceErrorPage,
      page
    }) => {
      await assertHandlesOutage({
        injectFault: () => toxiproxy.takeDown(S3),
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        serviceErrorPage,
        page
      })
    })

    test('S3 not answering shows the error page without hanging, then the file can be uploaded again', async ({
      toxiproxy,
      createProjectFlow,
      projectDashboardPage,
      uploadBaselineFileFlow,
      serviceErrorPage,
      page
    }) => {
      await assertHandlesOutage({
        injectFault: () => toxiproxy.hang(S3),
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        serviceErrorPage,
        page
      })
    })
  })
})
