import { test, expect } from '@fixtures'
import { STORAGE_STATE, runMode } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import {
  assertErrorPage,
  assertHandlesOutage,
  assertRecovers,
  TOXIPROXY_SKIP_REASON
} from '@utils/resilience-checks.js'

const POSTGRES = 'postgres'
const PROJECT_LABEL = 'Resilience Postgres'
const BASELINE_FILE = 'Baseline - complete with area refs.gpkg'

// The frontend gives up on a backend call at 10s, but the error arrives on a
// form post here rather than on page.goto, so navigationTimeout doesn't bound it.
const MAX_SAVE_ERROR_MS = 25_000
// Includes the status polling before the file check starts, plus the frontend's
// 25s budget for the check itself.
const MAX_FILE_CHECK_ERROR_MS = 60_000
const FILE_CHECK_TEST_TIMEOUT_MS = 150_000

// Routes that load the project through fetchProjectOrThrow take a different path
// from the dashboard, and answer 502 where the dashboard answers 500 or 504. A
// project with no baseline moves on from the summary to the file-type selection
// page once it loads, so that page is what shows the service has recovered.
async function assertProjectSummaryHandlesOutage({
  injectFault,
  toxiproxy,
  createProjectFlow,
  projectDashboardPage,
  projectSummaryPage,
  uploadFilePage,
  serviceErrorPage,
  page
}) {
  const { id } = await setupProject(
    createProjectFlow,
    projectDashboardPage,
    PROJECT_LABEL
  )

  await injectFault()

  await projectSummaryPage.open(id)
  await assertErrorPage(page, serviceErrorPage)

  await toxiproxy.reset()

  await assertRecovers(
    () => projectSummaryPage.open(id),
    uploadFilePage.heading
  )
}

// Opening the name page doesn't read the database, so the fault lands on the
// save. The user then retries with the same name, as they would in real use,
// and must end up with exactly one project. If the insert held during a hang
// were completed once the fault cleared, the retry would make a second one and
// the count would fail: that duplicate is a real defect, so the count stays.
// Measured on 2026-11-06, the held insert never landed (3 runs, 25s each).
async function assertSaveHandlesOutage({
  injectFault,
  toxiproxy,
  createProjectFlow,
  projectDashboardPage,
  defineProjectNamePage,
  serviceErrorPage,
  page
}) {
  const name = `${PROJECT_LABEL} save ${Date.now()}`

  await defineProjectNamePage.open()
  await defineProjectNamePage.enterProjectName(name)
  await injectFault()
  await defineProjectNamePage.submit()
  await assertErrorPage(page, serviceErrorPage, { timeout: MAX_SAVE_ERROR_MS })

  await toxiproxy.reset()

  await assertRecovers(
    () => projectDashboardPage.open(),
    projectDashboardPage.createProjectButton
  )
  await createProjectFlow.createProject(name)
  await expect(projectDashboardPage.projectLink(name)).toHaveCount(1)
}

// Opening the upload page needs Postgres, so the fault lands after it. The
// browser posts the file to the uploader directly, so the upload still succeeds
// and only the backend's side of the file check fails.
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
  const { id } = await setupProject(
    createProjectFlow,
    projectDashboardPage,
    PROJECT_LABEL
  )

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

  await uploadBaselineFileFlow.uploadFileAndWaitForSummary(id, BASELINE_FILE)
}

test.describe('resilience', { tag: '@resilience' }, () => {
  test.describe('Postgres outage', { tag: '@regression' }, () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', TOXIPROXY_SKIP_REASON)

    test.describe('project dashboard', () => {
      test('Postgres refusing connections shows the error page, then recovers', async ({
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        serviceErrorPage,
        page
      }) => {
        await assertHandlesOutage({
          injectFault: () => toxiproxy.takeDown(POSTGRES),
          toxiproxy,
          createProjectFlow,
          projectDashboardPage,
          serviceErrorPage,
          page
        })
      })

      test('Postgres not answering shows the error page without hanging, then recovers', async ({
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        serviceErrorPage,
        page
      }) => {
        await assertHandlesOutage({
          injectFault: () => toxiproxy.hang(POSTGRES),
          toxiproxy,
          createProjectFlow,
          projectDashboardPage,
          serviceErrorPage,
          page
        })
      })
    })

    test.describe('project summary', () => {
      test('Postgres refusing connections shows the error page, then recovers', async ({
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        projectSummaryPage,
        uploadFilePage,
        serviceErrorPage,
        page
      }) => {
        await assertProjectSummaryHandlesOutage({
          injectFault: () => toxiproxy.takeDown(POSTGRES),
          toxiproxy,
          createProjectFlow,
          projectDashboardPage,
          projectSummaryPage,
          uploadFilePage,
          serviceErrorPage,
          page
        })
      })

      test('Postgres not answering shows the error page without hanging, then recovers', async ({
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        projectSummaryPage,
        uploadFilePage,
        serviceErrorPage,
        page
      }) => {
        await assertProjectSummaryHandlesOutage({
          injectFault: () => toxiproxy.hang(POSTGRES),
          toxiproxy,
          createProjectFlow,
          projectDashboardPage,
          projectSummaryPage,
          uploadFilePage,
          serviceErrorPage,
          page
        })
      })
    })

    test.describe('saving a new project', () => {
      test('Postgres refusing connections shows the error page, then the project can be saved once', async ({
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        defineProjectNamePage,
        serviceErrorPage,
        page
      }) => {
        await assertSaveHandlesOutage({
          injectFault: () => toxiproxy.takeDown(POSTGRES),
          toxiproxy,
          createProjectFlow,
          projectDashboardPage,
          defineProjectNamePage,
          serviceErrorPage,
          page
        })
      })

      test('Postgres not answering shows the error page without hanging, then the project can be saved once', async ({
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        defineProjectNamePage,
        serviceErrorPage,
        page
      }) => {
        await assertSaveHandlesOutage({
          injectFault: () => toxiproxy.hang(POSTGRES),
          toxiproxy,
          createProjectFlow,
          projectDashboardPage,
          defineProjectNamePage,
          serviceErrorPage,
          page
        })
      })
    })

    test.describe('file check', () => {
      test.describe.configure({ timeout: FILE_CHECK_TEST_TIMEOUT_MS })

      test('Postgres refusing connections shows the error page, then the file can be uploaded again', async ({
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFilePage,
        uploadBaselineFileFlow,
        serviceErrorPage,
        page
      }) => {
        await assertFileCheckHandlesOutage({
          injectFault: () => toxiproxy.takeDown(POSTGRES),
          toxiproxy,
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFilePage,
          uploadBaselineFileFlow,
          serviceErrorPage,
          page
        })
      })

      test('Postgres not answering shows the error page without hanging, then the file can be uploaded again', async ({
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFilePage,
        uploadBaselineFileFlow,
        serviceErrorPage,
        page
      }) => {
        await assertFileCheckHandlesOutage({
          injectFault: () => toxiproxy.hang(POSTGRES),
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
})
