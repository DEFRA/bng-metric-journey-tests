import { test, expect } from '@fixtures'
import { STORAGE_STATE, runMode } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import { ServiceErrorPage } from '@pages/service-error.page.js'

const POSTGRES = 'postgres'
const PROJECT_LABEL = 'Resilience'

// The frontend's backend timeout is 10s; the margin is for slower CI runners.
const MAX_ERROR_PAGE_MS = 20_000
const MAX_RECOVERY_MS = 15_000

// Runs the same checks for each fault: the error page arrives within a bound,
// then the user's project is readable again without restarting anything. The
// status code is deliberately not asserted — see the flow doc.
async function assertHandlesOutage({
  injectFault,
  toxiproxy,
  createProjectFlow,
  projectDashboardPage,
  serviceErrorPage,
  page
}) {
  const { name } = await setupProject(
    createProjectFlow,
    projectDashboardPage,
    PROJECT_LABEL
  )

  await injectFault()

  const startedAt = Date.now()
  await projectDashboardPage.open()
  const elapsedMs = Date.now() - startedAt

  await expect(page).toHaveTitle(ServiceErrorPage.title)
  await expect(serviceErrorPage.message).toBeVisible()
  expect(elapsedMs).toBeLessThan(MAX_ERROR_PAGE_MS)

  await toxiproxy.reset()

  await expect(async () => {
    await projectDashboardPage.open()
    await expect(projectDashboardPage.projectLink(name)).toBeVisible()
  }).toPass({ timeout: MAX_RECOVERY_MS })
}

test.describe('resilience', { tag: '@resilience' }, () => {
  test.describe(
    'Postgres outage — project dashboard',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(
        runMode === 'e2e',
        'Requires Toxiproxy in the Docker Compose stack — not available on CDP'
      )

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
    }
  )
})
