import { test, expect } from '@fixtures'
import { STORAGE_STATE, runMode } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import {
  assertErrorPage,
  assertRecovers,
  TOXIPROXY_SKIP_REASON
} from '@utils/resilience-checks.js'

const CDP_UPLOADER = 'cdp-uploader'
const PROJECT_LABEL = 'Resilience Uploader'
const BASELINE_FILE = 'Baseline - complete with area refs.gpkg'

// The frontend's MAX_WAIT_SECONDS is 120. A hanging uploader also holds each poll
// until the backend's uploader timeout (CDP_UPLOADER_TIMEOUT_MS, 5s). Before
// BMD-1200 it held each poll for the frontend's 10s, which took this to 149s.
const MAX_TIMED_OUT_MESSAGE_MS = 180_000
const TIMED_OUT_MESSAGE = 'The file check timed out. Please try again.'
const UPLOAD_UNAVAILABLE_TEXT =
  'Unable to start file upload. Please try again later.'
const FILE_CHECK_TEST_TIMEOUT_MS = 300_000

test.describe('resilience', { tag: '@resilience' }, () => {
  test.describe('CDP Uploader outage', { tag: '@regression' }, () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', TOXIPROXY_SKIP_REASON)

    async function assertUploadPageHandlesOutage({
      injectFault,
      toxiproxy,
      createProjectFlow,
      projectDashboardPage,
      uploadBaselineFilePage,
      serviceErrorPage,
      page
    }) {
      const { id } = await setupProject(
        createProjectFlow,
        projectDashboardPage,
        PROJECT_LABEL
      )

      await injectFault()

      await uploadBaselineFilePage.open(id)
      await assertErrorPage(page, serviceErrorPage)

      await toxiproxy.reset()

      await assertRecovers(
        () => uploadBaselineFilePage.open(id),
        uploadBaselineFilePage.heading
      )
    }

    test('uploader refusing connections shows the error page on the upload page, then recovers', async ({
      toxiproxy,
      createProjectFlow,
      projectDashboardPage,
      uploadBaselineFilePage,
      serviceErrorPage,
      page
    }) => {
      await assertUploadPageHandlesOutage({
        injectFault: () => toxiproxy.takeDown(CDP_UPLOADER),
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFilePage,
        serviceErrorPage,
        page
      })
    })

    test('uploader not answering shows the error page on the upload page without hanging, then recovers', async ({
      toxiproxy,
      createProjectFlow,
      projectDashboardPage,
      uploadBaselineFilePage,
      serviceErrorPage,
      page
    }) => {
      await assertUploadPageHandlesOutage({
        injectFault: () => toxiproxy.hang(CDP_UPLOADER),
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFilePage,
        serviceErrorPage,
        page
      })
    })

    // Only the backend's connection to the uploader fails here: the browser
    // posts the file to the uploader directly, so the upload succeeds and the
    // status checks that follow do not. The frontend then waits out its 120s
    // limit, which makes these the slowest tests in the suite.
    //
    // The user is not left waiting forever, and is told the file check timed
    // out. The upload page that says so cannot start a new upload while the
    // uploader fails, so it shows that instead of the form. Before BMD-1200 the
    // message was lost and the journey ended on the generic error page.
    async function assertFileCheckHandlesOutage({
      injectFault,
      toxiproxy,
      createProjectFlow,
      projectDashboardPage,
      uploadBaselineFilePage,
      uploadBaselineFileFlow,
      page
    }) {
      test.setTimeout(FILE_CHECK_TEST_TIMEOUT_MS)

      const { id } = await setupProject(
        createProjectFlow,
        projectDashboardPage,
        PROJECT_LABEL
      )

      // Opening the upload page needs the uploader, so the fault lands after it.
      await uploadBaselineFilePage.open(id)
      await injectFault()
      await uploadBaselineFilePage.fileInput.setInputFiles(
        uploadBaselineFileFlow.filePath(BASELINE_FILE)
      )
      await uploadBaselineFilePage.continueButton.click()

      await expect(uploadBaselineFilePage.errorSummary).toContainText(
        TIMED_OUT_MESSAGE,
        { timeout: MAX_TIMED_OUT_MESSAGE_MS }
      )
      await expect(uploadBaselineFilePage.heading).toBeVisible()
      await expect(page.getByText(UPLOAD_UNAVAILABLE_TEXT)).toBeVisible()

      await toxiproxy.reset()

      await uploadBaselineFileFlow.uploadFileAndWaitForSummary(
        id,
        BASELINE_FILE
      )
    }

    test('uploader lost during the file check shows the timed-out message, then the file can be uploaded again', async ({
      toxiproxy,
      createProjectFlow,
      projectDashboardPage,
      uploadBaselineFilePage,
      uploadBaselineFileFlow,
      page
    }) => {
      await assertFileCheckHandlesOutage({
        injectFault: () => toxiproxy.takeDown(CDP_UPLOADER),
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFilePage,
        uploadBaselineFileFlow,
        page
      })
    })

    test('uploader not answering during the file check shows the timed-out message without hanging, then the file can be uploaded again', async ({
      toxiproxy,
      createProjectFlow,
      projectDashboardPage,
      uploadBaselineFilePage,
      uploadBaselineFileFlow,
      page
    }) => {
      await assertFileCheckHandlesOutage({
        injectFault: () => toxiproxy.hang(CDP_UPLOADER),
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFilePage,
        uploadBaselineFileFlow,
        page
      })
    })
  })
})
