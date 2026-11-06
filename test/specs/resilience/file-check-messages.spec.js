import { test, expect } from '@fixtures'
import { STORAGE_STATE, runMode } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'

const PROJECT_LABEL = 'Resilience file check'
const BASELINE_FILE = 'Baseline - complete with area refs.gpkg'
const TIMED_OUT_MESSAGE = 'The file check timed out. Please try again.'
const BUSY_MESSAGE =
  'The service is busy checking other files. Please try again in a few moments.'

// The services in compose.resilience.yml that the proxies are pointed at.
const PENDING_UPLOADER = 'cdp-uploader-pending:8080'
const BUSY_BACKEND = 'bng-metric-backend-busy:3001'

// The frontend's MAX_WAIT_SECONDS is 120, plus a poll's worth of margin.
const MAX_MESSAGE_MS = 180_000
const TEST_TIMEOUT_MS = 300_000

// Both messages appear only once the frontend has waited out its 120s limit, so
// each of these tests takes over 2 minutes. Nothing fails here: the dependency
// keeps answering, just never with a finished check.
async function assertFileCheckMessage({
  redirect,
  message,
  toxiproxy,
  createProjectFlow,
  projectDashboardPage,
  uploadBaselineFilePage,
  uploadBaselineFileFlow
}) {
  const { id } = await setupProject(
    createProjectFlow,
    projectDashboardPage,
    PROJECT_LABEL
  )

  await uploadBaselineFilePage.open(id)
  await redirect()
  await uploadBaselineFilePage.fileInput.setInputFiles(
    uploadBaselineFileFlow.filePath(BASELINE_FILE)
  )
  await uploadBaselineFilePage.continueButton.click()

  await expect(uploadBaselineFilePage.errorSummary).toContainText(message, {
    timeout: MAX_MESSAGE_MS
  })
  await expect(uploadBaselineFilePage.heading).toBeVisible()

  await toxiproxy.reset()

  await uploadBaselineFileFlow.uploadFileAndWaitForSummary(id, BASELINE_FILE)
}

test.describe('resilience', { tag: '@resilience' }, () => {
  test.describe(
    'File check messages — upload baseline',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(
        runMode === 'e2e',
        'Requires Toxiproxy in the Docker Compose stack — not available on CDP'
      )
      test.describe.configure({ timeout: TEST_TIMEOUT_MS })

      test('a file check still running after 2 minutes shows the timed-out message, then the file can be uploaded again', async ({
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFilePage,
        uploadBaselineFileFlow
      }) => {
        await assertFileCheckMessage({
          redirect: () => toxiproxy.pointAt('cdp-uploader', PENDING_UPLOADER),
          message: TIMED_OUT_MESSAGE,
          toxiproxy,
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFilePage,
          uploadBaselineFileFlow
        })
      })

      test('a checker still busy after 2 minutes shows the busy message, then the file can be uploaded again', async ({
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFilePage,
        uploadBaselineFileFlow
      }) => {
        await assertFileCheckMessage({
          redirect: () => toxiproxy.pointAt('backend', BUSY_BACKEND),
          message: BUSY_MESSAGE,
          toxiproxy,
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFilePage,
          uploadBaselineFileFlow
        })
      })
    }
  )
})
