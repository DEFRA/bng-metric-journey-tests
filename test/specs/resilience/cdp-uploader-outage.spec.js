import { test } from '@fixtures'
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
// for the 10s backend timeout, which took this to 149s when measured.
const MAX_FILE_CHECK_ERROR_MS = 180_000
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
    // These assert the user is not left waiting forever, which holds today. They
    // do not cover the "file check timed out" message, which is lost in this
    // scenario (BMD-1189 defect 3): the upload page clears the message and then
    // fails to load, because it needs the uploader too. A fix may end this
    // journey somewhere other than the error page, so expect to update these
    // tests alongside it.
    async function assertFileCheckHandlesOutage({
      injectFault,
      toxiproxy,
      createProjectFlow,
      projectDashboardPage,
      uploadBaselineFilePage,
      uploadBaselineFileFlow,
      serviceErrorPage,
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

      await assertErrorPage(page, serviceErrorPage, {
        timeout: MAX_FILE_CHECK_ERROR_MS
      })

      await toxiproxy.reset()

      await uploadBaselineFileFlow.uploadFileAndWaitForSummary(
        id,
        BASELINE_FILE
      )
    }

    test('uploader lost during the file check ends on the error page, then the file can be uploaded again', async ({
      toxiproxy,
      createProjectFlow,
      projectDashboardPage,
      uploadBaselineFilePage,
      uploadBaselineFileFlow,
      serviceErrorPage,
      page
    }) => {
      await assertFileCheckHandlesOutage({
        injectFault: () => toxiproxy.takeDown(CDP_UPLOADER),
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFilePage,
        uploadBaselineFileFlow,
        serviceErrorPage,
        page
      })
    })

    test('uploader not answering during the file check ends on the error page without hanging, then the file can be uploaded again', async ({
      toxiproxy,
      createProjectFlow,
      projectDashboardPage,
      uploadBaselineFilePage,
      uploadBaselineFileFlow,
      serviceErrorPage,
      page
    }) => {
      await assertFileCheckHandlesOutage({
        injectFault: () => toxiproxy.hang(CDP_UPLOADER),
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFilePage,
        uploadBaselineFileFlow,
        serviceErrorPage,
        page
      })
    })
  })
})
